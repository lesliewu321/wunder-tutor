// "Say it right": a photo of a page (or typed text) → the sentences to practise. For Chinese also the Simplified form
// the scorer needs, the Traditional form Hong Kong learners read, and the pinyin the tone checks need — read in
// context (好吃 hǎo chī, 银行 yín háng). Gemini reads; every answer is checked before it is used: one pinyin syllable
// per character, the same characters in both scripts. A line that fails the checks is returned without pinyin, and
// the app won't offer it for Mandarin practice. Nothing is stored.

import { HttpError } from './http-error.mjs';

export const DEFAULT_READ_MODEL = 'gemini-3.8-flash';
const MAX_LINES = 40;
const MAX_LINE_CHARS = 160;
const MAX_TEXT_CHARS = 2000;
const TIMEOUT_MS = 30_000;

const INSTRUCTION = [
  'You prepare text for a pronunciation-practice app used by children and adults in Hong Kong.',
  'Return the text as sentences to practise, in reading order. Keep every word exactly as written: do not correct,',
  'translate, summarise or add anything. Leave out page numbers, running headers and anything that is not text to read.',
  'Split long lines into sentences of at most 120 characters. Join a sentence that continues onto the next printed line.',
  'language: "en" (English), "zh" (Chinese), "other" (another language) or "none" (no readable text).',
  'Each sentence: text = the sentence exactly as written.',
  'Chinese only — chars: one entry for every Chinese character of the sentence, in order (skip punctuation):',
  '  t = the character in Traditional script, s = the same character in Simplified script,',
  '  py = its numbered pinyin as read in this sentence (多音字 by context), ü as v, tone 1–4, or 5 for a syllable that',
  '  standard Putonghua says light (neutral), as a dictionary marks it: 谢谢 xie4 xie5, 喜欢 xi3 huan5, 奶奶 nai3 nai5,',
  '  客气 ke4 qi5, 朋友 peng2 you5, 什么 shen2 me5, 东西 dong1 xi5 (thing), and particles 的 了 吗 呢 吧 着 们 = 5.',
  '  Otherwise the dictionary tone — no tone change for 3+3, 一 or 不. A number or symbol read aloud gets entries for',
  '  the characters it is read as (3 → 三 san1).',
].join('\n');

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    language: { type: 'STRING', enum: ['en', 'zh', 'other', 'none'] },
    lines: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          chars: { type: 'ARRAY', items: { type: 'OBJECT', properties: { t: { type: 'STRING' }, s: { type: 'STRING' }, py: { type: 'STRING' } }, required: ['t', 's', 'py'] } },
        },
        required: ['text'],
      },
    },
  },
  required: ['language', 'lines'],
};

const HAN = /\p{Script=Han}/u;

/**
 * A Chinese line is usable only if every character has exactly one entry, each entry is one character in each script
 * with a well-formed syllable, and the entries spell the sentence as written (in either script).
 */
export function checkChineseLine(line) {
  const text = String(line.text ?? '').trim();
  const chars = Array.isArray(line.chars) ? line.chars : [];
  const t = chars.map((c) => String(c?.t ?? '').trim()), s = chars.map((c) => String(c?.s ?? '').trim());
  const py = chars.map((c) => String(c?.py ?? '').trim().toLowerCase().replace(/ü/g, 'v'));
  const wellFormed = chars.length > 0
    && t.every((c) => [...c].length === 1 && HAN.test(c)) && s.every((c) => [...c].length === 1 && HAN.test(c))
    && py.every((x) => /^[a-z]{1,6}[1-5]$/.test(x));
  const spelt = wellFormed ? respell(text, t, s) : null;
  return spelt ? { text, traditional: spelt.trad, simplified: spelt.simp, pinyin: py.join(' ') } : { text };
}

const DIGIT = /[0-9０-９]/;
const NUMERAL = /[零〇一二三四五六七八九十百千万萬亿億两兩点點]/;

