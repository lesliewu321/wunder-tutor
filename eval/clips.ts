// Cheaper likely-mistake checks: instead of re-scoring the WHOLE take against each likely mistake, score only the
// checked word's clip (cut with the main scoring's timings) against the real word and the mistake. Same verdicts?
// Compares both ways on every multi-word item in the test set, through the production code, and what each bills.
//
// Three steps (vite-node's network stalls on this machine, plain Node doesn't):
//   npx vite-node eval/clips.ts --plan      → cuts the clips, lists the scorings needed (eval/.cache/clip-jobs.json)
//   node eval/run-jobs.mjs                  → scores them with Azure (cached)
//   npx vite-node eval/clips.ts [--pad=0.08] → the comparison, from the cache only
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assess, CACHE, sha, wav16k } from './lib.mjs';
import type { EvalCase } from './build';
import { EN_SENTENCES } from './cases';
import { hanChars, pitchFor, profileSpeakers, zhCases } from './zh-common';
import { assessZh, readCharacters, type AzureZhResponse, type ZhAlternativeResult } from '../src/speech/zh/assess';
import { applyEnglishAlternatives, mapAzure, wordSpans } from '../src/speech/azureProvider';
import { cutWav } from '../src/speech/wav';

const PAD = Number(process.argv.find((a) => a.startsWith('--pad='))?.slice(6) ?? 0.08);
const PLAN = process.argv.includes('--plan');
const RATE = 16000;
if (!PLAN) process.env.EVAL_OFFLINE = '1';
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
const pcmOf = (c: EvalCase) => {
  const wav = wav16k(readFileSync(join(CACHE, 'audio', `${c.audio.key}.pcm`)), c.audio.rate, c.speed);
  const src = new Int16Array(wav.buffer, wav.byteOffset + 44, (wav.length - 44) >> 1);
  return { wav, pcm: Float32Array.from(src, (v) => v / 32768) };
};
const clip = (pcm: Float32Array, span: { from: number; to: number }) => Buffer.from(cutWav(pcm, span.from - PAD, span.to + PAD, RATE));
const secs = (b: Buffer) => (b.length - 44) / 2 / RATE;

const jobs: { file: string; reference: string; locale: string }[] = [];
let missing = 0;
mkdirSync(join(CACHE, 'clips'), { recursive: true });
/** Score from the cache — or, when planning, note the scoring as a job. */
const score = async (wav: Buffer, reference: string, locale: string): Promise<unknown | null> => {
  if (PLAN) {
    const file = join(CACHE, 'clips', `${sha(wav.toString('base64'))}.wav`);
    if (!existsSync(file)) writeFileSync(file, wav);
    jobs.push({ file, reference, locale });
    return null;
  }
  try { return await assess({ wav, reference, locale }); } catch { missing++; return null; }
};

// ------------------------------------------------------------------------------------------------ Mandarin
{
  const cases = zhCases.filter((c) => hanChars(c.reference).length > 1 && c.alts?.length);
  let fullSecs = 0, clipSecs = 0;
  const rows: { c: EvalCase; clipAlts: ZhAlternativeResult[] }[] = [];
  for (const c of cases) {
    const chars = hanChars(c.reference);
    const { wav, pcm } = pcmOf(c);
    const spans = readCharacters(c.azure as AzureZhResponse, chars).perChar.map((r) => (r.offsetMs != null && r.durationMs ? { from: r.offsetMs / 1000, to: (r.offsetMs + r.durationMs) / 1000 } : null));
    fullSecs += secs(wav) * c.alts!.length;
    const clipAlts: ZhAlternativeResult[] = [];
    for (const i of new Set(c.alts!.map((a) => a.index))) {
      const span = spans[i];
      if (!span) continue;
      const w = clip(pcm, span);
      const mine = c.alts!.filter((a) => a.index === i);
      clipSecs += secs(w) * (1 + mine.length);
      const base = await score(w, chars[i], 'zh-CN');
      for (const a of mine) {
        const json = await score(w, a.char, 'zh-CN');
        if (base && json) clipAlts.push({ index: i, py: a.py, char: a.char, part: a.part as 'initial' | 'final', json: json as AzureZhResponse, base: base as AzureZhResponse });
      }
    }
    rows.push({ c, clipAlts });
  }
  if (!PLAN) {
    for (const mode of ['whole take', 'word clip'] as const) {
      let correct = 0, fa = 0, falseNamed = 0, sylCorrect = 0, errs = 0, caught = 0, named = 0, namedAny = 0;
      for (const { c, clipAlts } of rows) {
        const alts = mode === 'word clip' ? clipAlts : c.alts!.map((a) => ({ index: a.index, py: a.py, char: a.char, part: a.part as 'initial' | 'final', json: a.azure as AzureZhResponse }));
        let a;
        try { a = assessZh(c.azure as AzureZhResponse, { text: c.reference, py: c.refPy! }, { durationMs: 0, pitch: pitchFor(c), speaker: profileSpeakers.get(`${c.voice}|${c.speed}`)!, alts }); } catch { continue; }
        const zs = a.words.map((w) => w.syllables[0]?.zh);
        if (c.truth.correct) {
          correct++;
          if (a.words.some((w) => w.errorType === 'mispronunciation' || w.errorType === 'omission')) fa++;
          zs.forEach((z) => { if (z) { sylCorrect++; if (z.heardAs) falseNamed++; } });
        } else if (c.truth.part !== 'tone') {
          errs++;
          const z = zs[c.truth.index!];
          const w = a.words[c.truth.index!];
          if (w && w.errorType !== 'none') caught++;
          if (z?.heardAs) { namedAny++; if (z.heardAs === c.truth.heard) named++; }
        }
      }
      console.log(`Mandarin, ${mode.padEnd(10)}: correct items flagged ${pct(fa, correct)} (of ${correct}); correct syllables "sounded like" ${pct(falseNamed, sylCorrect)}; sound errors caught ${pct(caught, errs)} (of ${errs}), named right ${pct(named, errs)}, precision ${pct(named, namedAny)}`);
    }
    console.log(`Mandarin billed seconds for the checks: whole take ${fullSecs.toFixed(0)} s, word clips ${clipSecs.toFixed(0)} s (${pct(clipSecs, fullSecs)}), pad ${PAD}s\n`);
  }
}

