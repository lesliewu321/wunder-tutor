// Teacher voice through the Gemini Live API (native audio), used as a strict text-to-speech engine.
//
// A Live model is a conversational model, not a TTS engine, so three things keep it honest:
//   1. the system instruction allows nothing but the requested words,
//   2. the model's own output transcription is checked against the request (up to three takes — a reference
//      pronunciation that ad-libs is worse than none — then the backup voice reads the line: azure-tts.mjs), and a
//      take that runs on far longer than the line could (the model glitching) is cut off and tried again,
//   3. accepted audio is cached on disk, so every learner hears the same take and each phrase is
//      generated (and paid for) once.
//
// Only text is ever sent to Google from here — lesson text, or a sentence a learner chose to practise ("Say it
// right") — never a child's voice. A learner's own sentences are spoken but never stored in the shared cache.
// Setup / message shapes follow https://ai.google.dev/gemini-api/docs/live-guide (raw WebSocket).

// Runtime-neutral: runs under Node and Cloudflare Workers (nodejs_compat supplies Buffer and node:crypto).
// Storage and the WebSocket dialer are injected — see server/index.mjs and functions/api/[[path]].js.
import { createHash } from 'node:crypto';

const DEFAULT_ENDPOINT =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';
export const DEFAULT_LIVE_MODEL = 'gemini-3.1-flash-live-preview';
export const DEFAULT_VOICE = 'Kore';
export const MAX_TTS_CHARS = 200;
const OUTPUT_RATE = 24000;

