import type { Assessment, PhonemeScore, Tone, WordScore, ZhSyllable } from '../domain/types';
import { phonemeInfo } from '../content/phonemes';
import { textPhones } from '../content/lexicon';
import { alternativesFor } from '../content/zh/alternatives';
import { parseSyllable, splitPinyin, surfaceTones } from '../content/zh/pinyin';
import { unitsFor } from './zh/assess';
import { SpeechError, type AssessContext, type PronunciationProvider, type Recording } from './types';

// A learner model, not a random-number generator. It produces Azure-shaped results that behave the
// way real learners do: trouble concentrates on the sounds that are hard for the child's home
// language, coaching + retry helps within a sitting, and practice helps across days. Real signal
// checks (silence, noise, cut-off speech) run on the actual recording.

const hash = (s: string): number => {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
};
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const RETRY_FACTOR = [1, 0.5, 0.22, 0.12];

export class MockPronunciationProvider implements PronunciationProvider {
  readonly name = 'mock';

  /** `latency: false` skips the simulated network delay (unit tests). */
  constructor(private opts: { latency?: boolean } = {}) {}

  async assess(rec: Recording, referenceText: string, ctx: AssessContext): Promise<Assessment> {
    const rand = rng(hash(`${ctx.profileId}|${ctx.itemId}|${ctx.attemptIndex}`));
    const delay = 650 + rand() * 500;
    if (this.opts.latency !== false) await wait(ctx.simulate === 'slow' ? 6500 : delay);
    if (ctx.simulate === 'network') throw new SpeechError('network');
    if (ctx.simulate === 'service') throw new SpeechError('service');

    const a = rec.analysis;
    if (!rec.simulated) {
      if (a.speechMs < 120 || a.peak < 0.02) throw new SpeechError('no-speech');
      if (a.noiseRms > 0.045 && a.speechRms / a.noiseRms < 2.2) throw new SpeechError('too-noisy');
    }
    if (ctx.locale === 'zh-CN' && ctx.zh) return mockZh(referenceText, ctx.zh.py, ctx, rand, a.durationMs, ctx.script === 'hant' ? ctx.zh.hant : undefined);

    const words = textPhones(referenceText, ctx.accent);
    const syllables = words.reduce((n, w) => n + w.syllables.length, 0);

    // Completeness: was there enough speech for the whole text? If not, trailing words were dropped.
    const coverage = clamp(a.speechMs / (syllables * 140), 0, 1);
    if (coverage < 0.35 && words.length === 1) throw new SpeechError('too-short');
    const spoken = coverage >= 0.75 ? words.length : Math.max(1, Math.round(words.length * (coverage / 0.75)));

    // Effective difficulty per phoneme for this child, right now.
    const retry = RETRY_FACTOR[Math.min(ctx.attemptIndex, RETRY_FACTOR.length - 1)];
    const eff = (ph: string): number => {
      const info = phonemeInfo(ph);
      const base = clamp(info.difficulty + (info.l1?.[ctx.homeLanguage]?.boost ?? 0), 0, 0.95);
      const stat = ctx.profile?.phonemes[ph];
      const learned = stat ? Math.min(0.6, stat.count / (stat.count + 14)) : 0;
      return base * (1 - learned);
    };

    // Trouble concentrates on the one or two hardest sounds in the utterance.
    const spokenPhonemes = [...new Set(words.slice(0, spoken).flatMap((w) => w.syllables.flatMap((s) => s.phonemes)))];
    const trouble = spokenPhonemes
      .map((ph) => ({ ph, e: eff(ph) }))
      .filter((x) => x.e > 0.2)
      .sort((x, y) => y.e - x.e)
      .slice(0, syllables > 3 ? 2 : 1)
      .map((x) => x.ph);

    const scorePhoneme = (ph: string): PhonemeScore => {
      const e = eff(ph);
      const penalty = trouble.includes(ph) ? (18 + e * 46) * retry : e * 20 * Math.max(retry, 0.5);
      const score = Math.round(clamp(100 - penalty + (rand() - 0.5) * 8, 4, 100));
      const info = phonemeInfo(ph);
      const heardAs = score < 72 ? info.l1?.[ctx.homeLanguage]?.heardAs ?? info.heardAs : undefined;
      return { phoneme: ph, score, heardAs };
    };

    const wordScores: WordScore[] = words.map((w, i) => {
      if (i >= spoken) {
        return { word: w.word, score: 0, errorType: 'omission', syllables: w.syllables.map((s) => ({ text: s.text, score: 0 })), phonemes: [] };
      }
      const syls = w.syllables.map((s) => ({ text: s.text, ph: s.phonemes.map(scorePhoneme) }));
      const phonemes = syls.flatMap((s) => s.ph);
      const mean = avg(phonemes.map((p) => p.score));
      const min = Math.min(...phonemes.map((p) => p.score));
      const score = Math.round(0.4 * mean + 0.6 * min);
      return {
        word: w.word, score, errorType: score < 60 ? 'mispronunciation' : 'none', phonemes,
        syllables: syls.map((s) => ({ text: s.text, score: Math.round(0.4 * avg(s.ph.map((p) => p.score)) + 0.6 * Math.min(...s.ph.map((p) => p.score))) })),
      };
    });

    const spokenWords = wordScores.slice(0, spoken);
    const accuracy = Math.round(avg(spokenWords.map((w) => w.score)));
    const completeness = Math.round((spoken / words.length) * 100);
    const pace = a.speechMs / (syllables * 235);
    const fluency = Math.round(clamp(100 - Math.abs(Math.log2(clamp(pace, 0.2, 5))) * 30 - rand() * 6, 35, 100));
    const prosody = words.length > 1 ? Math.round(clamp(fluency - 6 + rand() * 10, 35, 100)) : undefined;
    const overall = Math.round(0.62 * accuracy + 0.18 * fluency + 0.2 * completeness);

    return { provider: this.name, referenceText, overall, accuracy, fluency, completeness, prosody, words: wordScores, durationMs: a.durationMs };
  }
}

