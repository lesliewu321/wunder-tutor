import type { Assessment, WordErrorType, WordScore } from '../domain/types';
import { SpeechError, type AssessContext, type PronunciationProvider, type Recording } from './types';

// Azure Speech Pronunciation Assessment via the server-side proxy (server/index.mjs), which holds
// the subscription key. The browser only ever sends audio + reference text to our own origin.
// Verified against a live eastasia resource (2026-09): regional stt host, IPA phonemes, syllables and
// prosody all come back over REST. Fixtures from those calls live in src/__tests__/fixtures.

interface AzurePhoneme { Phoneme?: string; AccuracyScore?: number; PronunciationAssessment?: { AccuracyScore?: number } }
interface AzureSyllable { Syllable?: string; Grapheme?: string; AccuracyScore?: number; PronunciationAssessment?: { AccuracyScore?: number } }
interface AzureWord {
  Word: string; AccuracyScore?: number; ErrorType?: string;
  PronunciationAssessment?: { AccuracyScore?: number; ErrorType?: string };
  Syllables?: AzureSyllable[]; Phonemes?: AzurePhoneme[];
}
interface AzureScores { AccuracyScore?: number; FluencyScore?: number; CompletenessScore?: number; PronScore?: number; ProsodyScore?: number }
interface AzureNBest extends AzureScores { PronunciationAssessment?: AzureScores; Words?: AzureWord[] }
interface AzureResponse { RecognitionStatus?: string; NBest?: AzureNBest[]; Duration?: number }

const errorType = (t?: string): WordErrorType => {
  switch ((t ?? 'None').toLowerCase()) {
    case 'mispronunciation': return 'mispronunciation';
    case 'omission': return 'omission';
    case 'insertion': return 'insertion';
    default: return 'none';
  }
};

export const mapAzure = (json: AzureResponse, referenceText: string, fallbackDurationMs: number): Assessment => {
  if (json.RecognitionStatus && json.RecognitionStatus !== 'Success') {
    throw new SpeechError(/silence|nomatch/i.test(json.RecognitionStatus) ? 'no-speech' : 'service', json.RecognitionStatus);
  }
  const best = json.NBest?.[0];
  if (!best) throw new SpeechError('no-speech');
  const s: AzureScores = { ...best.PronunciationAssessment, ...pick(best) };
  const words: WordScore[] = (best.Words ?? []).map((w) => ({
    word: w.Word,
    score: Math.round(w.AccuracyScore ?? w.PronunciationAssessment?.AccuracyScore ?? 0),
    errorType: errorType(w.ErrorType ?? w.PronunciationAssessment?.ErrorType),
    syllables: (w.Syllables ?? []).map((y) => ({ text: y.Grapheme ?? y.Syllable ?? '', score: Math.round(y.AccuracyScore ?? y.PronunciationAssessment?.AccuracyScore ?? 0) })),
    phonemes: (w.Phonemes ?? []).map((p) => ({ phoneme: normalise(p.Phoneme ?? ''), score: Math.round(p.AccuracyScore ?? p.PronunciationAssessment?.AccuracyScore ?? 0) })),
  }));
  // PronScore folds in prosody, which is meaningless for one word: a perfect "three" came back as
  // accuracy 100 / PronScore 88. For single words the accuracy of the sounds is the score.
  const single = words.filter((w) => w.errorType !== 'insertion').length === 1;
  return {
    provider: 'azure', referenceText, words,
    overall: Math.round((single ? s.AccuracyScore : s.PronScore) ?? s.PronScore ?? s.AccuracyScore ?? 0),
    accuracy: Math.round(s.AccuracyScore ?? 0),
    fluency: Math.round(s.FluencyScore ?? 0),
    completeness: Math.round(s.CompletenessScore ?? 0),
    prosody: s.ProsodyScore != null ? Math.round(s.ProsodyScore) : undefined,
    durationMs: json.Duration ? json.Duration / 10000 : fallbackDurationMs,
  };
};

const pick = (b: AzureScores): AzureScores =>
  Object.fromEntries(Object.entries({ AccuracyScore: b.AccuracyScore, FluencyScore: b.FluencyScore, CompletenessScore: b.CompletenessScore, PronScore: b.PronScore, ProsodyScore: b.ProsodyScore }).filter(([, v]) => v != null));

/** Azure IPA → the symbols used by our phoneme catalogue. */
const normalise = (ph: string): string => {
  const p = ph.replace(/[ˈˌː.]/g, '');
  const map: Record<string, string> = { 'ɹ': 'r', 'e': 'ɛ', 'ɡ': 'g', 'ɐ': 'ə', 'a': 'æ', 'ɒ': 'ɑ', 'əʊ': 'oʊ' };
  return map[p] ?? p;
};

export class AzurePronunciationProvider implements PronunciationProvider {
  readonly name = 'azure';

  async assess(rec: Recording, referenceText: string, ctx: AssessContext): Promise<Assessment> {
    if (!rec.wav) throw new SpeechError('service', 'no audio to assess');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 20000);
    let res: Response;
    try {
      res = await fetch(`/api/assess?text=${encodeURIComponent(referenceText)}&locale=${ctx.accent}`, {
        method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: rec.wav, signal: ctl.signal,
      });
    } catch (e) {
      throw new SpeechError((e as Error).name === 'AbortError' ? 'timeout' : 'network');
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 504) throw new SpeechError('timeout');
    if (!res.ok) throw new SpeechError('service', `assess ${res.status}`);
    return mapAzure((await res.json()) as AzureResponse, referenceText, rec.analysis.durationMs);
  }
}
