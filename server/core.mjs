// Wunder Tutor API — runtime-neutral core. Standard Request in, standard Response out.
// Adapters: server/index.mjs (Node, local development) and functions/api/[[path]].js (Cloudflare Pages).
//
//   GET  /api/health  -> { ok, azure, claude, gemini, ttsVersion, needsCode, authorized } — which keys are PRESENT
//   GET  /api/status  -> { scoring, reading, voice } — whether the keys actually WORK (free live checks, cached 60 s)
//   POST /api/assess  -> Azure pronunciation assessment (raw 16 kHz WAV in, Azure JSON out)
//   POST /api/tts     -> teacher voice via Gemini Live native audio ({ text, accent, slow, kind } in, WAV out)
//   POST /api/tutor   -> Claude conversation partner ({ reply, suggestions, done })
//   POST /api/read    -> "Say it right": a photo (image/*) or typed text ({ text }) → sentences to practise (+ pinyin)
//
// API keys stay on the server. Nothing here logs a key, an access code, audio, or a request body.

import { HttpError } from './http-error.mjs';
import { createFamilies } from './family.mjs';
import { createTts, DEFAULT_LIVE_MODEL, DEFAULT_VOICE, TtsError } from './tts.mjs';
import { DEFAULT_READ_MODEL, readText } from './read.mjs';
import { buildSystemPrompt, parseTutorOutput, SAFE_FALLBACK_REPLY, toMessages, TUTOR_SCHEMA, validateTutorInput } from './tutor.mjs';

const MAX_BODY_BYTES = 5 * 1024 * 1024;
const AZURE_TIMEOUT_MS = 15_000;
const CLAUDE_TIMEOUT_MS = 20_000;
const LOCALES = new Set(['en-US', 'en-GB', 'zh-CN']);
/** At most this many "likely mistake" re-scorings of one take (each is billed as a scoring). */
const MAX_ALTS = 5;
/** A Mandarin teacher take is only kept if it scores at least this well as its own text (calibrated in eval/). */
const TEACHER_MIN_ACCURACY = 85;
const TEACHER_MIN_SYLLABLE = 70;
export const ACCESS_HEADER = 'x-wunder-access';

/** A "Success" response whose best result carries no pronunciation scores at all. */
export function missingScores(text) {
  try {
    const j = JSON.parse(text);
    const b = j?.NBest?.[0];
    return j?.RecognitionStatus === 'Success' && !!b && b.AccuracyScore == null && b.PronunciationAssessment == null;
  } catch { return false; }
}

/**
 * A likely-mistake text must be the reference with ONE word (English) or ONE character (Chinese) changed — the
 * endpoint scores audio against lesson text, not arbitrary text.
 */