/**
 * The entries must be this very sentence: walking the text as written, every Chinese character is the next entry
 * (in either script) and a written number is a run of numeral entries. Returns the sentence in both scripts,
 * punctuation kept, numbers written out, anything else (Latin letters, emoji) left out — or null if they disagree.
 */
function respell(text, t, s) {
  const src = [...text];
  let k = 0, trad = '', simp = '';
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (HAN.test(c)) {
      if (k >= t.length || (t[k] !== c && s[k] !== c)) return null;
      trad += t[k]; simp += s[k]; k++;
    } else if (DIGIT.test(c)) {
      while (i + 1 < src.length && /[0-9０-９.,]/.test(src[i + 1])) i++;
      const next = src.slice(i + 1).find((x) => HAN.test(x));
      let used = 0;
      while (k < t.length && NUMERAL.test(s[k]) && !(used > 0 && next && (t[k] === next || s[k] === next))) { trad += t[k]; simp += s[k]; k++; used++; }
      if (!used) return null;
    } else if (/[\p{P}\s]/u.test(c)) {
      trad += c; simp += c;
    }
  }
  return k === t.length ? { trad: trad.trim(), simp: simp.trim() } : null;
}

/** Normalise and check the model's answer. */
export function cleanReading(raw) {
  const language = ['en', 'zh', 'other', 'none'].includes(raw?.language) ? raw.language : 'none';
  let total = 0;
  const lines = [];
  for (const l of Array.isArray(raw?.lines) ? raw.lines : []) {
    const text = String(l?.text ?? l?.traditional ?? l?.simplified ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LINE_CHARS);
    if (!text) continue;
    if (lines.length >= MAX_LINES || total + text.length > MAX_TEXT_CHARS) break;
    total += text.length;
    lines.push(language === 'zh' ? checkChineseLine({ ...l, text }) : { text });
  }
  return { language, lines };
}

const toBase64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/**
 * Ask Gemini to read an image (`image: { bytes, mime }`) or prepare typed `text`. Chinese lines that fail the checks
 * get one more try, as typed text; any still failing come back without pinyin.
 * @returns {Promise<{ language: string, lines: { text: string, traditional?: string, simplified?: string, pinyin?: string }[] }>}
 */
export async function readText(opts) {
  const first = await readOnce(opts);
  const failed = first.language === 'zh' ? first.lines.filter((l) => !l.pinyin && HAN.test(l.text)) : [];
  if (!failed.length) return first;
  let again;
  try { again = await readOnce({ ...opts, image: undefined, text: failed.map((l) => l.text).join('\n') }); } catch { return first; }
  const fixed = new Map(again.lines.filter((l) => l.pinyin).map((l) => [l.text.replace(/\s/g, ''), l]));
  return { ...first, lines: first.lines.map((l) => (l.pinyin ? l : fixed.get(l.text.replace(/\s/g, '')) ?? l)) };
}

async function readOnce({ apiKey, model = DEFAULT_READ_MODEL, image, text, thinking = 'low', fetchImpl = fetch }) {
  const parts = image
    ? [{ inlineData: { mimeType: image.mime, data: toBase64(image.bytes) } }, { text: 'Read the text in this photo.' }]
    : [{ text: `Prepare this text, typed by a learner:\n${String(text).slice(0, MAX_TEXT_CHARS)}` }];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res;
  try {
    res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: INSTRUCTION }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA, thinkingConfig: { thinkingLevel: thinking } },
      }),
    });
  } catch {
    throw new HttpError(controller.signal.aborted ? 504 : 502, controller.signal.aborted ? 'read_timeout' : 'read_upstream');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new HttpError(502, 'read_upstream', { status: res.status });
  const body = await res.json().catch(() => null);
  const out = body?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  try { return cleanReading(JSON.parse(out)); } catch { throw new HttpError(502, 'read_unparseable'); }
}
