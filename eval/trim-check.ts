// Is trimming silence safe? A child's take has pauses before and after the words; Azure bills for all of it. Every
// take in the test set is padded with 0.8 s of room noise either side (quiet and noisy), trimmed with the app's
// speechWindow(), and checked: the words Azure found (with 0.1 s to spare) must lie inside what is kept.
//   npx vite-node eval/trim-check.ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE, wav16k } from './lib.mjs';
import type { EvalCase } from './build';
import { speechWindow } from '../src/speech/wav';

const PAD = 0.8, RATE = 16000, MARGIN = 0.1;
const TICKS = 10_000_000;
let seed = 7;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

for (const noise of [0.002, 0.01]) {
  let n = 0, cut = 0, kept = 0, total = 0;
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const lang of ['en', 'zh']) {
    const cases: EvalCase[] = JSON.parse(readFileSync(join(CACHE, `dataset-${lang}.json`), 'utf8')).cases;
    for (const c of cases) {
      const key = `${c.audio.key}|${c.speed}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const words = ((c.azure as { NBest?: { Words?: { Offset?: number; Duration?: number; ErrorType?: string; PronunciationAssessment?: { ErrorType?: string } }[] }[] }).NBest?.[0]?.Words ?? [])
        .filter((w) => w.Offset != null && w.Duration && (w.PronunciationAssessment?.ErrorType ?? w.ErrorType ?? 'None') !== 'Omission');
      if (!words.length) continue;
      const start = Math.min(...words.map((w) => w.Offset! / TICKS)), end = Math.max(...words.map((w) => (w.Offset! + w.Duration!) / TICKS));
      const raw = readFileSync(join(CACHE, 'audio', `${c.audio.key}.pcm`));
      const wav = wav16k(raw, c.audio.rate, c.speed);
      const src = new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) >> 1);
      if (src.length / RATE > 10) continue; // glitched generations (a real take is a few seconds)
      const pad = Math.round(PAD * RATE);
      const pcm = new Float32Array(src.length + 2 * pad);
      for (let i = 0; i < pcm.length; i++) pcm[i] = (rnd() * 2 - 1) * noise;
      for (let i = 0; i < src.length; i++) pcm[pad + i] += src[i] / 32768;
      const [a, b] = speechWindow(pcm, RATE);
      n++;
      total += pcm.length; kept += b - a;
      if (a / RATE > PAD + start - MARGIN || b / RATE < PAD + end + MARGIN) {
        cut++;
        if (bad.length < 12) bad.push(`${c.voice}@${c.speed} "${c.spoken}": words ${start.toFixed(2)}–${end.toFixed(2)} s, kept ${(a / RATE - PAD).toFixed(2)}–${(b / RATE - PAD).toFixed(2)} s`);
      }
    }
  }
  console.log(`noise ${noise}: ${n} takes, words cut in ${cut}; audio kept ${(100 * kept / total).toFixed(0)}% (saved ${(100 - 100 * kept / total).toFixed(0)}%)`);
  for (const x of bad) console.log(`  ${x}`);
}
