import type { AgeBand, Assessment, HomeLanguage, PhonemeId, WordScore } from '../domain/types';
import { phonemeInfo, soundLabel, tipFor } from '../content/phonemes';

/** Substitutions that aren't English sounds get a plain description instead of a symbol. */
const FOREIGN_SOUNDS: Record<string, string> = { 'ɾ': 'a quick tapped R', 'ʁ': 'a throaty R', 'x': 'a throaty, scratchy H' };

export const GOOD = 85;
export const OKAY = 65;

export type Tier = 'good' | 'okay' | 'weak';
export const tier = (score: number): Tier => (score >= GOOD ? 'good' : score >= OKAY ? 'okay' : 'weak');

export interface Correction {
  word: string;
  score: number;
  /** 'word' = the scorer marked the word down but we can't say which sound (unnamed and not alignable). */
  kind: 'sound' | 'word' | 'omission' | 'insertion' | 'fine';
  phoneme?: PhonemeId;
  heardAs?: PhonemeId;
  /** What went wrong, in one short sentence. */
  problem: string;
  /** What to do with your mouth, in one short sentence. */
  tip: string;
  /** Optional deeper phonetic explanation. */
  detail?: string;
}

/** Turn provider numbers into something a child can act on: exact sound, what happened, what to do. */
export const correctionFor = (w: WordScore, band: AgeBand, home?: HomeLanguage): Correction => {
  if (w.errorType === 'omission') {
    return {
      word: w.word, score: w.score, kind: 'omission',
      problem: band === 'little' ? `I didn’t hear “${w.word}”.` : `The word “${w.word}” was missing.`,
      tip: 'Say every word, nice and steady — don’t rush to the end.',
    };
  }
  if (w.errorType === 'insertion') {
    return { word: w.word, score: w.score, kind: 'insertion', problem: `I heard an extra word: “${w.word}”.`, tip: 'Say just the words on the screen.' };
  }
  const worst = [...w.phonemes].sort((a, b) => a.score - b.score)[0];
  // A clean word is fine. A word the scorer marked down is not, even if every sound individually looks passable.
  if (!worst || (worst.score >= GOOD && w.score >= GOOD)) {
    return { word: w.word, score: w.score, kind: 'fine', problem: 'This word sounded clear.', tip: 'Keep saying it just like that!' };
  }
  if (!worst.phoneme) {
    // Never guess a sound's name. Honest word-level advice beats confident advice about the wrong sound.
    return {
      word: w.word, score: w.score, kind: 'word',
      problem: band === 'little' ? `“${w.word}” wasn’t quite clear.` : `“${w.word}” wasn’t quite clear yet.`,
      tip: 'Tap Slow, listen to each part of the word, then say it just as slowly.',
    };
  }
  const info = phonemeInfo(worst.phoneme);
  const me = band === 'teen' ? `/${worst.phoneme}/` : `“${info.label}”`;
  let problem = info.problem;
  if (worst.heardAs === '∅') problem = `The ${me} sound was missing.`;
  else if (worst.heardAs) {
    const foreign = FOREIGN_SOUNDS[worst.heardAs];
    const other = foreign ?? (band === 'teen' ? `/${worst.heardAs}/` : `“${soundLabel(worst.heardAs)}”`);
    problem = band === 'little' || foreign ? `Your ${me} sounded like ${other}.` : `Your ${me} sounded closer to ${other}.`;
  } else {
    // The scorer knows the sound was off but not what came out instead (Azure only reports that for en-US).
    // The learner's home language tells us the usual culprit — offered as a likelihood, never as a fact.
    const usual = home ? info.l1?.[home]?.heardAs : undefined;
    if (usual && usual !== '∅' && !FOREIGN_SOUNDS[usual]) {
      const other = band === 'teen' ? `/${usual}/` : `“${soundLabel(usual)}”`;
      problem = band === 'little' ? `Your ${me} wasn’t clear. Careful — it likes to turn into ${other}!` : `Your ${me} wasn’t clear. Careful — it easily turns into ${other}.`;
    } else if (usual === '∅') {
      problem = `Your ${me} wasn’t clear — make sure it doesn’t disappear.`;
    }
  }
  return {
    word: w.word, score: w.score, kind: 'sound', phoneme: worst.phoneme, heardAs: worst.heardAs,
    problem, tip: tipFor(worst.phoneme, band), detail: info.detail,
  };
};

/** The one word the learner should look at first (lowest score below "good"), or -1. */
export const focusWordIndex = (a: Assessment): number => {
  let idx = -1;
  let min = GOOD;
  a.words.forEach((w, i) => { if (w.score < min) { min = w.score; idx = i; } });
  return idx;
};

export const headline = (score: number, band: AgeBand, delta?: number, stillFixable = false): string => {
  if (delta != null && delta >= 8) {
    if (score >= GOOD && !stillFixable) return band === 'little' ? 'Wow, you fixed it!' : `Up ${delta} points — you fixed it!`;
    return band === 'little' ? 'Better! Keep going!' : `Up ${delta} points — getting closer!`;
  }
  if (score >= GOOD && stillFixable) return band === 'little' ? 'So close! One fix.' : 'Strong — one word to polish.';
  if (score >= 95) return band === 'little' ? 'Perfect!' : 'Spot on!';
  if (score >= GOOD) return band === 'little' ? 'Great talking!' : 'Great pronunciation!';
  if (score >= OKAY) return band === 'little' ? 'Good try! One fix.' : 'Nearly there — one thing to fix.';
  if (score >= 40) return band === 'little' ? 'Let’s try together!' : 'Good effort. Let’s fix one sound.';
  return band === 'little' ? 'Tricky one! Listen first.' : 'That’s a tricky one. Listen slowly, then try again.';
};
