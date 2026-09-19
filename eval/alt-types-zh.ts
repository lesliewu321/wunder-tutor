// Which kinds of "sounded like" earn their place? For each kind of likely-mistake swap (ü→i, n→l, z→zh …): how often
// it fires on a CORRECT take (a false alarm) versus names the real mistake on an error take.
//   npx vite-node eval/alt-types-zh.ts [--margin=8]
import { parseSyllable } from '../src/content/zh/pinyin';
import { assessZh, type AzureZhResponse } from '../src/speech/zh/assess';
import { pitchFor, profileSpeakers, zhCases as cases } from './zh-common';

const margin = Number(process.argv.find((a) => a.startsWith('--margin='))?.slice(9) ?? NaN);
const kind = (target: string, heard: string) => {
  const a = parseSyllable(target), b = parseSyllable(heard);
  return a.initial !== b.initial ? `${a.initial || '∅'}→${b.initial || '∅'}` : `-${a.final}→-${b.final}`;
};
const stats = new Map<string, { fa: number; tp: number; wrong: number; offered: number }>();
const scores = new Map<string, { tp: number[]; fa: number[] }>();
const keep = (k: string, f: 'tp' | 'fa', v: number) => { const x = scores.get(k) ?? { tp: [], fa: [] }; x[f].push(v); scores.set(k, x); };
const bump = (k: string, f: 'fa' | 'tp' | 'wrong' | 'offered') => { const s = stats.get(k) ?? { fa: 0, tp: 0, wrong: 0, offered: 0 }; s[f]++; stats.set(k, s); };

for (const c of cases) {
  const alts = (c.alts ?? []).map((a) => ({ index: a.index, py: a.py, char: a.char, part: a.part as 'initial' | 'final', json: a.azure as AzureZhResponse }));
  let a;
  try {
    a = assessZh(c.azure as AzureZhResponse, { text: c.reference, py: c.refPy! }, { durationMs: 0, pitch: pitchFor(c), speaker: profileSpeakers.get(`${c.voice}|${c.speed}`)!, alts, altMargin: Number.isFinite(margin) ? margin : undefined });
  } catch { continue; }
  const py = c.refPy!.split(' ');
  for (const alt of c.alts ?? []) bump(kind(py[alt.index], alt.py), 'offered');
  a.words.forEach((w, i) => {
    const z = w.syllables[0]?.zh;
    if (!z?.heardAs) return;
    const k = kind(py[i], z.heardAs);
    if (c.truth.correct) { bump(k, 'fa'); keep(k, 'fa', z.soundScore); }
    else if (i === c.truth.index && z.heardAs === c.truth.heard) { bump(k, 'tp'); keep(k, 'tp', z.soundScore); }
    else bump(k, 'wrong');
  });
}
console.log('swap'.padEnd(12), 'offered'.padStart(8), 'right'.padStart(6), 'wrong'.padStart(6), 'false alarm'.padStart(12));
for (const [k, s] of [...stats].sort((x, y) => y[1].fa - x[1].fa)) console.log(k.padEnd(12), String(s.offered).padStart(8), String(s.tp).padStart(6), String(s.wrong).padStart(6), String(s.fa).padStart(12));

console.log('\ntarget scores when named (right | false alarm):');
for (const [k, x] of scores) if (x.fa.length) console.log(k.padEnd(12), x.tp.sort((a, b) => a - b).join(' '), ' | ', x.fa.sort((a, b) => a - b).join(' '));
