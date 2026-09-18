import { describe, expect, it } from 'vitest';
import { createApi } from './core.mjs';

const get = (api, path, headers) => api.handle(new Request(`http://x${path}`, { headers }));
const post = (api, path, body, headers) => api.handle(new Request(`http://x${path}`, { method: 'POST', body, headers }));
const KEYS = { AZURE_SPEECH_KEY: 'k', AZURE_SPEECH_REGION: 'eastasia', GEMINI_API_KEY: 'g' };

describe('API access control', () => {
  it('is open on localhost when no access code is configured', async () => {
    const h = await (await get(createApi(KEYS), '/api/health')).json();
    expect(h).toMatchObject({ needsCode: false, authorized: true, azure: true, gemini: true });
  });

  it('reveals nothing and serves nothing until the right code is sent', async () => {
    const api = createApi({ ...KEYS, BETA_ACCESS_CODE: 'open-sesame' });
    expect(await (await get(api, '/api/health')).json()).toMatchObject({ needsCode: true, authorized: false, azure: false, gemini: false, ttsVersion: null });
    expect((await post(api, '/api/tts', '{"text":"milk"}')).status).toBe(401);
    expect((await post(api, '/api/assess?text=milk', new Uint8Array(100), { 'x-wunder-access': 'wrong' })).status).toBe(401);
    expect(await (await get(api, '/api/health', { 'x-wunder-access': 'open-sesame' })).json()).toMatchObject({ authorized: true, azure: true, gemini: true });
  });

  it('fails closed on a public deployment with no access code set', async () => {
    const api = createApi(KEYS, { requireAccessCode: true });
    expect(await (await get(api, '/api/health', { 'x-wunder-access': '' })).json()).toMatchObject({ needsCode: true, authorized: false, azure: false });
    expect((await post(api, '/api/tts', '{"text":"milk"}', { 'x-wunder-access': 'anything' })).status).toBe(401);
  });

  it('slows down code guessing', async () => {
    const api = createApi({ ...KEYS, BETA_ACCESS_CODE: 'open-sesame' });
    let last;
    for (let i = 0; i < 14; i++) last = await get(api, '/api/health', { 'x-wunder-access': `guess-${i}` });
    expect(last.status).toBe(429);
  });

  it('rejects oversized bodies, unknown routes and wrong methods', async () => {
    const api = createApi(KEYS);
    expect((await post(api, '/api/assess?text=milk', new Uint8Array(10), { 'content-length': String(6 * 1024 * 1024) })).status).toBe(413);
    expect((await get(api, '/api/nope')).status).toBe(404);
    expect((await get(api, '/api/tts')).status).toBe(405);
    expect((await post(api, '/api/assess', new Uint8Array(100))).status).toBe(400);
  });
});
