// Mandarin accuracy report: runs the PRODUCTION pipeline (src/speech/zh) over the labelled test set.
//   npx vite-node eval/run-zh.ts [--cv] [--misses]
//   --cv   use tone models trained WITHOUT the voice being tested (the honest number for a new child's voice)
import { coldSpeaker, hanChars, pct100 as pct, pitchFor, profileSpeakers, speakers, surfaceOf, zhCases as cases } from './zh-common';
import { samples, train } from './tone-train-lib';
import { assessZh, readCharacters, type AzureZhResponse } from '../src/speech/zh/assess';
import { DEFAULT_TONE_PARAMS, type ToneModel, type ToneParams } from '../src/speech/zh/tone';
import type { Tone } from '../src/content/zh/pinyin';

export interface ZhSummary {
  falseAlarmItems: number; detectItems: number; toneDetect: number; toneFalse: number; segDetect: number; localised: number;
  /** Single characters vs. syllables inside phrases: false alarms per correct item, tone errors caught. */
  alone: { falseAlarms: number; toneDetect: number }; inPhrase: { falseAlarms: number; toneDetect: number };
}

/**
 * `speaker`: how the learner's voice is known — 'pooled' statistics over all their takes, the app's own 'profile' after
 * hearing them all, or 'cold' (a new learner's first takes: only this take's own middle pitch).
 */
