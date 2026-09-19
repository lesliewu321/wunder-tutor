import type { Assessment, PhonemeScore, Tone, WordErrorType, WordScore, ZhSyllable } from '../../domain/types';
import { parseSyllable, splitPinyin, surfaceTones } from '../../content/zh/pinyin';
import { SWAP_TRUST, swapKind } from '../../content/zh/alternatives';
import { type PitchTrack } from '../pitch';
import { SpeechError } from '../types';
import { DEFAULT_TONE_PARAMS, judgeTone, readTone, type SpeakerRef, type Span, type ToneContext, type ToneModel, type ToneParams } from './tone';

// Mandarin assessment = the speech scorer's view of each syllable's sounds
//                     + our own pitch check of each tone
//                     + "what did it sound like instead", from scoring the same audio against likely mistakes.

interface AzPhoneme { Phoneme?: string; Offset?: number; Duration?: number; AccuracyScore?: number; PronunciationAssessment?: { AccuracyScore?: number } }
interface AzWord {
  Word: string; Offset?: number; Duration?: number; AccuracyScore?: number; ErrorType?: string;
  PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string }; Phonemes?: AzPhoneme[];
}
interface AzScores { AccuracyScore?: number; FluencyScore?: number; CompletenessScore?: number; PronScore?: number }
export interface AzureZhResponse { RecognitionStatus?: string; Duration?: number; NBest?: (AzScores & { PronunciationAssessment?: AzScores; Words?: AzWord[] })[] }

export interface ZhAlternativeResult {
  /** Syllable index (among the characters) the alternative replaces. */
  index: number;
  py: string;
  char: string;
  part: 'initial' | 'final';
  /** The take (or, with `base`, just this character's clip) scored against the likely mistake. */
  json: AzureZhResponse;
  /** Clip mode: the character's clip scored against the real character — the mistake is compared with this. */
  base?: AzureZhResponse;
}

export interface ZhAssessOptions {
  durationMs: number;
  /** Show feedback in the learner's characters: with 'hant' and ref.hant, words are Traditional. */
  script?: 'hant' | 'hans';
  pitch?: PitchTrack | null;
  speaker?: SpeakerRef | null;
  alts?: ZhAlternativeResult[];
  toneParams?: ToneParams;
  /** Override the tone model (the accuracy harness uses this to test on voices a model never saw). */
  toneModel?: ToneModel;
  /** How much better a likely mistake must fit the audio before we say that's what was heard. */
  altMargin?: number;
}

export const ZH_ALT_MARGIN = 8;
/**
 * Below this the scorer's syllable score alone marks a sound as off (1% of correct syllables fell under 50, 2% under
 * 60; 29–35% of swapped ones). Light-tone syllables are exempt: the scorer marks ~10% of correct ones down.
 */
export const ZH_LOW_SOUND = 55;
const TICKS_PER_MS = 10_000;

const isHan = (c: string) => /\p{Script=Han}/u.test(c);
const errorType = (t?: string): WordErrorType => {
  const v = (t ?? 'None').toLowerCase();
  return v === 'omission' ? 'omission' : v === 'insertion' ? 'insertion' : v === 'mispronunciation' ? 'mispronunciation' : 'none';
};

interface CharReading { score: number; error: WordErrorType; offsetMs?: number; durationMs?: number; label?: string }

/** Spread Azure's words (which may hold several characters) back onto the reference's characters. */
export function readCharacters(json: AzureZhResponse, chars: string[]): { perChar: CharReading[]; inserted: string[] } {
  const words = json.NBest?.[0]?.Words ?? [];
  const perChar: CharReading[] = [];
  const inserted: string[] = [];
  for (const w of words) {
    const pa = w.PronunciationAssessment ?? w;
    const err = errorType(pa.ErrorType ?? w.ErrorType);
    if (err === 'insertion') { inserted.push(w.Word); continue; }
    const wc = [...w.Word].filter(isHan);
    const phs = w.Phonemes ?? [];
    for (let k = 0; k < wc.length; k++) {
      const ph = phs.length === wc.length ? phs[k] : undefined;
      const score = Math.round(ph ? (ph.AccuracyScore ?? ph.PronunciationAssessment?.AccuracyScore ?? 0) : (pa.AccuracyScore ?? 0));
      let offsetMs: number | undefined;
      let durationMs: number | undefined;
      if (err !== 'omission') {
        if (ph?.Offset != null && ph.Duration) { offsetMs = ph.Offset / TICKS_PER_MS; durationMs = ph.Duration / TICKS_PER_MS; }
        else if (w.Offset != null && w.Duration) { durationMs = w.Duration / TICKS_PER_MS / wc.length; offsetMs = w.Offset / TICKS_PER_MS + k * durationMs; }
      }
      perChar.push({ score: err === 'omission' ? 0 : score, error: err, offsetMs, durationMs, label: ph?.Phoneme });
    }
  }
  // Azure should mirror the reference exactly; if it doesn't, pad or trim so indices stay aligned.
  while (perChar.length < chars.length) perChar.push({ score: 0, error: 'omission' });
  return { perChar: perChar.slice(0, chars.length), inserted };
}

