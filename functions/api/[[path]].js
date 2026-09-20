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
// at TPE and "User location is not supported" at HKG). So every Google request goes through a relay that lives in one
// place (egress/src/index.mjs). A relay lives where Cloudflare put it on first use: within the region of its hint,
// next to whoever used it first. For "apac" that was Hong Kong every time (google-apac, -2 and -3, all first used by
// requests entering at HKG on 2026-09-20, all refused by Google) — so they are not in this list: each new isolate would
// only waste two round trips on them. Relays are tried in this order and the first one Google accepts is kept for the
// life of this isolate: Oceania (it landed in Auckland, ~0.15 s from Hong Kong), then western North America (Dallas,
// ~0.2 s, always served). To do, for speed: a relay in Taiwan, Singapore or Japan — it has to be FIRST used by a request
// entering outside Hong Kong (e.g. only create it when request.cf.colo isn't HKG, and publish its name through KV).
const RELAYS = [{ name: 'google-oc', hint: 'oc' }, { name: 'google-wnam', hint: 'wnam' }];
const REFUSED_HERE = /location is not supported/i;
const relay = (env, i) => env.EGRESS.get(env.EGRESS.idFromName(RELAYS[i].name), { locationHint: RELAYS[i].hint });
const whereIs = (env, i) => relay(env, i).fetch('https://egress.internal/where').then((r) => r.json()).then((j) => j.colo, () => '?');

let chosen; // Promise<{ use: number, refused: string[] }>, per isolate
function chooseRelay(env) {
  chosen ??= (async () => {
    const key = cleanApiKey(env.GEMINI_API_KEY);
    const refused = [];
    for (let i = 0; i < RELAYS.length - 1; i++) {
      try {
        // Costs nothing: Google lists its models, or says where it won't serve.
        const res = await relay(env, i).fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', { headers: { 'x-goog-api-key': key } });
        if (!(res.status === 400 && REFUSED_HERE.test(await res.text()))) return { use: i, refused };
        refused.push(`${RELAYS[i].name} ${await whereIs(env, i)}`);
      } catch { refused.push(`${RELAYS[i].name} unreachable`); }
    }
    return { use: RELAYS.length - 1, refused };
  })();
  return chosen;
}

/** fetch() for Google. Without the binding (a preview deployment) it is the plain one. */
const googleFetch = (env) => (env.EGRESS ? async (url, init) => relay(env, (await chooseRelay(env)).use).fetch(url, init) : undefined);

/** Which relay is in use and where it lives ("google-apac-2 NRT"), and which ones Google refused — for /api/status. */
const egressInfo = (env) => (env.EGRESS ? async () => {
  const { use, refused } = await chooseRelay(env);
  return `${RELAYS[use].name} ${await whereIs(env, use)}${refused.length ? ` (refused: ${refused.join(', ')})` : ''}`;
} : undefined);

/**
 * Outbound WebSocket from a Worker goes through fetch() with an Upgrade header; the socket is
 * already open once accept() returns. (Same approach as wunder-manager's voice bridge.)
 */
const connectWebSocket = (env) => async (url) => {
  const target = url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  const viaRelay = env.EGRESS && new URL(target).hostname === 'generativelanguage.googleapis.com';
  const response = viaRelay
    ? await relay(env, (await chooseRelay(env)).use).fetch(target, { headers: { Upgrade: 'websocket' } })
    : await fetch(target, { headers: { Upgrade: 'websocket' } });
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

export async function onRequest({ request, env }) {
  api ??= createApi(env, {
    connectWebSocket: connectWebSocket(env), canDialWebSocket: true, requireAccessCode: true,
    ttsCache: env.TTS_CACHE ? kvCache(env.TTS_CACHE) : undefined,
    googleFetch: googleFetch(env), egressInfo: egressInfo(env),
  });
  return api.handle(request, { clientId: request.headers.get('cf-connecting-ip') ?? 'unknown' });
}
