import { isGrownUp, type AgeBand, type Assessment, type HomeLanguage, type PhonemeId, type Tone, type WordScore, type ZhSyllable } from '../domain/types';
import { phonemeInfo, soundLabel, tipFor } from '../content/phonemes';
import { markSyllable, parseSyllable } from '../content/zh/pinyin';
import { unitsFor as zhUnits } from '../speech/zh/assess';
import { isMastered, wrongSound } from '../engine/learning';
import { sentences, t } from '../i18n';

/**
 * Substitutions that aren't English sounds get a plain description instead of a symbol ("a quick tapped R"). Each
 * has its own whole sentences in the catalog — `feedback.sound.heard.<this name>.kid` / `.adult`.
 */
const FOREIGN_SOUNDS: Record<string, 'tappedR' | 'throatyR' | 'throatyH'> = { 'ɾ': 'tappedR', 'ʁ': 'throatyR', 'x': 'throatyH' };

export { sentences };

export const GOOD = 85;
export const OKAY = 65;

export type Tier = 'good' | 'okay' | 'weak';
export const tier = (score: number): Tier => (score >= GOOD ? 'good' : score >= OKAY ? 'okay' : 'weak');

/**
 * The scored words as written in the prompt (capitals, punctuation) rather than the scorer's own tokens ("mr",
 * "three"). Extra words the scorer heard keep their own spelling, and a dash or "&" isn't a word. When the text
 * can't be lined up with the scores (a hyphenated word scored as two), the scorer's words are shown instead.
 */
export const writtenWords = (text: string, words: readonly Pick<WordScore, 'word' | 'errorType'>[]): string[] => {
  const written = text.split(/\s+/).filter((token) => /[\p{L}\p{N}]/u.test(token));
  if (written.length !== words.filter((w) => w.errorType !== 'insertion').length) return words.map((w) => w.word);
  let k = 0;
  return words.map((w) => (w.errorType === 'insertion' ? w.word : written[k++]));
};

export interface Correction {
  word: string;
  score: number;
  /** 'word' = the scorer marked the word down but we can't say which sound (unnamed and not alignable). */
  kind: 'sound' | 'tone' | 'word' | 'omission' | 'insertion' | 'fine';
  phoneme?: PhonemeId;
  heardAs?: PhonemeId;
  /** What went wrong, in one short sentence. */
  problem: string;
  /** What to do with your mouth, in one short sentence. */
  tip: string;
  /** Optional deeper phonetic explanation. */
  detail?: string;
  /** Mandarin: the syllable, and for tones what was expected and what was measured (for the tone picture). */
  zh?: { py: string; expected: Tone; heard?: Tone; contour?: number[]; heardPy?: string };
}

/** Why a character's tone differs from the dictionary here, in words a child can follow. */
const sandhiNote = (z: ZhSyllable): string | undefined => {
  const citation = parseSyllable(z.py).tone;
  const said = z.accept[0];
  if (said === citation || said === 5) return undefined;
  if (citation === 3 && said === 2) return t('feedback.zh.sandhi.third', { char: z.char });
  if (z.char === '一') return t(`feedback.zh.sandhi.yi.${said}`);
  if (z.char === '不') return t('feedback.zh.sandhi.bu');
  return undefined;
};