/** Profile units a syllable practises: its tone, and the tricky part of its sounds. */
export const unitsFor = (py: string): { initial?: string; final?: string } => {
  const s = parseSyllable(py);
  // Curled and flat tongue are taught in opposite directions, so they are separate units.
  const initial = /^(zh|ch|sh|r)$/.test(s.initial) ? 'zh:sh' : /^[zcs]$/.test(s.initial) ? 'zh:s' : /^[jqx]$/.test(s.initial) ? 'zh:j' : /^[nl]$/.test(s.initial) ? 'zh:n' : undefined;
  const final = s.final.startsWith('ü') ? 'zh:ü' : /n$|ng$/.test(s.final) && s.final !== 'er' ? 'zh:-ng' : undefined;
  return { initial, final };
};

/** Does the scorer's own reading of a character ("shan 4") fit the syllable we expect, with one of these tones? */
const labelFits = (label: string | undefined, py: string, tones: number[]): boolean => {
  if (!label) return true; // no label: nothing says it read something else
  const m = /^([a-zü]+)\s*([1-5])$/i.exec(label.trim().replace(/v/g, 'ü'));
  if (!m) return true;
  return m[1].toLowerCase() === parseSyllable(py).base && tones.includes(Number(m[2]));
};

/** Where a syllable sits, which changes how far its tone moves. */
export const toneContext = (i: number, n: number, breaks: Set<number>): ToneContext => (n === 1 ? 'alone' : i === n - 1 || breaks.has(i) ? 'final' : 'mid');

