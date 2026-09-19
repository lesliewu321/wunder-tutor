// "Say it right": a photo of a page (or typed text) → the sentences to practise. For Chinese also the Simplified form
// the scorer needs, the Traditional form Hong Kong learners read, and the pinyin the tone checks need — read in
// context (好吃 hǎo chī, 银行 yín háng). Two steps: Gemini first finds the sentences and each one's language, then gives
// the Chinese ones their characters and pinyin, a few sentences per request, side by side. (All of it in one answer
// took 14 s for a 280-character page and could run past the answer-size limit on a full textbook page.) Every answer
// is checked before it is used: one pinyin syllable per character, the same characters in both scripts. A sentence
// that fails the checks is returned without pinyin, and the app won't offer it for Mandarin practice. Wunder Tutor
// stores neither the photo nor the text.

import { HttpError } from './http-error.mjs';

export const DEFAULT_READ_MODEL = 'gemini-3.8-flash';
const MAX_LINES = 40;
const MAX_LINE_CHARS = 160;
const MAX_TEXT_CHARS = 2000;
/** The whole read, pinyin and its retry included, finishes well inside the app's wait (60 s). */
const BUDGET_MS = 40_000;
const MAX_OUTPUT_TOKENS = 8192;
/**
 * Status for a read that failed at Google. Not 502/504: Cloudflare swaps a Function's 502 body for its own
 * "error code: 502" page, which hid the reason from the app (seen live on 2026-09-19).
 */
const UPSTREAM = 424;
/**
 * Pinyin requests: at most 6 at once (a Cloudflare Worker opens 6 connections at a time), each of about 45 Chinese
 * characters; a very long page gets bigger requests rather than more of them.
 */
const MAX_BATCHES = 6;
const BATCH_CHARS = 45;

const READ_INSTRUCTION = [
  'You prepare text for a pronunciation-practice app used by children and adults in Hong Kong.',
  'Return the text as sentences to practise, in reading order. Keep every word exactly as written: do not correct,',
  'translate, summarise or add anything. Leave out page numbers, running headers and anything that is not text to read.',
  'Split long lines into sentences of at most 120 characters. Join a sentence that continues onto the next printed line.',
  'A page may mix languages (Hong Kong signs, menus and school books often have English and Chinese): keep each',
  'language in its own sentences. No readable text: no sentences.',
  'Each sentence: text = the sentence exactly as written; lang = its language: "en" English, "zh" Chinese, "other"',
  '  anything else (French, Japanese, …).',
].join('\n');

const PINYIN_INSTRUCTION = [
  'You give the pinyin of Chinese sentences for a pronunciation-practice app used by children and adults in Hong Kong.',
  'For every numbered sentence: n = its number; chars = one entry for every Chinese character of the sentence, in',
  'order (skip punctuation):',
  '  t = the character in Traditional script, s = the same character in Simplified script,',
  '  py = its numbered pinyin as read in this sentence (多音字 by context), ü as v, tone 1–4, or 5 for a syllable that',
  '  standard Putonghua says light (neutral), as a dictionary marks it: 谢谢 xie4 xie5, 喜欢 xi3 huan5, 奶奶 nai3 nai5,',
  '  客气 ke4 qi5, 朋友 peng2 you5, 什么 shen2 me5, 东西 dong1 xi5 (thing), and particles 的 了 吗 呢 吧 着 们 = 5.',
  '  得 is dei3 when it means "must" (我得走了 wo3 dei3 zou3 le5), de2 "get" (得到), de5 after a verb (跑得快).',
  '  Otherwise the dictionary tone — no tone change for 3+3, 一 or 不. A number or symbol read aloud gets entries for',
  '  the characters it is read as (3 → 三 san1).',
].join('\n');

// Each sentence carries its own language: a page-wide label was unstable on bilingual pages (the same menu came back
// "zh" one time and "other" the next, and "other" turned the whole page away).
const LANGS = ['en', 'zh', 'other'];
const READ_SCHEMA = {
  type: 'OBJECT',
  properties: {
    lines: {
      type: 'ARRAY',
      items: { type: 'OBJECT', properties: { text: { type: 'STRING' }, lang: { type: 'STRING', enum: LANGS } }, required: ['text', 'lang'] },
    },
  },
  required: ['lines'],
};
const CHARS = { type: 'ARRAY', items: { type: 'OBJECT', properties: { t: { type: 'STRING' }, s: { type: 'STRING' }, py: { type: 'STRING' } }, required: ['t', 's', 'py'] } };
const PINYIN_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sentences: { type: 'ARRAY', items: { type: 'OBJECT', properties: { n: { type: 'INTEGER' }, chars: CHARS }, required: ['n', 'chars'] } },
  },
  required: ['sentences'],
};

