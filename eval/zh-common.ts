// Shared Mandarin eval helpers (no side effects): load the test set, pitch-track takes, estimate each "speaker".
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CACHE, wav16k } from './lib.mjs';
import type { EvalCase } from './build';
import { semitones, speakerMedian, trackPitch, type PitchTrack } from '../src/speech/pitch';
import { parseSyllable, surfaceTones } from '../src/content/zh/pinyin';
import type { SpeakerRef } from '../src/speech/zh/tone';

/**
 * A synthetic take is only a fair test if it really is the text: the voice sometimes returns a few milliseconds of
 * audio, or keeps going for half a minute. Such takes are generation glitches, not learner speech — excluded.
 */
export const takeSeconds = (c: EvalCase): number => readFileSync(join(CACHE, 'audio', `${c.audio.key}.pcm`)).length / 2 / c.audio.rate / c.speed;
export const plausibleTake = (c: EvalCase): boolean => {
  const syl = [...c.spoken].filter((ch) => /\p{Script=Han}/u.test(ch)).length || c.spoken.split(/\s+/).length;
  const s = takeSeconds(c);
  return s >= 0.18 && s <= 1.5 + 0.9 * syl;
};
/** Azure sometimes answers "Success" without running the pronunciation part (no scores at all) — not a verdict. */
export const scored = (c: EvalCase): boolean => {
  const b = (c.azure as { NBest?: { AccuracyScore?: number; PronunciationAssessment?: object }[] }).NBest?.[0];
  return !b || b.AccuracyScore != null || b.PronunciationAssessment != null;
};

const allZh: EvalCase[] = JSON.parse(readFileSync(join(CACHE, 'dataset-zh.json'), 'utf8')).cases;
export const zhExcluded = allZh.filter((c) => !plausibleTake(c) || !scored(c));
export const zhCases: EvalCase[] = allZh.filter((c) => plausibleTake(c) && scored(c));

const pitchCache = new Map<string, PitchTrack>();
export function pitchFor(c: EvalCase): PitchTrack {
  const k = `${c.audio.key}|${c.speed}`;
  let t = pitchCache.get(k);
  if (!t) {
    const pcm = readFileSync(join(CACHE, 'audio', `${c.audio.key}.pcm`));
    const wav: Buffer = wav16k(pcm, c.audio.rate, c.speed);
    const n = (wav.length - 44) >> 1;
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) s[i] = wav.readInt16LE(44 + i * 2) / 32768;
    t = trackPitch(s, 16000);
    pitchCache.set(k, t);
  }
  return t;
}

const pct = (xs: number[], q: number) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };

/** A child's pitch history, per voice and speed: median of their takes' medians, and their 10th–90th spread. */
export const speakers = new Map<string, SpeakerRef>();
{
  const meds = new Map<string, number[]>();
  const all = new Map<string, number[]>();
  const seen = new Set<string>();
  for (const c of zhCases) {
    const k = `${c.voice}|${c.speed}`;
    const tk = `${k}|${c.audio.key}`;
    if (seen.has(tk)) continue;
    seen.add(tk);
    const tr = pitchFor(c);
    const m = speakerMedian(tr);
    if (m != null) meds.set(k, [...(meds.get(k) ?? []), m]);
    all.set(k, [...(all.get(k) ?? []), ...Array.from(tr.f0).filter((f) => f > 0).map(semitones)]);
  }
  for (const [k, ms] of meds) speakers.set(k, { median: pct(ms, 0.5), spread: pct(all.get(k)!, 0.9) - pct(all.get(k)!, 0.1), takes: ms.length });
}

export const hanChars = (s: string) => [...s].filter((c) => /\p{Script=Han}/u.test(c));
export const breaksOf = (text: string) => { const b = new Set<number>(); let i = -1; for (const c of text) { if (/\p{Script=Han}/u.test(c)) i++; else if (i >= 0 && /[，。！？]/.test(c)) b.add(i); } return b; };
export const surfaceOf = (text: string, py: string) => surfaceTones(py.split(' ').map((s) => parseSyllable(s).tone), hanChars(text), breaksOf(text));
export const pct100 = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '—');
