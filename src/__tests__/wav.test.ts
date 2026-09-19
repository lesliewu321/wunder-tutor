import { describe, expect, it } from 'vitest';
import { cutWav, decodeWav, encodeWav, speechWindow } from '../speech/wav';

const RATE = 16000;
/** Silence (faint noise) – a soft "th"-like hiss – a loud vowel – silence. */
const take = () => {
  const pcm = new Float32Array(RATE * 3);
  let seed = 1;
  const noise = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - 0.5) * 0.002; };
  for (let i = 0; i < pcm.length; i++) {
    const t = i / RATE;
    pcm[i] = noise();
    if (t >= 1.0 && t < 1.15) pcm[i] += (seed % 2 ? 1 : -1) * 0.02; // soft fricative onset
    if (t >= 1.15 && t < 1.6) pcm[i] += 0.5 * Math.sin(2 * Math.PI * 220 * t);
  }
  return pcm;
};

describe('scoring audio', () => {
  it('writes and reads back 16 kHz WAV', () => {
    const pcm = new Float32Array([0, 0.5, -0.5, 1, -1]);
    const back = decodeWav(encodeWav(pcm))!;
    expect(back.rate).toBe(RATE);
    expect(Array.from(back.pcm).map((v) => Math.round(v * 100) / 100)).toEqual([0, 0.5, -0.5, 1, -1]);
    expect(decodeWav(new ArrayBuffer(8))).toBeNull();
  });

  it('trims the pauses around speech but keeps a soft start and a margin', () => {
    const [a, b] = speechWindow(take());
    expect(a / RATE).toBeLessThan(1.0 - 0.1); // the soft onset at 1.0 s is kept, with room to spare
    expect(a / RATE).toBeGreaterThan(0.4); // the long silence before it is not
    expect(b / RATE).toBeGreaterThan(1.6 + 0.1);
    expect(b / RATE).toBeLessThan(2.3);
  });

  it('keeps everything when nothing stands out from the noise', () => {
    const flat = new Float32Array(RATE).fill(0);
    expect(speechWindow(flat)).toEqual([0, RATE]);
  });

  it('cuts a stretch of a take as its own WAV, clamped to the take', () => {
    const pcm = take();
    expect(decodeWav(cutWav(pcm, 1.0, 1.5))!.pcm.length).toBe(RATE * 0.5);
    expect(decodeWav(cutWav(pcm, 2.8, 9))!.pcm.length).toBe(Math.round(RATE * 0.2));
  });
});
