// Wunder Tutor API — runtime-neutral core. Standard Request in, standard Response out.
// Adapters: server/index.mjs (Node, local development) and functions/api/[[path]].js (Cloudflare Pages).
//
//   GET  /api/health  -> { ok, azure, claude, gemini, ttsVersion, needsCode, authorized }
//   POST /api/assess  -> Azure pronunciation assessment (raw 16 kHz WAV in, Azure JSON out)
//   POST /api/tts     -> teacher voice via Gemini Live native audio ({ text, accent, slow, kind } in, WAV out)
//   POST /api/tutor   -> Claude conversation partner ({ reply, suggestions, done })
//
// API keys stay on the server. Nothing here logs a key, an access code, audio, or a request body.

import { HttpError } from './http-error.mjs';
import { createTts, DEFAULT_LIVE_MODEL, DEFAULT_VOICE, TtsError } from './tts.mjs';
import { buildSystemPrompt, parseTutorOutput, SAFE_FALLBACK_REPLY, toMessages, TUTOR_SCHEMA, validateTutorInput } from './tutor.mjs';

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const AZURE_TIMEOUT_MS = 15_000;
const CLAUDE_TIMEOUT_MS = 20_000;
const LOCALES = new Set(['en-US', 'en-GB']);
export const ACCESS_HEADER = 'x-wunder-access';

const json = (status, body, extraHeaders) =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extraHeaders },
  });

/** Buffers the body, rejecting anything over MAX_BODY_BYTES with a 413. */
async function readBody(request) {
  const declared = Number.parseInt(request.headers.get('content-length') ?? '', 10);
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new HttpError(413, 'payload_too_large', { maxBytes: MAX_BODY_BYTES });
  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length > MAX_BODY_BYTES) throw new HttpError(413, 'payload_too_large', { maxBytes: MAX_BODY_BYTES });
  return bytes;
}

async function readJson(request) {
  try {
    return JSON.parse(new TextDecoder().decode(await readBody(request)) || '{}');
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'invalid_json');
  }
}

/** fetch() with a hard deadline that also covers reading the body. */
async function fetchText(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return { status: response.status, ok: response.ok, text: await response.text(), timedOut: false };
  } catch (err) {
    if (controller.signal.aborted) return { status: 0, ok: false, text: '', timedOut: true };
    return { status: 0, ok: false, text: '', timedOut: false, networkError: err?.cause?.code ?? err?.name ?? 'fetch_failed' };
  } finally {
    clearTimeout(timer);
  }
}