export function oneChangeAway(text, alt) {
  const han = (s) => [...s].filter((c) => /\p{Script=Han}/u.test(c));
  const a = han(text), b = han(alt);
  if (a.length) return a.length === b.length && a.filter((c, i) => c !== b[i]).length === 1;
  const words = (s) => s.toLowerCase().split(/\s+/).map((w) => w.replace(/[^a-z']/g, '')).filter(Boolean);
  const x = words(text), y = words(alt);
  return x.length === y.length && x.filter((w, i) => w !== y[i]).length === 1;
}

/**
 * A key or id as it goes into a request header or URL: everything a paste may have carried along — line breaks,
 * spaces, and invisible characters from a web page or document — is removed, because a single one of them makes the
 * request itself invalid (it then fails before ever reaching Google). Keys are printable ASCII; passphrases are left
 * alone, since spaces may be part of them.
 */
export const cleanApiKey = (value) => String(value ?? '').replace(/[^!-~]+/g, '');

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

/** fetch() with a hard deadline that also covers reading the body. `fetchFn`: the way out to use (see googleFetch). */
async function fetchText(url, init, timeoutMs, fetchFn = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(url, { ...init, signal: controller.signal });
    return { status: response.status, ok: response.ok, text: await response.text(), timedOut: false };
  } catch (err) {
    if (controller.signal.aborted) return { status: 0, ok: false, text: '', timedOut: true };
    return { status: 0, ok: false, text: '', timedOut: false, networkError: err?.cause?.code ?? err?.name ?? 'fetch_failed' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * An access code as it is compared: what a paste or a phone keyboard may add without anyone seeing it — a zero-width
 * space, a byte-order mark, a non-breaking space, a line break — never decides whether the code is right. Spaces
 * inside a passphrase still count (as one ordinary space each).
 */
export const normalCode = (value) => String(value ?? '')
  .replace(/[\p{Cc}\p{Cf}]+/gu, '')
  .replace(/[\p{Zs}\s]+/gu, ' ')
  .trim();

/** The app sends the code URI-encoded (a header can't carry every character); older copies of the app send it raw. */
const decoded = (value) => { try { return decodeURIComponent(value); } catch { return value; } };

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
  /** `cost`: how many billed upstream calls this request makes. */
  return (id, cost = 1) => {
    const now = Date.now();
    if (hits.size > 5000) hits.clear();
    const entry = hits.get(id);
    if (!entry || now - entry.start > windowMs) { hits.set(id, { start: now, count: cost }); return cost <= max; }
    entry.count += cost;
    return entry.count <= max;
  };
}

/** Counts only failures (wrong access codes): a client that keeps guessing is locked out for the window. */
function createFailureCounter(max, windowMs) {
  const fails = new Map();
  return {
    blocked(id) { const e = fails.get(id); return !!e && Date.now() - e.start <= windowMs && e.count >= max; },
    fail(id) {
      const now = Date.now();
      if (fails.size > 5000) fails.clear();
      const e = fails.get(id);
      if (!e || now - e.start > windowMs) fails.set(id, { start: now, count: 1 }); else e.count += 1;
    },
  };
}

/**
 * @param {Record<string, string|undefined>} rawEnv  AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, AZURE_SPEECH_ENDPOINT,
 *   GEMINI_API_KEY, GEMINI_LIVE_MODEL, GEMINI_TTS_VOICE, GEMINI_LIVE_ENDPOINT, ANTHROPIC_API_KEY, CLAUDE_MODEL,
 *   BETA_ACCESS_CODE (when set, every endpoint except /api/health requires it in the x-wunder-access header)
 * @param {{ ttsCache?: object, connectWebSocket?: Function, canDialWebSocket?: boolean, requireAccessCode?: boolean, log?: Console,
 *   googleFetch?: typeof fetch, egressInfo?: () => Promise<string> }} [deps]
 *   googleFetch: how requests reach Google. Google refuses requests that leave from Hong Kong, where the hosted API
 *   runs for Hong Kong learners — there it is a relay elsewhere (functions/api/[[path]].js); locally, plain fetch.
 *   requireAccessCode: public deployments fail closed — with no BETA_ACCESS_CODE configured, nothing is unlocked.
 */
export function createApi(rawEnv, deps = {}) {
  const env = (name) => String(rawEnv?.[name] ?? '').trim();
  const log = deps.log ?? console;
  const googleFetch = deps.googleFetch ?? ((url, init) => fetch(url, init));

  const AZURE_SPEECH_KEY = cleanApiKey(env('AZURE_SPEECH_KEY'));
  const AZURE_SPEECH_REGION = cleanApiKey(env('AZURE_SPEECH_REGION')).toLowerCase();
  const AZURE_SPEECH_ENDPOINT = env('AZURE_SPEECH_ENDPOINT').replace(/\/+$/, '');
  const ANTHROPIC_API_KEY = cleanApiKey(env('ANTHROPIC_API_KEY'));
  const CLAUDE_MODEL = env('CLAUDE_MODEL') || 'claude-sonnet-5';
  const GEMINI_API_KEY = cleanApiKey(env('GEMINI_API_KEY'));
  const GEMINI_LIVE_MODEL = env('GEMINI_LIVE_MODEL') || DEFAULT_LIVE_MODEL;
  const GEMINI_TTS_VOICE = env('GEMINI_TTS_VOICE') || DEFAULT_VOICE;
  const GEMINI_READ_MODEL = env('GEMINI_READ_MODEL') || DEFAULT_READ_MODEL;
  const ACCESS_CODE = normalCode(env('BETA_ACCESS_CODE'));
  // Families with an account (server/family.mjs). SUPABASE_URL is public; SUPABASE_SECRET_KEY is a secret like the others.
  const families = deps.families ?? (env('SUPABASE_URL') ? createFamilies({ url: env('SUPABASE_URL'), secretKey: cleanApiKey(env('SUPABASE_SECRET_KEY')), log }) : null);

  const canDial = deps.canDialWebSocket ?? (Boolean(deps.connectWebSocket) || typeof WebSocket === 'function');
  const status = {
    azure: Boolean(AZURE_SPEECH_KEY && (AZURE_SPEECH_REGION || AZURE_SPEECH_ENDPOINT)),
    claude: Boolean(ANTHROPIC_API_KEY),
    gemini: Boolean(GEMINI_API_KEY && canDial),
    needsCode: Boolean(ACCESS_CODE) || deps.requireAccessCode === true,
    claudeModel: CLAUDE_MODEL,
    ttsVersion: `${GEMINI_LIVE_MODEL}/${GEMINI_TTS_VOICE}`,
    read: Boolean(GEMINI_API_KEY),
  };

  /** Quality gate for new Mandarin teacher takes: the take must score as the text, syllable by syllable. */
  async function verifyTake(wav, text, locale) {
    const j = JSON.parse(await scoreOnce(wav, text, locale, 0));
    if (j.RecognitionStatus !== 'Success') return false;
    const best = j.NBest?.[0];
    const pa = best?.PronunciationAssessment ?? best ?? {};
    const words = best?.Words ?? [];
    if (words.some((w) => ((w.PronunciationAssessment ?? w).ErrorType ?? 'None') !== 'None')) return false;
    const syllables = words.flatMap((w) => (w.Phonemes?.length ? w.Phonemes : [w]).map((p) => (p.PronunciationAssessment ?? p).AccuracyScore ?? 0));
    return (pa.AccuracyScore ?? 0) >= TEACHER_MIN_ACCURACY && syllables.every((s) => s >= TEACHER_MIN_SYLLABLE);
  }

  const tts = status.gemini
    ? createTts({
      apiKey: GEMINI_API_KEY, model: GEMINI_LIVE_MODEL, voiceName: GEMINI_TTS_VOICE, endpoint: env('GEMINI_LIVE_ENDPOINT') || undefined,
      cache: deps.ttsCache, connect: deps.connectWebSocket, verify: status.azure ? verifyTake : undefined,
    })
    : null;

  // Counted in billed scorings (a take with likely-mistake checks is several): ~100 typical takes per 5 minutes.
  const allowAssess = createLimiter(400, 5 * 60_000);
  const allowTts = createLimiter(120, 5 * 60_000);
  const allowTutor = createLimiter(40, 5 * 60_000);
  const allowRead = createLimiter(30, 10 * 60_000);
  // New teacher takes for a learner's own sentences are generated per request: a per-client cap keeps one busy
  // page-photographer from spending everyone's voice budget.
  const allowOwnTextTts = createLimiter(40, 10 * 60_000);
  // Wrong codes only: the right code rides on every request and must never count as a guess.
  const codeGuesses = createFailureCounter(12, 10 * 60_000);

  // ---------------------------------------------------------------- /api/assess
  // Verified live (eastasia, 2026-09): regional stt host, PhonemeAlphabet IPA honoured over REST, scores flat on NBest[0],
  // NBestPhonemeCount ("what was said instead") returned for en-US over REST, not for en-GB or zh-CN.
  function pronunciationHeader(referenceText, locale, nbestPhonemeCount) {
    const params = {
      ReferenceText: referenceText, GradingSystem: 'HundredMark', Granularity: 'Phoneme', Dimension: 'Comprehensive',
      EnableMiscue: 'True', EnableProsodyAssessment: 'True',
    };
    if (locale === 'en-US') params.PhonemeAlphabet = 'IPA';
    if (locale === 'en-US' && nbestPhonemeCount > 0) params.NBestPhonemeCount = nbestPhonemeCount;
    const bytes = new TextEncoder().encode(JSON.stringify(params));
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary);
  }

  async function scoreOnce(audio, text, locale, nbest, attempt = 0, started = Date.now()) {
    const base = AZURE_SPEECH_ENDPOINT || `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com`;
    const upstream = await fetchText(
      `${base}/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}&format=detailed`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY,
          'Content-Type': 'audio/wav; codecs=audio/pcm; samplerate=16000',
          Accept: 'application/json',
          'Pronunciation-Assessment': pronunciationHeader(text, locale, nbest),
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
    // Now and then Azure answers "Success" without running the pronunciation part (no scores at all). That is not a
    // verdict on the child — ask once more rather than let it read as a zero.
    // Only when a retry can still finish inside the app's 20-second wait.
    if (!attempt && Date.now() - started < 4000 && missingScores(upstream.text)) return scoreOnce(audio, text, locale, nbest, 1, started);
    return upstream.text;
  }

  /**
   * One take, scored once — or, for accuracy, several times in parallel so it costs no extra waiting:
   *   alts=["我想卖", …]  the same audio against likely mistakes ("what did it sound like instead"), any locale
   *   dual=1             British: the same audio as US English too, for "what was said instead" on consonants
   * With either, the response is { main, alts?, us? } holding Azure's JSON objects; without, Azure's JSON unchanged.
   */
  async function handleAssess(request, url, client) {
    if (!status.azure) throw new HttpError(503, 'azure_not_configured');
    const text = (url.searchParams.get('text') ?? '').trim();
    if (!text) throw new HttpError(400, 'missing_text');
    if (text.length > 500) throw new HttpError(400, 'text_too_long', { maxChars: 500 });
    const locale = url.searchParams.get('locale') ?? 'en-US';
    if (!LOCALES.has(locale)) throw new HttpError(400, 'unsupported_locale', { supported: [...LOCALES] });
    const nbestRaw = Number.parseInt(url.searchParams.get('nbest') ?? '0', 10);
    const nbest = Number.isFinite(nbestRaw) ? Math.min(Math.max(nbestRaw, 0), 10) : 0;
    let alts = [];
    if (url.searchParams.has('alts')) {
      try { alts = JSON.parse(url.searchParams.get('alts') ?? '[]'); } catch { throw new HttpError(400, 'invalid_alts'); }
      if (!Array.isArray(alts) || alts.length > MAX_ALTS || alts.some((a) => typeof a !== 'string' || !a.trim() || a.length > 500 || !oneChangeAway(text, a))) throw new HttpError(400, 'invalid_alts', { max: MAX_ALTS });
    }
    const dual = url.searchParams.get('dual') === '1' && locale === 'en-GB';
    if (!allowAssess(client, 1 + alts.length + (dual ? 1 : 0))) throw new HttpError(429, 'rate_limited');

    const audio = await readBody(request);
    if (audio.length < 44) throw new HttpError(400, 'missing_audio'); // smaller than a WAV header

    if (!alts.length && !dual) {
      // Azure's JSON unchanged. RecognitionStatus may still be NoMatch / InitialSilenceTimeout with HTTP 200.
      return json(200, await scoreOnce(audio, text, locale, nbest));
    }
    const [main, us, ...altTexts] = await Promise.all([
      scoreOnce(audio, text, locale, nbest),
      // A failed extra scoring only loses that evidence; the main score still stands.
      dual ? scoreOnce(audio, text, 'en-US', 5).catch(() => null) : Promise.resolve(null),
      ...alts.map((a) => scoreOnce(audio, a, locale, 0).catch(() => null)),
    ]);
    const parse = (t) => { try { return t ? JSON.parse(t) : null; } catch { return null; } };
    return json(200, { main: parse(main), us: dual ? parse(us) : undefined, alts: alts.length ? altTexts.map(parse) : undefined });
  }

  // ---------------------------------------------------------------- /api/tts
  // ---------------------------------------------------------------- /api/read
  // A photo of a page (raw image/jpeg|png|webp body) or typed text ({ "text": "…" }) → the sentences to practise.
  // Only the image or text goes to Google; Wunder Tutor stores neither.
  const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  async function handleRead(request) {
    if (!GEMINI_API_KEY) throw new HttpError(503, 'gemini_not_configured');
    const type = (request.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
    let input;
    if (IMAGE_TYPES.has(type)) {
      const bytes = await readBody(request);
      if (bytes.length < 100) throw new HttpError(400, 'missing_image');
      input = { image: { bytes, mime: type } };
    } else {
      const { text } = await readJson(request);
      if (typeof text !== 'string' || !text.trim()) throw new HttpError(400, 'missing_text');
      if (text.length > 2000) throw new HttpError(400, 'text_too_long', { maxChars: 2000 });
      input = { text };
    }
    const started = Date.now();
    try {
      return json(200, await readText({ apiKey: GEMINI_API_KEY, model: GEMINI_READ_MODEL, fetchImpl: googleFetch, ...input }));
    } catch (err) {
      // What failed and how long it took — never the photo, the text, or a key. For a key that can't be sent, how
      // much of the stored value is usable at all says whether it is empty, padded or the wrong value entirely.
      const what = input.image ? `photo ${Math.round(input.image.bytes.length / 1024)} KB` : `text ${input.text.length} chars`;
      // A key that can't be used: how much of the stored value is usable at all (never the value) says whether it is
      // empty, padded, or the wrong value entirely — in the app's message too, since a tester's screenshot is the
      // fastest way back to me.
      if (err?.body?.error === 'read_key') err.body.note = `${GEMINI_API_KEY.length}/${env('GEMINI_API_KEY').length}`;
      log.warn?.(`[read] ${err?.body?.error ?? err?.name ?? 'error'}${err.upstreamMessage ? ` (${err?.body?.status ? `gemini ${err.body.status}: ` : ''}${err.upstreamMessage})` : ''}${err?.body?.finish ? ` (${err.body.finish})` : ''} after ${((Date.now() - started) / 1000).toFixed(1)} s, ${what}`);
      throw err;
    }
  }

  async function handleTts(request, client) {
    if (!tts) throw new HttpError(503, 'gemini_not_configured');
    const input = await readJson(request);
    if (input?.ephemeral && !allowOwnTextTts(client)) throw new HttpError(429, 'rate_limited');
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

  // ---------------------------------------------------------------- live status: do the keys actually work?
  // /api/health only says which keys are present. A pasted key can be present and wrong (2026-09-20: three photo
  // attempts failed on the live app before anyone could see that Google refused the key). This asks the services
  // themselves, with calls that cost nothing — Azure issues a token, Google describes a model — and remembers the
  // answer for a minute per isolate. The coarse words are public, like any status page, so the keys can be checked
  // from outside right after they are changed; what helps repair a pasted key (how many usable characters it has,
  // Google's own words) goes only to a device with the access code. Never a key, never part of one.
  let lastStatus = null;
  const keyShape = () => `key ${GEMINI_API_KEY.length}/${env('GEMINI_API_KEY').length}`;

  async function checkAzure() {
    if (!status.azure) return { state: 'not_set' };
    if (AZURE_SPEECH_ENDPOINT) return { state: 'unchecked' }; // a custom endpoint has no token service to ask
    const r = await fetchText(`https://${AZURE_SPEECH_REGION}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': AZURE_SPEECH_KEY }, body: '' }, 8000);
    if (r.ok) return { state: 'ok' };
    if (r.status === 401 || r.status === 403) return { state: 'key_refused', note: `azure ${r.status}` };
    return { state: r.status ? 'error' : 'unreachable', note: `azure ${r.status || r.networkError || 'timeout'}` };
  }

  async function checkGemini(model) {
    if (!GEMINI_API_KEY) return { state: 'not_set', note: keyShape() };
    const r = await fetchText(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, { headers: { 'x-goog-api-key': GEMINI_API_KEY } }, 8000, googleFetch);
    if (r.ok) return { state: 'ok' };
    let message = '';
    try { message = String(JSON.parse(r.text)?.error?.message ?? ''); } catch { /* not JSON */ }
    const state = !r.status ? 'unreachable'
      : /location is not supported/i.test(message) ? 'region'
      : /api key/i.test(message) || r.status === 401 || r.status === 403 ? 'key_refused'
      : r.status === 404 ? 'model_missing'
      : r.status === 429 ? 'quota'
      : 'error';
    return { state, note: `google ${r.status || r.networkError || 'timeout'}${message ? `: ${message.replace(/\s+/g, ' ').slice(0, 140)}` : ''}; ${keyShape()}` };
  }

  /** A definite answer ("works", "refused", "not set") keeps for a minute; a hiccup (a timeout, a 5xx, a rate limit) for 5 s. */
  const DEFINITE = new Set(['ok', 'not_set', 'key_refused', 'region', 'model_missing', 'unchecked']);
  function liveStatus() {
    if (lastStatus && Date.now() < lastStatus.until) return lastStatus.value;
    // One check at a time: everyone who asks while it runs shares its answer.
    const value = (async () => {
      const [scoring, reading, voice] = await Promise.all([checkAzure(), checkGemini(GEMINI_READ_MODEL), checkGemini(GEMINI_LIVE_MODEL)]);
      const notes = Object.fromEntries(Object.entries({ scoring, reading, voice }).filter(([, v]) => v.note).map(([k, v]) => [k, v.note]));
      // Where calls to Google leave from ("apac NRT") — it decides whether Google serves them at all.
      const egress = deps.egressInfo ? await deps.egressInfo().catch(() => '?') : 'direct';
      const out = { checkedAt: new Date().toISOString(), scoring: scoring.state, reading: reading.state, voice: canDial ? voice.state : 'not_set', egress, notes };
      const sure = [out.scoring, out.reading, out.voice].every((s) => DEFINITE.has(s));
      lastStatus = { until: Date.now() + (sure ? 60_000 : 5_000), value };
      return out;
    })().catch(() => {
      lastStatus = null; // the check itself broke: say so, and ask again next time
      return { checkedAt: new Date().toISOString(), scoring: 'error', reading: 'error', voice: 'error', notes: {} };
    });
    lastStatus = { until: Date.now() + 15_000, value };
    return value;
  }
  const allowStatus = createLimiter(30, 60_000);

  // ---------------------------------------------------------------- router
  const ROUTES = new Set(['/api/health', '/api/assess', '/api/tutor', '/api/tts', '/api/read']);

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
        if (codeGuesses.blocked(client)) throw new HttpError(429, 'too_many_attempts');
        // Both forms are always compared, so the time taken says nothing about which one matched.
        const asSent = sameSecret(normalCode(offered), ACCESS_CODE), asDecoded = sameSecret(normalCode(decoded(offered)), ACCESS_CODE);
        authorized = asSent || asDecoded;
        if (!authorized) codeGuesses.fail(client);
      }

      // A signed-in family: the account unlocks the API once it has a plan — 'beta' from the first time the access code
      // came with the sign-in (on any device), 'family' once they pay. Its use is counted per day against the plan.
      const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
      const family = families && token ? await families.verify(token) : null;
      let plan = family ? await families.plan(family) : null;
      if (family && authorized && ACCESS_CODE && plan === 'free' && await families.grantBeta(family)) plan = 'beta';
      const byAccount = plan === 'beta' || plan === 'family';
      authorized = authorized || byAccount;
      const spend = async (kind) => {
        if (!family || !byAccount) return;
        const use = await families.use(family, plan, kind);
        if (!use.ok) throw new HttpError(429, 'daily_limit', { kind, used: use.used, limit: use.limit });
      };

      if (route === 'GET /api/health') {
        // Before the code is entered the app only learns that one is needed — not which services exist.
        const open = authorized;
        return json(200, {
          ok: true, needsCode: status.needsCode, codeSet: Boolean(ACCESS_CODE), authorized,
          family: Boolean(family), plan: family ? plan : null,
          azure: open && status.azure, claude: open && status.claude, gemini: open && status.gemini,
          ttsVersion: open && status.gemini ? status.ttsVersion : null,
          read: open && status.read,
        });
      }
      if (route === 'GET /api/status') {
        if (!allowStatus(client)) throw new HttpError(429, 'rate_limited');
        const { notes, ...words } = await liveStatus();
        return json(200, authorized ? { ...words, notes } : words);
      }
      if (!ROUTES.has(path)) return json(404, { error: 'not_found' });
      if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
      if (!authorized) throw new HttpError(401, 'access_code_required');

      if (path === '/api/assess') {
        await spend('scorings');
        return await handleAssess(request, url, client);
      }
      if (path === '/api/read') {
        if (!allowRead(client)) throw new HttpError(429, 'rate_limited');
        await spend('reads');
        return await handleRead(request);
      }
      if (path === '/api/tts') {
        if (!allowTts(client)) throw new HttpError(429, 'rate_limited');
        await spend('voice');
        return await handleTts(request, client);
      }
      if (!allowTutor(client)) throw new HttpError(429, 'rate_limited');
      await spend('tutor');
      return await handleTutor(request);
    } catch (err) {
      if (err instanceof HttpError) return json(err.status, err.body, err.status === 413 ? { Connection: 'close' } : undefined);
      log.error?.(`[api] unexpected error on ${route}: ${err?.name ?? 'Error'}`);
      return json(500, { error: 'internal_error' });
    }
  }

  return { handle, status };
}