// ------------------------------------------------------------------------------------------------ English sentences
{
  const all: EvalCase[] = JSON.parse(readFileSync(join(CACHE, 'dataset-en.json'), 'utf8')).cases;
  const words = (t: string) => t.split(/\s+/).map((x) => x.replace(/[^A-Za-z']/g, ''));
  for (const locale of ['en-US', 'en-GB'] as const) {
    let fullSecs = 0, clipSecs = 0;
    const res = { 'whole take': { correct: 0, fa: 0, errs: 0, named: 0 }, 'word clip': { correct: 0, fa: 0, errs: 0, named: 0 } };
    for (const c of all.filter((x) => x.kind === 'sentence' && x.locale === locale)) {
      // Each sentence pair: the good take and the swapped take are both checked against the same likely mistake.
      for (const [good, bad, index, target, heard] of EN_SENTENCES.filter(([g, b]) => g === c.reference && (c.truth.correct || b === c.spoken))) {
        const { wav, pcm } = pcmOf(c);
        const span = wordSpans(c.azure as never)[index];
        if (!span) continue;
        const w = clip(pcm, span);
        const whole = await score(wav, bad, locale);
        const base = await score(w, words(good)[index], locale);
        const altClip = await score(w, words(bad)[index], locale);
        fullSecs += secs(wav); clipSecs += 2 * secs(w);
        if (PLAN || !whole || !base || !altClip) continue;
        const alt = { wordIndex: index, target, heard, text: bad };
        for (const mode of ['whole take', 'word clip'] as const) {
          const alts = mode === 'word clip' ? [{ alt, json: altClip as never, base: base as never }] : [{ alt, json: whole as never }];
          const fired = applyEnglishAlternatives(mapAzure(c.azure as never, good, 0, locale).words, c.azure as never, alts).some((x) => x.phonemes.some((p) => p.heardAs === heard && p.phoneme === target));
          const r = res[mode];
          if (c.truth.correct) { r.correct++; if (fired) r.fa++; } else { r.errs++; if (fired) r.named++; }
        }
      }
    }
    if (!PLAN) {
      for (const mode of ['whole take', 'word clip'] as const) {
        const r = res[mode];
        console.log(`English ${locale} sentences, ${mode.padEnd(10)}: correct takes wrongly "sounded like" ${pct(r.fa, r.correct)} (of ${r.correct}); swaps named ${pct(r.named, r.errs)} (of ${r.errs})`);
      }
      console.log(`English ${locale} billed seconds for the checks: whole take ${fullSecs.toFixed(0)} s, word clips ${clipSecs.toFixed(0)} s (${pct(clipSecs, fullSecs)})\n`);
    }
  }
}

if (PLAN) {
  const unique = [...new Map(jobs.map((j) => [`${j.file}|${j.reference}|${j.locale}`, j])).values()];
  writeFileSync(join(CACHE, 'clip-jobs.json'), JSON.stringify(unique));
  console.log(`${unique.length} scorings to run: node eval/run-jobs.mjs`);
} else if (missing) console.log(`(${missing} scorings not in the cache — run --plan and node eval/run-jobs.mjs first)`);
