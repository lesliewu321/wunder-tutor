import { beforeAll, describe, expect, it } from 'vitest';
import { createApi } from './core.mjs';
import { createFamilies, DAILY_LIMITS } from './family.mjs';

// A pretend Supabase: real ES256 tokens signed here, the public key served as the project would serve it, and the
// two REST calls the API makes (plans, count_usage).
const URL_ = 'https://project.example';
const USER = '11111111-2222-4333-8444-555555555555';
const enc = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

let pair, jwk, stranger;
beforeAll(async () => {
  pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  stranger = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  jwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'key-1', alg: 'ES256', use: 'sig' };
});

async function token(claims = {}, key = pair.privateKey, header = {}) {
  const head = enc({ alg: 'ES256', typ: 'JWT', kid: 'key-1', ...header });
  const body = enc({ sub: USER, role: 'authenticated', aud: 'authenticated', iss: `${URL_}/auth/v1`, exp: Math.floor(Date.now() / 1000) + 600, ...claims });
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${Buffer.from(sig).toString('base64url')}`;
}

/** @param {{ plan?: string | null, used?: number, down?: boolean }} db */
function supabase(db = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    const path = String(url).replace(URL_, '');
    calls.push(`${init.method ?? 'GET'} ${path.split('?')[0]}`);
    const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
    if (path === '/auth/v1/.well-known/jwks.json') return json({ keys: [jwk] });
    if (db.down) return json({ message: 'down' }, 503);
    if (init.headers?.apikey !== 'secret') return json({ message: 'no key' }, 401);
    if (path.startsWith('/rest/v1/plans') && (init.method ?? 'GET') === 'GET') return json(db.plan ? [{ plan: db.plan, status: 'active', current_period_end: null }] : []);
    if (path.startsWith('/rest/v1/plans') && init.method === 'POST') { db.plan = JSON.parse(init.body).plan; return new Response(null, { status: 201 }); }
    if (path === '/rest/v1/rpc/count_usage') { const { p_kind, p_amount } = JSON.parse(init.body); db.used = (db.used ?? 0) + p_amount; return json({ [p_kind]: db.used }); }
    return json({ message: 'not found' }, 404);
  };
  return { fetchImpl, calls, db };
}
const quiet = { warn() {}, error() {} };

describe('who is asking: the sign-in token', () => {
  it('accepts a genuine, current token of this project and gives the parent\'s id', async () => {
    const f = createFamilies({ url: URL_, fetchImpl: supabase().fetchImpl, log: quiet });
    expect(await f.verify(await token())).toBe(USER);
  });

  it('refuses everything else', async () => {
    const f = createFamilies({ url: URL_, fetchImpl: supabase().fetchImpl, log: quiet });
    expect(await f.verify(await token({ exp: Math.floor(Date.now() / 1000) - 60 }))).toBeNull();          // expired
    expect(await f.verify(await token({}, stranger.privateKey))).toBeNull();                                // signed by someone else
    expect(await f.verify(await token({ iss: 'https://other.example/auth/v1' }))).toBeNull();              // another project
    expect(await f.verify(await token({ role: 'anon' }))).toBeNull();
    expect(await f.verify(await token({ is_anonymous: true }))).toBeNull();
    expect(await f.verify(await token({}, pair.privateKey, { alg: 'none' }))).toBeNull();
    expect(await f.verify(await token({}, pair.privateKey, { kid: 'unknown' }))).toBeNull();
    const good = await token();
    expect(await f.verify(`${good.slice(0, -4)}AAAA`)).toBeNull();                                          // tampered
    expect(await f.verify('not-a-token')).toBeNull();
    expect(await f.verify('')).toBeNull();
  });

  it('asks for the public keys once, not per request', async () => {
    const s = supabase();
    const f = createFamilies({ url: URL_, fetchImpl: s.fetchImpl, log: quiet });
    for (let i = 0; i < 5; i += 1) await f.verify(await token());
    expect(s.calls.filter((c) => c.includes('jwks'))).toHaveLength(1);
  });
});

describe('what a family may use', () => {
  it('reads the plan; counts the day\'s use against it', async () => {
    const s = supabase({ plan: 'beta', used: DAILY_LIMITS.beta.reads - 1 });
    const f = createFamilies({ url: URL_, secretKey: 'secret', fetchImpl: s.fetchImpl, log: quiet });
    expect(await f.plan(USER)).toBe('beta');
    expect(await f.use(USER, 'beta', 'reads')).toMatchObject({ ok: true, used: DAILY_LIMITS.beta.reads });
    expect(await f.use(USER, 'beta', 'reads')).toMatchObject({ ok: false, limit: DAILY_LIMITS.beta.reads });
  });

  it('no plan row is the free plan; without the secret key nothing is known', async () => {
    expect(await createFamilies({ url: URL_, secretKey: 'secret', fetchImpl: supabase().fetchImpl, log: quiet }).plan(USER)).toBe('free');
    expect(await createFamilies({ url: URL_, fetchImpl: supabase({ plan: 'beta' }).fetchImpl, log: quiet }).plan(USER)).toBe('unknown');
  });

  it('never locks a family out because the database is down', async () => {
    const f = createFamilies({ url: URL_, secretKey: 'secret', fetchImpl: supabase({ down: true }).fetchImpl, log: quiet });
    expect(await f.plan(USER)).toBe('unknown');
    expect(await f.use(USER, 'beta', 'scorings')).toEqual({ ok: true });
  });
});

describe('the API with family accounts', () => {
  const KEYS = { AZURE_SPEECH_KEY: 'k', AZURE_SPEECH_REGION: 'eastasia', GEMINI_API_KEY: 'g', BETA_ACCESS_CODE: 'open-sesame' };
  const api = (s) => createApi(KEYS, { requireAccessCode: true, log: quiet, families: createFamilies({ url: URL_, secretKey: 'secret', fetchImpl: s.fetchImpl, log: quiet }) });
  const health = async (a, headers) => (await a.handle(new Request('http://x/api/health', { headers }))).json();

  it('a signed-in family without a plan is not let in by the sign-in alone', async () => {
    expect(await health(api(supabase()), { authorization: `Bearer ${await token()}` })).toMatchObject({ authorized: false, family: true, plan: 'free' });
  });

  it('the access code given once while signed in becomes the family\'s beta plan: other devices need no code', async () => {
    const s = supabase();
    expect(await health(api(s), { authorization: `Bearer ${await token()}`, 'x-wunder-access': 'open-sesame' })).toMatchObject({ authorized: true, family: true, plan: 'beta' });
    expect(s.db.plan).toBe('beta');
    expect(await health(api(s), { authorization: `Bearer ${await token()}` })).toMatchObject({ authorized: true, plan: 'beta' });
  });

  it('a bad or missing token changes nothing: the code still works, a stranger still gets nothing', async () => {
    const s = supabase({ plan: 'beta' });
    expect(await health(api(s), { authorization: 'Bearer junk' })).toMatchObject({ authorized: false, family: false, plan: null });
    expect(await health(api(s), { authorization: 'Bearer junk', 'x-wunder-access': 'open-sesame' })).toMatchObject({ authorized: true, family: false });
  });

  it('reports account access without accepting a missing or invalid invite code', async () => {
    const s = supabase({ plan: 'beta' });
    const a = api(s), authorization = 'Bearer ' + await token();
    expect(await health(a, { authorization })).toMatchObject({ authorized: true, family: true, plan: 'beta', codeAccepted: false });
    expect(await health(a, { authorization, 'x-wunder-access': 'invalid-code' })).toMatchObject({ authorized: true, codeAccepted: false });
    const answer = await a.handle(new Request('http://x/api/redeem', { method: 'POST', headers: { authorization }, body: JSON.stringify({ code: 'invalid-code', device: 'device-aaaaaaaa' }) }));
    expect(await answer.json()).toEqual({ ok: false, reason: 'unknown' });
    expect(s.db.plan).toBe('beta');
    expect(await health(a, { authorization, 'x-wunder-access': 'open-sesame' })).toMatchObject({ authorized: true, codeAccepted: true });
  });

  it('an invalid code cannot give a free account beta access', async () => {
    const s = supabase();
    expect(await health(api(s), { authorization: 'Bearer ' + await token(), 'x-wunder-access': 'invalid-code' })).toMatchObject({ authorized: false, plan: 'free', codeAccepted: false });
    expect(s.db.plan).not.toBe('beta');
  });

  it('stops at the day\'s limit with a reason the app can show', async () => {
    const s = supabase({ plan: 'beta', used: DAILY_LIMITS.beta.voice });
    const res = await api(s).handle(new Request('http://x/api/tts', { method: 'POST', body: '{"text":"milk"}', headers: { authorization: `Bearer ${await token()}` } }));
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: 'daily_limit', kind: 'voice', limit: DAILY_LIMITS.beta.voice });
  });
});
