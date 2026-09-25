// The tongue-twister leaderboard (supabase/migrations/20260925150000_twister_scores.sql). Runtime-neutral like the
// rest: fetch only. One row per device and twister — the best passing time — written and read with the project's
// SECRET key; browsers never touch the table. What goes out to everyone: avatar, nickname, region, time.
import twisterFile from '../content/twisters.json' with { type: 'json' };

export const TWISTER_IDS = new Set(twisterFile.twisters.map((t) => t.id));
export const PASS = twisterFile.pass;
const DEVICE_SHAPE = /^[A-Za-z0-9_-]{8,64}$/;
const REGION_SHAPE = /^[A-Z]{2}$/;
const BOARD = 20;

/** Nicknames as the board shows them: trimmed, at most 16 characters, never empty, no control characters. */
export const cleanNickname = (raw) => String(raw ?? '').replace(/[\p{Cc}\p{Cf}]+/gu, '').replace(/\s+/g, ' ').trim().slice(0, 16) || 'Someone';
/** One emoji (or a couple of code points of one), else a neutral face. */
export const cleanAvatar = (raw) => { const s = String(raw ?? '').replace(/[\p{Cc}\p{Cf}\s]+/gu, '').slice(0, 8); return s || '🙂'; };

/**
 * @param {{ url: string, secretKey?: string, fetchImpl?: typeof fetch, log?: Console }} opts
 */
export function createTwisters({ url, secretKey = '', fetchImpl = fetch, log = console }) {
  const base = url.replace(/\/+$/, '');
  const enabled = Boolean(secretKey);
  const auth = { apikey: secretKey, ...(secretKey.startsWith('sb_') ? {} : { Authorization: `Bearer ${secretKey}` }) };
  const rest = (path, init = {}) => fetchImpl(`${base}/rest/v1/${path}`, { ...init, headers: { ...auth, 'Content-Type': 'application/json', ...init.headers } });

  /**
   * A passing take: keep it if it beats the device's best for this twister (or is the first). Returns the row kept.
   * Throws on a bad input; the caller turns that into a 400.
   */
  async function submit({ twister, device, nickname, avatar, region, ms, score }) {
    if (!TWISTER_IDS.has(twister)) throw new Error('unknown twister');
    if (!DEVICE_SHAPE.test(String(device ?? ''))) throw new Error('bad device id');
    const time = Math.round(Number(ms)), overall = Math.round(Number(score));
    if (!(time >= 200 && time <= 60000)) throw new Error('bad time');
    if (!(overall >= PASS && overall <= 100)) throw new Error('not a pass');
    const row = { twister, device, nickname: cleanNickname(nickname), avatar: cleanAvatar(avatar), region: REGION_SHAPE.test(region) ? region : 'XX', ms: time, score: overall, updated_at: new Date().toISOString() };
    if (!enabled) return row;
    const had = await rest(`twister_scores?twister=eq.${encodeURIComponent(twister)}&device=eq.${encodeURIComponent(device)}&select=ms`);
    if (!had.ok) throw new Error(`board ${had.status}`);
    const [prev] = await had.json();
    if (prev && prev.ms <= time) return { ...row, ms: prev.ms, kept: false };
    const res = await rest('twister_scores?on_conflict=twister,device', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
    if (!res.ok) throw new Error(`board write ${res.status}`);
    return { ...row, kept: true };
  }

  /** The top of the board for a twister, worldwide and in one region, and where this device stands. */
  async function board({ twister, device, region }) {
    if (!TWISTER_IDS.has(twister)) throw new Error('unknown twister');
    if (!enabled) return { region, global: [], regional: [], me: null };
    const pick = 'nickname,avatar,region,ms';
    const [g, r] = await Promise.all([
      rest(`twister_scores?twister=eq.${encodeURIComponent(twister)}&select=${pick}&order=ms.asc,updated_at.asc&limit=${BOARD}`),
      REGION_SHAPE.test(region) ? rest(`twister_scores?twister=eq.${encodeURIComponent(twister)}&region=eq.${region}&select=${pick}&order=ms.asc,updated_at.asc&limit=${BOARD}`) : null,
    ]);
    if (!g.ok || (r && !r.ok)) throw new Error(`board ${g.status}`);
    const global = await g.json();
    const regional = r ? await r.json() : [];
    let me = null;
    if (DEVICE_SHAPE.test(String(device ?? ''))) {
      const mine = await rest(`twister_scores?twister=eq.${encodeURIComponent(twister)}&device=eq.${encodeURIComponent(device)}&select=ms,region`);
      const [row] = mine.ok ? await mine.json() : [];
      if (row) {
        const [ahead, aheadHere] = await Promise.all([
          rest(`twister_scores?twister=eq.${encodeURIComponent(twister)}&ms=lt.${row.ms}&select=id`, { headers: { Prefer: 'count=exact', Range: '0-0' } }),
          rest(`twister_scores?twister=eq.${encodeURIComponent(twister)}&region=eq.${row.region}&ms=lt.${row.ms}&select=id`, { headers: { Prefer: 'count=exact', Range: '0-0' } }),
        ]);
        const count = (res) => { const m = /\/(\d+)$/.exec(res.headers.get('content-range') ?? ''); return m ? Number(m[1]) : 0; };
        me = { ms: row.ms, rank: count(ahead) + 1, rankRegion: count(aheadHere) + 1, region: row.region };
      }
    }
    return { region, global, regional, me };
  }

  return { enabled, submit, board };
}
