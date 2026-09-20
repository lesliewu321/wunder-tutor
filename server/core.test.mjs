import { describe, expect, it } from 'vitest';
import { cleanApiKey, createApi, missingScores, oneChangeAway } from './core.mjs';

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

  it('never counts the right code as a guess, however busy the learner is', async () => {
    const api = createApi({ ...KEYS, BETA_ACCESS_CODE: 'open-sesame' });
    let last;
    for (let i = 0; i < 40; i++) last = await get(api, '/api/health', { 'x-wunder-access': 'open-sesame' });
    expect(last.status).toBe(200);
    expect((await last.json()).authorized).toBe(true);
  });

  it('rejects oversized bodies, unknown routes and wrong methods', async () => {
    const api = createApi(KEYS);
    expect((await post(api, '/api/assess?text=milk', new Uint8Array(10), { 'content-length': String(6 * 1024 * 1024) })).status).toBe(413);
    expect((await get(api, '/api/nope')).status).toBe(404);
    expect((await get(api, '/api/tts')).status).toBe(405);
    expect((await post(api, '/api/assess', new Uint8Array(100))).status).toBe(400);
  });
});

describe('keys as pasted', () => {
  it('drops whitespace a paste left in a key, and keeps the key itself', () => {
    // A line break inside a pasted key made the request invalid: it failed before ever reaching Google (2026-09-20).
    expect(cleanApiKey('AIzaSyB-sample\nkey_s123')).toBe('AIzaSyB-samplekey_s123');
    expect(cleanApiKey('  spaced key  ')).toBe('spacedkey');
    // Copied from a web page or a document: a zero-width space, a non-breaking space, a byte-order mark.
    expect(cleanApiKey('﻿AIza​SyB key')).toBe('AIzaSyBkey');
    expect(cleanApiKey(undefined)).toBe('');
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

describe('live status: do the keys actually work?', () => {
  const upstream = (google) => async (url) => (String(url).includes('issueToken')
    ? new Response('token', { status: 200 })
    : new Response(JSON.stringify(google.body), { status: google.status }));

  it('asks the services themselves, tells anyone the coarse words and only a trusted device the details', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = upstream({ status: 400, body: { error: { message: 'API key not valid. Please pass a valid API key.' } } });
    try {
      const api = createApi({ ...KEYS, GEMINI_API_KEY: ' AIza\u200bbad\n', BETA_ACCESS_CODE: 'open-sesame' });
      const anyone = await (await get(api, '/api/status')).json();
      expect(anyone).toMatchObject({ scoring: 'ok', reading: 'key_refused', voice: 'key_refused' });
      expect(anyone.notes).toBeUndefined();
      const trusted = await (await get(api, '/api/status', { 'x-wunder-access': 'open-sesame' })).json();
      // 7 usable characters of the 8 stored (the invisible one is dropped) — never the key itself.
      expect(trusted.notes.reading).toContain('API key not valid');
      expect(trusted.notes.reading).toContain('key 7/8');
      expect(JSON.stringify(trusted)).not.toContain('AIza');
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it('says so when everything works, and when nothing is set up', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = upstream({ status: 200, body: { name: 'models/x' } });
    try {
      expect(await (await get(createApi(KEYS), '/api/status')).json()).toMatchObject({ scoring: 'ok', reading: 'ok', voice: 'ok' });
      expect(await (await get(createApi({}), '/api/status')).json()).toMatchObject({ scoring: 'not_set', reading: 'not_set', voice: 'not_set' });
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
