import { afterEach, describe, expect, it, vi } from 'vitest';
import { takeStill } from '../features/say/camera';
import { readProblem, setupProblem } from '../features/say/messages';
import { ReadError } from '../speech/read';
import type { ApiHealth, ServiceStatus } from '../speech/health';

const health = (h: Partial<ApiHealth>): ApiHealth => ({ azure: false, claude: false, gemini: false, ttsVersion: '', needsCode: false, authorized: false, read: false, ...h });
const status = (reading: ServiceStatus['reading']): ServiceStatus => ({ checkedAt: '', scoring: 'ok', reading, voice: 'ok' });
const READY = health({ needsCode: true, authorized: true, azure: true, gemini: true, read: true });

describe('the camera: setup problems show before the photo, not after it', () => {
  it('sends a device without an accepted code to the code, and says when a stored code was refused', () => {
    expect(setupProblem(health({ needsCode: true }), false, null)).toMatchObject({ fix: 'code' });
    const refused = setupProblem(health({ needsCode: true }), true, null)!;
    expect(refused.fix).toBe('code');
    expect(refused.text).toMatch(/isn’t accepted/);
  });

  it('says when the server’s own key is the problem (every live failure on 2026-09-19/20 was one)', () => {
    const p = setupProblem(READY, true, status('key_refused'))!;
    expect(p.fix).toBe('connections');
    expect(p.text).toMatch(/key refused/);
    expect(p.text).toMatch(/not your camera/);
  });

  it('never blocks the camera when all is well, or when the check itself could not run', () => {
    expect(setupProblem(READY, true, status('ok'))).toBeNull();
    expect(setupProblem(READY, true, null)).toBeNull();
    expect(setupProblem(health({}), false, null)).toBeNull(); // offline: the photo attempt will say so itself
  });
});

describe('the camera: a failed read says whose fault it is', () => {
  it('does not blame the photo for a key problem', () => {
    const p = readProblem(new ReadError('failed', 'read_key 39/84'));
    expect(p.text).toMatch(/not your photo/);
    expect(p.text).toContain('read_key 39/84');
    expect(p.fix).toBe('connections');
  });
  it('keeps the photo advice for a real reading failure, with the server’s reason for a tester’s screenshot', () => {
    const p = readProblem(new ReadError('failed', 'read_timeout'));
    expect(p.text).toMatch(/flat, still and well lit/);
    expect(p.text).toContain('(read_timeout)');
    expect(p.fix).toBeUndefined();
  });
  it('sends a refused code to the code', () => {
    expect(readProblem(new ReadError('locked', 'access_code_required'))).toMatchObject({ fix: 'code' });
  });
});

describe('the camera: a real photograph where the browser can take one', () => {
  afterEach(() => vi.useRealTimers());
  const track = { readyState: 'live' } as MediaStreamTrack;
  const video = {} as HTMLVideoElement;
  const big = new Blob([new Uint8Array(50_000)], { type: 'image/jpeg' });
  const onScreen = new Blob([new Uint8Array(20_000)], { type: 'image/jpeg' });
  const frame = async () => onScreen;

  it('asks the phone for a page-sized photo, not its 50-megapixel maximum', async () => {
    const asked: unknown[] = [];
    class Taker { getPhotoCapabilities = async () => ({ imageWidth: { min: 320, max: 8160 } }); takePhoto = async (s?: unknown) => { asked.push(s); return big; }; }
    expect(await takeStill(track, video, Taker, frame)).toBe(big);
    expect(asked).toEqual([{ imageWidth: 2560 }]);
  });

  it('tries the phone’s own size when the asked size is rejected', async () => {
    const asked: unknown[] = [];
    class Taker { getPhotoCapabilities = async () => ({ imageWidth: { min: 320, max: 4000 } }); takePhoto = async (s?: unknown) => { asked.push(s); if (s) throw new Error('unsupported size'); return big; }; }
    expect(await takeStill(track, video, Taker, frame)).toBe(big);
    expect(asked).toEqual([{ imageWidth: 2560 }, undefined]);
  });

  it('uses the picture on screen when the phone hangs, without a second wait — and when there is no photo taker at all', async () => {
    vi.useFakeTimers();
    let calls = 0;
    class Taker { getPhotoCapabilities = async () => ({ imageWidth: { min: 320, max: 4000 } }); takePhoto = () => { calls++; return new Promise<Blob>(() => undefined); }; }
    const shot = takeStill(track, video, Taker, frame);
    await vi.advanceTimersByTimeAsync(4100);
    expect(await shot).toBe(onScreen);
    expect(calls).toBe(1);
    expect(await takeStill(track, video, undefined, frame)).toBe(onScreen);
    expect(await takeStill({ readyState: 'ended' } as MediaStreamTrack, video, Taker, frame)).toBe(onScreen);
  });
});
