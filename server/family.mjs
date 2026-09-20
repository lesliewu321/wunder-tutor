// Families with an account (Supabase, see supabase/migrations): who is asking, what may they use, how much have they
// used today. Runtime-neutral like core.mjs (fetch + WebCrypto only).
//
//   * WHO: the app sends the parent's sign-in token (Authorization: Bearer …). Supabase signs tokens with a private key
//     (ES256); the matching PUBLIC keys are published at <project>/auth/v1/.well-known/jwks.json, so checking a token
//     needs no secret at all.
//   * WHAT: public.plans — 'beta' once the family has given the beta access code on any device, 'family' once they
//     pay, otherwise 'free' (which unlocks nothing yet). Reading and setting it needs the project's SECRET key.
//   * HOW MUCH: public.count_usage() adds to the family's counters for the day (Hong Kong time) in one step and
//     returns the totals, which are compared with the plan's limits here.
// Without the secret key configured, tokens can still be checked but plans can't be read: every family is 'unknown'
// and only the access code unlocks the API, exactly as before accounts existed.

const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const text = (bytes) => new TextDecoder().decode(bytes);

/** What a family may do in a day, by plan. 'free' and 'unknown' unlock nothing: the device's access code still can. */
export const DAILY_LIMITS = {
  beta: { scorings: 400, reads: 40, voice: 400, tutor: 150 },
  family: { scorings: 600, reads: 60, voice: 600, tutor: 300 },
};

/**
 * @param {{ url: string, secretKey?: string, fetchImpl?: typeof fetch, log?: Console, now?: () => number }} opts
 */
export function createFamilies({ url, secretKey = '', fetchImpl = fetch, log = console, now = Date.now }) {
  const base = url.replace(/\/+$/, '');
  const issuer = `${base}/auth/v1`;
  let keys = null; // { until, byId: Map<kid, CryptoKey> }
  const plans = new Map(); // user → { until, plan }

  async function signingKeys(force = false) {
    if (!force && keys && keys.until > now()) return keys.byId;
    const res = await fetchImpl(`${issuer}/.well-known/jwks.json`);
    if (!res.ok) throw new Error(`jwks ${res.status}`);
    const byId = new Map();
    for (const jwk of (await res.json()).keys ?? []) {
      if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') continue;
      byId.set(jwk.kid, await crypto.subtle.importKey('jwk', { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']));
    }
    keys = { until: now() + 10 * 60_000, byId };
    return byId;
  }

  /** The parent's user id when the token is genuine, current and meant for this project; otherwise null. Never throws. */
  async function verify(token) {
    try {
      const [h, p, s] = String(token).split('.');
      if (!h || !p || !s) return null;
      const header = JSON.parse(text(b64url(h))), claims = JSON.parse(text(b64url(p)));
      if (header.alg !== 'ES256' || !header.kid) return null;
      let key = (await signingKeys()).get(header.kid);
      if (!key) key = (await signingKeys(true)).get(header.kid); // the project's keys were rotated
      if (!key) return null;
      const good = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, b64url(s), new TextEncoder().encode(`${h}.${p}`));
      if (!good) return null;
      const seconds = now() / 1000;
      if (typeof claims.exp !== 'number' || claims.exp < seconds - 5) return null;
      if (claims.iss !== issuer || claims.role !== 'authenticated' || claims.is_anonymous === true) return null;
      const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (!aud.includes('authenticated')) return null;
      return /^[0-9a-f-]{36}$/i.test(claims.sub ?? '') ? claims.sub : null;
    } catch (e) {
      log.warn?.(`[family] token check failed: ${e?.message ?? e}`);
      return null;
    }
  }

  const rest = (path, init = {}) => fetchImpl(`${base}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: secretKey, ...(secretKey.startsWith('sb_') ? {} : { Authorization: `Bearer ${secretKey}` }), 'Content-Type': 'application/json', ...init.headers },
  });

  /** 'beta' | 'family' | 'free' | 'unknown' (no secret key here, or the database did not answer). */
  async function plan(user) {
    if (!secretKey) return 'unknown';
    const hit = plans.get(user);
    if (hit && hit.until > now()) return hit.plan;
    try {
      const res = await rest(`plans?parent_id=eq.${user}&select=plan,status,current_period_end`);
      if (!res.ok) throw new Error(`plans ${res.status}`);
      const row = (await res.json())[0];
      const lapsed = row?.current_period_end && Date.parse(row.current_period_end) < now();
      const value = row && row.status === 'active' && !lapsed ? row.plan : 'free';
      plans.set(user, { until: now() + 60_000, plan: value });
      if (plans.size > 5000) plans.delete(plans.keys().next().value);
      return value;
    } catch (e) {
      log.warn?.(`[family] plan: ${e?.message ?? e}`);
      return 'unknown';
    }
  }

  /** The family gave the beta access code while signed in: from now on the account itself unlocks the API. */
  async function grantBeta(user) {
    if (!secretKey) return false;
    try {
      const res = await rest('plans?on_conflict=parent_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ parent_id: user, plan: 'beta', status: 'active', source: 'manual' }) });
      if (!res.ok) throw new Error(`grant ${res.status}`);
      plans.set(user, { until: now() + 60_000, plan: 'beta' });
      return true;
    } catch (e) {
      log.warn?.(`[family] grant: ${e?.message ?? e}`);
      return false;
    }
  }

  /**
   * Counts `amount` of `kind` for today and says whether the family is still within its plan.
   * If the counter can't be reached the answer is yes: a family is never locked out by our own outage.
   * @returns {Promise<{ ok: boolean, used?: number, limit?: number }>}
   */
  async function use(user, planName, kind, amount = 1) {
    const limit = DAILY_LIMITS[planName]?.[kind];
    if (!secretKey || limit == null) return { ok: true };
    try {
      const res = await rest('rpc/count_usage', { method: 'POST', body: JSON.stringify({ p_parent: user, p_kind: kind, p_amount: Math.min(100, Math.max(0, amount)) }) });
      if (!res.ok) throw new Error(`count ${res.status}`);
      const used = (await res.json())?.[kind];
      return { ok: typeof used !== 'number' || used <= limit, used, limit };
    } catch (e) {
      log.warn?.(`[family] count: ${e?.message ?? e}`);
      return { ok: true };
    }
  }

  return { verify, plan, grantBeta, use, configured: Boolean(secretKey) };
}