const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// ---------------------------------------------------------------- Mandarin learner model

/** What a Hong Kong child's tone tends to turn into (Cantonese has six tones, but not these shapes). */
const TONE_SLIP: Record<1 | 2 | 3 | 4, Tone> = { 1: 4, 2: 3, 3: 2, 4: 1 };
const TONE_DIFFICULTY: Record<1 | 2 | 3 | 4, number> = { 1: 0.3, 2: 0.45, 3: 0.55, 4: 0.3 };
const UNIT_DIFFICULTY: Record<string, number> = { 'zh:sh': 0.55, 'zh:s': 0.2, 'zh:n': 0.45, 'zh:j': 0.35, 'zh:ü': 0.35, 'zh:-ng': 0.3 };

function mockZh(text: string, py: string, ctx: AssessContext, rand: () => number, durationMs: number, hant?: string): Assessment {
  const chars = [...text].filter((c) => /\p{Script=Han}/u.test(c));
  const shown = hant ? [...hant].filter((c) => /\p{Script=Han}/u.test(c)) : chars;
  const syl = splitPinyin(py);
  const surface = surfaceTones(syl.map((s) => parseSyllable(s).tone), chars);
  const retry = RETRY_FACTOR[Math.min(ctx.attemptIndex, RETRY_FACTOR.length - 1)];
  const learned = (id: string) => { const s = ctx.profile?.phonemes[id]; return s ? Math.min(0.6, s.count / (s.count + 14)) : 0; };
  const home = ctx.homeLanguage === 'yue' ? 0.1 : 0;

  // Risk per syllable; the one or two riskiest are where this take goes wrong.
  const risk = syl.map((s, i) => {
    const t = surface[i].accept[0];
    const u = unitsFor(s);
    const toneRisk = t === 5 ? 0 : (TONE_DIFFICULTY[t as 1 | 2 | 3 | 4] + home) * (1 - learned(`zh:t${t}`));
    const unit = u.initial ?? u.final;
    const segRisk = unit ? ((UNIT_DIFFICULTY[unit] ?? 0.2) + home) * (1 - learned(unit)) : 0;
    return { i, toneRisk, segRisk, unit, r: Math.max(toneRisk, segRisk) * (0.7 + rand() * 0.6) };
  });
  const trouble = new Set([...risk].sort((x, y) => y.r - x.r).filter((x) => x.r * retry > 0.18).slice(0, chars.length > 4 ? 2 : 1).map((x) => x.i));

  const words: WordScore[] = chars.map((_, i) => {
    const char = shown[i] ?? chars[i];
    const sf = surface[i];
    const t = sf.accept[0];
    const z: ZhSyllable = { char, py: syl[i], accept: sf.accept, lowThird: sf.lowThird, soundScore: Math.round(clamp(96 - rand() * 8, 0, 100)) };
    const rk = risk[i];
    if (t !== 5) {
      z.toneScore = Math.round(clamp(92 - rand() * 12, 0, 100));
      z.contour = TONE_CONTOUR[t as 1 | 2 | 3 | 4];
    }
    if (trouble.has(i)) {
      if (t !== 5 && rk.toneRisk >= rk.segRisk) {
        const heard = TONE_SLIP[t as 1 | 2 | 3 | 4];
        z.toneHeard = heard;
        z.toneScore = Math.round(clamp(30 + rand() * 25 + (1 - retry) * 30, 0, 100));
        z.contour = TONE_CONTOUR[heard as 1 | 2 | 3 | 4];
        if (z.toneScore >= 65) { delete z.toneHeard; z.contour = TONE_CONTOUR[t as 1 | 2 | 3 | 4]; }
      } else {
        const alt = alternativesFor(syl[i])[0];
        z.soundScore = Math.round(clamp(45 + rand() * 20 + (1 - retry) * 35, 0, 100));
        if (alt && z.soundScore < 75) z.heardAs = alt.py;
      }
    }
    const score = z.toneHeard ? Math.min(z.soundScore, z.toneScore ?? 60) : z.heardAs ? Math.min(z.soundScore, 55) : z.soundScore;
    const phonemes: PhonemeScore[] = [];
    if (t !== 5 && z.toneScore != null) phonemes.push({ phoneme: `zh:t${t}`, score: z.toneScore });
    const u = unitsFor(syl[i]);
    if (u.initial) phonemes.push({ phoneme: u.initial, score: z.soundScore });
    if (u.final) phonemes.push({ phoneme: u.final, score: z.soundScore });
    return { word: char, score, errorType: score < 60 ? 'mispronunciation' : 'none', syllables: [{ text: char, score, zh: z }], phonemes };
  });
  const overall = Math.round(avg(words.map((w) => w.score)));
  return { provider: 'mock', referenceText: text, words, overall, accuracy: overall, fluency: Math.round(clamp(88 - rand() * 12, 0, 100)), completeness: 100, durationMs };
}

const TONE_CONTOUR: Record<1 | 2 | 3 | 4, number[]> = { 1: [4.7, 4.75, 4.75, 4.7, 4.6], 2: [3, 2.9, 3.4, 4.1, 4.7], 3: [2.4, 1.6, 1.2, 1.5, 2.8], 4: [4.8, 4.4, 3.5, 2.4, 1.4] };
