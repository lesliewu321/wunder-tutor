// Builds the labelled accuracy test set: synthetic takes (Gemini Live, several voices, normal and "child-like"
// speed) scored by Azure exactly as the app would score them, plus the extra scorings the accuracy features use
// (US "heard as" for British takes; likely-mistake alternatives for Mandarin).
//
//   npx vite-node eval/build.ts [en|zh]      → eval/.cache/dataset-<lang>.json
//
// Everything is cached; a rerun only generates what is missing.

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { assess, CACHE, pool, take, wav16k } from './lib.mjs';
import { EN_PAIRS, EN_SENTENCES, VOICES, ZH_PAIRS, ZH_PHRASES } from './cases';
import { ITEM_INDEX } from '../src/content/course';
import { ZH_ITEMS } from '../src/content/zh/course';
import { alternativesFor } from '../src/content/zh/alternatives';

type Speed = 1 | 1.25;

export interface EvalCase {
  id: string;
  lang: 'en' | 'zh';
  locale: 'en-US' | 'en-GB' | 'zh-CN';
  voice: string;
  speed: Speed;
  /** What the learner was asked to say. */
  reference: string;
  refPy?: string;
  /** What the synthetic learner actually said. */
  spoken: string;
  spokenPy?: string;
  kind: 'pair' | 'pair-reverse' | 'sentence' | 'lesson' | 'phrase';
  truth: { correct: boolean; index?: number; target?: string; heard?: string; part?: 'tone' | 'initial' | 'final' };
  audio: { key: string; rate: number; transcript: string };
  azure: unknown;
  /** British takes: the same audio scored as US English with "what was said instead" candidates. */
  azureUS?: unknown;
  /** Mandarin: the same audio scored against likely mistakes. */
  alts?: { index: number; py: string; char: string; part: string; azure: unknown }[];
}

const which = process.argv[2] ?? 'all';
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function buildEnglish(): Promise<EvalCase[]> {
  const cases: EvalCase[] = [];
  const lessonTexts = [...new Set(Object.values(ITEM_INDEX).filter((i) => !i.lang).map((i) => i.text))];
  for (const locale of ['en-US', 'en-GB'] as const) {
    const texts = [...new Set([...EN_PAIRS.flatMap(([a, b]) => [a, b]), ...EN_SENTENCES.flatMap(([a, b]) => [a, b]), ...lessonTexts])];
    const jobs = VOICES.flatMap((voice) => texts.map((text) => ({ text, voice })));
    log(`${locale}: ${jobs.length} takes`);
    const takes = new Map<string, { key: string; rate: number; transcript: string; pcm: Buffer }>();
    await pool(jobs, 3, async (j: { text: string; voice: string }) => {
      try { takes.set(`${j.voice}|${j.text}`, await take({ text: j.text, locale, voice: j.voice })); } catch (e) { log('take failed', j, (e as Error).message); }
    });

    const planned: Omit<EvalCase, 'azure' | 'azureUS'>[] = [];
    const add = (voice: string, speed: Speed, reference: string, spoken: string, kind: EvalCase['kind'], truth: EvalCase['truth']) => {
      const t = takes.get(`${voice}|${spoken}`);
      if (!t) return;
      planned.push({ id: `${locale}|${voice}|${speed}|${kind}|${reference}|${spoken}`, lang: 'en', locale, voice, speed, reference, spoken, kind, truth, audio: { key: t.key, rate: t.rate, transcript: t.transcript } });
    };
    for (const voice of VOICES) {
      const speeds: Speed[] = voice === 'Kore' ? [1, 1.25] : [1];
      for (const speed of speeds) {
        for (const [a, b, pa, pb] of EN_PAIRS) {
          add(voice, speed, a, a, 'pair', { correct: true });
          add(voice, speed, a, b, 'pair', { correct: false, index: 0, target: pa, heard: pb });
          add(voice, speed, b, b, 'pair-reverse', { correct: true });
          add(voice, speed, b, a, 'pair-reverse', { correct: false, index: 0, target: pb, heard: pa });
        }
        for (const [good, bad, index, target, heard] of EN_SENTENCES) {
          add(voice, speed, good, good, 'sentence', { correct: true });
          add(voice, speed, good, bad, 'sentence', { correct: false, index, target, heard });
        }
        if (speed === 1) for (const text of lessonTexts) add(voice, speed, text, text, 'lesson', { correct: true });
      }
    }
    // De-duplicate identical scorings (the same word appears in several pairs).
    const unique = [...new Map(planned.map((c) => [c.id, c])).values()];
    log(`${locale}: scoring ${unique.length} cases`);
    const scored = await pool(unique, 6, async (c: Omit<EvalCase, 'azure'>) => {
      const t = takes.get(`${c.voice}|${c.spoken}`)!;
      const wav = wav16k(t.pcm, t.rate, c.speed);
      try {
        const azure = await assess({ wav, reference: c.reference, locale, extra: locale === 'en-US' ? { NBestPhonemeCount: 5 } : {} });
        const azureUS = locale === 'en-GB' ? await assess({ wav, reference: c.reference, locale: 'en-US', extra: { NBestPhonemeCount: 5 } }) : undefined;
        return { ...c, azure, azureUS } as EvalCase;
      } catch (e) { log('assess failed', c.id, (e as Error).message); return null; }
    });
    cases.push(...scored.filter(Boolean) as EvalCase[]);
  }
  return cases;
}

