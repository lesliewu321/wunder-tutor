import type { Tone } from '../../domain/types';
import type { PitchTrack } from '../pitch';
import { segment } from '../pitch';
import { TONE_MODEL } from './toneModel';

// Mandarin tone check from the learner's own pitch.
//
// Each syllable's pitch is summarised by features that describe its movement — five slices of pitch relative to
// the speaker's usual pitch and range, how low and high it goes and when, how far it rises and falls, its length,
// and where it sits in the phrase (a 2nd or 3rd tone rises much further said alone than mid-phrase). A small
// learned model (eval/train-tone.ts, validated by training on some voices and testing on another) turns these into
// a probability for each tone. We only call a tone wrong when the model is confident the child said a different
// tone AND gives the expected one little chance; anything in between says nothing.

export interface SpeakerRef {
  /** Speaker's median pitch in semitones re 100 Hz. */
  median: number;
  /** Speaker's pitch spread (10th–90th percentile, semitones): how far this voice moves. */
  spread?: number;
  /** How many takes the estimate is based on (0 = this take only). */
  takes: number;
}

export const DEFAULT_SPREAD = 9;

export type ToneContext = 'alone' | 'final' | 'mid';

export interface ToneModel {
  mean: number[];
  std: number[];
  /** 4 rows (tones 1–4) of weights over the standardised features, and a bias per row. */
  weights: number[][];
  bias: number[];
}

export interface ToneParams {
  /** Call a tone wrong only if the accepted tones together get less than this probability from our pitch model … */
  maxExpected: number;
  /** … and the speech scorer also marked the syllable down (it hears tones partly: most tone swaps drop its score). */
  scorerDoubt: number;
  trimStart: number;
  trimEnd: number;
}

/**
 * Calibrated on the labelled set with tone models that never saw the voice under test: pitch model and scorer
 * agreeing caught 91% of tone swaps with 3.1% of correct syllables flagged; the pitch model alone caught 68% at 3.8%.
 */
export const DEFAULT_TONE_PARAMS: ToneParams = { maxExpected: 0.4, scorerDoubt: 95, trimStart: 0.08, trimEnd: 0.04 };

/**
 * Typical shapes (semitones relative to the speaker's usual pitch at 10/30/50/70/90 % of the syllable), measured on
 * the labelled set — used to draw the target in the tone picture.
 */
export const SHAPES: Record<ToneContext, Record<1 | 2 | 3 | 4, number[]>> = {
  alone: { 1: [5.0, 5.2, 5.4, 5.8, 6.3], 2: [-1.9, -3.2, -3.0, 3.2, 10.4], 3: [-1.1, -4.4, -5.4, -0.3, 8.0], 4: [7.7, 8.2, 3.5, -1.4, -2.6] },
  final: { 1: [4.6, 4.7, 5.2, 6.0, 6.6], 2: [-1.4, -4.1, -2.9, 2.9, 8.4], 3: [1.5, -2.9, -3.1, -0.3, 4.1], 4: [8.4, 8.1, 5.1, 0.4, 0.0] },
  mid: { 1: [6.8, 7.0, 6.8, 7.0, 5.8], 2: [-0.4, -0.9, 0.4, 3.3, 4.6], 3: [-0.2, -1.5, -3.0, -3.7, -2.2], 4: [6.1, 6.7, 4.9, 1.8, 0.0] },
};

/** Semitones relative to the speaker → Chao's 1 (low) – 5 (high), for the tone picture. */
export const toChao = (st: number): number => Math.round(Math.max(0.6, Math.min(5.4, 3 + st / 3.2)) * 100) / 100;
export const targetContour = (tone: 1 | 2 | 3 | 4, context: ToneContext): number[] => SHAPES[context][tone].map(toChao);

export interface Span { from: number; to: number }

/** Five slices of a span: median pitch (semitones, null if unvoiced) and the fraction of frames that were voiced. */
const slice = (track: PitchTrack, s: Span, p: Pick<ToneParams, 'trimStart' | 'trimEnd'>) => {
  const dur = s.to - s.from;
  const a = s.from + dur * p.trimStart;
  const b = s.to - dur * p.trimEnd;
  const pts = segment(track, a, b);
  const bins: number[][] = [[], [], [], [], []];
  for (const pt of pts) bins[Math.min(4, Math.max(0, Math.floor(((pt.t - a) / (b - a)) * 5)))].push(pt.st);
  const framesPerBin = Math.max(1, (b - a) / track.hop / 5);
  return { pts, raw: bins.map((x) => (x.length ? x.sort((u, v) => u - v)[x.length >> 1] : null)), voiced: bins.map((x) => Math.min(1, x.length / framesPerBin)) };
};

const lastVoiced = (xs: (number | null)[]) => [...xs].reverse().find((v) => v != null) ?? null;
const firstVoiced = (xs: (number | null)[]) => xs.find((v) => v != null) ?? null;

/**
 * Features of one syllable's pitch (see the file comment). `spans` are all syllables of the take, so a syllable can
 * be compared with its neighbours (a 1st tone sits higher than what's around it, a 3rd lower). Null when there is
 * too little voiced pitch to tell.
 */
