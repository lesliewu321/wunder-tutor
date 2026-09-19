// "Say it right" — does reading Chinese text give the scorer the right characters and the tone checks the right
// pinyin? Every Mandarin course item (hand-checked Simplified + pinyin) is sent as the Traditional text a Hong Kong
// book would print, through the production reader (server/read.mjs), in batches like a page of text.
// Plain Node (vite-node's network stalls on Gemini here):
//   npx vite-node eval/dump-zh-items.ts && node eval/read-check.mjs [--model=gemini-3.8-flash] [--thinking=low]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE, env } from './lib.mjs';
import { readText } from '../server/read.mjs';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const model = arg('model', 'gemini-3.8-flash'), thinking = arg('thinking', 'low');
// --set=polyphones: harder sentences whose characters change reading with the word (eval/zh-polyphones.json).
const set = arg('set', 'course');
const source = set === 'polyphones' ? JSON.parse(readFileSync(new URL('./zh-polyphones.json', import.meta.url), 'utf8')) : JSON.parse(readFileSync(join(CACHE, 'zh-items.json'), 'utf8'));
const items = [...new Map(source.map((i) => [i.hant, i])).values()];
const BATCH = 10;

let lines = 0, usable = 0, simpOk = 0, syl = 0, sylOk = 0, toneOk = 0, lightDiff = 0, ms = 0, calls = 0, failed = 0;
const wrong = [];
for (let b = 0; b < items.length; b += BATCH) {
  const batch = items.slice(b, b + BATCH);
  const t0 = Date.now();
  let got;
  try { got = await readText({ apiKey: env.GEMINI_API_KEY, model, thinking, text: batch.map((i) => i.hant).join('\n') }); } catch (e) { failed++; console.log('error', e.body ?? e.message); continue; }
  ms += Date.now() - t0; calls++;
  for (const it of batch) {
    lines++;
    // The reader may split a line into sentences ("你好！" + "你想喝什麼？"): join a run of lines that spells it.
    const flat = (x) => x.replace(/\s/g, '');
    let line = null;
    for (let i = 0; i < got.lines.length && !line; i++) {
      for (let j = i; j < got.lines.length; j++) {
        const run = got.lines.slice(i, j + 1);
        if (flat(run.map((l) => l.text).join('')) !== flat(it.hant)) continue;
        line = run.every((l) => l.pinyin)
          ? { text: run.map((l) => l.text).join(''), simplified: run.map((l) => l.simplified).join(''), pinyin: run.map((l) => l.pinyin).join(' ') }
          : { text: it.hant };
        break;
      }
    }
    if (!line?.pinyin) {
      const near = got.lines.filter((l) => [...it.hant].some((c) => l.text.includes(c))).map((l) => `${l.text} [${l.lang}${l.pinyin ? ` ${l.pinyin}` : ''}]`);
      wrong.push(`UNUSABLE ${it.hant} → ${line ? 'no pinyin' : 'not found'}; read as: ${near.join(' / ') || '(nothing)'}`);
      continue;
    }
    usable++;
    if (line.simplified === it.text) simpOk++; else wrong.push(`SIMPLIFIED ${it.hant}: got ${line.simplified}, want ${it.text}`);
    const want = it.py.split(' '), have = line.pinyin.split(' ');
    want.forEach((w, i) => {
      const h = have[i] ?? '';
      syl++;
      if (h.slice(0, -1) === w.slice(0, -1)) sylOk++;
      if (h === w) toneOk++;
      else if (h.slice(0, -1) === w.slice(0, -1) && (h.endsWith('5') || w.endsWith('5'))) lightDiff++;
      if (h !== w) wrong.push(`PINYIN ${it.hant}: ${w} → ${h}`);
    });
  }
}
const pct = (a, n) => `${((100 * a) / Math.max(1, n)).toFixed(1)}%`;
console.log(`${set}: ${model} (thinking ${thinking}): ${lines} items in ${calls} requests (${failed} failed), ${(ms / Math.max(1, calls) / 1000).toFixed(1)} s each`);
console.log(`usable ${pct(usable, lines)}; Simplified exactly right ${pct(simpOk, usable)}; syllables right ${pct(sylOk, syl)}; syllable + tone right ${pct(toneOk, syl)} (of which light-tone disagreements ${lightDiff})`);
for (const w of wrong.slice(0, 30)) console.log(`  ${w}`);
