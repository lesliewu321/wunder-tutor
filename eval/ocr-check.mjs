// "Say it right" — reading a photo of a page. Pages with known text (English, Traditional and Simplified Chinese) are
// rendered as images, clean and "phone photo" (tilted, blurred, uneven light, grain, JPEG), then read by the
// production reader (server/read.mjs). Measures characters read wrongly (edit distance) and, for Chinese, whether the
// pinyin that comes back is right. Plain Node (vite-node's network stalls on Gemini here):
//   node eval/ocr-check.mjs [--model=gemini-3.8-flash] [--thinking=low]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE, env, ROOT } from './lib.mjs';
import { readText } from '../server/read.mjs';

const require = createRequire(join(ROOT, 'site', 'package.json'));
const sharp = require('sharp');
const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const model = arg('model', 'gemini-3.8-flash'), thinking = arg('thinking', 'low');
const OUT = join(CACHE, 'ocr');
mkdirSync(OUT, { recursive: true });

const poly = JSON.parse(readFileSync(new URL('./zh-polyphones.json', import.meta.url), 'utf8'));
const course = JSON.parse(readFileSync(join(CACHE, 'zh-items.json'), 'utf8')).filter((i) => [...i.text].length >= 4).slice(0, 12);
const PAGES = [
  { id: 'en-story', font: 'Georgia', size: 36, lang: 'en', lines: [
    'Once upon a time, a little fox lived in a big forest.',
    'Every morning she ran to the river to drink cool water.',
    'One day, she saw a shiny red apple on the grass.',
    '“Is this for me?” she asked the old tree.',
    'The tree laughed. “Yes, little fox. Share it with your friends.”',
    'So the fox called the rabbit, the bird and the bear.',
    'They sat together and shared the sweet red apple.',
    'It was the best breakfast they had ever had.',
  ] },
  { id: 'zh-hant', font: 'Microsoft JhengHei', size: 40, lang: 'zh', lines: poly.slice(0, 14).map((p) => p.hant), py: poly.slice(0, 14) },
  { id: 'zh-hans', font: 'Microsoft YaHei', size: 40, lang: 'zh', lines: course.map((c) => c.text), py: course.map((c) => ({ hant: c.text, py: c.py })) },
];

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const render = (page) => {
  const lh = Math.round(page.size * 1.8), w = 1400, h = 160 + lh * page.lines.length;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#fbf7ec"/>`
    + `<text x="${w / 2}" y="60" font-family="Arial" font-size="22" fill="#999" text-anchor="middle">— 12 —</text>`
    + page.lines.map((l, i) => `<text x="80" y="${130 + i * lh}" font-family="${page.font}" font-size="${page.size}" fill="#1e1e1e">${esc(l)}</text>`).join('')
    + '</svg>';
};

async function photo(png) {
  const img = sharp(png);
  const { width, height } = await img.metadata();
  // Grain: a random greyscale layer multiplied in.
  const grain = Buffer.alloc(width * height);
  let seed = 3;
  for (let i = 0; i < grain.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; grain[i] = 215 + (seed % 41); }
  const noisy = await sharp(png).composite([{ input: grain, raw: { width, height, channels: 1 }, blend: 'multiply' }]).png().toBuffer();
  return sharp(noisy).rotate(4, { background: '#6d6a60' }).blur(1.1).modulate({ brightness: 0.88 }).linear(0.85, 12)
    .resize({ width: 1000 }).jpeg({ quality: 55 }).toBuffer();
}

/** Harder: steeper tilt, a shadow across half the page, heavy blur, low resolution, strong JPEG. */
async function hard(png) {
  const { width, height } = await sharp(png).metadata();
  const shade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff"/><stop offset="0.45" stop-color="#fff"/><stop offset="1" stop-color="#8a8274"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`);
  const shaded = await sharp(png).composite([{ input: shade, blend: 'multiply' }]).png().toBuffer();
  return sharp(await photo(shaded)).rotate(5, { background: '#4d4a42' }).blur(1.6).resize({ width: 700 }).jpeg({ quality: 40 }).toBuffer();
}

const lev = (a, b) => {
  const x = [...a], y = [...b];
  let prev = Array.from({ length: y.length + 1 }, (_, j) => j);
  for (let i = 1; i <= x.length; i++) {
    const cur = [i];
    for (let j = 1; j <= y.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[y.length];
};
const norm = (s, lang) => (lang === 'zh' ? [...s].filter((c) => /\p{Script=Han}/u.test(c)).join('') : s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim());

for (const page of PAGES) {
  const png = await sharp(Buffer.from(render(page))).png().toBuffer();
  for (const variant of ['clean', 'photo', 'hard']) {
    const bytes = variant === 'clean' ? png : variant === 'photo' ? await photo(png) : await hard(png);
    writeFileSync(join(OUT, `${page.id}-${variant}.${variant === 'clean' ? 'png' : 'jpg'}`), bytes);
    const t0 = Date.now();
    let got;
    try { got = await readText({ apiKey: env.GEMINI_API_KEY, model, thinking, image: { bytes: new Uint8Array(bytes), mime: variant === 'clean' ? 'image/png' : 'image/jpeg' } }); } catch (e) { console.log(`${page.id} ${variant}: error`, e.body ?? e.message); continue; }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    const truth = norm(page.lines.join(page.lang === 'zh' ? '' : ' '), page.lang);
    const read = norm(got.lines.map((l) => l.text).join(page.lang === 'zh' ? '' : ' '), page.lang);
    const cer = lev(read, truth) / Math.max(1, [...truth].length);
    let pyNote = '';
    if (page.py) {
      // Pinyin of everything read, against the known pinyin of the page, syllable by syllable.
      const want = page.py.flatMap((p) => p.py.split(' ')), have = got.lines.flatMap((l) => (l.pinyin ? l.pinyin.split(' ') : []));
      const ok = want.filter((w, i) => have[i] === w).length;
      const unusable = got.lines.filter((l) => !l.pinyin).length;
      pyNote = `; pinyin ${ok}/${want.length} syllables right${unusable ? `, ${unusable} line(s) unusable` : ''}`;
    }
    console.log(`${page.id.padEnd(8)} ${variant.padEnd(5)}: language ${got.language}, ${got.lines.length} lines, characters wrong ${(100 * cer).toFixed(1)}%${pyNote} (${secs} s)`);
    if (cer > 0) console.log(`    read: ${read.slice(0, 160)}\n    want: ${truth.slice(0, 160)}`);
  }
}