const HAN = /\p{Script=Han}/u;
/** A letter of any other script: Latin, kana, hangul… */
const OTHER_LETTER = /(?!\p{Script=Han})\p{L}/u;
/**
 * Spelling slips the model keeps making, with the tone right: "de3" isn't a Mandarin syllable — 得 read with tone 3
 * is always děi ("must"). Seen in 2 of 32 fresh sentences even with the prompt line.
 */
const SLIPS = { '得de3': 'dei3' };

/**
 * A Chinese line is usable only if every character has exactly one entry, each entry is one character in each script
 * with a well-formed syllable, and the entries spell the sentence as written (in either script).
 */
export function checkChineseLine(line) {
  const text = String(line.text ?? '').trim();
  const chars = Array.isArray(line.chars) ? line.chars : [];
  const t = chars.map((c) => String(c?.t ?? '').trim()), s = chars.map((c) => String(c?.s ?? '').trim());
  const py = chars.map((c, i) => {
    const x = String(c?.py ?? '').trim().toLowerCase().replace(/ü/g, 'v');
    return SLIPS[`${s[i]}${x}`] ?? x;
  });
  const wellFormed = chars.length > 0
    && t.every((c) => [...c].length === 1 && HAN.test(c)) && s.every((c) => [...c].length === 1 && HAN.test(c))
    && py.every((x) => /^[a-z]{0,2}[aeiouv][a-z]{0,4}[1-5]$/.test(x));
  const spelt = wellFormed ? respell(text, t, s) : null;
  return spelt ? { text, traditional: spelt.trad, simplified: spelt.simp, pinyin: py.join(' ') } : { text };
}

const DIGIT = /[0-9０-９]/;
const NUMERAL = /[零〇一二三四五六七八九十百千万萬亿億两兩点點]/;

/**
 * The entries must be this very sentence: walking the text as written, every Chinese character is the next entry
 * (in either script) and a written number is a run of numeral entries. Returns the sentence in both scripts,
 * punctuation kept, numbers written out, emoji left out — or null if they disagree, or if the sentence also holds
 * letters of another script: scoring only the Chinese would quietly drop "Peppa Pig", or the kana of a Japanese line.
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
    } else if (OTHER_LETTER.test(c)) {
      return null;
    }
  }
  return k === t.length ? { trad: trad.trim(), simp: simp.trim() } : null;
}

/** The sentences found, normalised and capped. A sentence without a known language: "zh" if it has characters. */
export function cleanLines(raw) {
  let total = 0;
  const lines = [];
  for (const l of Array.isArray(raw?.lines) ? raw.lines : []) {
    const text = String(l?.text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_LINE_CHARS);
    if (!text) continue;
    if (lines.length >= MAX_LINES || total + text.length > MAX_TEXT_CHARS) break;
    total += text.length;
    lines.push({ text, lang: LANGS.includes(l?.lang) ? l.lang : HAN.test(text) ? 'zh' : 'en' });
  }
  return lines;
}

/** "none" (nothing to read), "other" (nothing in English or Chinese), else "zh" if any sentence is Chinese, else "en". */
export const pageLanguage = (lines) =>
  !lines.length ? 'none' : lines.some((l) => l.lang === 'zh') ? 'zh' : lines.some((l) => l.lang === 'en') ? 'en' : 'other';

/** Chinese sentences that could pass the checks (one with English or kana in it never will). */
const needsPinyin = (l) => l.lang === 'zh' && !l.pinyin && HAN.test(l.text) && !OTHER_LETTER.test(l.text);
const hanCount = (text) => [...text].filter((c) => HAN.test(c)).length;