export function toneFeatures(track: PitchTrack, spans: Span[], i: number, ref: SpeakerRef, context: ToneContext, p: Pick<ToneParams, 'trimStart' | 'trimEnd'> = DEFAULT_TONE_PARAMS): { features: number[]; slices: number[] } | null {
  const span = spans[i];
  const dur = span.to - span.from;
  if (dur < 0.06) return null;
  const me = slice(track, span, p);
  if (me.pts.length < 4 || me.raw.filter((x) => x != null).length < 3) return null;
  const spread = Math.max(4, ref.spread ?? DEFAULT_SPREAD);
  const rel = me.raw.map((x, k) => {
    if (x != null) return x - ref.median;
    for (let d = 1; d < 5; d++) { const v = me.raw[k - d] ?? me.raw[k + d]; if (v != null) return v - ref.median; }
    return 0;
  });
  const z = rel.map((v) => v / spread);
  const min = Math.min(...z), max = Math.max(...z);
  const mean = z.reduce((n, v) => n + v, 0) / 5;
  const shape = [z[0], z[1], z[2], z[3], z[4], z[4] - z[0], z[4] - min, max - z[4], z[0] - min, z.indexOf(min) / 4, z.indexOf(max) / 4];
  // Neighbours: how this syllable joins the one before and the one after, and how high it sits against the take.
  const prev = spans[i - 1] && slice(track, spans[i - 1], p);
  const next = spans[i + 1] && slice(track, spans[i + 1], p);
  const pe = prev ? lastVoiced(prev.raw) : null;
  const ns = next ? firstVoiced(next.raw) : null;
  const takeVals = spans.flatMap((s) => slice(track, s, p).raw.filter((v): v is number => v != null));
  const takeMean = takeVals.length ? takeVals.reduce((n, v) => n + v, 0) / takeVals.length : ref.median;
  const joins = [pe == null ? 0 : z[0] - (pe - ref.median) / spread, pe == null ? 0 : 1, ns == null ? 0 : (ns - ref.median) / spread - z[4], ns == null ? 0 : 1, mean - (takeMean - ref.median) / spread];
  const ctx = [context === 'alone' ? 1 : 0, context === 'final' ? 1 : 0, context === 'mid' ? 1 : 0];
  return {
    features: [...shape, min, max, mean, Math.log(Math.max(0.08, dur)), ...me.voiced, ...joins, ...ctx, ...ctx.flatMap((c) => shape.map((s) => c * s))],
    slices: rel,
  };
}

/** Probability of each tone (index 0–3 = tones 1–4). */
export function toneProbabilities(model: ToneModel, features: number[]): number[] {
  const x = features.map((f, i) => (f - model.mean[i]) / (model.std[i] || 1));
  const logits = model.weights.map((w, k) => w.reduce((n, wi, i) => n + wi * x[i], model.bias[k]));
  const m = Math.max(...logits);
  const e = logits.map((l) => Math.exp(l - m));
  const s = e.reduce((n, v) => n + v, 0);
  return e.map((v) => v / s);
}

export interface ToneReading {
  /** Pitch at five slices, semitones relative to the speaker. */
  slices: number[];
  /** The same on Chao's 1–5 scale, for the tone picture. */
  contour: number[];
  /** Probability of tones 1–4. */
  probs: number[];
  heard: 1 | 2 | 3 | 4;
}

/**
 * Read the tone of one syllable from `from`–`to` seconds of the take. Null when there is too little voiced pitch
 * to tell (whispered, creaky, clipped, noisy) — the caller must then say nothing about the tone.
 */
export function readTone(track: PitchTrack, spans: Span[], i: number, ref: SpeakerRef, context: ToneContext = 'alone', p: ToneParams = DEFAULT_TONE_PARAMS, model: ToneModel = TONE_MODEL): ToneReading | null {
  const f = toneFeatures(track, spans, i, ref, context, p);
  if (!f) return null;
  const probs = toneProbabilities(model, f.features);
  const heard = (probs.indexOf(Math.max(...probs)) + 1) as 1 | 2 | 3 | 4;
  return { slices: f.slices, contour: f.slices.map(toChao), probs, heard };
}

export interface ToneVerdict {
  /** 0–100; undefined when the tone couldn't be measured or is the light tone. */
  score?: number;
  /** Measured tone, reported only when we are confident it is not an accepted one. */
  heard?: Tone;
  wrong: boolean;
}

/**
 * Judge a reading against the tones a native speaker would accept here. `soundScore` is the speech scorer's score for
 * the syllable: a tone is only called wrong when our pitch model and the scorer agree something is off.
 */
export function judgeTone(reading: ToneReading | null, accept: Tone[], soundScore: number, p: ToneParams = DEFAULT_TONE_PARAMS): ToneVerdict {
  const checked = accept.filter((t): t is 1 | 2 | 3 | 4 => t !== 5);
  if (!reading || !checked.length) return { wrong: false };
  const pOk = checked.reduce((n, t) => n + reading.probs[t - 1], 0);
  if (checked.includes(reading.heard) || pOk >= 0.5) return { score: Math.round(75 + 25 * Math.min(1, pOk)), wrong: false };
  if (pOk >= p.maxExpected || soundScore >= p.scorerDoubt) return { score: Math.round(66 + 18 * pOk), wrong: false }; // not sure enough to say
  return { score: Math.round(20 + 100 * pOk), heard: reading.heard, wrong: true };
}
