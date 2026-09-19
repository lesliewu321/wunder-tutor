import { describe, expect, it } from 'vitest';
import { createApi, missingScores, oneChangeAway } from './core.mjs';

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

describe('assess helpers', () => {
  it('spots Azure answering "Success" without any pronunciation scores', () => {
    const ok = { RecognitionStatus: 'Success', NBest: [{ AccuracyScore: 90, Words: [] }] };
    const glitch = { RecognitionStatus: 'Success', NBest: [{ Display: 'milk', Words: [] }] };
    expect(missingScores(JSON.stringify(glitch))).toBe(true);
    expect(missingScores(JSON.stringify(ok))).toBe(false);
    expect(missingScores(JSON.stringify({ RecognitionStatus: 'NoMatch' }))).toBe(false);
    expect(missingScores('not json')).toBe(false);
  });

  it('only scores likely mistakes that change one word or one character', () => {
    expect(oneChangeAway('Thank you!', 'Fank you!')).toBe(true);
    expect(oneChangeAway('I am very hungry.', 'I am wery hungry.')).toBe(true);
    expect(oneChangeAway('Thank you!', 'Buy crypto now')).toBe(false);
    expect(oneChangeAway('Thank you!', 'Thank you!')).toBe(false);
    expect(oneChangeAway('我想买', '我想卖')).toBe(true);
    expect(oneChangeAway('我想买', '你想卖')).toBe(false);
    expect(oneChangeAway('我想买', '我想买东西')).toBe(false);
  });

  it('rejects unrelated alternative texts', async () => {
    const api = createApi(KEYS);
    const res = await post(api, `/api/assess?text=milk&alts=${encodeURIComponent(JSON.stringify(['anything at all']))}`, new Uint8Array(100));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_alts');
  });
});

describe('reading text', () => {
  it('needs a Gemini key and something to read', async () => {
    expect((await post(createApi({ AZURE_SPEECH_KEY: 'k', AZURE_SPEECH_REGION: 'eastasia' }), '/api/read', JSON.stringify({ text: 'hi' }), { 'content-type': 'application/json' })).status).toBe(503);
    const api = createApi(KEYS);
    expect((await post(api, '/api/read', JSON.stringify({ text: '  ' }), { 'content-type': 'application/json' })).status).toBe(400);
    expect((await post(api, '/api/read', new Uint8Array(10), { 'content-type': 'image/jpeg' })).status).toBe(400);
  });
});
