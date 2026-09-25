// Cloudflare Pages Function: every /api/* request on the deployed site.
// Same core as the local Node proxy (server/core.mjs); only storage, the WebSocket dialer and the way out to Google
// differ.
//
// Secrets (uploaded with `npm run keys:push`, never in git): AZURE_SPEECH_KEY, AZURE_SPEECH_REGION, GEMINI_API_KEY;
// BETA_ACCESS_CODE with `wrangler pages secret put`; optionally ANTHROPIC_API_KEY.
// Bindings: KV namespace TTS_CACHE — accepted teacher takes, so each phrase is generated once;
//           Durable Object EGRESS (the `wunder-egress` Worker) — where calls to Google leave from.
import { cleanApiKey, createApi } from '../../server/core.mjs';

// ---------------------------------------------------------------- the way out to Google
// Google's Gemini service refuses requests that leave from Hong Kong, and this Function runs at the Cloudflare location
// nearest the learner — for the launch market, Hong Kong (seen live, 2026-09-20: the same code and key answered "ok"
// at TPE and "User location is not supported" at HKG). So each location first asks Google DIRECTLY whether it is
// served from here (Taiwan, Singapore, Japan, … are); only a location Google refuses — Hong Kong, and mainland China
// should Cloudflare ever run us there — sends its Google requests through a relay that lives in one place
// (egress/src/index.mjs). The choice is made once per isolate, and an isolate belongs to one location, so a Taipei
// learner never pays the Tokyo round trip. A relay lives where Cloudflare put it on FIRST use: somewhere in the region of its hint,
// and for "apac" that is often Hong Kong itself when a Hong Kong request is first (google-apac, -2, -3: all HKG, all
// refused by Google). So the Asia-Pacific relays below were first used from the Auckland relay instead (the relay's
// own "spawn", 2026-09-20): google-apac-a landed in Tokyo (NRT), -c in Osaka (KIX) — ~50 ms from Hong Kong, served by
// Google. (-b and -e landed in HKG and are not listed; Singapore never came up in six tries.) They are tried in this
// order and the first one Google accepts is kept for the life of this isolate; Auckland (~150 ms) and Dallas
// (~200 ms) remain as the last resorts. To make another: see "spawn" in egress/src/index.mjs and the handoff.
const RELAYS = [{ name: 'google-apac-a', hint: 'apac' }, { name: 'google-apac-c', hint: 'apac' }, { name: 'google-oc', hint: 'oc' }, { name: 'google-wnam', hint: 'wnam' }];
const DIRECT = -1; // "use": no relay — this location is served by Google
const REFUSED_HERE = /location is not supported/i;
const PROBE = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1'; // costs nothing: Google lists its models, or says where it won't serve
const relay = (env, i) => env.EGRESS.get(env.EGRESS.idFromName(RELAYS[i].name), { locationHint: RELAYS[i].hint });
const whereIs = (env, i) => relay(env, i).fetch('https://egress.internal/where').then((r) => r.json()).then((j) => j.colo, () => '?');
const refusedHere = async (res) => res.status === 400 && REFUSED_HERE.test(await res.text());

let chosen; // Promise<{ use: number, refused: string[] }>, per isolate (= per Cloudflare location)
let colo = '?'; // where this isolate runs, from the first request (request.cf.colo), for /api/status
function chooseRelay(env) {
  chosen ??= (async () => {
    const key = cleanApiKey(env.GEMINI_API_KEY);
    const refused = [];
    // First from here: most of the world is served by Google directly. Only a refusal (not a hiccup) sends this
    // location to a relay — a network error here would otherwise pin the isolate to a relay for its whole life.
    try {
      if (!(await refusedHere(await fetch(PROBE, { headers: { 'x-goog-api-key': key } })))) return { use: DIRECT, refused };
      refused.push(`direct ${colo}`);
    } catch { refused.push(`direct ${colo} unreachable`); }
    for (let i = 0; i < RELAYS.length - 1; i++) {
      try {
        if (!(await refusedHere(await relay(env, i).fetch(PROBE, { headers: { 'x-goog-api-key': key } })))) return { use: i, refused };
        refused.push(`${RELAYS[i].name} ${await whereIs(env, i)}`);
      } catch { refused.push(`${RELAYS[i].name} unreachable`); }
    }
    return { use: RELAYS.length - 1, refused };
  })();
  return chosen;
}

/** fetch() for Google: plain from a location Google serves, through the chosen relay from one it refuses. Without the binding (a preview deployment) it is the plain one. */
const googleFetch = (env) => (env.EGRESS ? async (url, init) => {
  const { use } = await chooseRelay(env);
  return use === DIRECT ? fetch(url, init) : relay(env, use).fetch(url, init);
} : undefined);

/** Where Google calls leave from ("direct TPE", or "google-apac-a NRT" with what was refused) — for /api/status. */
const egressInfo = (env) => (env.EGRESS ? async () => {
  const { use, refused } = await chooseRelay(env);
  const where = use === DIRECT ? `direct ${colo}` : `${RELAYS[use].name} ${await whereIs(env, use)}`;
  return `${where}${refused.length ? ` (refused: ${refused.join(', ')})` : ''}`;
} : undefined);

/**
 * Outbound WebSocket from a Worker goes through fetch() with an Upgrade header; the socket is
 * already open once accept() returns. (Same approach as wunder-manager's voice bridge.)
 */
const connectWebSocket = (env) => async (url) => {
  const target = url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  const toGoogle = env.EGRESS && new URL(target).hostname === 'generativelanguage.googleapis.com';
  const use = toGoogle ? (await chooseRelay(env)).use : DIRECT;
  const response = use === DIRECT
    ? await fetch(target, { headers: { Upgrade: 'websocket' } })
    : await relay(env, use).fetch(target, { headers: { Upgrade: 'websocket' } });
  const socket = response.webSocket;
  if (!socket) throw new Error(`websocket upgrade refused (${response.status})`);
  socket.binaryType = 'arraybuffer'; // before accept(), so binary frames arrive synchronously
  socket.accept();
  return { socket, alreadyOpen: true };
};

const kvCache = (kv) => ({
  get: async (key) => { const hit = await kv.get(`tts:${key}`, 'arrayBuffer'); return hit ? new Uint8Array(hit) : null; },
  put: (key, wav) => kv.put(`tts:${key}`, wav),
});

let api; // one per isolate; env bindings are stable for its lifetime

export async function onRequest({ request, env, waitUntil }) {
  if (colo === '?') colo = request.cf?.colo ?? '?';
  api ??= createApi(env, {
    connectWebSocket: connectWebSocket(env), canDialWebSocket: true, requireAccessCode: true,
    ttsCache: env.TTS_CACHE ? kvCache(env.TTS_CACHE) : undefined,
    googleFetch: googleFetch(env), egressInfo: egressInfo(env),
  });
  // waitUntil: a contributed recording is stored after the score has gone back (server/core.mjs keepIfAsked).
  return api.handle(request, { clientId: request.headers.get('cf-connecting-ip') ?? 'unknown', waitUntil });
}
