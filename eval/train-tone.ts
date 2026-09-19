// Train the tone model on the labelled set and check it honestly: every voice is tested by a model trained without it.
//   npx vite-node eval/train-tone.ts [--write] [--l2=0.02]
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib.mjs';
import { pct100 } from './zh-common';
import { samples, train, type Sample } from './tone-train-lib';
import { toneProbabilities, type ToneModel } from '../src/speech/zh/tone';

console.log(`samples: ${samples.length}`);
const evaluate = (m: ToneModel, test: Sample[]) => {
  let ok = 0; const byCtx: Record<string, [number, number]> = {}; const conf: Record<string, number> = {};
  for (const s of test) {
    const p = toneProbabilities(m, s.x); const h = p.indexOf(Math.max(...p));
    const hit = h === s.y; if (hit) ok++;
    byCtx[s.ctx] = [(byCtx[s.ctx]?.[0] ?? 0) + (hit ? 1 : 0), (byCtx[s.ctx]?.[1] ?? 0) + 1];
    if (!hit) conf[`${s.y + 1}→${h + 1}`] = (conf[`${s.y + 1}→${h + 1}`] ?? 0) + 1;
  }
  return { acc: ok / test.length, byCtx, conf };
};

const l2 = Number(process.argv.find((a) => a.startsWith('--l2='))?.slice(5) ?? 0.02);
let cvOk = 0, cvN = 0;
for (const held of new Set(samples.map((s) => s.voice))) {
  const m = train(samples.filter((s) => s.voice !== held), l2);
  const test = samples.filter((s) => s.voice === held);
  const r = evaluate(m, test);
  cvOk += r.acc * test.length; cvN += test.length;
  console.log(`held out ${held}: ${(100 * r.acc).toFixed(1)}%`, Object.fromEntries(Object.entries(r.byCtx).map(([k, [a, n]]) => [k, pct100(a, n)])), Object.entries(r.conf).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => `${k}×${v}`).join(' '));
}
console.log(`CROSS-VOICE tone accuracy: ${pct100(cvOk, cvN)}`);
if (process.argv.includes('--write')) {
  const m = train(samples, l2);
  const r4 = (a: number[]) => a.map((v) => Math.round(v * 1e4) / 1e4);
  writeFileSync(join(ROOT, 'src/speech/zh/toneModel.ts'), `import type { ToneModel } from './tone';\n\n// Trained by eval/train-tone.ts on ${samples.length} labelled syllables (${new Set(samples.map((s) => s.voice)).size} voices × normal and child-like speed).\n// Cross-voice accuracy (each voice tested by a model trained without it): ${pct100(cvOk, cvN)}. Regenerate; don't edit.\nexport const TONE_MODEL: ToneModel = {\n  mean: ${JSON.stringify(r4(m.mean))},\n  std: ${JSON.stringify(r4(m.std))},\n  weights: [\n${m.weights.map((w) => `    ${JSON.stringify(r4(w))},`).join('\n')}\n  ],\n  bias: ${JSON.stringify(r4(m.bias))},\n};\n`);
  console.log('wrote src/speech/zh/toneModel.ts');
}
