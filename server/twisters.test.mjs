import { describe, expect, it } from 'vitest';
import { cleanAvatar, cleanNickname, createTwisters, PASS, TWISTER_IDS } from './twisters.mjs';

const jsonRes = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/** A board that remembers one existing row and what it was told. */
function fakeDb({ existing = null } = {}) {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const u = new URL(url);
    if (u.pathname.endsWith('/rest/v1/twister_scores') && (init.method ?? 'GET') === 'GET') {
      if (u.searchParams.has('device') && !u.searchParams.has('region')) return jsonRes(existing ? [existing] : []);
      if (init.headers?.Range) return jsonRes([], 206, { 'content-range': '0-0/7' });
      return jsonRes([{ nickname: 'Mia', avatar: '🦊', region: 'HK', ms: 1800 }, { nickname: 'Tiger', avatar: '🐯', region: 'SG', ms: 2100 }]);
    }
    if (u.pathname.endsWith('/rest/v1/twister_scores') && init.method === 'POST') return new Response(null, { status: 201 });
    return new Response('not faked', { status: 500 });
  };
  return { calls, fetchImpl };
}
const one = [...TWISTER_IDS][0];

describe('the tongue-twister board', () => {
  it('knows the twisters in content/twisters.json and the pass mark', () => {
    expect(TWISTER_IDS.size).toBeGreaterThan(5);
    expect(PASS).toBe(80);
  });

  it('keeps a passing take that beats the device’s best, and leaves a slower one alone', async () => {
    const db = fakeDb();
    const tw = createTwisters({ url: 'https://db.example', secretKey: 'sb_secret_x', fetchImpl: db.fetchImpl, log: { warn() {} } });
    const kept = await tw.submit({ twister: one, device: 'device-aaaaaaaa', nickname: '  Tiger  ', avatar: '🐯', region: 'HK', ms: 2345.6, score: 88 });
    expect(kept).toMatchObject({ kept: true, nickname: 'Tiger', avatar: '🐯', region: 'HK', ms: 2346, score: 88 });
    const write = db.calls.find((c) => c.init.method === 'POST');
    expect(write.url).toContain('on_conflict=twister,device');
    expect(JSON.parse(write.init.body)).not.toHaveProperty('id');

    const slower = createTwisters({ url: 'https://db.example', secretKey: 'sb_secret_x', fetchImpl: fakeDb({ existing: { ms: 1500 } }).fetchImpl, log: { warn() {} } });
    expect(await slower.submit({ twister: one, device: 'device-aaaaaaaa', nickname: 'Tiger', avatar: '🐯', region: 'HK', ms: 2000, score: 90 })).toMatchObject({ kept: false, ms: 1500 });
  });

  it('refuses what is not a pass, an unknown twister, a bad device or a silly time', async () => {
    const tw = createTwisters({ url: 'https://db.example', secretKey: 'sb_secret_x', fetchImpl: fakeDb().fetchImpl, log: { warn() {} } });
    const base = { twister: one, device: 'device-aaaaaaaa', nickname: 'T', avatar: '🐯', region: 'HK', ms: 2000, score: 90 };
    await expect(tw.submit({ ...base, score: 79 })).rejects.toThrow(/not a pass/);
    await expect(tw.submit({ ...base, twister: 'nope' })).rejects.toThrow(/unknown twister/);
    await expect(tw.submit({ ...base, device: 'x' })).rejects.toThrow(/bad device/);
    await expect(tw.submit({ ...base, ms: 50 })).rejects.toThrow(/bad time/);
    await expect(tw.submit({ ...base, ms: 120000 })).rejects.toThrow(/bad time/);
  });

  it('shows a world board, a regional board, and where this device stands', async () => {
    const tw = createTwisters({ url: 'https://db.example', secretKey: 'sb_secret_x', fetchImpl: fakeDb({ existing: { ms: 2500, region: 'HK' } }).fetchImpl, log: { warn() {} } });
    const b = await tw.board({ twister: one, device: 'device-aaaaaaaa', region: 'HK' });
    expect(b.region).toBe('HK');
    expect(b.global.map((r) => r.nickname)).toEqual(['Mia', 'Tiger']);
    expect(b.regional.length).toBe(2);
    expect(b.me).toEqual({ ms: 2500, rank: 8, rankRegion: 8, region: 'HK' });
    expect(JSON.stringify(b)).not.toMatch(/device/);
  });

  it('cleans what goes on the board', () => {
    expect(cleanNickname('  Leslie\u0000 Wu\n')).toBe('Leslie Wu');
    expect(cleanNickname('')).toBe('Someone');
    expect(cleanNickname('a'.repeat(40)).length).toBe(16);
    expect(cleanAvatar('🐯')).toBe('🐯');
    expect(cleanAvatar('')).toBe('🙂');
  });

  it('does nothing without the secret key, and says so', async () => {
    const tw = createTwisters({ url: 'https://db.example' });
    expect(tw.enabled).toBe(false);
    expect(await tw.board({ twister: one, device: 'device-aaaaaaaa', region: 'HK' })).toEqual({ region: 'HK', global: [], regional: [], me: null });
  });
});