export class TtsError extends Error {
  constructor(code, status = 502, detail) {
    super(code);
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

// ------------------------------------------------------------------ prompt

export function buildInstruction({ accent, slow, kind }) {
  if (accent === 'zh-CN') {
    return [
      'You are the recorded model voice inside a pronunciation app for children learning Mandarin Chinese (Putonghua).',
      'Each user message is one line starting with "SAY:". Speak exactly the Chinese text after "SAY:", once, in clear, warm, standard Putonghua (Beijing standard, as on mainland school recordings), with careful and correct tones on every syllable and natural tone changes (for example 你好 is said ní hǎo).',
      'Never add, remove or change a character. No greeting, no comment, no question, no English, no sound effects.',
      slow
        ? 'Speak slowly and deliberately, about half normal speed, giving every syllable its full tone, without distorting it.'
        : 'Speak at a calm, natural pace.',
    ].join(' ');
  }
  if (accent === 'fr-FR') {
    return [
      'You are the recorded model voice inside a pronunciation app for people learning French.',
      'Each user message is one line starting with "SAY:". Speak exactly the French text after "SAY:", once, in clear, warm, standard European French (as spoken in Paris, on a school recording).',
      // The three things a learner is listening for, and the three a generative voice is most likely to smooth over.
      'Keep the nasal vowels distinct (pain, paon and pont must not sound alike), use the uvular r throughout, and leave silent final consonants silent.',
      'Never add, remove or change a word. No greeting, no comment, no question, no English, no sound effects.',
      slow
        ? 'Speak slowly and deliberately, about half normal speed, with a short pause between words, without distorting any vowel.'
        : 'Speak at a calm, natural pace, with the liaisons a French speaker would naturally make.',
    ].join(' ');
  }
  if (accent === 'ja-JP') {
    return [
      'You are the recorded model voice inside a pronunciation app for children learning Japanese.',
      'Each user message is one line starting with "SAY:". Speak exactly the Japanese text after "SAY:", once, in clear, warm, standard Japanese (Tokyo), as on a school recording.',
      // The beats a learner is listening for, and the ones a generative voice is most likely to rush.
      'Give every beat its full length: hold long vowels (ー, おばあさん) for two beats, keep the small っ as a clear pause, and give ん a beat of its own. Use the flapped Japanese r.',
      'Never add, remove or change a word. No greeting, no comment, no question, no English, no sound effects.',
      slow
        ? 'Speak slowly and deliberately, about half normal speed, beat by beat, without distorting any sound.'
        : 'Speak at a calm, natural pace.',
    ].join(' ');
  }
  const accentName = accent === 'en-GB' ? 'standard southern British English' : 'General American English';
  return [
    'You are the recorded model voice inside a pronunciation app for children learning English.',
    `Each user message is one line starting with "SAY:". Speak exactly the text after "SAY:", once, in clear, warm, natural ${accentName}.`,
    'Never add, remove or change a word. No greeting, no comment, no question, no sound effects, no spelling out letters.',
    kind === 'syllable'
      ? 'The text is a phonetic respelling of a single syllable for phonics practice (for example "rah" or "thee"). Say that one syllable naturally, as a single short sound.'
      : 'Pronounce every sound fully, including word endings.',
    slow
      ? 'Speak slowly and deliberately, about half normal speed, with a short pause between words, keeping each sound natural and undistorted.'
      : 'Speak at a calm, natural pace.',
  ].join(' ');
}

// ------------------------------------------------------------------ transcript check

const NUMBERS = { 0: 'zero', 1: 'one', 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten' };
const CHATTER = new Set(['sure', 'okay', 'ok', 'certainly', 'hello', 'hi', 'here', 'say', 'saying', 'repeat', 'great', 'alright', 'absolutely', 'course']);

export const tokens = (s) =>
  String(s).toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean).map((t) => NUMBERS[t] ?? t);

/**
 * Did the model say what we asked, and nothing else? Transcription of short or unusual words is
 * imperfect, so this tolerates mis-hearings but not extra speech.
 */
const han = (s) => [...String(s)].filter((c) => /\p{Script=Han}/u.test(c));

const kana = (s) => [...String(s)].filter((c) => /[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(c));

export function transcriptMatches(expected, heard) {
  if (kana(expected).length) {
    // Japanese: the transcript may write a word in kanji that the line has in kana (みず / 水), or the reverse, so it
    // cannot be compared letter by letter — only checked for what must never be served: English, or a lot of extra
    // speech (a greeting, a comment).
    if (!String(heard).trim()) return true;
    if (/[a-z]{3,}/i.test(heard)) return false;
    const size = (t) => kana(t).length + han(t).length * 2;
    return size(heard) <= size(expected) * 2 + 2;
  }
  if (han(expected).length) {
    // Mandarin: the transcript may use Traditional forms or a homophone for a lone syllable, so compare loosely —
    // but never accept extra speech (a greeting, a comment in English).
    const want = han(expected);
    const got = han(heard);
    if (!String(heard).trim()) return true;
    if (/[a-z]{3,}/i.test(heard)) return false;
    if (got.length > want.length + 1) return false;
    if (want.length <= 2) return true;
    return want.filter((c) => got.includes(c)).length / want.length >= 0.5;
  }
  const want = tokens(expected);
  const got = tokens(heard);
  if (!got.length) return true; // no transcription delivered — nothing to contradict the audio
  if (got.some((t) => CHATTER.has(t) && !want.includes(t))) return false;
  if (got.length > want.length + 2) return false;
  if (want.length <= 1) return true; // single words / syllables: length and chatter checks are all we can trust
  const found = want.filter((t) => got.includes(t)).length;
  return found / want.length >= 0.6;
}

// ------------------------------------------------------------------ audio

/** Trim leading/trailing near-silence from 16-bit mono PCM, keeping a little padding. */
export function trimSilence(pcm, rate = OUTPUT_RATE, threshold = 500) {
  const samples = Math.floor(pcm.length / 2);
  let start = 0;
  let end = samples - 1;
  while (start < samples && Math.abs(pcm.readInt16LE(start * 2)) < threshold) start += 1;
  while (end > start && Math.abs(pcm.readInt16LE(end * 2)) < threshold) end -= 1;
  if (start >= end) return pcm;
  const pad = Math.floor(rate * 0.08);
  return pcm.subarray(Math.max(0, start - pad) * 2, Math.min(samples, end + pad) * 2);
}

export function pcmToWav(pcm, rate = OUTPUT_RATE) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

// ------------------------------------------------------------------ one Live session = one utterance

const decodeFrame = (data) => (typeof data === 'string' ? data : Buffer.from(data).toString('utf8'));

/**
 * Opens a Live session, speaks one line, returns raw PCM + the model's transcript of itself.
 * `connect(url)` is injectable: it may return a socket, a promise of one, or `{ socket, alreadyOpen: true }`
 * (Cloudflare's fetch-upgrade sockets are open by the time they are handed over). Default: the runtime's
 * WebSocket (Node 22+).
 */
export async function synthesizeOnce({ apiKey, model, voiceName, text, accent, slow, kind, endpoint, connect, timeoutMs = 25_000, firm = false, maxAudioSeconds = Infinity }) {
  const open = connect ?? ((url) => new WebSocket(url));
  let ws;
  let alreadyOpen = false;
  try {
    const dialled = await open(`${endpoint || DEFAULT_ENDPOINT}?key=${encodeURIComponent(apiKey)}`);
    ws = dialled?.socket ?? dialled;
    alreadyOpen = dialled?.alreadyOpen === true;
  } catch {
    throw new TtsError('gemini_connect_failed');
  }
  try { if ('binaryType' in ws) ws.binaryType = 'arraybuffer'; } catch { /* read-only on some runtimes */ }

  return new Promise((resolvePromise, reject) => {

    const chunks = [];
    let bytes = 0;
    let transcript = '';
    let rate = OUTPUT_RATE;
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(1000, 'done'); } catch { /* already closed */ }
      if (err) reject(err); else resolvePromise(value);
    };
    const timer = setTimeout(() => finish(new TtsError('gemini_timeout', 504)), timeoutMs);

    const sendSetup = () => {
      ws.send(JSON.stringify({
        setup: {
          model: `models/${model}`,
          generationConfig: {
            responseModalities: ['AUDIO'],
            temperature: 0.2,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
            thinkingConfig: { thinkingLevel: 'minimal' },
          },
          systemInstruction: { parts: [{ text: buildInstruction({ accent, slow, kind }) + (firm ? ' Your previous attempt added or changed words. Say ONLY the text after "SAY:".' : '') }] },
          outputAudioTranscription: {},
        },
      }));
    };
    // A socket may already be open by the time it reaches us (fetch-upgrade, or a fast local dial).
    if (alreadyOpen || ws.readyState === 1) sendSetup(); else ws.addEventListener('open', sendSetup);

    ws.addEventListener('message', (event) => {
      let msg;
      try { msg = JSON.parse(decodeFrame(event.data)); } catch { return; }
      if (msg.setupComplete) {
        ws.send(JSON.stringify({ clientContent: { turns: [{ role: 'user', parts: [{ text: `SAY: ${text}` }] }], turnComplete: true } }));
        return;
      }
      const sc = msg.serverContent;
      if (!sc) return;
      for (const part of sc.modelTurn?.parts ?? []) {
        const inline = part.inlineData;
        if (inline?.data && String(inline.mimeType ?? '').startsWith('audio/pcm')) {
          rate = Number(/rate=(\d+)/.exec(inline.mimeType)?.[1]) || rate;
          const chunk = Buffer.from(inline.data, 'base64');
          chunks.push(chunk);
          bytes += chunk.length;
          // A glitching voice streams on long after the line is said (19.6 s of audio for a 2 s line, the transcript
          // stopping at the second word): stop listening instead of waiting it out, so there is time to try again.
          if (bytes / 2 / rate > maxAudioSeconds) { finish(new TtsError('gemini_runaway')); return; }
        }
      }
      if (sc.outputTranscription?.text) transcript += sc.outputTranscription.text;
      if (sc.turnComplete || sc.generationComplete) {
        if (!chunks.length) finish(new TtsError('gemini_no_audio'));
        else finish(null, { pcm: Buffer.concat(chunks), sampleRate: rate, transcript: transcript.trim() });
      }
    });

    ws.addEventListener('error', () => finish(new TtsError('gemini_connect_failed')));
    ws.addEventListener('close', (event) => {
      if (settled) return;
      // 1007/1008 are how the Live API reports a bad key, model or setup message.
      const code = event?.code;
      finish(new TtsError(code === 1008 || code === 1007 ? 'gemini_rejected' : 'gemini_closed', 502, { code, reason: String(event?.reason ?? '').slice(0, 200) }));
    });
  });
}

// ------------------------------------------------------------------ service: validation, cache, retry, budget

/**
 * @param {{ get(key: string): Promise<Uint8Array|Buffer|null|undefined>, put(key: string, wav: Buffer): Promise<void> }} [opts.cache]
 *   Durable store for accepted takes (disk under Node, KV on Cloudflare). Optional.
 */
/** 24 kHz 16-bit mono PCM → 16 kHz WAV, the format the speech scorer takes. */
export function toWav16k(pcm, rate) {
  const n = Math.floor(((pcm.length >> 1) * 16000) / rate);
  const out = Buffer.alloc(n * 2);
  const step = rate / 16000;
  const src = (i) => pcm.readInt16LE(Math.min((pcm.length >> 1) - 1, i) * 2);
  for (let i = 0; i < n; i++) {
    const x = i * step, i0 = Math.floor(x), f = x - i0;
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(src(i0) * (1 - f) + src(i0 + 1) * f))), i * 2);
  }
  return pcmToWav(out, 16000);
}