export function assessZh(json: AzureZhResponse, ref: { text: string; py: string; hant?: string }, opts: ZhAssessOptions): Assessment {
  if (json.RecognitionStatus && json.RecognitionStatus !== 'Success') {
    throw new SpeechError(/silence|nomatch/i.test(json.RecognitionStatus) ? 'no-speech' : 'service', json.RecognitionStatus);
  }
  const best = json.NBest?.[0];
  if (!best) throw new SpeechError('no-speech');
  // Azure occasionally answers "Success" without the pronunciation part — a glitch, never a zero for the child.
  if (best.AccuracyScore == null && best.PronunciationAssessment == null) throw new SpeechError('service', 'no scores');
  // Nothing recognised at all (every character "omitted"): ask again rather than mark everything missing.
  const azWords = best.Words ?? [];
  // Scores but no words: another glitch — there is nothing to grade the characters by.
  if (!azWords.length) throw new SpeechError('service', 'no words');
  if (azWords.every((w) => errorType((w.PronunciationAssessment ?? w).ErrorType ?? w.ErrorType) === 'omission')) throw new SpeechError('no-speech');
  const scores: AzScores = { ...best.PronunciationAssessment, ...best };

  const all = [...ref.text];
  const chars = all.filter(isHan);
  const py = splitPinyin(ref.py);
  // Punctuation after a character ends a phrase: tone changes don't carry across it.
  const breaks = new Set<number>();
  let ci = -1;
  for (const c of all) { if (isHan(c)) ci++; else if (ci >= 0 && /[，。！？、,.!?；;：:]/.test(c)) breaks.add(ci); }
  const tones = py.map((s) => parseSyllable(s).tone);
  const surface = surfaceTones(tones, chars, breaks);
  const { perChar } = readCharacters(json, chars);
  const altReadings = (opts.alts ?? []).map((a) => {
    if (!a.base) return { ...a, reading: readCharacters(a.json, chars).perChar[a.index], baseScore: undefined as number | undefined };
    // Clip mode: the clip scored as the real character is the yardstick — but only a clean one. A glitch (no scores,
    // nothing heard) or the scorer reading the character differently out of context (扇 shàn for shān) says nothing
    // about the learner, so that likely mistake is not judged at all.
    const base = readCharacters(a.base, [chars[a.index]]).perChar[0];
    const hasScores = a.base.RecognitionStatus === 'Success' && (a.base.NBest?.[0]?.AccuracyScore != null || a.base.NBest?.[0]?.PronunciationAssessment != null);
    const reads = labelFits(base?.label, py[a.index], [...surface[a.index].accept, tones[a.index]]);
    const usable = hasScores && !!base && base.error !== 'omission' && reads;
    return { ...a, reading: usable ? readCharacters(a.json, [a.char]).perChar[0] : undefined, baseScore: usable ? base.score : undefined };
  });
  const margin = opts.altMargin ?? ZH_ALT_MARGIN;
  const speaker = opts.speaker ?? null;
  const toneParams = opts.toneParams ?? DEFAULT_TONE_PARAMS;
  // Every syllable's span, so each tone can be read against its neighbours (gaps where the scorer gave no timing).
  const spans: Span[] = perChar.map((r) => (r.offsetMs != null && r.durationMs ? { from: r.offsetMs / 1000, to: (r.offsetMs + r.durationMs) / 1000 } : { from: 0, to: 0 }));

  // Scoring is in Simplified; what the learner reads may be Traditional (蘋果, not 苹果).
  const shown = opts.script === 'hant' && ref.hant ? [...ref.hant].filter(isHan) : chars;
  const words: WordScore[] = chars.map((_, i) => {
    const char = shown[i] ?? chars[i];
    const r = perChar[i];
    const sf = surface[i];
    const zh: ZhSyllable = { char, py: py[i], accept: sf.accept as Tone[], lowThird: sf.lowThird, context: toneContext(i, chars.length, breaks), soundScore: r.score };
    if (r.error === 'omission') {
      return { word: char, score: 0, errorType: 'omission', syllables: [{ text: char, score: 0, zh }], phonemes: [] };
    }
    // Sounds: did a likely mistake fit the audio clearly better than the target?
    const better = altReadings
      .filter((a) => {
        if (a.index !== i || !a.reading || a.reading.error === 'omission') return false;
        const trust = SWAP_TRUST[swapKind(py[i], a.py)] ?? {};
        if (trust.off || (trust.maxTarget != null && r.score >= trust.maxTarget)) return false;
        return a.reading.score >= (a.baseScore ?? r.score) + margin + (trust.extraMargin ?? 0) && a.reading.score >= 70;
      })
      .sort((a, b) => b.reading!.score - a.reading!.score)[0];
    if (better) zh.heardAs = better.py;
    const segScore = better ? Math.min(r.score, 55) : r.score;

    // The scorer grades against its own reading of the character. When that differs from ours (it reads 好 in 好吃
    // as hào), its score says nothing about what the child should have said — so it neither confirms a tone slip
    // nor marks the sound down.
    const theirs = r.label ? /^([a-zü]+)\s*([1-5])$/i.exec(r.label.trim().replace(/v/g, 'ü')) : null;
    const scorerDisagrees = !!theirs && (theirs[1].toLowerCase() !== parseSyllable(py[i]).base || !sf.accept.includes(Number(theirs[2]) as Tone));

    // Tone: from the child's own pitch, never from the scorer alone.
    let toneWrong = false;
    if (opts.pitch && speaker && r.offsetMs != null && r.durationMs) {
      const context = toneContext(i, chars.length, breaks);
      const reading = readTone(opts.pitch, spans, i, speaker, context, toneParams, opts.toneModel);
      // A speaker with no takes behind them is this take's own pitch: a new learner, judged more carefully.
      const p = { ...toneParams, ...(context === 'alone' ? undefined : toneParams.connected), ...(speaker.takes === 0 ? toneParams.cold : undefined) };
      // Without the scorer as a second opinion, only a near-certain pitch reading counts.
      const verdict = judgeTone(reading, sf.accept as Tone[], scorerDisagrees ? 0 : r.score, scorerDisagrees ? { ...p, maxExpected: p.maxExpected / 4 } : p);
      if (reading) zh.contour = reading.contour;
      if (verdict.score != null) zh.toneScore = verdict.score;
      if (verdict.wrong) { zh.toneHeard = verdict.heard; toneWrong = true; }
    }
    const neutral = sf.accept.every((t) => t === 5);
    // A light (neutral) tone is unstressed and the scorer expects it wrongly often; when the scorer read the character
    // differently (好 in 好吃 as hào) it graded something else. Either way its score says nothing about the sounds:
    // it neither marks the syllable down nor counts for or against the learner's sounds.
    const unreliable = (neutral || scorerDisagrees) && !better;
    const soundScore = unreliable ? Math.max(segScore, 85) : segScore;
    zh.soundScore = unreliable ? soundScore : r.score;
    const lowSound = !unreliable && !better && r.score < ZH_LOW_SOUND;
    const score = toneWrong ? Math.min(soundScore, zh.toneScore ?? 60) : soundScore;

    const units = unitsFor(py[i]);
    const phonemes: PhonemeScore[] = [];
    const tone = sf.accept[0];
    if (tone !== 5 && zh.toneScore != null) phonemes.push({ phoneme: `zh:t${tone}`, score: zh.toneScore });
    const heardPart = better?.part;
    if (!unreliable) {
      if (units.initial) phonemes.push({ phoneme: units.initial, score: heardPart === 'final' ? r.score : segScore });
      if (units.final) phonemes.push({ phoneme: units.final, score: heardPart === 'initial' ? r.score : segScore });
    }

    const err: WordErrorType = toneWrong || !!better || lowSound ? 'mispronunciation' : 'none';
    return { word: char, score, errorType: err, syllables: [{ text: char, score, zh }], phonemes, offsetMs: r.offsetMs, durationMs: r.durationMs };
  });

  const assessed = words.filter((w) => w.errorType !== 'insertion');
  const overall = Math.round(assessed.reduce((n, w) => n + w.score, 0) / Math.max(1, assessed.length));
  return {
    provider: 'azure', referenceText: ref.text, words, overall,
    accuracy: Math.round(scores.AccuracyScore ?? overall),
    fluency: Math.round(scores.FluencyScore ?? 0),
    completeness: Math.round(scores.CompletenessScore ?? 100),
    durationMs: json.Duration ? json.Duration / TICKS_PER_MS : opts.durationMs,
  };
}
