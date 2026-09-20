import { afterEach, describe, expect, it, vi } from 'vitest';
import { sameShape, takeStill } from '../features/say/camera';
import { bookNotice, readProblem, setupProblem } from '../features/say/messages';
import { readFailure } from '../speech/read';
import { normalCode, type ApiHealth, type ServiceStatus } from '../speech/health';

const health = (h: Partial<ApiHealth>): ApiHealth => ({ azure: false, claude: false, gemini: false, ttsVersion: '', needsCode: false, authorized: false, codeSet: true, read: false, ...h });
const status = (reading: ServiceStatus['reading']): ServiceStatus => ({ checkedAt: '', scoring: 'ok', reading, voice: 'ok' });
const READY = health({ needsCode: true, authorized: true, azure: true, gemini: true, read: true });

describe('the camera: setup problems show before the photo, not after it', () => {
  it('sends a device without an accepted code to the code, and says when a stored code was refused', () => {
    expect(setupProblem(health({ needsCode: true }), false, null)).toMatchObject({ fix: 'code' });
    const refused = setupProblem(health({ needsCode: true }), true, null)!;
    expect(refused.fix).toBe('code');
    expect(refused.text).toMatch(/isn’t accepted/);
  });

  it('does not send anyone to type a code that cannot work: a server with no code set', () => {
    const p = setupProblem(health({ needsCode: true, codeSet: false }), true, null)!;
    expect(p.text).toMatch(/no access code set/);
    expect(p.fix).toBeUndefined();
  });

  it('says when the server’s own key is the problem (every live failure on 2026-09-19/20 was one)', () => {
    const p = setupProblem(READY, true, status('key_refused'))!;
    expect(p.fix).toBe('connections');
    expect(p.text).toMatch(/key refused/);
    expect(p.text).toMatch(/not your camera/);
    expect(setupProblem(READY, true, status('not_set'))).not.toBeNull();
  });

  it('never blocks the camera on a hiccup, when all is well, or when the check itself could not run', () => {
    // One slow answer from Google’s information service says nothing about whether reading works.
    for (const unsure of ['unreachable', 'error', 'quota', 'unchecked', 'ok'] as const) expect(setupProblem(READY, true, status(unsure))).toBeNull();
    expect(setupProblem(READY, true, null)).toBeNull();
    expect(setupProblem(health({}), false, null)).toBeNull(); // offline: the photo attempt will say so itself
  });

  it('tells My book what is actually wrong', () => {
    expect(bookNotice(READY, true, true, 'the Parent Zone')).toBeNull();
    expect(bookNotice(health({ needsCode: true }), false, true, 'the Parent Zone')).toMatch(/need the beta access code.*grown-up/);
    expect(bookNotice(health({ needsCode: true }), true, false, 'Settings & privacy')).toMatch(/isn’t accepted any more/);
    expect(bookNotice(health({ needsCode: true, authorized: true, azure: true }), true, false, 'Settings & privacy')).toMatch(/isn’t switched on/);
    expect(bookNotice(health({}), false, false, 'Settings & privacy')).toBeNull(); // offline: we can’t tell
  });
});

describe('the camera: a failed read says whose fault it is', () => {
  const told = (statusCode: number, body: unknown) => readProblem(readFailure(statusCode, typeof body === 'string' ? body : JSON.stringify(body)));

  it('never blames the photo for something on our side', () => {
    for (const error of ['read_upstream', 'read_timeout', 'read_unparseable', 'internal_error']) {
      const p = told(error === 'internal_error' ? 500 : 424, { error });
      expect(p.text).toMatch(/our side, not your photo/);
      expect(p.text).toContain(`(${error})`);
      expect(p.fix).toBeUndefined();
    }
  });

  it('names a setup problem, and only a lasting one', () => {
    expect(told(424, { error: 'read_key', note: '39/84' })).toMatchObject({ fix: 'connections' });
    expect(told(424, { error: 'read_key', note: '39/84' }).text).toContain('read_key 39/84');
    expect(told(424, { error: 'read_region' }).fix).toBe('connections');
    // A rate limit passes by itself: no "setup problem", no trip to Settings (where everything would show a tick).
    const quota = told(424, { error: 'read_quota' });
    expect(quota.text).toMatch(/busy right now/);
    expect(quota.fix).toBeUndefined();
  });

  it('says when Google’s reader declined the page itself: trying again won’t help', () => {
    const p = told(424, { error: 'read_unparseable', finish: 'RECITATION' });
    expect(p.text).toMatch(/wouldn’t read this page/);
    expect(p.text).toContain('RECITATION');
  });

  it('tells a refused code, a lockout after wrong codes, and a busy learner apart', () => {
    expect(told(401, { error: 'access_code_required' })).toMatchObject({ fix: 'code' });
    expect(told(429, { error: 'too_many_attempts' }).text).toMatch(/Too many wrong codes/);
    expect(told(429, { error: 'rate_limited' }).text).toMatch(/a lot of pages/);
  });

  it('only calls reading "not switched on" when our server says so, not for the platform’s own 503', () => {
    expect(told(503, { error: 'gemini_not_configured' }).text).toMatch(/isn’t switched on/);
    const platform = told(503, 'error code: 1102');
    expect(platform.text).toMatch(/our side/);
    expect(platform.text).toContain('http_503 cf1102');
  });
});

