import { afterEach, describe, expect, it } from 'vitest';
import { createApi } from './core.mjs';
import { createInvites, inviteCode } from './invites.mjs';

const KEYS = { AZURE_SPEECH_KEY: 'k', AZURE_SPEECH_REGION: 'eastasia', GEMINI_API_KEY: 'g', BETA_ACCESS_CODE: 'open-sesame' };
const post = (api, path, body, headers, ctx) => api.handle(new Request(`http://x${path}`, { method: 'POST', body, headers }), ctx);
const get = (api, path, headers) => api.handle(new Request(`http://x${path}`, { headers }));
const jsonRes = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** A database that answers the three things invites.mjs asks it, and remembers what it was told. */
function fakeDb({ codes = {}, answer, storageStatus = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const u = new URL(url);
    if (u.pathname.endsWith('/rest/v1/invite_codes')) {
      const code = decodeURIComponent(u.searchParams.get('code')?.replace(/^eq\./, '') ?? '');
      return jsonRes(code in codes ? [{ disabled: codes[code] === 'disabled' }] : []);
    }
    if (u.pathname.endsWith('/rest/v1/rpc/redeem_invite')) return jsonRes(answer ?? { ok: true, reason: 'new', places: 10, used: 1, expires_at: '2026-10-05T00:00:00Z' });
    if (u.pathname.includes('/storage/v1/object/contributions/')) return new Response('{}', { status: storageStatus });
    if (u.pathname.endsWith('/rest/v1/contributions')) return new Response(null, { status: 201 });
    return new Response('not faked', { status: 500 });
  };
  return { calls, fetchImpl };
}
const invitesWith = (db, extra = {}) => createInvites({ url: 'https://db.example', secretKey: 'sb_secret_x', fetchImpl: db.fetchImpl, log: { warn() {} }, ...extra });

describe('invite codes as typed', () => {
  it('reads a code however it arrives: case, spaces, invisible characters', () => {
    expect(inviteCode(' wunder-7k2m ')).toBe('WUNDER-7K2M');
    expect(inviteCode('WUNDER​-7K2M')).toBe('WUNDER-7K2M');
    expect(inviteCode('ｗｕｎｄｅｒ－７ｋ２ｍ'.replace('－', '-'))).toBe('WUNDER-7K2M'); // full-width, as a Chinese keyboard may give it
  });
});

describe('an invite code unlocking the app', () => {
  it('accepts a code we issued, and turns away one we did not or switched off', async () => {
    const db = fakeDb({ codes: { 'WUNDER-7K2M': 'ok', 'WUNDER-OFF1': 'disabled' } });
    const invites = invitesWith(db);
    expect(await invites.isValid('wunder-7k2m')).toBe(true);
    expect(await invites.isValid('WUNDER-OFF1')).toBe(false);
    expect(await invites.isValid('NEVER-SEEN')).toBe(false);
  });

  it('asks the database once a minute, not on every request of a lesson', async () => {
    let t = 0;
    const db = fakeDb({ codes: { 'WUNDER-7K2M': 'ok' } });
    const invites = invitesWith(db, { now: () => t });
    await invites.isValid('WUNDER-7K2M');
    await invites.isValid('WUNDER-7K2M');
    expect(db.calls.filter((c) => c.url.includes('invite_codes'))).toHaveLength(1);
    t += 61_000;
    await invites.isValid('WUNDER-7K2M');
    expect(db.calls.filter((c) => c.url.includes('invite_codes'))).toHaveLength(2);
  });

  it('unlocks nothing at all without the secret key, exactly as before invite codes existed', async () => {
    const invites = createInvites({ url: 'https://db.example', secretKey: '', fetchImpl: async () => { throw new Error('must not be called'); } });
    expect(await invites.isValid('WUNDER-7K2M')).toBe(false);
  });

  it('lets a device in through the API with an invite code instead of the master code', async () => {
    const api = createApi(KEYS, { invites: invitesWith(fakeDb({ codes: { 'WUNDER-7K2M': 'ok' } })) });
    const h = await (await get(api, '/api/health', { 'x-wunder-access': encodeURIComponent('WUNDER-7K2M') })).json();
    expect(h.authorized).toBe(true);
    const no = await (await get(api, '/api/health', { 'x-wunder-access': 'WUNDER-NOPE' })).json();
    expect(no.authorized).toBe(false);
  });
});

