// Invite codes and contributed recordings (supabase/migrations/20260921100000_invites_and_contributions.sql).
// Runtime-neutral like core.mjs: fetch and WebCrypto only, so the same code runs in Node and in the Pages Function.
//
//   * INVITE CODES. Many codes instead of one shared passphrase, each good for a number of families (10) until a
//     date (14 days out). A code takes a place when a device REDEEMS it (POST /api/redeem); the app keeps a code
//     only once the server has accepted it. After that, every request just asks "is this a code we issued, and not
//     switched off?" — a family that joined is never turned away because the code later filled up or passed its
//     date. The date and the count are for joining.
//
//     Switching a code off is different: it is the lever against a code that leaked, so it stops EVERY device using
//     it, joined or not, within the minute this module remembers a code for.
//
//     Known and accepted for a beta: someone who copies a code into their browser's storage by hand, never
//     redeeming it, is not counted against its places — but still stops working the moment the code is switched off.
//
//   * CONTRIBUTIONS. A practice recording already comes to this server to be scored. With the learner's consent the
//     server keeps that copy instead of discarding it — nothing new leaves the device. It is stored with no name:
//     the device's random id, age band, home language, what was asked and the scorer's own answer.
//
// Both need the project's SECRET key. Without it, invite codes unlock nothing (only the master code does, as before
// they existed) and nothing is kept.

/** An invite code as typed or pasted: letters and digits and dashes, upper case. "wunder-7k2m " → "WUNDER-7K2M". */
export const inviteCode = (raw) => String(raw ?? '').normalize('NFKC').toUpperCase().replace(/[^A-Z0-9-]/g, '');
const INVITE_SHAPE = /^[A-Z0-9-]{4,32}$/;
const DEVICE_SHAPE = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * @param {{ url: string, secretKey?: string, fetchImpl?: typeof fetch, log?: Console, now?: () => number, uuid?: () => string }} opts
 */
export function createInvites({ url, secretKey = '', fetchImpl = fetch, log = console, now = Date.now, uuid = () => crypto.randomUUID() }) {
  const base = url.replace(/\/+$/, '');
  const enabled = Boolean(secretKey);
  // The new `sb_secret_…` keys go in `apikey` alone; the older JWT-style keys also need the Authorization header.
  const auth = { apikey: secretKey, ...(secretKey.startsWith('sb_') ? {} : { Authorization: `Bearer ${secretKey}` }) };
  const rest = (path, init = {}) => fetchImpl(`${base}/rest/v1/${path}`, {
    ...init,
    headers: { ...auth, 'Content-Type': 'application/json', ...init.headers },
  });

  // "Is this one of ours?" is asked on every request, so the answer is kept a minute. A code Leslie switches off
  // stops working within that minute.
  const known = new Map(); // code → { until, ok }

  /** True when `raw` is an invite code we issued and have not switched off. Never throws: a database hiccup is a no. */
  async function isValid(raw) {
    if (!enabled) return false;
    const code = inviteCode(raw);
    if (!INVITE_SHAPE.test(code)) return false;
    const hit = known.get(code);
    if (hit && hit.until > now()) return hit.ok;
    try {
      const res = await rest(`invite_codes?code=eq.${encodeURIComponent(code)}&select=disabled`);
      if (!res.ok) throw new Error(`invite lookup ${res.status}`);
      const rows = await res.json();
      const ok = Array.isArray(rows) && rows.length === 1 && rows[0].disabled !== true;
      known.set(code, { until: now() + 60_000, ok });
      return ok;
    } catch (e) {
      log.warn?.(`[invite] lookup failed: ${e?.message ?? e}`);
      return false;
    }
  }

  /**
   * Take a place on a code for this device, in one atomic step (the database locks the code row).
   * @returns {Promise<{ ok: boolean, reason: 'new'|'again'|'unknown'|'disabled'|'expired'|'full', places?: number, used?: number, expiresAt?: string }>}
   */
  async function redeem(raw, device) {
    if (!enabled) return { ok: false, reason: 'unknown' };
    const code = inviteCode(raw);
    if (!INVITE_SHAPE.test(code)) return { ok: false, reason: 'unknown' };
    if (!DEVICE_SHAPE.test(String(device ?? ''))) throw new Error('bad device id');
    const res = await rest('rpc/redeem_invite', { method: 'POST', body: JSON.stringify({ p_code: code, p_device: device }) });
    if (!res.ok) throw new Error(`redeem ${res.status}`);
    const r = await res.json();
    if (r?.ok) known.set(code, { until: now() + 60_000, ok: true });
    return { ok: !!r?.ok, reason: r?.reason ?? 'unknown', places: r?.places, used: r?.used, expiresAt: r?.expires_at };
  }

  /**
   * Keep a contributed recording: the WAV to the private bucket, and a row beside it. Throws on failure — the
   * caller runs this after the learner already has their score, so a failure costs a recording, never a lesson.
   */
  async function contribute({ device, locale, band, homeLanguage, reference, overall, azure, wav, appVersion }) {
    if (!enabled) return null;
    if (!DEVICE_SHAPE.test(String(device ?? ''))) throw new Error('bad device id');
    const id = uuid();
    const day = new Date(now()).toISOString().slice(0, 10);
    const path = `${locale}/${day}/${id}.wav`;
    const put = await fetchImpl(`${base}/storage/v1/object/contributions/${path}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'audio/wav', 'x-upsert': 'false' },
      body: wav,
    });
    if (!put.ok) throw new Error(`storage ${put.status}`);
    const row = await rest('contributions', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        id, device, locale, band: band || null, home_language: homeLanguage || null,
        reference: String(reference).slice(0, 500),
        overall: Number.isFinite(overall) ? Math.max(0, Math.min(100, Math.round(overall))) : null,
        azure: azure ?? null, audio_path: path, app_version: appVersion ? String(appVersion).slice(0, 40) : null,
      }),
    });
    if (!row.ok) throw new Error(`contribution row ${row.status}`);
    return path;
  }

  return { enabled, isValid, redeem, contribute };
}