/**
 * @param {(wav16k: Buffer, text: string, locale: string, opts?: { reader?: boolean }) => Promise<boolean>} [opts.verify]
 *   Optional quality gate for a new take (the server wires Azure scoring in for Mandarin): a take whose tones or
 *   sounds don't score as the text is rejected, exactly like one that ad-libbed.
 */
/** Failures of one take that the next take may not repeat (the model, not the key or the network). */
const GLITCHES = new Set(['gemini_runaway', 'gemini_timeout', 'gemini_no_audio']);

/**
 * Kept under a line's own key when the teacher could not say it: its take is the backup voice's, under backupKey. The
 * next request goes straight there, without three more tries, and knows whose voice it is (the app checks Mandarin
 * tones against the teacher's voice only).
 */
const BACKUP_MARK = Buffer.from('wunder:backup-voice');
const backupKey = (key) => `${key}:backup`;
const isMark = (hit) => hit.length === BACKUP_MARK.length && Buffer.from(hit).equals(BACKUP_MARK);

/**
 * @param {(req: { text: string, accent: string, slow?: boolean }) => Promise<{ pcm: Buffer, rate: number }>} [opts.backup]
 *   The reading voice for a line the teacher cannot give a clean take of (server/azure-tts.mjs). Without it, the line
 *   stays silent, as before.
 */