describe('taking a place on a code', () => {
  it('needs no code already — it is how a device gets one', async () => {
    const api = createApi(KEYS, { invites: invitesWith(fakeDb()) });
    const res = await post(api, '/api/redeem', JSON.stringify({ code: 'wunder-7k2m', device: 'device-aaaaaaaa' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, reason: 'new', places: 10, used: 1 });
  });

  it('says precisely why a code was turned away, so the app can too', async () => {
    for (const reason of ['full', 'expired', 'disabled', 'unknown']) {
      const api = createApi(KEYS, { invites: invitesWith(fakeDb({ answer: { ok: false, reason } })) });
      const r = await (await post(api, '/api/redeem', JSON.stringify({ code: 'WUNDER-7K2M', device: 'device-aaaaaaaa' }))).json();
      expect(r).toMatchObject({ ok: false, reason });
    }
  });

  it('still accepts the master code, which is not an invite and takes no place', async () => {
    const db = fakeDb();
    const api = createApi(KEYS, { invites: invitesWith(db) });
    const r = await (await post(api, '/api/redeem', JSON.stringify({ code: 'open-sesame', device: 'device-aaaaaaaa' }))).json();
    expect(r).toMatchObject({ ok: true, reason: 'master' });
    expect(db.calls.some((c) => c.url.includes('redeem_invite'))).toBe(false);
  });

  it('refuses a malformed device id rather than store it', async () => {
    const api = createApi(KEYS, { invites: invitesWith(fakeDb()) });
    expect((await post(api, '/api/redeem', JSON.stringify({ code: 'WUNDER-7K2M', device: 'x' }))).status).toBe(400);
  });

  it('counts a code that does not exist as a guess, but not a real code that happens to be full', async () => {
    const full = createApi(KEYS, { invites: invitesWith(fakeDb({ answer: { ok: false, reason: 'full' } })) });
    for (let i = 0; i < 20; i++) await post(full, '/api/redeem', JSON.stringify({ code: 'WUNDER-7K2M', device: 'device-aaaaaaaa' }));
    expect((await post(full, '/api/redeem', JSON.stringify({ code: 'WUNDER-7K2M', device: 'device-aaaaaaaa' }))).status).toBe(200);

    const guessing = createApi(KEYS, { invites: invitesWith(fakeDb({ answer: { ok: false, reason: 'unknown' } })) });
    let last;
    for (let i = 0; i < 20; i++) last = await post(guessing, '/api/redeem', JSON.stringify({ code: `GUESS-${i}`, device: 'device-aaaaaaaa' }));
    expect(last.status).toBe(429);
  });
});

describe('keeping a recording a learner chose to give', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });
  const AZURE_OK = { RecognitionStatus: 'Success', NBest: [{ AccuracyScore: 88, Words: [{ Word: 'milk', AccuracyScore: 88 }] }] };
  const azure = (body) => async () => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });

  function spyInvites(fail = false) {
    const kept = [];
    return {
      kept,
      invites: {
        enabled: true,
        isValid: async () => false,
        redeem: async () => ({ ok: true, reason: 'new' }),
        contribute: async (c) => { if (fail) throw new Error('storage down'); kept.push(c); return 'path'; },
      },
    };
  }
  const assess = (api, query, ctx) => post(api, `/api/assess?text=milk&locale=en-US${query}`, new Uint8Array(200), { 'x-wunder-access': 'open-sesame' }, ctx);

  it('keeps the take the scorer heard, with what was asked and the answer, and no name', async () => {
    globalThis.fetch = azure(AZURE_OK);
    const spy = spyInvites();
    const waited = [];
    const api = createApi(KEYS, { invites: spy.invites });
    const res = await assess(api, '&keep=1&device=device-aaaaaaaa&band=junior&home=yue&v=0.1.0', { waitUntil: (p) => waited.push(p) });
    expect(res.status).toBe(200);
    await Promise.all(waited);
    expect(spy.kept).toHaveLength(1);
    expect(spy.kept[0]).toMatchObject({ device: 'device-aaaaaaaa', locale: 'en-US', band: 'junior', homeLanguage: 'yue', reference: 'milk', overall: 88, appVersion: '0.1.0' });
    expect(spy.kept[0].wav).toBeInstanceOf(Uint8Array);
    expect(JSON.stringify(spy.kept[0])).not.toMatch(/name/i);
  });

  it('keeps nothing when the learner has not agreed', async () => {
    globalThis.fetch = azure(AZURE_OK);
    const spy = spyInvites();
    await assess(createApi(KEYS, { invites: spy.invites }), '&device=device-aaaaaaaa');
    expect(spy.kept).toHaveLength(0);
  });

  it('keeps nothing when the take was silence — there is nothing in it to learn from', async () => {
    globalThis.fetch = azure({ RecognitionStatus: 'InitialSilenceTimeout' });
    const spy = spyInvites();
    await assess(createApi(KEYS, { invites: spy.invites }), '&keep=1&device=device-aaaaaaaa');
    expect(spy.kept).toHaveLength(0);
  });

  it('never lets a failure to keep a recording cost the learner their score', async () => {
    globalThis.fetch = azure(AZURE_OK);
    const spy = spyInvites(true);
    const waited = [];
    const res = await assess(createApi(KEYS, { invites: spy.invites }), '&keep=1&device=device-aaaaaaaa', { waitUntil: (p) => waited.push(p) });
    expect(res.status).toBe(200);
    expect((await res.json()).NBest[0].AccuracyScore).toBe(88);
    await expect(Promise.all(waited)).resolves.toBeDefined();
  });

  it('files an unknown age band as none rather than trust what the browser sent', async () => {
    globalThis.fetch = azure(AZURE_OK);
    const spy = spyInvites();
    const waited = [];
    await assess(createApi(KEYS, { invites: spy.invites }), '&keep=1&device=device-aaaaaaaa&band=admin', { waitUntil: (p) => waited.push(p) });
    await Promise.all(waited);
    expect(spy.kept[0].band).toBeNull();
  });
});