/** Mandarin: tone first (from the child's own pitch), then sounds (measured "heard as", or a Cantonese-speaker likelihood). */
const correctionForZh = (w: WordScore, z: ZhSyllable, band: AgeBand, home?: HomeLanguage): Correction => {
  const char = w.word;
  const mark = markSyllable(z.py);
  const expected = (z.accept.find((a) => a !== 5) ?? z.accept[0]) as Tone;
  if (w.errorType === 'omission') {
    return { word: char, score: 0, kind: 'omission', problem: band === 'little' ? t('feedback.omission.little', { word: char }) : t('feedback.zh.omission', { char, pinyin: mark }), tip: t('feedback.zh.omission.tip'), zh: { py: z.py, expected } };
  }
  if (z.toneHeard && expected !== 5) {
    const tone = expected as 1 | 2 | 3 | 4;
    const heard = z.toneHeard;
    // Every tone has its own whole sentences (the shape it needs, the shape that came out): none is glued from parts.
    const problem = band === 'little'
      ? (heard === 5 ? t(`feedback.zh.tone.little.${tone}`, { char }) : t(`feedback.zh.tone.little.${tone}.${heard}`, { char }))
      : sentences(t(`feedback.zh.tone.heard.${heard}`, { char, pinyin: mark }), t(`feedback.zh.tone.needs.${tone}`));
    return {
      word: char, score: w.score, kind: 'tone', phoneme: `zh:t${tone}`, problem, tip: tipFor(`zh:t${tone}`, band),
      detail: sentences(sandhiNote(z), phonemeInfo(`zh:t${tone}`).detail),
      zh: { py: z.py, expected: tone, heard: z.toneHeard, contour: z.contour },
    };
  }
  const units = zhUnits(z.py);
  if (z.heardAs) {
    const a = parseSyllable(z.py), b = parseSyllable(z.heardAs);
    const unit = (a.initial !== b.initial ? units.initial : units.final) ?? units.initial ?? units.final;
    const heardMark = markSyllable(z.heardAs);
    return {
      word: char, score: w.score, kind: 'sound', phoneme: unit, problem: band === 'little' ? t('feedback.zh.heard.little', { char, heard: heardMark }) : t('feedback.zh.heard', { char, pinyin: mark, heard: heardMark }),
      tip: unit ? tipFor(unit, band) : t('feedback.zh.heard.tip'), detail: unit ? phonemeInfo(unit).detail : undefined,
      zh: { py: z.py, expected, heardPy: z.heardAs },
    };
  }
  if (w.score >= GOOD) return { word: char, score: w.score, kind: 'fine', problem: t('feedback.zh.fine'), tip: t('feedback.fine.tip'), zh: { py: z.py, expected } };
  const unit = units.initial ?? units.final;
  if (!unit) {
    return { word: char, score: w.score, kind: 'word', problem: t('feedback.zh.word', { char, pinyin: mark }), tip: t('feedback.zh.word.tip'), zh: { py: z.py, expected } };
  }
  const info = phonemeInfo(unit);
  // The scorer can't say what came out instead; for a Cantonese speaker the usual slip is a strong hint, offered as a likelihood.
  const problem = sentences(t('feedback.zh.sound', { char, pinyin: mark }), home === 'yue' && t('feedback.zh.sound.mixup', { label: info.label }));
  return { word: char, score: w.score, kind: 'sound', phoneme: unit, problem, tip: tipFor(unit, band), detail: info.detail, zh: { py: z.py, expected } };
};

/** Turn provider numbers into something a child can act on: exact sound, what happened, what to do. */
export const correctionFor = (w: WordScore, band: AgeBand, home?: HomeLanguage): Correction => {
  const z = w.syllables[0]?.zh;
  if (z) return correctionForZh(w, z, band, home);
  if (w.errorType === 'omission') {
    return {
      word: w.word, score: w.score, kind: 'omission',
      problem: band === 'little' ? t('feedback.omission.little', { word: w.word }) : t('feedback.omission', { word: w.word }),
      tip: t('feedback.omission.tip'),
    };
  }
  if (w.errorType === 'insertion') {
    return { word: w.word, score: w.score, kind: 'insertion', problem: t('feedback.insertion', { word: w.word }), tip: t('feedback.insertion.tip') };
  }
  const worst = [...w.phonemes].sort((a, b) => a.score - b.score)[0];
  // A clean word is fine. A word the scorer marked down is not, even if every sound individually looks passable.
  if (!worst || (worst.score >= GOOD && w.score >= GOOD)) {
    return { word: w.word, score: w.score, kind: 'fine', problem: t('feedback.fine'), tip: t('feedback.fine.tip') };
  }
  if (!worst.phoneme) {
    // Never guess a sound's name. Honest word-level advice beats confident advice about the wrong sound.
    return {
      word: w.word, score: w.score, kind: 'word',
      problem: band === 'little' ? t('feedback.word.little', { word: w.word }) : t('feedback.word', { word: w.word }),
      tip: t('feedback.word.tip'),
    };
  }
  const info = phonemeInfo(worst.phoneme);
  // Children read a sound as it is spelled (“th”), grown-ups as its symbol (/θ/). The marks around it belong to the
  // sentence, not to the sound — Chinese writes 「th」 — so each sentence has a `.kid` and an `.adult` line.
  const who = isGrownUp(band) ? 'adult' : 'kid';
  const sound = who === 'adult' ? worst.phoneme : info.label;
  const written = (id: PhonemeId): string => (who === 'adult' ? id : soundLabel(id));
  let problem = info.problem;
  if (worst.heardAs === '∅') problem = t(`feedback.sound.missing.${who}`, { sound });
  else if (worst.heardAs) {
    const foreign = FOREIGN_SOUNDS[worst.heardAs];
    problem = foreign
      ? t(`feedback.sound.heard.${foreign}.${who}`, { sound })
      : t(`feedback.sound.heard.${band === 'little' ? 'little' : who}`, { sound, other: written(worst.heardAs) });
  } else {
    // The scorer knows the sound was off but not what came out instead (Azure only reports that for en-US).
    // The learner's home language tells us the usual culprit — offered as a likelihood, never as a fact.
    const usual = home ? info.l1?.[home]?.heardAs : undefined;
    if (usual && usual !== '∅' && !FOREIGN_SOUNDS[usual]) {
      problem = t(`feedback.sound.likely.${band === 'little' ? 'little' : who}`, { sound, other: written(usual) });
    } else if (usual === '∅') {
      problem = t(`feedback.sound.likelyMissing.${who}`, { sound });
    }
  }
  return {
    word: w.word, score: w.score, kind: 'sound', phoneme: worst.phoneme, heardAs: worst.heardAs,
    problem, tip: tipFor(worst.phoneme, band), detail: info.detail,
  };
};