/** Sentences grouped for the pinyin requests, in order. */
export function pinyinBatches(lines) {
  const total = lines.reduce((n, l) => n + hanCount(l.text), 0);
  const size = Math.max(BATCH_CHARS, Math.ceil(total / MAX_BATCHES));
  const batches = [];
  let cur = [], n = 0;
  for (const l of lines) {
    const c = hanCount(l.text);
    if (cur.length && n + c > size) { batches.push(cur); cur = []; n = 0; }
    cur.push(l);
    n += c;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

/** Fill in a batch's sentences from the model's answer; a sentence whose entries fail the checks stays without. */
export function applyPinyin(batch, answer) {
  for (const s of Array.isArray(answer?.sentences) ? answer.sentences : []) {
    const line = batch[Number(s?.n) - 1];
    if (line && !line.pinyin) Object.assign(line, checkChineseLine({ text: line.text, chars: s.chars }));
  }
}

/**
 * The photo as base64 for Gemini. Buffer (Node, and Workers with nodejs_compat) does it natively in about a
 * millisecond; the character-by-character fallback costs tens of milliseconds of a Worker's CPU time on a phone photo.
 */
const toBase64 = (bytes) => {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64');
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

/**
 * Read an image (`image: { bytes, mime }`) or prepare typed `text`. Chinese sentences that fail the checks get one
 * more try while there is time; any still failing come back without pinyin.
 * @returns {Promise<{ language: string, lines: { text: string, lang: string, traditional?: string, simplified?: string, pinyin?: string }[] }>}
 */
export async function readText({ apiKey, model = DEFAULT_READ_MODEL, image, text, thinking = 'low', fetchImpl = fetch }) {
  const started = Date.now();
  const left = () => BUDGET_MS - (Date.now() - started);
  const ask = (instruction, schema, parts) => askGemini({ apiKey, model, thinking, fetchImpl, instruction, schema, parts, budget: left() });

  const parts = image
    ? [{ inlineData: { mimeType: image.mime, data: toBase64(image.bytes) } }, { text: 'Read the text in this photo.' }]
    // Typed line breaks are the learner's own (a list of words, a poem): kept, unlike a printed page's wrapping.
    : [{ text: `Prepare this text, typed by a learner. Each of their lines stays separate: never join a line to the next.\n${String(text).slice(0, MAX_TEXT_CHARS)}` }];
  const lines = cleanLines(await ask(READ_INSTRUCTION, READ_SCHEMA, parts));

  let todo = lines.filter(needsPinyin);
  for (let round = 0; round < 2 && todo.length && left() > (round ? 10_000 : 3_000); round++) {
    await Promise.all(pinyinBatches(todo).map(async (batch) => {
      try {
        applyPinyin(batch, await ask(PINYIN_INSTRUCTION, PINYIN_SCHEMA, [{ text: batch.map((l, i) => `${i + 1}. ${l.text}`).join('\n') }]));
      } catch { /* these sentences stay without pinyin (or get the retry) */ }
    }));
    todo = todo.filter(needsPinyin);
  }
  return { language: pageLanguage(lines), lines };
}

async function askGemini({ apiKey, model, thinking, fetchImpl, instruction, schema, parts, budget }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1, budget));
  let res, raw;
  try {
    res = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instruction }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS, responseMimeType: 'application/json', responseSchema: schema, thinkingConfig: { thinkingLevel: thinking } },
      }),
    });
    raw = await res.text();
  } catch {
    throw new HttpError(UPSTREAM, controller.signal.aborted ? 'read_timeout' : 'read_upstream');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw upstreamError(res.status, raw);
  let body = null;
  try { body = JSON.parse(raw); } catch { /* reported below */ }
  const candidate = body?.candidates?.[0];
  const out = candidate?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? '').join('') ?? '';
  try { return JSON.parse(out); } catch { throw new HttpError(UPSTREAM, 'read_unparseable', { finish: candidate?.finishReason ?? body?.promptFeedback?.blockReason ?? null }); }
}

/**
 * Google refused the request: name the usual reasons, and keep Google's own words for the server log (never sent to
 * the app — they are Google's, not the learner's, but the app only needs the code).
 */
export function upstreamError(status, raw) {
  let message = '';
  try { message = String(JSON.parse(raw)?.error?.message ?? ''); } catch { message = String(raw ?? ''); }
  const code = /location is not supported/i.test(message) ? 'read_region'
    : /api key/i.test(message) ? 'read_key'
    : status === 404 ? 'read_model'
    : status === 429 ? 'read_quota'
    : 'read_upstream';
  const err = new HttpError(UPSTREAM, code, { status });
  err.upstreamMessage = message.replace(/\s+/g, ' ').slice(0, 200);
  return err;
}
