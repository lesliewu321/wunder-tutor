// Shared tooling for the accuracy gauntlet: synthetic "learner" takes from Gemini Live, scored by Azure.
// Everything is cached under eval/.cache (gitignored) so reruns are free and deterministic.
// Reads keys from the project's .env and never prints them.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = join(ROOT, 'eval', '.cache');
mkdirSync(join(CACHE, 'audio'), { recursive: true });
mkdirSync(join(CACHE, 'azure'), { recursive: true });

export const env = (() => {
  const out = {};
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*)$/.exec(line);
    if (m && m[2].trim()) out[m[1]] = m[2].trim();
  }
  return out;
})();

export const sha = (v) => createHash('sha1').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 16);

export const INSTRUCTIONS = {
  'en-US': 'Speak exactly the text after "SAY:", once, in clear, natural General American English. Add nothing, no greeting, no comment.',
  'en-GB': 'Speak exactly the text after "SAY:", once, in clear, natural standard southern British English. Add nothing, no greeting, no comment.',
  'zh-CN': 'Speak exactly the text after "SAY:", once, in clear standard Mandarin Chinese (Putonghua) with careful, correct tones. Add nothing, no greeting, no comment.',
};

// ------------------------------------------------------------------ Gemini Live → 24 kHz PCM

async function geminiOnce(text, instruction, voice) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`);
    ws.binaryType = 'arraybuffer';
    const chunks = [];
    let transcript = '';
    let rate = 24000;
    const t = setTimeout(() => { try { ws.close(); } catch { /* */ } reject(new Error('gemini timeout')); }, 40000);
    ws.addEventListener('open', () => ws.send(JSON.stringify({
      setup: {
        model: 'models/gemini-3.1-flash-live-preview',
        generationConfig: { responseModalities: ['AUDIO'], temperature: 0.2, speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } }, thinkingConfig: { thinkingLevel: 'minimal' } },
        systemInstruction: { parts: [{ text: instruction }] },
        outputAudioTranscription: {},
      },
    })));
    ws.addEventListener('message', (e) => {
      const msg = JSON.parse(typeof e.data === 'string' ? e.data : Buffer.from(e.data).toString('utf8'));
      if (msg.setupComplete) return ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: `SAY: ${text}` }] }], turnComplete: true } }));
      const sc = msg.serverContent;
      if (!sc) return;
      for (const p of sc.modelTurn?.parts ?? []) {
        if (p.inlineData?.data) { rate = Number(/rate=(\d+)/.exec(p.inlineData.mimeType ?? '')?.[1]) || rate; chunks.push(Buffer.from(p.inlineData.data, 'base64')); }
      }
      if (sc.outputTranscription?.text) transcript += sc.outputTranscription.text;
      if (sc.turnComplete || sc.generationComplete) { clearTimeout(t); try { ws.close(); } catch { /* */ } resolve({ pcm: Buffer.concat(chunks), rate, transcript: transcript.trim() }); }
    });
    ws.addEventListener('error', () => { clearTimeout(t); reject(new Error('gemini ws error')); });
    ws.addEventListener('close', (e) => { if (e.code !== 1000 && e.code !== 1005) { clearTimeout(t); reject(new Error(`gemini closed ${e.code} ${String(e.reason).slice(0, 120)}`)); } });
  });
}

/** Trim leading/trailing near-silence (16-bit mono PCM buffer). */
function trim(pcm, rate, threshold = 400) {
  const n = pcm.length >> 1;
  let s = 0; let e = n - 1;
  while (s < n && Math.abs(pcm.readInt16LE(s * 2)) < threshold) s++;
  while (e > s && Math.abs(pcm.readInt16LE(e * 2)) < threshold) e--;
  if (s >= e) return pcm;
  const pad = Math.floor(rate * 0.12);
  return pcm.subarray(Math.max(0, s - pad) * 2, Math.min(n, e + pad) * 2);
}

/**
 * A cached synthetic take. `voice` is a Gemini prebuilt voice; `locale` picks the accent instruction.
 * Returns { key, pcm (24k 16-bit mono Buffer), rate, transcript }.
 */
export async function take({ text, locale, voice = 'Kore', instruction }) {
  const instr = instruction ?? INSTRUCTIONS[locale];
  const key = sha({ text, instr, voice, model: 'gemini-3.1-flash-live-preview' });
  const file = join(CACHE, 'audio', `${key}.json`);
  if (existsSync(file)) {
    const meta = JSON.parse(readFileSync(file, 'utf8'));
    return { key, ...meta, pcm: readFileSync(join(CACHE, 'audio', `${key}.pcm`)) };
  }
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const out = await geminiOnce(text, instr, voice);
      if (!out.pcm.length) throw new Error('no audio');
      const pcm = trim(out.pcm, out.rate);
      writeFileSync(join(CACHE, 'audio', `${key}.pcm`), pcm);
      writeFileSync(file, JSON.stringify({ text, locale, voice, rate: out.rate, transcript: out.transcript }));
      return { key, text, locale, voice, rate: out.rate, transcript: out.transcript, pcm };
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); }
  }
  throw last;
}

/**
 * 16 kHz mono 16-bit WAV from a take. `speed` > 1 plays the take faster and higher —
 * F0 and formants both scale, a crude but useful stand-in for a child's smaller vocal tract.
 */
export function wav16k(pcm, rate, speed = 1) {
  const src = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.length >> 1);
  const step = (rate * speed) / 16000;
  const n = Math.floor(src.length / step);
  const out = Buffer.alloc(44 + n * 2);
  for (let i = 0; i < n; i++) {
    const x = i * step; const i0 = Math.floor(x); const f = x - i0;
    const v = src[i0] * (1 - f) + src[Math.min(i0 + 1, src.length - 1)] * f;
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v))), 44 + i * 2);
  }
  out.write('RIFF', 0); out.writeUInt32LE(36 + n * 2, 4); out.write('WAVEfmt ', 8); out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22); out.writeUInt32LE(16000, 24); out.writeUInt32LE(32000, 28);
  out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(n * 2, 40);
  return out;
}

// ------------------------------------------------------------------ Azure pronunciation assessment (cached)

export async function assess({ wav, reference, locale, extra = {} }) {
  const params = { ReferenceText: reference, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive', EnableMiscue: 'True', EnableProsodyAssessment: 'True', ...(locale === 'en-US' ? { PhonemeAlphabet: 'IPA' } : {}), ...extra };
  const key = sha({ audio: sha(wav.toString('base64')), params, locale });
  const file = join(CACHE, 'azure', `${key}.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  if (process.env.EVAL_OFFLINE) throw new Error('not cached (offline run)');
  let last;
  for (let attempt = 0; attempt < 5; attempt++) {
    let res;
    try {
      res = await fetch(`https://${env.AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${locale}&format=detailed`, {
        method: 'POST', body: wav, signal: AbortSignal.timeout(20000),
        headers: { 'Ocp-Apim-Subscription-Key': env.AZURE_SPEECH_KEY, 'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000', Accept: 'application/json', 'Pronunciation-Assessment': Buffer.from(JSON.stringify(params)).toString('base64') },
      });
    } catch (e) {
      // A dropped or stalled connection: try again rather than lose the case.
      last = e; await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue;
    }
    if (res.status === 429 || res.status >= 500) { last = new Error(`azure ${res.status}`); await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error(`azure ${res.status}`);
    const json = await res.json();
    writeFileSync(file, JSON.stringify(json));
    return json;
  }
  throw last;
}

