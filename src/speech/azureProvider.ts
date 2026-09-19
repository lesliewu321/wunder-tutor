import type { Accent, Assessment, PhonemeId, PhonemeScore, WordErrorType, WordScore } from '../domain/types';
import { englishAlternatives, type EnAlternative } from '../content/alternatives-en';
import { alignmentCandidates, tokenize } from '../content/lexicon';
import { alternativeRequests } from '../content/zh/alternatives';
import { apiFetch } from './health';
import { speakerMedian, type PitchTrack } from './pitch';
import { SpeechError, type AssessContext, type PronunciationProvider, type Recording } from './types';
import { assessZh, readCharacters, type AzureZhResponse } from './zh/assess';
import { cutWav } from './wav';
import type { SpeakerRef } from './zh/tone';

// Azure Speech Pronunciation Assessment via the server-side proxy (server/index.mjs), which holds
// the subscription key. The browser only ever sends audio + reference text to our own origin.
// Verified against a live eastasia resource (2026-09): regional stt host, IPA phonemes, syllables and
// prosody all come back over REST. Fixtures from those calls live in src/__tests__/fixtures.

interface AzureCandidate { Phoneme?: string; Score?: number }
interface AzurePhoneme { Phoneme?: string; AccuracyScore?: number; NBestPhonemes?: AzureCandidate[]; PronunciationAssessment?: { AccuracyScore?: number; NBestPhonemes?: AzureCandidate[] } }
interface AzureSyllable { Syllable?: string; Grapheme?: string; AccuracyScore?: number; PronunciationAssessment?: { AccuracyScore?: number } }
interface AzureWord {
  Word: string; AccuracyScore?: number; ErrorType?: string; Offset?: number; Duration?: number;
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

/**
 * Azure scores every phoneme in every locale but only *names* them for en-US. For British English the scores arrive
 * in order with empty names, so we line them up with our own pronunciation of the word. Silent-R slots are dropped:
 * a British learner must never be coached on an R they are right not to say. No confident alignment → leave unnamed,
 * and the feedback layer falls back to word-level advice rather than naming the wrong sound.
 */
const namePhonemes = (word: string, scored: PhonemeScore[], accent: Accent): PhonemeScore[] => {
  if (!scored.length || scored.some((p) => p.phoneme)) return scored;
  const fit = alignmentCandidates(word, accent).find((c) => c.phonemes.length === scored.length);
  if (!fit) return scored;
  return scored.map((p, i) => ({ ...p, phoneme: fit.phonemes[i] })).filter((_, i) => !fit.silent[i]);
};

/**
 * What came out instead of a sound, from Azure's own candidate list (en-US only). Only for a clearly weak sound
 * whose best candidate is a different sound and clearly beats the expected one — otherwise we say nothing.
 */
export const HEARD = { weakBelow: 60, minCandidate: 50, minLead: 20 };
const heardFrom = (expected: string, score: number, nbest?: AzureCandidate[]): PhonemeId | undefined => {
  if (!nbest?.length || !expected || score >= HEARD.weakBelow) return undefined;
  const top = nbest[0];
  const cand = normalise(top.Phoneme ?? '');
  const topScore = top.Score ?? 0;
  if (!cand || cand === expected || topScore < HEARD.minCandidate) return undefined;
  const own = nbest.find((n) => normalise(n.Phoneme ?? '') === expected)?.Score ?? 0;
  return topScore - own >= HEARD.minLead ? cand : undefined;
};

const mapWords = (best: AzureNBest, accent: Accent): WordScore[] =>
  (best.Words ?? []).map((w) => ({
    word: w.Word,
    score: Math.round(w.AccuracyScore ?? w.PronunciationAssessment?.AccuracyScore ?? 0),
    errorType: errorType(w.ErrorType ?? w.PronunciationAssessment?.ErrorType),
    syllables: (w.Syllables ?? []).map((y) => ({ text: y.Grapheme ?? y.Syllable ?? '', score: Math.round(y.AccuracyScore ?? y.PronunciationAssessment?.AccuracyScore ?? 0) })),
    phonemes: namePhonemes(w.Word, (w.Phonemes ?? []).map((p) => {
      const phoneme = normalise(p.Phoneme ?? '');
      const score = Math.round(p.AccuracyScore ?? p.PronunciationAssessment?.AccuracyScore ?? 0);
      const heardAs = heardFrom(phoneme, score, p.PronunciationAssessment?.NBestPhonemes ?? p.NBestPhonemes);
      return heardAs ? { phoneme, score, heardAs } : { phoneme, score };
    }), accent),
  }));

/**
 * Sounds that are the same in British and American English: every consonant except R, and the vowels both accents
 * share (the ship/sheep, bad/bed, full/fool contrasts). British-only vowels (ɒ hot, əʊ no, ɜ bird, ɑ in glass) never
 * pair with a US symbol, so they always stay British.
 */
const SHARED_SOUNDS = new Set(['p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ', 'tʃ', 'dʒ', 'h', 'm', 'n', 'ŋ', 'l', 'w', 'j',
  'ɪ', 'i', 'æ', 'ɛ', 'ʊ', 'u', 'ʌ', 'eɪ', 'aɪ', 'aʊ', 'ɔɪ']);
/** The US scorer rated correct British takes ~100; clearly lower on a shared sound is evidence, not accent. */
export const US_EVIDENCE = { lowerBy: 15 };

/** Pair up two phoneme sequences on identical symbols (longest common subsequence). */
const alignSame = (a: string[], b: string[]): [number, number][] => {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs: [number, number][] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return pairs;
};

/**
 * British takes: Azure's en-GB model names no sounds and reports nothing about what came out instead, and it is
 * lenient on some substitutions ("free" for "three" left /θ/ at 82). The same audio scored as US English does name
 * them — and for sounds both accents share, that verdict is accent-free (the US scorer gave correct British takes
 * ~100). So on shared sounds, a clearly lower US score and its "heard as" carry over; R and British-only vowels
 * always stay British.
 */
export const mergeUsConsonants = (gb: WordScore[], usAll: WordScore[]): WordScore[] => {
  // Words line up by position among the reference words; an extra word heard by only one scorer must not shift them.
  const us = usAll.filter((w) => w.errorType !== 'insertion');
  let ref = -1;
  return gb.map((w) => {
    if (w.errorType === 'insertion') return w;
    const u = us[++ref];
    if (!u || u.word.toLowerCase() !== w.word.toLowerCase() || !w.phonemes.length || !u.phonemes.length) return w;
    const pairs = alignSame(w.phonemes.map((p) => p.phoneme), u.phonemes.map((p) => p.phoneme));
    const phonemes = w.phonemes.map((p) => ({ ...p }));
    for (const [gi, ui] of pairs) {
      const up = u.phonemes[ui];
      if (!SHARED_SOUNDS.has(phonemes[gi].phoneme)) continue;
      if (up.heardAs) phonemes[gi] = { ...phonemes[gi], score: Math.min(phonemes[gi].score, up.score), heardAs: up.heardAs };
      else if (up.score < phonemes[gi].score - US_EVIDENCE.lowerBy) phonemes[gi] = { ...phonemes[gi], score: up.score };
    }
    return { ...w, phonemes };
  });
};

/** How much better a likely mistake must fit a word than the real text before we say that's what was said. */
export const EN_ALT_MARGIN = 7;

export interface EnAltResult {
  alt: EnAlternative;
  /** The take (or, with `base`, just the word's clip) scored against the likely mistake. */
  json: AzureResponse | null | undefined;
  /** Clip mode: the word's clip scored against the real word — the mistake is compared with this, not the whole take. */
  base?: AzureResponse | null;
}

const rawWordScore = (json: AzureResponse | null | undefined, wi: number): number | null => {
  const w = json?.NBest?.[0]?.Words?.filter((x) => errorType(x.ErrorType ?? x.PronunciationAssessment?.ErrorType) !== 'insertion')[wi];
  if (!w) return null;
  return w.AccuracyScore ?? w.PronunciationAssessment?.AccuracyScore ?? null;
};

/**
 * The same take scored against likely mistakes ("fank you", "wery"): where a mistake fits a word clearly better than
 * the real text, the swapped sound is what came out. Compared raw score to raw score, so it holds for either accent.
 */
export const applyEnglishAlternatives = (words: WordScore[], main: AzureResponse, alts: EnAltResult[], margin = EN_ALT_MARGIN): WordScore[] => {
  const best = new Map<number, { alt: EnAlternative; lead: number }>();
  for (const { alt, json, base } of alts) {
    if (json?.RecognitionStatus !== 'Success') continue;
    const m = base !== undefined ? rawWordScore(base, 0) : rawWordScore(main, alt.wordIndex);
    const a = rawWordScore(json, base !== undefined ? 0 : alt.wordIndex);
    if (m == null || a == null || a < 60 || a - m < margin) continue;
    const prev = best.get(alt.wordIndex);
    if (!prev || a - m > prev.lead) best.set(alt.wordIndex, { alt, lead: a - m });
  }
  if (!best.size) return words;
  const counted = words.filter((w) => w.errorType !== 'insertion');
  return words.map((w) => {
    const hit = best.get(counted.indexOf(w));
    if (!hit) return w;
    let marked = false;
    const phonemes = w.phonemes.map((p) => {
      if (marked || p.phoneme !== hit.alt.target) return p;
      marked = true;
      return { ...p, score: Math.min(p.score, 45), heardAs: hit.alt.heard };
    });
    return marked ? { ...w, phonemes, score: Math.min(w.score, 70) } : w;
  });
};

export const mapAzure = (json: AzureResponse, referenceText: string, fallbackDurationMs: number, accent: Accent = 'en-US', usJson?: AzureResponse, alts: EnAltResult[] = []): Assessment => {
  if (json.RecognitionStatus && json.RecognitionStatus !== 'Success') {
    throw new SpeechError(/silence|nomatch/i.test(json.RecognitionStatus) ? 'no-speech' : 'service', json.RecognitionStatus);
  }
  const best = json.NBest?.[0];
  if (!best) throw new SpeechError('no-speech');
  // Azure occasionally answers "Success" without the pronunciation part — a glitch, never a zero for the child.
  if (best.AccuracyScore == null && best.PronunciationAssessment == null) throw new SpeechError('service', 'no scores');
  // Scores but no words: another glitch — the overall number alone must not count as a pass.
  if (!(best.Words ?? []).length) throw new SpeechError('service', 'no words');
  // Nothing recognised at all (every word "omitted"): ask again rather than mark every word missing.
  if ((best.Words ?? []).every((w) => errorType(w.ErrorType ?? w.PronunciationAssessment?.ErrorType) === 'omission')) throw new SpeechError('no-speech');
  const s: AzureScores = { ...best.PronunciationAssessment, ...pick(best) };
  let words: WordScore[] = mapWords(best, accent);
  const usBest = accent === 'en-GB' && usJson?.RecognitionStatus === 'Success' ? usJson.NBest?.[0] : undefined;
  if (usBest) words = mergeUsConsonants(words, mapWords(usBest, 'en-US'));
  if (alts.length) words = applyEnglishAlternatives(words, json, alts);
  if (accent === 'en-GB') {
    // Azure's en-GB word score marks correct single words down whatever the accent (a correct "they" scored 59–61
    // while its sounds scored 79–100, and the US scorer gave the same take 100). Its per-sound scores are sound, so
    // a British word's score is built from its sounds.
    words = words.map((w) => (w.errorType === 'omission' || w.errorType === 'insertion' || !w.phonemes.length ? w : { ...w, score: Math.round(w.phonemes.reduce((n, p) => n + p.score, 0) / w.phonemes.length) }));
    const counted = words.filter((w) => w.errorType !== 'insertion');
    const acc = Math.round(counted.reduce((n, w) => n + w.score, 0) / Math.max(1, counted.length));
    s.AccuracyScore = acc;
    s.PronScore = acc; // en-GB's prosody isn't documented as supported; don't let it pull the score around either
  }
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

/**
 * Phrases and sentences: check likely mistakes on each word's own clip instead of re-scoring the whole take — Azure
 * bills by the second. Single words are one clip already. eval/clips.ts (2026-09-19), whole take → clip: Mandarin
 * sound slips named 27% → 58% (0.04 s either side), British swaps 0% → 88%, US 84% → 78–81% (1 case in 32), no new
 * false alarms, ~35% cheaper. Mandarin characters are clearly separate syllables: a tight clip works best.
 */
export const CLIP_CHECKS = { on: true, pad: { zh: 0.04, en: 0.08 } };

type AssessBody = AzureResponse & { main?: AzureResponse; us?: AzureResponse | null; alts?: (AzureResponse | null)[] };

const TICKS_PER_S = 10_000_000;

/** Where each reference word was heard in the take, in seconds (from the main scoring), by word position. */
export const wordSpans = (json: AzureResponse): ({ from: number; to: number } | null)[] =>
  (json.NBest?.[0]?.Words ?? [])
    .filter((w) => errorType(w.ErrorType ?? w.PronunciationAssessment?.ErrorType) !== 'insertion')
    .map((w) => (w.Offset != null && w.Duration && errorType(w.ErrorType ?? w.PronunciationAssessment?.ErrorType) !== 'omission'
      ? { from: w.Offset / TICKS_PER_S, to: (w.Offset + w.Duration) / TICKS_PER_S } : null));

async function postAssess(params: URLSearchParams, body: Blob | ArrayBuffer, ms: number): Promise<AssessBody> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  let res: Response;
  try {
    res = await apiFetch(`/api/assess?${params}`, { method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body, signal: ctl.signal });
  } catch (e) {
    throw new SpeechError((e as Error).name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 504) throw new SpeechError('timeout');
  if (!res.ok) throw new SpeechError('service', `assess ${res.status}`);
  return (await res.json()) as AssessBody;
}

export class AzurePronunciationProvider implements PronunciationProvider {
  readonly name = 'azure';

  async assess(rec: Recording, referenceText: string, ctx: AssessContext): Promise<Assessment> {
    if (!rec.wav) throw new SpeechError('service', 'no audio to assess');
    const zh = ctx.locale === 'zh-CN' && ctx.zh ? ctx.zh : null;
    // Extra scorings for accuracy: the take against likely mistakes ("what did it sound like instead"), and for
    // British takes the same take as US English (named sounds, and "heard as" for sounds both accents share).
    const alts = zh ? alternativeRequests(referenceText, zh.py, ctx.focus) : [];
    const enAlts = zh ? [] : englishAlternatives(referenceText, ctx.focus, ctx.accent, ctx.homeLanguage);
    const altTexts = zh ? alts.map((a) => a.text) : enAlts.map((a) => a.text);
    const units = zh ? [...referenceText].filter((c) => /\p{Script=Han}/u.test(c)) : tokenize(referenceText);
    // More than one word: score the take first, then each checked word's clip (in parallel) — see CLIP_CHECKS.
    const clips = CLIP_CHECKS.on && units.length > 1 && !!rec.pcm && altTexts.length > 0;
    const params = new URLSearchParams({ text: referenceText, locale: ctx.locale });
    if (ctx.locale === 'en-US') params.set('nbest', '5');
    if (ctx.locale === 'en-GB') params.set('dual', '1');
    if (altTexts.length && !clips) params.set('alts', JSON.stringify(altTexts));

    const body = await postAssess(params, rec.wav, 20000);
    const main = body.main ?? body;

    // Clip checks: per word, its clip scored against the real word and against each likely mistake. A failure here
    // only loses the "sounded like" hints; the main score stands.
    const clipped = new Map<number, AssessBody | null>();
    if (clips && main.RecognitionStatus === 'Success') {
      const spans = zh ? readCharacterSpans(main as AzureZhResponse, units) : wordSpans(main);
      const indexes = [...new Set(zh ? alts.map((a) => a.index) : enAlts.map((a) => a.wordIndex))];
      await Promise.all(indexes.map(async (i) => {
        const span = spans[i];
        if (!span) return;
        const mistakes = zh ? alts.filter((a) => a.index === i).map((a) => a.char) : enAlts.filter((a) => a.wordIndex === i).map((a) => tokenize(a.text)[i]);
        const p = new URLSearchParams({ text: units[i], locale: ctx.locale, alts: JSON.stringify(mistakes) });
        const pad = zh ? CLIP_CHECKS.pad.zh : CLIP_CHECKS.pad.en;
        try { clipped.set(i, await postAssess(p, cutWav(rec.pcm!, span.from - pad, span.to + pad), 8000)); } catch { clipped.set(i, null); }
      }));
    }

    if (zh) {
      const speaker = ctx.speaker ?? (rec.pitch ? thisTake(rec.pitch) : null);
      const zhAlts = clips
        ? alts.flatMap((a) => {
          const c = clipped.get(a.index);
          const k = alts.filter((x) => x.index === a.index).indexOf(a);
          const json = c?.alts?.[k];
          return c?.main && json ? [{ index: a.index, py: a.py, char: a.char, part: a.part, json: json as AzureZhResponse, base: c.main as AzureZhResponse }] : [];
        })
        : alts.flatMap((a, i) => (body.alts?.[i] ? [{ index: a.index, py: a.py, char: a.char, part: a.part, json: body.alts[i] as AzureZhResponse }] : []));
      return assessZh(main as AzureZhResponse, { text: referenceText, py: zh.py, hant: zh.hant }, {
        durationMs: rec.analysis.durationMs, pitch: rec.pitch, speaker, script: ctx.script, alts: zhAlts,
      });
    }
    const enResults: EnAltResult[] = clips
      ? enAlts.flatMap((alt) => {
        const c = clipped.get(alt.wordIndex);
        const k = enAlts.filter((x) => x.wordIndex === alt.wordIndex).indexOf(alt);
        return c?.main ? [{ alt, json: c.alts?.[k], base: c.main }] : [];
      })
      : enAlts.map((alt, i) => ({ alt, json: body.alts?.[i] }));
    return mapAzure(main, referenceText, rec.analysis.durationMs, ctx.accent, body.us ?? undefined, enResults);
  }
}

/** Where each character was heard in a Mandarin take, in seconds. */
const readCharacterSpans = (json: AzureZhResponse, chars: string[]): ({ from: number; to: number } | null)[] =>
  readCharacters(json, chars).perChar.map((r) => (r.offsetMs != null && r.durationMs ? { from: r.offsetMs / 1000, to: (r.offsetMs + r.durationMs) / 1000 } : null));

/** First Mandarin takes, before we know the child's voice: judge against this take's own middle pitch. */
const thisTake = (pitch: PitchTrack): SpeakerRef | null => {
  const m = speakerMedian(pitch);
  return m == null ? null : { median: m, takes: 0 };
};
