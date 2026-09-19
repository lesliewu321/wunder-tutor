// 16 kHz mono WAV helpers: the format every take is scored in. Pure functions — they run in the browser on the
// learner's recording and in Node for the accuracy test set.

export const SCORE_RATE = 16000;

/** Float samples (−1…1) → 16-bit PCM WAV. */
export function encodeWav(pcm: Float32Array, rate = SCORE_RATE): ArrayBuffer {
  const view = new DataView(new ArrayBuffer(44 + pcm.length * 2));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return view.buffer;
}

/** A 16-bit mono WAV (as written by encodeWav) → float samples. Null for anything else. */
export function decodeWav(buf: ArrayBuffer): { pcm: Float32Array; rate: number } | null {
  if (buf.byteLength < 44) return null;
  const v = new DataView(buf);
  if (v.getUint32(0, false) !== 0x52494646 || v.getUint16(22, true) !== 1 || v.getUint16(34, true) !== 16) return null; // RIFF, mono, 16-bit
  const rate = v.getUint32(24, true);
  const n = Math.floor((buf.byteLength - 44) / 2);
  const pcm = new Float32Array(n);
  for (let i = 0; i < n; i++) pcm[i] = v.getInt16(44 + i * 2, true) / 32768;
  return { pcm, rate };
}

/**
 * Where the speech is in a take, in samples, with a margin either side — or the whole take when nothing stands out.
 * Azure bills for every second it hears, silence included, and a child's take is often more pause than word. The
 * margins are generous so a soft start or end ("th", a final "t") is never cut: eval/trim-check.ts measures that no
 * scored word falls outside the window.
 */
export function speechWindow(pcm: Float32Array, rate = SCORE_RATE, padBefore = 0.3, padAfter = 0.35): [number, number] {
  const frame = Math.round(rate * 0.02);
  const n = Math.floor(pcm.length / frame);
  if (n < 5) return [0, pcm.length];
  const rms = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let s = 0;
    for (let j = f * frame; j < (f + 1) * frame; j++) s += pcm[j] * pcm[j];
    rms[f] = Math.sqrt(s / frame);
  }
  const sorted = Array.from(rms).sort((a, b) => a - b);
  const noise = sorted[Math.floor(n * 0.1)], peak = sorted[n - 1];
  const loud = Math.max(noise * 2.5, peak * 0.02, 0.003);
  let first = -1, last = -1;
  for (let f = 0; f < n; f++) if (rms[f] > loud) { if (first < 0) first = f; last = f; }
  if (first < 0) return [0, pcm.length];
  // Follow a soft start or a fading end outwards while it is still above the room's noise.
  const soft = Math.max(noise * 1.5, peak * 0.005, 0.002);
  while (first > 0 && rms[first - 1] > soft) first--;
  while (last < n - 1 && rms[last + 1] > soft) last++;
  return [Math.max(0, first * frame - Math.round(padBefore * rate)), Math.min(pcm.length, (last + 1) * frame + Math.round(padAfter * rate))];
}

/** A stretch of a 16 kHz take, in seconds, as its own WAV (clamped to the take). */
export function cutWav(pcm: Float32Array, fromSec: number, toSec: number, rate = SCORE_RATE): ArrayBuffer {
  const a = Math.max(0, Math.floor(fromSec * rate));
  const b = Math.min(pcm.length, Math.ceil(toSec * rate));
  return encodeWav(pcm.subarray(a, Math.max(a, b)), rate);
}
