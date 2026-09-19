// Average pitch shape of each tone as actually produced (correct takes only), per voice and position — to check
// the tone templates against reality.   npx vite-node eval/tone-shapes.ts
process.env.EVAL_NO_MAIN = '1';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE } from './lib.mjs';
import type { EvalCase } from './build';
import { pitchFor } from './run-zh';
import { readCharacters, type AzureZhResponse } from '../src/speech/zh/assess';
import { segment, speakerMedian } from '../src/speech/pitch';
import { parseSyllable, surfaceTones } from '../src/content/zh/pinyin';

const data: { cases: EvalCase[] } = JSON.parse(readFileSync(join(CACHE, 'dataset-zh.json'), 'utf8'));
const han = (s: string) => [...s].filter((c) => /\p{Script=Han}/u.test(c));
const XS = [0, 0.25, 0.5, 0.75, 1];

// Per voice/speed median across takes (the "history" a child would have).
const med = new Map<string, number[]>();
for (const c of data.cases) { const m = speakerMedian(pitchFor(c)); if (m != null) med.set(`${c.voice}|${c.speed}`, [...(med.get(`${c.voice}|${c.speed}`) ?? []), m]); }
const ref = (k: string) => { const s = [...(med.get(k) ?? [0])].sort((a, b) => a - b); return s[s.length >> 1]; };

const acc = new Map<string, { n: number; sum: number[]; dur: number }>();
const seen = new Set<string>();
for (const c of data.cases) {
  if (!c.truth.correct) continue;
  const key0 = `${c.voice}|${c.speed}|${c.spoken}`;
  if (seen.has(key0)) continue; // same audio scored twice
  seen.add(key0);
  const chars = han(c.spoken);
  const sf = surfaceTones(c.spokenPy!.split(' ').map((s) => parseSyllable(s).tone), chars);
  const { perChar } = readCharacters(c.azure as AzureZhResponse, han(c.reference));
  const pitch = pitchFor(c);
  const r = ref(`${c.voice}|${c.speed}`);
  perChar.forEach((pc, i) => {
    const t = sf[i]?.accept.length === 1 ? sf[i].accept[0] : null;
    if (!t || t === 5 || pc.offsetMs == null || !pc.durationMs) return;
    const pts = segment(pitch, pc.offsetMs / 1000, (pc.offsetMs + pc.durationMs) / 1000);
    if (pts.length < 5) return;
    const t0 = pts[0].t, span = pts[pts.length - 1].t - t0;
    if (span <= 0) return;
    const at = (x: number) => { const target = t0 + x * span; let best = pts[0]; for (const p of pts) if (Math.abs(p.t - target) < Math.abs(best.t - target)) best = p; return best.st - r; };
    const pos = chars.length === 1 ? 'alone' : sf[i].lowThird ? 'low3' : i === chars.length - 1 ? 'final' : 'mid';
    const k = `T${t} ${pos.padEnd(5)} ${c.voice}@${c.speed}`;
    const e = acc.get(k) ?? { n: 0, sum: [0, 0, 0, 0, 0], dur: 0 };
    e.n++; XS.forEach((x, j) => (e.sum[j] += at(x))); e.dur += pc.durationMs;
    acc.set(k, e);
  });
}
for (const [k, e] of [...acc].sort()) console.log(`${k.padEnd(24)} n=${String(e.n).padStart(3)} dur ${Math.round(e.dur / e.n)}ms  st vs voice median: ${e.sum.map((s) => (s / e.n).toFixed(1).padStart(5)).join(' ')}`);
