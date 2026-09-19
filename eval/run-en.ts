// English accuracy report: runs the PRODUCTION pipeline (mapAzure → isMastered → correctionFor) over the test set.
//   npx vite-node eval/run-en.ts [--misses]
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE } from './lib.mjs';
import type { EvalCase } from './build';
import { mapAzure } from '../src/speech/azureProvider';
import { isMastered } from '../src/engine/learning';
import { correctionFor, focusWordIndex } from '../src/tutor/feedback';
import type { AgeBand } from '../src/domain/types';
import { EN_PAIRS } from './cases';

const raw: { cases: EvalCase[] } = JSON.parse(readFileSync(join(CACHE, 'dataset-en.json'), 'utf8'));
// Same exclusions as Mandarin: glitched synthetic takes (a few ms, or half a minute) and responses with no scoring in them.
const plausible = (c: EvalCase) => { const s = readFileSync(join(CACHE, 'audio', `${c.audio.key}.pcm`)).length / 2 / c.audio.rate / c.speed; return s >= 0.18 && s <= 1.5 + 0.9 * c.spoken.split(/\s+/).length; };
const scoredCase = (c: EvalCase) => { const b = (c.azure as { NBest?: { AccuracyScore?: number; PronunciationAssessment?: object }[] }).NBest?.[0]; return !b || b.AccuracyScore != null || b.PronunciationAssessment != null; };
const data = { cases: raw.cases.filter((c) => plausible(c) && scoredCase(c)) };
console.log(`excluded ${raw.cases.length - data.cases.length} glitched takes of ${raw.cases.length}`);
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
const band: AgeBand = (process.argv.find((a) => a.startsWith('--band='))?.slice(7) as AgeBand) ?? 'junior';

const byKey = new Map(data.cases.map((c) => [`${c.locale}|${c.voice}|${c.speed}|${c.reference}|${c.spoken}`, c.azure]));
for (const locale of ['en-US', 'en-GB'] as const) {
  const cases = data.cases.filter((c) => c.locale === locale);
  const m = { correct: 0, falseAlarm: 0, errors: 0, detected: 0, localised: 0, named: 0, heardAny: 0, heardRight: 0 };
  const byKind: Record<string, { fa: number; n: number; det: number; e: number }> = {};
  const bySound: Record<string, { det: number; e: number; named: number }> = {};
  const misses: string[] = [];
  for (const c of cases) {
    let a;
    // Likely-mistake scorings: for pair words the test set already scored this take against each partner word.
    const alts = process.argv.join(' ').includes('--no-alts') ? [] : EN_PAIRS.flatMap(([x, y, px, py]) => (c.reference === x ? [[y, px, py]] : c.reference === y ? [[x, py, px]] : []))
      .map(([partner, target, heard]) => ({ alt: { wordIndex: 0, target, heard, text: partner }, json: byKey.get(`${locale}|${c.voice}|${c.speed}|${partner}|${c.spoken}`) as never }))
      .filter((x) => x.json);
    try { a = mapAzure(c.azure as never, c.reference, 0, locale, c.azureUS as never, alts); } catch { continue; }
    const fi = focusWordIndex(a);
    const mastered = isMastered(a, band);
    const corr = fi >= 0 ? correctionFor(a.words[fi], band, 'yue') : null;
    // "Flagged" = the app would not let this pass as mastered, or shows a concrete fix.
    const flagged = !mastered || (!!corr && corr.kind !== 'fine' && corr.score < 80);
    const k = byKind[`${c.kind}@${c.speed}`] ??= { fa: 0, n: 0, det: 0, e: 0 };
    if (c.truth.correct) {
      m.correct++; k.n++;
      if (flagged) { m.falseAlarm++; k.fa++; misses.push(`FALSE ALARM ${c.voice}@${c.speed} "${c.reference}" overall ${a.overall}: ${corr ? `${corr.word} ${corr.kind} ${corr.phoneme ?? ''} ${corr.score}` : 'not mastered'} | ${a.words.map((w) => `${w.word}:${w.score}[${w.phonemes.map((p) => `${p.phoneme || '?'}${p.score}${p.heardAs ? '>' + p.heardAs : ''}`).join(' ')}]`).join(' ')}`); }
    } else {
      m.errors++; k.e++;
      const s = bySound[`${c.truth.target}→${c.truth.heard}`] ??= { det: 0, e: 0, named: 0 };
      s.e++;
      if (flagged) { m.detected++; k.det++; s.det++; }
      const w = a.words[c.truth.index!];
      const localised = fi === c.truth.index;
      if (flagged && localised) m.localised++;
      const named = flagged && localised && corr?.phoneme === c.truth.target;
      if (named) { m.named++; s.named++; }
      const heard = w?.phonemes.find((p) => p.phoneme === c.truth.target)?.heardAs ?? (localised ? corr?.heardAs : undefined);
      if (heard) { m.heardAny++; if (heard === c.truth.heard) m.heardRight++; }
      if (!flagged || !named) misses.push(`${flagged ? (localised ? 'WRONG SOUND' : 'WRONG WORD') : 'MISSED'} ${c.voice}@${c.speed} said "${c.spoken}" for "${c.reference}" overall ${a.overall}: focus ${fi >= 0 ? a.words[fi].word : '-'} ${corr?.phoneme ?? ''} | ${a.words.map((x) => `${x.word}:${x.score}[${x.phonemes.map((p) => `${p.phoneme || '?'}${p.score}${p.heardAs ? '>' + p.heardAs : ''}`).join(' ')}]`).join(' ')}`);
    }
  }
  console.log(`\n=== ${locale} (band ${band}) ===  cases ${cases.length}`);
  console.log(`FALSE ALARMS on correct takes: ${pct(m.falseAlarm, m.correct)} of ${m.correct}`);
  console.log(`DETECTION of wrong sounds: ${pct(m.detected, m.errors)} of ${m.errors}; right word: ${pct(m.localised, m.errors)}; right sound named: ${pct(m.named, m.errors)}`);
  console.log(`"heard as" given: ${pct(m.heardAny, m.errors)}; correct when given: ${pct(m.heardRight, m.heardAny)}`);
  console.log('by kind:', Object.entries(byKind).map(([kk, v]) => `${kk} fa ${pct(v.fa, v.n)} det ${pct(v.det, v.e)}`).join(' | '));
  console.log('by sound (detected/named):', Object.entries(bySound).map(([kk, v]) => `${kk} ${v.det}/${v.named}/${v.e}`).join('  '));
  if (process.argv.includes('--misses')) console.log(misses.slice(0, 250).join('\n'));
}