export function createTts({ apiKey, model = DEFAULT_LIVE_MODEL, voiceName = DEFAULT_VOICE, cache, endpoint, connect, verify, backup, maxGenerationsPerWindow = 120, windowMs = 10 * 60_000 }) {
  const inflight = new Map();
  let windowStart = Date.now();
  let generated = 0;

  const keyFor = (req) => createHash('sha1').update([model, voiceName, req.accent, req.slow ? 'slow' : 'normal', req.kind ?? '', req.text].join('|')).digest('hex');

  async function generate(req) {
    // A small budget guard: this endpoint fronts a paid API.
    if (Date.now() - windowStart > windowMs) { windowStart = Date.now(); generated = 0; }
    if (generated >= maxGenerationsPerWindow) throw new TtsError('tts_budget_exceeded', 429);
    // Longer than any clean take of this line could be (a line of n characters takes well under 0.35 s each).
    const maxAudioSeconds = (req.slow ? 2 : 1) * (4 + [...req.text].length * 0.35);
    // Three tries: a take that ad-libs, fails the Mandarin gate or glitches is followed by a firmer one. A glitch used to
    // end the request outright (a timeout was thrown, not retried), and two in a row silenced a line that the voice
    // says perfectly well the next time — Bonjour ! Tu as faim ? on the live app, 2026-09-21.
    for (const firm of [false, true, true]) {
      generated += 1;
      let out;
      try {
        out = await synthesizeOnce({ apiKey, model, voiceName, endpoint, connect, firm, maxAudioSeconds, ...req });
      } catch (e) {
        if (e instanceof TtsError && GLITCHES.has(e.code)) continue;
        throw e;
      }
      if (!transcriptMatches(req.text, out.transcript)) continue;
      const pcm = trimSilence(out.pcm, out.sampleRate);
      if (verify && req.accent === 'zh-CN') {
        let ok = true;
        try { ok = await verify(toWav16k(pcm, out.sampleRate), req.text, req.accent); } catch { ok = true; } // a scorer outage must not silence the teacher
        if (!ok) continue;
      }
      return pcmToWav(pcm, out.sampleRate);
    }
    throw new TtsError('tts_mismatch');
  }

  /** The backup voice's take of a line. It reads exactly the text; for Mandarin a lighter tone gate still applies (reader). */
  async function fromBackup(req) {
    const out = await backup(req);
    const pcm = trimSilence(out.pcm, out.rate);
    if (verify && req.accent === 'zh-CN') {
      let ok = true;
      try { ok = await verify(toWav16k(pcm, out.rate), req.text, req.accent, { reader: true }); } catch { ok = true; }
      if (!ok) throw new TtsError('tts_mismatch');
    }
    return pcmToWav(pcm, out.rate);
  }

  /** @returns {Promise<{ wav: Buffer, cached: boolean, voice: 'teacher' | 'backup' }>} */
  async function speak(input) {
    const text = String(input?.text ?? '').replace(/\s+/g, ' ').trim();
    if (!text) throw new TtsError('missing_text', 400);
    if (text.length > MAX_TTS_CHARS) throw new TtsError('text_too_long', 400);
    const locale = input.locale ?? input.accent;
    const zh = locale === 'zh-CN';
    const ja = locale === 'ja-JP';
    if (ja ? !kana(text).length && !han(text).length : zh ? !han(text).length : !/[a-z]/i.test(text)) throw new TtsError('invalid_text', 400);
    const fr = locale === 'fr-FR';
    const req = { text, accent: zh ? 'zh-CN' : ja ? 'ja-JP' : fr ? 'fr-FR' : locale === 'en-GB' ? 'en-GB' : 'en-US', slow: !!input.slow, kind: !zh && !fr && !ja && input.kind === 'syllable' ? 'syllable' : undefined };
    const key = keyFor(req);
    // A learner's own text (a photographed page may hold a name) is not written to the shared cache.
    const keep = cache && !input.ephemeral;
    if (keep) {
      try {
        const hit = await cache.get(key);
        if (hit?.length && !isMark(hit)) return { wav: Buffer.from(hit), cached: true, voice: 'teacher' };
        if (hit?.length) {
          const kept = await cache.get(backupKey(key));
          if (kept?.length) return { wav: Buffer.from(kept), cached: true, voice: 'backup' };
        }
      } catch { /* cache unavailable — generate */ }
    }
    if (!inflight.has(key)) {
      inflight.set(key, (async () => {
        try {
          try {
            const wav = await generate(req);
            if (keep) await cache.put(key, wav).catch(() => undefined); // a failed write must not lose the take
            return { wav, voice: 'teacher' };
          } catch (e) {
            // Our own limits (a bad request, the spending guard) are not the teacher failing: no backup for those.
            if (!backup || (e instanceof TtsError && e.status < 500)) throw e;
            let wav;
            try { wav = await fromBackup(req); } catch { throw e; } // both failed: the teacher's reason is the one to report
            // A line the teacher could not say cleanly is kept as the backup's. After an outage (no connection, a
            // timeout) the teacher gets the next request again, so nothing is kept for good.
            if (keep && e instanceof TtsError && e.code === 'tts_mismatch') {
              await cache.put(backupKey(key), wav).then(() => cache.put(key, BACKUP_MARK)).catch(() => undefined);
            }
            return { wav, voice: 'backup' };
          }
        } finally {
          inflight.delete(key);
        }
      })());
    }
    const { wav, voice } = await inflight.get(key);
    return { wav, cached: false, voice };
  }

  return { speak, model, voiceName };
}
