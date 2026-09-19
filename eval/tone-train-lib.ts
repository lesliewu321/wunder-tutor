// Tone-model training library (no side effects): labelled syllable samples and a softmax-regression trainer.
import { breaksOf, hanChars, pitchFor, speakers, surfaceOf, zhCases } from './zh-common';
import { readCharacters, toneContext, type AzureZhResponse } from '../src/speech/zh/assess';
import { toneFeatures, type ToneModel } from '../src/speech/zh/tone';

export interface Sample { x: number[]; y: number; voice: string; ctx: string; speed: number }
export const samples: Sample[] = [];
const seen = new Set<string>();
for (const c of zhCases) {
  if (c.reference !== c.spoken) continue; // timings from scoring the take against what it really says
  const key = `${c.voice}|${c.speed}|${c.spoken}`;
  if (seen.has(key)) continue;
  seen.add(key);
  const chars = hanChars(c.spoken);
  const sf = surfaceOf(c.spoken, c.spokenPy!);
  const { perChar } = readCharacters(c.azure as AzureZhResponse, chars);
  const pitch = pitchFor(c);
  const spk = speakers.get(`${c.voice}|${c.speed}`)!;
  const breaks = breaksOf(c.spoken);
  const spans = perChar.map((r) => (r.offsetMs != null && r.durationMs ? { from: r.offsetMs / 1000, to: (r.offsetMs + r.durationMs) / 1000 } : { from: 0, to: 0 }));
  perChar.forEach((r, i) => {
    const t = sf[i]?.accept.length === 1 ? sf[i].accept[0] : null;
    if (!t || t === 5 || r.offsetMs == null || !r.durationMs || r.score < 80) return;
    const ctx = toneContext(i, chars.length, breaks);
    const f = toneFeatures(pitch, spans, i, spk, ctx);
    if (f) samples.push({ x: f.features, y: t - 1, voice: c.voice, ctx, speed: c.speed });
  });
}

export function train(data: Sample[], l2 = 0.02, iters = 1500, lr = 0.05): ToneModel {
  const F = data[0].x.length;
  const mean = new Array(F).fill(0), std = new Array(F).fill(0);
  for (const s of data) s.x.forEach((v, i) => (mean[i] += v / data.length));
  for (const s of data) s.x.forEach((v, i) => (std[i] += (v - mean[i]) ** 2 / data.length));
  for (let i = 0; i < F; i++) std[i] = Math.sqrt(std[i]) || 1;
  const X = data.map((s) => s.x.map((v, i) => (v - mean[i]) / std[i]));
  const W = [0, 1, 2, 3].map(() => new Array(F).fill(0)), b = [0, 0, 0, 0];
  const mW = W.map((r) => r.map(() => 0)), vW = W.map((r) => r.map(() => 0)), mb = [0, 0, 0, 0], vb = [0, 0, 0, 0];
  // Balance tones so a common tone doesn't swamp a rare one.
  const counts = [0, 0, 0, 0]; data.forEach((s) => counts[s.y]++);
  const cw = counts.map((n) => data.length / (4 * Math.max(1, n)));
  for (let it = 1; it <= iters; it++) {
    const gW = W.map((r) => r.map(() => 0)), gb = [0, 0, 0, 0];
    let wsum = 0;
    X.forEach((x, n) => {
      const logits = W.map((w, k) => w.reduce((a, wi, i) => a + wi * x[i], b[k]));
      const m = Math.max(...logits); const e = logits.map((l) => Math.exp(l - m)); const s = e.reduce((a, v) => a + v, 0);
      const wgt = cw[data[n].y]; wsum += wgt;
      for (let k = 0; k < 4; k++) { const g = wgt * (e[k] / s - (k === data[n].y ? 1 : 0)); gb[k] += g; for (let i = 0; i < F; i++) gW[k][i] += g * x[i]; }
    });
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < F; i++) {
        const g = gW[k][i] / wsum + l2 * W[k][i];
        mW[k][i] = 0.9 * mW[k][i] + 0.1 * g; vW[k][i] = 0.999 * vW[k][i] + 0.001 * g * g;
        W[k][i] -= (lr * (mW[k][i] / (1 - 0.9 ** it))) / (Math.sqrt(vW[k][i] / (1 - 0.999 ** it)) + 1e-8);
      }
      const g = gb[k] / wsum;
      mb[k] = 0.9 * mb[k] + 0.1 * g; vb[k] = 0.999 * vb[k] + 0.001 * g * g;
      b[k] -= (lr * (mb[k] / (1 - 0.9 ** it))) / (Math.sqrt(vb[k] / (1 - 0.999 ** it)) + 1e-8);
    }
  }
  return { mean, std, weights: W, bias: b };
}