describe('the access code as typed or pasted on the device', () => {
  it('drops what nobody can see, so a request can always be sent', () => {
    expect(normalCode('﻿open​  sesame \n')).toBe('open sesame');
    expect(normalCode('好吃 100%')).toBe('好吃 100%');
  });
});

describe('the camera: a real photograph where the browser can take one', () => {
  afterEach(() => vi.useRealTimers());
  const track = { readyState: 'live' } as MediaStreamTrack;
  const video = { videoWidth: 1440, videoHeight: 1920 } as HTMLVideoElement; // a phone held upright: 3:4
  const big = new Blob([new Uint8Array(50_000)], { type: 'image/jpeg' });
  const onScreen = new Blob([new Uint8Array(20_000)], { type: 'image/jpeg' });
  const frame = async () => onScreen;
  const fourByThree = async () => ({ width: 1920, height: 2560 });

  it('asks the phone for a page-sized photo, not its 50-megapixel maximum', async () => {
    const asked: unknown[] = [];
    class Taker { getPhotoCapabilities = async () => ({ imageWidth: { min: 320, max: 8160 } }); takePhoto = async (s?: unknown) => { asked.push(s); return big; }; }
    expect(await takeStill(track, video, Taker, frame, fourByThree)).toBe(big);
    expect(asked).toEqual([{ imageWidth: 2560 }]);
  });

  it('will not use a photo that cuts the sides off what was framed: the largest photo, then the picture on screen', async () => {
    expect(sameShape({ width: 2560, height: 1920 }, { width: 1440, height: 1920 })).toBe(true); // the same 4:3, turned
    expect(sameShape({ width: 2560, height: 1440 }, { width: 1440, height: 1920 })).toBe(false); // 16:9 of a 4:3 preview
    const asked: unknown[] = [];
    const whole = new Blob([new Uint8Array(90_000)], { type: 'image/jpeg' });
    class Taker { getPhotoCapabilities = async () => ({ imageWidth: { min: 320, max: 4000 } }); takePhoto = async (s?: { imageWidth?: number }) => { asked.push(s); return s?.imageWidth === 4000 ? whole : big; }; }
    const measure = async (b: Blob) => (b === whole ? { width: 4000, height: 3000 } : { width: 2560, height: 1440 });
    expect(await takeStill(track, video, Taker, frame, measure)).toBe(whole);
    expect(asked).toEqual([{ imageWidth: 2560 }, { imageWidth: 4000 }]);
    // Every photo cropped: the picture on screen is what the learner framed.
    expect(await takeStill(track, video, Taker, frame, async () => ({ width: 2560, height: 1440 }))).toBe(onScreen);
  });

  it('tries the phone’s own size when the asked size is rejected', async () => {
    const asked: unknown[] = [];
    class Taker { getPhotoCapabilities = async () => ({ imageWidth: { min: 320, max: 2560 } }); takePhoto = async (s?: unknown) => { asked.push(s); if (s) throw new Error('unsupported size'); return big; }; }
    expect(await takeStill(track, video, Taker, frame, fourByThree)).toBe(big);
    expect(asked).toEqual([{ imageWidth: 2560 }, undefined]);
  });

  it('uses the picture on screen when the phone hangs, without a second wait, and when there is no photo taker at all', async () => {
    vi.useFakeTimers();
    let calls = 0;
    class Taker { getPhotoCapabilities = async () => ({ imageWidth: { min: 320, max: 4000 } }); takePhoto = () => { calls++; return new Promise<Blob>(() => undefined); }; }
    const shot = takeStill(track, video, Taker, frame, fourByThree);
    await vi.advanceTimersByTimeAsync(4100);
    expect(await shot).toBe(onScreen);
    expect(calls).toBe(1);
    expect(await takeStill(track, video, undefined, frame, fourByThree)).toBe(onScreen);
    expect(await takeStill({ readyState: 'ended' } as MediaStreamTrack, video, Taker, frame, fourByThree)).toBe(onScreen);
  });
});