/** Length-independent comparison so the access code can't be guessed by timing. */
function sameSecret(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Tiny fixed-window limiter. Per process / per Worker isolate — a speed bump, not a guarantee. */
function createLimiter(max, windowMs) {
  const hits = new Map();
  return (id) => {
    const now = Date.now();
    if (hits.size > 5000) hits.clear();
    const entry = hits.get(id);
    if (!entry || now - entry.start > windowMs) { hits.set(id, { start: now, count: 1 }); return true; }
    entry.count += 1;
    return entry.count <= max;
  };
}

/**
 * @param {Record<string, string|undefined>} rawEnv  AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, AZURE_SPEECH_ENDPOINT,
 *   GEMINI_API_KEY, GEMINI_LIVE_MODEL, GEMINI_TTS_VOICE, GEMINI_LIVE_ENDPOINT, ANTHROPIC_API_KEY, CLAUDE_MODEL,
 *   BETA_ACCESS_CODE (when set, every endpoint except /api/health requires it in the x-wunder-access header)
 * @param {{ ttsCache?: object, connectWebSocket?: Function, canDialWebSocket?: boolean, requireAccessCode?: boolean, log?: Console }} [deps]
 *   requireAccessCode: public deployments fail closed — with no BETA_ACCESS_CODE configured, nothing is unlocked.
 */
export function createApi(rawEnv, deps = {}) {
  const env = (name) => String(rawEnv?.[name] ?? '').trim();
  const log = deps.log ?? console;

  const AZURE_SPEECH_KEY = env('AZURE_SPEECH_KEY');
  const AZURE_SPEECH_REGION = env('AZURE_SPEECH_REGION').toLowerCase();
  const AZURE_SPEECH_ENDPOINT = env('AZURE_SPEECH_ENDPOINT').replace(/\/+$/, '');
  const ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY');
  const CLAUDE_MODEL = env('CLAUDE_MODEL') || 'claude-sonnet-5';
  const GEMINI_API_KEY = env('GEMINI_API_KEY');
  const GEMINI_LIVE_MODEL = env('GEMINI_LIVE_MODEL') || DEFAULT_LIVE_MODEL;
  const GEMINI_TTS_VOICE = env('GEMINI_TTS_VOICE') || DEFAULT_VOICE;
  const ACCESS_CODE = env('BETA_ACCESS_CODE');

  const canDial = deps.canDialWebSocket ?? (Boolean(deps.connectWebSocket) || typeof WebSocket === 'function');
  const status = {
    azure: Boolean(AZURE_SPEECH_KEY && (AZURE_SPEECH_REGION || AZURE_SPEECH_ENDPOINT)),
    claude: Boolean(ANTHROPIC_API_KEY),
    gemini: Boolean(GEMINI_API_KEY && canDial),
    needsCode: Boolean(ACCESS_CODE) || deps.requireAccessCode === true,
    claudeModel: CLAUDE_MODEL,
    ttsVersion: `${GEMINI_LIVE_MODEL}/${GEMINI_TTS_VOICE}`,
  };

  const tts = status.gemini
    ? createTts({ apiKey: GEMINI_API_KEY, model: GEMINI_LIVE_MODEL, voiceName: GEMINI_TTS_VOICE, endpoint: env('GEMINI_LIVE_ENDPOINT') || undefined, cache: deps.ttsCache, connect: deps.connectWebSocket })
    : null;

  const allowAssess = createLimiter(90, 5 * 60_000); // ~18 attempts a minute per client is already frantic
  const allowTts = createLimiter(120, 5 * 60_000);
  const allowTutor = createLimiter(40, 5 * 60_000);
  const allowCodeGuess = createLimiter(12, 10 * 60_000);

  // ---------------------------------------------------------------- /api/assess
  // Verified live (eastasia, 2026-09): regional stt host, PhonemeAlphabet IPA honoured over REST, scores flat on NBest[0].
  function pronunciationHeader(referenceText, nbestPhonemeCount) {
    const params = {
      ReferenceText: referenceText, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive',
      EnableMiscue: 'True', EnableProsodyAssessment: 'True', PhonemeAlphabet: 'IPA',
    };
    if (nbestPhonemeCount > 0) params.NBestPhonemeCount = nbestPhonemeCount;
    const bytes = new TextEncoder().encode(JSON.stringify(params));
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }

  async function handleAssess(request, url) {
    if (!status.azure) throw new HttpError(503, 'azure_not_configured');
    const text = (url.searchParams.get('text') ?? '').trim();
    if (!text) throw new HttpError(400, 'missing_text');
    if (text.length > 500) throw new HttpError(400, 'text_too_long', { maxChars: 500 });
    const locale = url.searchParams.get('locale') ?? 'en-US';
    if (!LOCALES.has(locale)) throw new HttpError(400, 'unsupported_locale', { supported: [...LOCALES] });
    const nbestRaw = Number.parseInt(url.searchParams.get('nbest') ?? '0', 10);
    const nbest = Number.isFinite(nbestRaw) ? Math.min(Math.max(nbestRaw, 0), 10) : 0;

    const audio = await readBody(request);
    if (audio.length < 44) throw new HttpError(400, 'missing_audio'); // smaller than a WAV header

    const base = AZURE_SPEECH_ENDPOINT || `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com`;
    const upstream = await fetchText(
      `${base}/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}&format=detailed`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          Accept: 'application/json',
          'Pronunciation-Assessment': pronunciationHeader(text, nbest),
        },
        body: audio,
      },
      AZURE_TIMEOUT_MS,
    );
    if (upstream.timedOut) throw new HttpError(504, 'azure_timeout');
    if (!upstream.ok) {
      // The upstream body is never echoed to the browser; 401/403 almost always means a bad key or region.
      log.warn?.(`[assess] azure upstream failure status=${upstream.status}${upstream.networkError ? ` (${upstream.networkError})` : ''}`);
      throw new HttpError(502, 'azure_upstream', { status: upstream.status });
    }
    // Azure's JSON unchanged. RecognitionStatus may still be NoMatch / InitialSilenceTimeout with HTTP 200.
    return json(200, upstream.text);
  }

  // ---------------------------------------------------------------- /api/tts
  async function handleTts(request) {
    if (!tts) throw new HttpError(503, 'gemini_not_configured');
    const input = await readJson(request);
    try {
      const { wav, cached } = await tts.speak(input);
      return new Response(wav, {
        status: 200,
        headers: {
          'Content-Type': 'audio/wav',
          // The same phrase always yields the same take, so the browser may keep it.
          'Cache-Control': 'private, max-age=31536000, immutable',
          'X-Content-Type-Options': 'nosniff',
          'X-Tts-Cache': cached ? 'hit' : 'miss',
        },
      });
    } catch (err) {
      if (err instanceof TtsError) {
        if (err.status >= 500) log.warn?.(`[tts] ${err.code}${err.detail?.code ? ` (ws close ${err.detail.code})` : ''}`);
        throw new HttpError(err.status, err.code, err.detail ? { detail: err.detail } : undefined);
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------- /api/tutor
  const callClaude = (body) =>
    fetchText('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }, CLAUDE_TIMEOUT_MS);

  async function handleTutor(request) {
    if (!status.claude) throw new HttpError(503, 'claude_not_configured');
    const { scenario, band, history, pronunciationNotes } = validateTutorInput(await readJson(request));
    const childTurns = history.filter((t) => t.role === 'child').length;
    const base = { model: CLAUDE_MODEL, max_tokens: 400, system: buildSystemPrompt({ scenario, band, childTurns, pronunciationNotes }), messages: toMessages(history) };

    // Preferred: thinking off (its tokens would eat max_tokens) + structured outputs. No sampling params.
    let upstream = await callClaude({ ...base, thinking: { type: 'disabled' }, output_config: { format: { type: 'json_schema', schema: TUTOR_SCHEMA } } });
    if (upstream.status === 400) {
      log.warn?.('[tutor] claude returned 400 for the preferred request shape; retrying without thinking/output_config');
      upstream = await callClaude({ ...base, max_tokens: 2000 });
    }
    if (upstream.timedOut) throw new HttpError(504, 'claude_timeout');
    if (!upstream.ok) {
      log.warn?.(`[tutor] claude upstream failure status=${upstream.status}${upstream.networkError ? ` (${upstream.networkError})` : ''}`);
      throw new HttpError(502, 'claude_upstream', { status: upstream.status });
    }
    let message;
    try { message = JSON.parse(upstream.text); } catch { throw new HttpError(502, 'claude_upstream', { status: upstream.status }); }

    let result;
    if (message.stop_reason === 'refusal') {
      result = { reply: '', suggestions: [], done: false }; // keep the child in the scenario with a neutral line
    } else {
      const text = (Array.isArray(message.content) ? message.content : []).filter((b) => b?.type === 'text' && typeof b.text === 'string').map((b) => b.text).join('');
      result = parseTutorOutput(text);
    }
    if (!result.reply) result.reply = SAFE_FALLBACK_REPLY;
    if (childTurns >= 8) result.done = true; // a session can never run on indefinitely, whatever the model says
    if (result.done) result.suggestions = [];
    return json(200, result);
  }

  // ---------------------------------------------------------------- router
  const ROUTES = new Set(['/api/health', '/api/assess', '/api/tutor', '/api/tts']);

  /** @param {Request} request  @param {{ clientId?: string }} [ctx] */
  async function handle(request, ctx = {}) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const route = `${request.method} ${path}`;
    const client = ctx.clientId || 'local';
    try {
      const offered = request.headers.get(ACCESS_HEADER) ?? '';
      let authorized = !ACCESS_CODE && deps.requireAccessCode !== true;
      if (ACCESS_CODE && offered) {
        if (!allowCodeGuess(client)) throw new HttpError(429, 'too_many_attempts');
        authorized = sameSecret(offered, ACCESS_CODE);
      }

      if (route === 'GET /api/health') {
        // Before the code is entered the app only learns that one is needed — not which services exist.
        const open = authorized;
        return json(200, {
          ok: true, needsCode: status.needsCode, authorized,
          azure: open && status.azure, claude: open && status.claude, gemini: open && status.gemini,
          ttsVersion: open && status.gemini ? status.ttsVersion : null,
        });
      }
      if (!ROUTES.has(path)) return json(404, { error: 'not_found' });
      if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
      if (!authorized) throw new HttpError(401, 'access_code_required');

      if (path === '/api/assess') {
        if (!allowAssess(client)) throw new HttpError(429, 'rate_limited');
        return await handleAssess(request, url);
      }
      if (path === '/api/tts') {
        if (!allowTts(client)) throw new HttpError(429, 'rate_limited');
        return await handleTts(request);
      }
      if (!allowTutor(client)) throw new HttpError(429, 'rate_limited');
      return await handleTutor(request);
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, err.body, err.status === 413 ? { Connection: 'close' } : undefined);
      log.error?.(`[api] unexpected error on ${route}: ${err?.name ?? 'Error'}`);
      return json(500, { error: 'internal_error' });
    }
  }

  return { handle, status };
}
