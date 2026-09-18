// Cloudflare Pages Function: every /api/* request on the deployed site.
// Same core as the local Node proxy (server/core.mjs); only storage and the WebSocket dialer differ.
//
// Secrets (set with `wrangler pages secret put`, never in git): AZURE_SPEECH_KEY, AZURE_SPEECH_REGION,
// GEMINI_API_KEY, BETA_ACCESS_CODE, optionally ANTHROPIC_API_KEY.
// Optional binding: KV namespace TTS_CACHE — accepted teacher takes, so each phrase is generated once.
import { createApi } from '../../server/core.mjs';

/**
 * Outbound WebSocket from a Worker goes through fetch() with an Upgrade header; the socket is
 * already open once accept() returns. (Same approach as wunder-manager's voice bridge.)
 */
async function connectWebSocket(url) {
  const response = await fetch(url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:'), { headers: { Upgrade: 'websocket' } });
  const socket = response.webSocket;
  if (!socket) throw new Error(`websocket upgrade refused (${response.status})`);
  socket.binaryType = 'arraybuffer'; // before accept(), so binary frames arrive synchronously
  socket.accept();
  return { socket, alreadyOpen: true };
}

const kvCache = (kv) => ({
  get: async (key) => { const hit = await kv.get(`tts:${key}`, 'arrayBuffer'); return hit ? new Uint8Array(hit) : null; },
  put: (key, wav) => kv.put(`tts:${key}`, wav),
});

let api; // one per isolate; env bindings are stable for its lifetime

export async function onRequest({ request, env }) {
  api ??= createApi(env, { connectWebSocket, canDialWebSocket: true, requireAccessCode: true, ttsCache: env.TTS_CACHE ? kvCache(env.TTS_CACHE) : undefined });
  return api.handle(request, { clientId: request.headers.get('cf-connecting-ip') ?? 'unknown' });
}