const hanChars = (s: string) => [...s].filter((c) => /\p{Script=Han}/u.test(c));

async function buildMandarin(): Promise<EvalCase[]> {
  const locale = 'zh-CN' as const;
  const items = ZH_ITEMS.map((i) => ({ text: i.text, py: i.zh!.py }));
  const pairTexts = ZH_PAIRS.flatMap(([a, pa, b, pb]) => [{ text: a, py: pa }, { text: b, py: pb }]);
  const phraseTexts = ZH_PHRASES.flatMap(([a, pa, b, pb]) => [{ text: a, py: pa }, { text: b, py: pb }]);
  const all = [...new Map([...items, ...pairTexts, ...phraseTexts].map((t) => [t.text, t])).values()];
  const jobs = VOICES.flatMap((voice) => all.map((t) => ({ ...t, voice })));
  log(`zh-CN: ${jobs.length} takes`);
  const takes = new Map<string, { key: string; rate: number; transcript: string; pcm: Buffer }>();
  await pool(jobs, 3, async (j: { text: string; voice: string }) => {
    try { takes.set(`${j.voice}|${j.text}`, await take({ text: j.text, locale, voice: j.voice })); } catch (e) { log('take failed', j, (e as Error).message); }
  });

  const planned: Omit<EvalCase, 'azure' | 'alts'>[] = [];
  const add = (voice: string, speed: Speed, ref: { text: string; py: string }, spoken: { text: string; py: string }, kind: EvalCase['kind'], truth: EvalCase['truth']) => {
    const t = takes.get(`${voice}|${spoken.text}`);
    if (!t) return;
    planned.push({ id: `${locale}|${voice}|${speed}|${kind}|${ref.text}|${spoken.text}`, lang: 'zh', locale, voice, speed, reference: ref.text, refPy: ref.py, spoken: spoken.text, spokenPy: spoken.py, kind, truth, audio: { key: t.key, rate: t.rate, transcript: t.transcript } });
  };
  for (const voice of VOICES) {
    for (const speed of [1, 1.25] as Speed[]) {
      for (const [a, pa, b, pb, part] of ZH_PAIRS) {
        const A = { text: a, py: pa }, B = { text: b, py: pb };
        add(voice, speed, A, A, 'pair', { correct: true });
        add(voice, speed, A, B, 'pair', { correct: false, index: 0, target: pa, heard: pb, part });
        add(voice, speed, B, B, 'pair-reverse', { correct: true });
        add(voice, speed, B, A, 'pair-reverse', { correct: false, index: 0, target: pb, heard: pa, part });
      }
      for (const [a, pa, b, pb, index, part] of ZH_PHRASES) {
        add(voice, speed, { text: a, py: pa }, { text: a, py: pa }, 'phrase', { correct: true });
        add(voice, speed, { text: a, py: pa }, { text: b, py: pb }, 'phrase', { correct: false, index, target: pa.split(' ')[index], heard: pb.split(' ')[index], part });
      }
      if (speed === 1 || voice === 'Kore') for (const it of items) add(voice, speed, it, it, 'lesson', { correct: true });
    }
  }
  const unique = [...new Map(planned.map((c) => [c.id, c])).values()];
  log(`zh-CN: scoring ${unique.length} cases (+ alternatives)`);
  const scored = await pool(unique, 6, async (c: Omit<EvalCase, 'azure'>) => {
    const t = takes.get(`${c.voice}|${c.spoken}`)!;
    const wav = wav16k(t.pcm, t.rate, c.speed);
    try {
      const azure = await assess({ wav, reference: c.reference, locale });
      // Score the same audio against each likely mistake, one syllable at a time.
      const chars = hanChars(c.reference);
      const py = c.refPy!.split(' ');
      const alts: EvalCase['alts'] = [];
      for (let i = 0; i < py.length; i++) {
        for (const alt of alternativesFor(py[i])) {
          let k = -1;
          const text = [...c.reference].map((ch) => (/\p{Script=Han}/u.test(ch) && ++k === i ? alt.char : ch)).join('');
          if (hanChars(text).length !== chars.length) continue;
          alts.push({ index: i, py: alt.py, char: alt.char, part: alt.part, azure: await assess({ wav, reference: text, locale }) });
        }
      }
      return { ...c, azure, alts } as EvalCase;
    } catch (e) { log('assess failed', c.id, (e as Error).message); return null; }
  });
  return scored.filter(Boolean) as EvalCase[];
}

if (which === 'en' || which === 'all') {
  const cases = await buildEnglish();
  writeFileSync(join(CACHE, 'dataset-en.json'), JSON.stringify({ built: new Date().toISOString(), cases }));
  log(`wrote ${cases.length} English cases`);
}
if (which === 'zh' || which === 'all') {
  const cases = await buildMandarin();
  writeFileSync(join(CACHE, 'dataset-zh.json'), JSON.stringify({ built: new Date().toISOString(), cases }));
  log(`wrote ${cases.length} Mandarin cases`);
}