describe('where a kept recording goes', () => {
  it('writes the audio to the private bucket first, then the row that points at it', async () => {
    const db = fakeDb();
    const invites = invitesWith(db, { uuid: () => 'id-1', now: () => Date.parse('2026-09-21T02:00:00Z') });
    const path = await invites.contribute({ device: 'device-aaaaaaaa', locale: 'zh-CN', band: 'teen', homeLanguage: 'yue', reference: '水', overall: 92, azure: {}, wav: new Uint8Array(4) });
    expect(path).toBe('zh-CN/2026-09-21/id-1.wav');
    const order = db.calls.map((c) => new URL(c.url).pathname);
    expect(order[0]).toMatch(/storage\/v1\/object\/contributions\/zh-CN\/2026-09-21\/id-1\.wav$/);
    expect(order[1]).toMatch(/rest\/v1\/contributions$/);
  });

  it('puts the audio in the recordings store (R2) when there is one, and the row says so', async () => {
    const db = fakeDb();
    const puts = [];
    const invites = invitesWith(db, { uuid: () => 'id-2', now: () => Date.parse('2026-09-25T02:00:00Z'), recordings: { put: async (key, bytes, type) => { puts.push({ key, size: bytes.length, type }); }, delete: async () => {} } });
    const path = await invites.contribute({ device: 'device-aaaaaaaa', locale: 'en-US', band: 'junior', reference: 'milk', overall: 80, azure: {}, wav: new Uint8Array(4) });
    expect(path).toBe('en-US/2026-09-25/id-2.wav');
    expect(puts).toEqual([{ key: 'en-US/2026-09-25/id-2.wav', size: 4, type: 'audio/wav' }]);
    expect(db.calls.some((c) => c.url.includes('/storage/v1/'))).toBe(false);
    const row = JSON.parse(db.calls.find((c) => c.url.endsWith('/rest/v1/contributions')).init.body);
    expect(row).toMatchObject({ audio_path: 'en-US/2026-09-25/id-2.wav', store: 'r2' });
  });

  it('forgets a device: R2 keys from the store, older keys from Supabase Storage, then the rows', async () => {
    const deleted = [];
    const calls = [];
    const fetchImpl = async (url, init = {}) => {
      calls.push({ url: String(url), init });
      const u = new URL(url);
      if (u.pathname.endsWith('/rest/v1/contributions') && (init.method ?? 'GET') === 'GET') return jsonRes([{ audio_path: 'en-US/2026-09-25/a.wav', store: 'r2' }, { audio_path: 'zh-CN/2026-09-21/b.wav', store: 'supabase' }]);
      if (u.pathname.endsWith('/rest/v1/contributions') && init.method === 'DELETE') return new Response(null, { status: 204 });
      if (u.pathname.endsWith('/storage/v1/object/contributions') && init.method === 'DELETE') return jsonRes([]);
      return new Response('not faked', { status: 500 });
    };
    const invites = createInvites({ url: 'https://db.example', secretKey: 'sb_secret_x', fetchImpl, log: { warn() {} }, recordings: { put: async () => {}, delete: async (keys) => { deleted.push(...keys); } } });
    expect(await invites.forget('device-aaaaaaaa')).toBe(2);
    expect(deleted).toEqual(['en-US/2026-09-25/a.wav']);
    const storageDelete = calls.find((c) => c.url.endsWith('/storage/v1/object/contributions') && c.init.method === 'DELETE');
    expect(JSON.parse(storageDelete.init.body)).toEqual({ prefixes: ['zh-CN/2026-09-21/b.wav'] });
    const rowsDelete = calls.find((c) => c.url.includes('/rest/v1/contributions?device=eq.device-aaaaaaaa') && c.init.method === 'DELETE');
    expect(rowsDelete).toBeTruthy();
    expect(calls.findIndex((c) => c === rowsDelete)).toBeGreaterThan(calls.findIndex((c) => c === storageDelete));
    await expect(invites.forget('x')).rejects.toThrow(/bad device id/);
  });

  it('writes no row when the audio did not arrive, so no row ever points at nothing', async () => {
    const db = fakeDb({ storageStatus: 500 });
    await expect(invitesWith(db).contribute({ device: 'device-aaaaaaaa', locale: 'en-US', reference: 'milk', wav: new Uint8Array(4) })).rejects.toThrow(/storage/);
    expect(db.calls.some((c) => c.url.includes('/rest/v1/contributions'))).toBe(false);
  });
});