export function report(opts: { params?: ToneParams; altMargin?: number; cv?: boolean; quiet?: boolean; misses?: boolean; speaker?: 'pooled' | 'profile' | 'cold' } = {}): ZhSummary {
  const params = opts.params ?? DEFAULT_TONE_PARAMS;
  const models = new Map<string, ToneModel>();
  if (opts.cv) for (const v of new Set(cases.map((c) => c.voice))) models.set(v, train(samples.filter((s) => s.voice !== v)));

  let falseTone = 0, sylCorrect = 0, falseSeg = 0;
  let toneErrDetected = 0, toneErrTotal = 0, toneErrHeardRight = 0;
  let segDetected = 0, segTotal = 0, segHeardRight = 0, segHeardAny = 0;
  let itemFalse = 0, itemCorrect = 0, itemDetected = 0, itemErrors = 0, itemLocalised = 0;
  const falseByKind: Record<string, [number, number]> = {};
  const bySize = { alone: { f: 0, n: 0, td: 0, tn: 0 }, inPhrase: { f: 0, n: 0, td: 0, tn: 0 } };
  const labelMismatch = new Set<string>();
  const misses: string[] = [];

  for (const c of cases) {
    const pitch = pitchFor(c);
    const mode = opts.speaker ?? 'profile';
    const speaker = mode === 'cold' ? coldSpeaker(c) : (mode === 'pooled' ? speakers : profileSpeakers).get(`${c.voice}|${c.speed}`)!;
    const alts = (c.alts ?? []).map((a) => ({ index: a.index, py: a.py, char: a.char, part: a.part as 'initial' | 'final', json: a.azure as AzureZhResponse }));
    let a;
    try {
      a = assessZh(c.azure as AzureZhResponse, { text: c.reference, py: c.refPy! }, { durationMs: 0, pitch, speaker, alts, toneParams: params, altMargin: opts.altMargin, toneModel: models.get(c.voice) });
    } catch { continue; }
    const spokenSurface = surfaceOf(c.spoken, c.spokenPy!);
    const refChars = hanChars(c.reference);

    if (c.kind === 'lesson') {
      const { perChar } = readCharacters(c.azure as AzureZhResponse, refChars);
      c.refPy!.split(' ').forEach((p, i) => {
        const label = perChar[i]?.label?.replace(/\s+/g, '').replace(/v/g, 'ü');
        if (label && label !== p.replace(/v/g, 'ü') && !p.endsWith('5')) labelMismatch.add(`${refChars[i]} ours=${p} azure=${label} in ${c.reference}`);
      });
    }

    const flagged = (w: (typeof a.words)[number]) => w.errorType === 'omission' || w.errorType === 'mispronunciation';
    const describe = (w: (typeof a.words)[number]) => { const z = w.syllables[0].zh; return `${w.word}[s${z?.soundScore} t${z?.toneScore ?? '-'}${z?.toneHeard ? ` heardT${z.toneHeard}` : ''}${z?.heardAs ? ` as ${z.heardAs}` : ''}]`; };

    if (c.truth.correct) {
      itemCorrect++;
      const fk = (falseByKind[c.kind] ??= [0, 0]);
      fk[1]++;
      const bad = a.words.filter(flagged);
      const size = a.words.length > 1 ? bySize.inPhrase : bySize.alone;
      size.n++;
      if (bad.length) size.f++;
      if (bad.length) { itemFalse++; fk[0]++; misses.push(`FALSE ALARM ${c.voice}@${c.speed} "${c.reference}": ${bad.map(describe).join(' ')}`); }
      for (const w of a.words) { const z = w.syllables[0]?.zh; if (!z) continue; sylCorrect++; if (z.toneHeard) falseTone++; if (z.heardAs) falseSeg++; }
    } else {
      itemErrors++;
      const i = c.truth.index!;
      const w = a.words[i];
      const z = w?.syllables[0]?.zh;
      const hit = !!w && flagged(w);
      if (hit) itemDetected++;
      const worst = a.words.reduce((m, x, k) => (x.score < a.words[m].score ? k : m), 0);
      if (hit && worst === i) itemLocalised++;
      if (c.truth.part === 'tone') {
        toneErrTotal++;
        const size = a.words.length > 1 ? bySize.inPhrase : bySize.alone;
        size.tn++;
        if (z?.toneHeard) size.td++;
        if (z?.toneHeard) { toneErrDetected++; if (spokenSurface[i]?.accept.includes(z.toneHeard as Tone)) toneErrHeardRight++; }
        else misses.push(`TONE MISS ${c.voice}@${c.speed} said "${c.spoken}" for "${c.reference}" #${i}: sound ${z?.soundScore} tone ${z?.toneScore ?? '-'}`);
      } else {
        segTotal++;
        if (hit) segDetected++;
        if (z?.heardAs) { segHeardAny++; if (z.heardAs === c.truth.heard) segHeardRight++; }
        if (!hit) {
          const altsHere = (c.alts ?? []).filter((x) => x.index === i).map((x) => `${x.char}${x.py}:${readCharacters(x.azure as AzureZhResponse, refChars).perChar[i]?.score}`);
          misses.push(`SOUND MISS ${c.voice}@${c.speed} said "${c.spoken}" for "${c.reference}" #${i}: target ${z?.soundScore} alts [${altsHere.join(' ')}]`);
        }
      }
    }
  }

  const summary: ZhSummary = {
    falseAlarmItems: itemFalse / itemCorrect, detectItems: itemDetected / itemErrors, toneDetect: toneErrDetected / toneErrTotal,
    toneFalse: falseTone / sylCorrect, segDetect: segDetected / segTotal, localised: itemLocalised / itemErrors,
    alone: { falseAlarms: bySize.alone.f / bySize.alone.n, toneDetect: bySize.alone.td / bySize.alone.tn },
    inPhrase: { falseAlarms: bySize.inPhrase.f / bySize.inPhrase.n, toneDetect: bySize.inPhrase.td / bySize.inPhrase.tn },
  };
  if (!opts.quiet) {
    console.log(`\n=== Mandarin accuracy${opts.cv ? ' (tone models never saw the voice under test)' : ''} ===`);
    console.log(`cases: ${cases.length}  (correct ${itemCorrect}, with an error ${itemErrors})`);
    console.log(`FALSE ALARMS — correct takes with anything flagged: ${pct(itemFalse, itemCorrect)}  [${Object.entries(falseByKind).map(([k, [f, n]]) => `${k} ${pct(f, n)}`).join(', ')}]; syllables wrongly flagged: tone ${pct(falseTone, sylCorrect)}, sound ${pct(falseSeg, sylCorrect)}`);
    console.log(`DETECTION — error takes flagged at the right syllable: ${pct(itemDetected, itemErrors)}; shown first: ${pct(itemLocalised, itemErrors)}`);
    console.log(`  tone errors caught: ${pct(toneErrDetected, toneErrTotal)} (tone named right: ${pct(toneErrHeardRight, toneErrDetected)})`);
    console.log(`  sound errors caught: ${pct(segDetected, segTotal)}; "sounded like" given & right: ${pct(segHeardRight, segTotal)} (precision ${pct(segHeardRight, segHeardAny)})`);
    if (labelMismatch.size) console.log(`Azure reads these characters differently from our pinyin:\n  ${[...labelMismatch].join('\n  ')}`);
    if (opts.misses) console.log(`\n${misses.slice(0, 300).join('\n')}`);
  }
  return summary;
}