/** Run async jobs with bounded concurrency, preserving order. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); }
  });
  await Promise.all(workers);
  return out;
}

export const nbest0 = (json) => json?.NBest?.[0] ?? null;
export const scores = (json) => { const b = nbest0(json); const pa = b?.PronunciationAssessment ?? b ?? {}; return { acc: pa.AccuracyScore, flu: pa.FluencyScore, comp: pa.CompletenessScore, pron: pa.PronScore, pros: pa.ProsodyScore }; };
export const words = (json) => (nbest0(json)?.Words ?? []).map((w) => {
  const pa = w.PronunciationAssessment ?? w;
  return {
    word: w.Word, score: pa.AccuracyScore, error: pa.ErrorType, offset: w.Offset, duration: w.Duration,
    phonemes: (w.Phonemes ?? []).map((p) => ({ ph: p.Phoneme, score: (p.PronunciationAssessment ?? p).AccuracyScore, nbest: (p.PronunciationAssessment?.NBestPhonemes ?? p.NBestPhonemes ?? []).map((n) => `${n.Phoneme}:${n.Score}`), offset: p.Offset, duration: p.Duration })),
    syllables: (w.Syllables ?? []).map((s) => ({ syl: s.Syllable, g: s.Grapheme, score: (s.PronunciationAssessment ?? s).AccuracyScore })),
  };
});