/**
 * The one word the learner should look at first, or -1: a missing word, else a word holding a clearly wrong sound
 * (a scorer's word score can be high around one wrong sound — "free" for "three" scored 90), else the lowest score
 * below "good".
 */
export const focusWordIndex = (a: Assessment): number => {
  const missing = a.words.findIndex((w) => w.errorType === 'omission');
  if (missing >= 0) return missing;
  let idx = -1;
  let min = Infinity;
  a.words.forEach((w, i) => {
    const wrong = w.phonemes.find((p) => wrongSound(p)) ?? w.syllables.find((s) => s.zh && (s.zh.toneHeard || s.zh.heardAs));
    if (!wrong) return;
    const sc = 'phoneme' in wrong ? wrong.score : w.score;
    if (sc < min) { min = sc; idx = i; }
  });
  if (idx >= 0) return idx;
  min = GOOD;
  a.words.forEach((w, i) => { if (w.score < min) { min = w.score; idx = i; } });
  return idx;
};

/**
 * The sound worth a quick workout once the learner moves on, or undefined. Judged on the LAST take: a learner who fixed
 * the sound on the retry was told "You fixed it! Every word is clear now." and, when this read the first take, was then
 * sent to a workout for that very sound — the lesson seemed to refuse to move on (Leslie, French, 78 → 88). A sound
 * still wrong in the last take is drilled, as it always was, when the item took a retry or was never mastered.
 */
export const soundToDrill = (takes: Assessment[], band: AgeBand, home?: HomeLanguage): PhonemeId | undefined => {
  const last = takes[takes.length - 1];
  if (!last) return undefined;
  const i = focusWordIndex(last);
  const c = i >= 0 ? correctionFor(last.words[i], band, home) : null;
  if (!c?.phoneme || c.kind === 'fine') return undefined;
  const stillWrong = c.score < 80 || !isMastered(last, band);
  const struggled = takes.length > 1 || !takes.some((a) => isMastered(a, band));
  return stillWrong && struggled ? c.phoneme : undefined;
};

export const headline = (score: number, band: AgeBand, delta?: number, stillFixable = false): string => {
  const little = band === 'little';
  if (delta != null && delta >= 8) {
    if (score >= GOOD && !stillFixable) return little ? t('feedback.headline.fixed.little') : t('feedback.headline.fixed', { delta });
    return little ? t('feedback.headline.closer.little') : t('feedback.headline.closer', { delta });
  }
  if (score >= GOOD && stillFixable) return t(little ? 'feedback.headline.polish.little' : 'feedback.headline.polish');
  if (score >= 95) return t(little ? 'feedback.headline.top.little' : 'feedback.headline.top');
  if (score >= GOOD) return t(little ? 'feedback.headline.good.little' : 'feedback.headline.good');
  if (score >= OKAY) return t(little ? 'feedback.headline.okay.little' : 'feedback.headline.okay');
  if (score >= 40) return t(little ? 'feedback.headline.weak.little' : 'feedback.headline.weak');
  return t(little ? 'feedback.headline.hard.little' : 'feedback.headline.hard');
};
