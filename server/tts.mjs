// Teacher voice through the Gemini Live API (native audio), used as a strict text-to-speech engine.
//
// A Live model is a conversational model, not a TTS engine, so three things keep it honest:
//   1. the system instruction allows nothing but the requested words,
//   2. the model's own output transcription is checked against the request (retry once, then fail —
//      a reference pronunciation that ad-libs is worse than none; the app falls back to device TTS),
//   3. accepted audio is cached on disk, so every learner hears the same take and each phrase is
//      generated (and paid for) once.
//
// Only lesson text is ever sent to Google from here — never a child's voice.
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
export function transcriptMatches(expected, heard) {
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
export async function synthesizeOnce({ apiKey, model, voiceName, text, accent, slow, kind, endpoint, connect, timeoutMs = 25_000, firm = false }) {
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
          chunks.push(Buffer.from(inline.data, 'base64'));
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
export function createTts({ apiKey, model = DEFAULT_LIVE_MODEL, voiceName = DEFAULT_VOICE, cache, endpoint, connect, maxGenerationsPerWindow = 120, windowMs = 10 * 60_000 }) {
  const inflight = new Map();
  let windowStart = Date.now();
  let generated = 0;

  const keyFor = (req) => createHash('sha1').update([model, voiceName, req.accent, req.slow ? 'slow' : 'normal', req.kind ?? '', req.text].join('|')).digest('hex');

  async function generate(req) {
    // A small budget guard: this endpoint fronts a paid API.
    if (Date.now() - windowStart > windowMs) { windowStart = Date.now(); generated = 0; }
    if (generated >= maxGenerationsPerWindow) throw new TtsError('tts_budget_exceeded', 429);
    for (const firm of [false, true]) {
      generated += 1;
      const out = await synthesizeOnce({ apiKey, model, voiceName, endpoint, connect, firm, ...req });
      if (transcriptMatches(req.text, out.transcript)) return pcmToWav(trimSilence(out.pcm, out.sampleRate), out.sampleRate);
    }
    throw new TtsError('tts_mismatch');
  }

  /** @returns {Promise<{ wav: Buffer, cached: boolean }>} */
  async function speak(input) {
    const text = String(input?.text ?? '').replace(/\s+/g, ' ').trim();
    if (!text) throw new TtsError('missing_text', 400);
    if (text.length > MAX_TTS_CHARS) throw new TtsError('text_too_long', 400);
    if (!/[a-z]/i.test(text)) throw new TtsError('invalid_text', 400);
    const req = { text, accent: input.accent === 'en-GB' ? 'en-GB' : 'en-US', slow: !!input.slow, kind: input.kind === 'syllable' ? 'syllable' : undefined };
    const key = keyFor(req);
    if (cache) {
      try {
        const hit = await cache.get(key);
        if (hit?.length) return { wav: Buffer.from(hit), cached: true };
      } catch { /* cache unavailable — generate */ }
    }
    if (!inflight.has(key)) {
      inflight.set(key, (async () => {
        try {
          const wav = await generate(req);
          if (cache) await cache.put(key, wav).catch(() => undefined); // a failed write must not lose the take
          return wav;
        } finally {
          inflight.delete(key);
        }
      })());
    }
    return { wav: await inflight.get(key), cached: false };
  }

  return { speak, model, voiceName };
}
