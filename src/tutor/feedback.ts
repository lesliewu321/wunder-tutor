import { isGrownUp, type AgeBand, type Assessment, type HomeLanguage, type PhonemeId, type Tone, type WordScore, type ZhSyllable } from '../domain/types';
import { phonemeInfo, soundLabel, tipFor } from '../content/phonemes';
import { markSyllable, parseSyllable } from '../content/zh/pinyin';
import { unitsFor as zhUnits } from '../speech/zh/assess';
import { wrongSound } from '../engine/learning';

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

const TONE_WORDS: Record<1 | 2 | 3 | 4, { shape: string; went: string }> = {
  1: { shape: 'stays high and flat', went: 'stayed flat' },
  2: { shape: 'rises', went: 'went up' },
  3: { shape: 'dips down low', went: 'went down low' },
  4: { shape: 'falls from high to low', went: 'fell' },
};

/** Why a character's tone differs from the dictionary here, in words a child can follow. */
const sandhiNote = (z: ZhSyllable): string | undefined => {
  const citation = parseSyllable(z.py).tone;
  const said = z.accept[0];
  if (said === citation || said === 5) return undefined;
  if (citation === 3 && said === 2) return `Here ${z.char} is said with tone 2, because the word after it is tone 3.`;
  if (z.char === '一') return `一 changes its tone to match the word after it — here it’s tone ${said}.`;
  if (z.char === '不') return `不 becomes tone 2 before a tone-4 word.`;
  return undefined;
};

/** Mandarin: tone first (from the child's own pitch), then sounds (measured "heard as", or a Cantonese-speaker likelihood). */
const correctionForZh = (w: WordScore, z: ZhSyllable, band: AgeBand, home?: HomeLanguage): Correction => {
  const char = w.word;
  const mark = markSyllable(z.py);
  const expected = (z.accept.find((t) => t !== 5) ?? z.accept[0]) as Tone;
  if (w.errorType === 'omission') {
    return { word: char, score: 0, kind: 'omission', problem: band === 'little' ? `I didn’t hear “${char}”.` : `I couldn’t make out “${char}” (${mark}) — was it skipped or said differently?`, tip: 'Say every character, nice and steady — don’t rush to the end.', zh: { py: z.py, expected } };
  }
  if (z.toneHeard && expected !== 5) {
    const t = expected as 1 | 2 | 3 | 4;
    const heard = z.toneHeard === 5 ? undefined : TONE_WORDS[z.toneHeard as 1 | 2 | 3 | 4];
    const problem = band === 'little'
      ? `“${char}” ${TONE_WORDS[t].shape}${heard ? ` — yours ${heard.went}` : ''}!`
      : `Your ${char} (${mark}) sounded like tone ${z.toneHeard}. It needs tone ${t}: it ${TONE_WORDS[t].shape}.`;
    return {
      word: char, score: w.score, kind: 'tone', phoneme: `zh:t${t}`, problem, tip: tipFor(`zh:t${t}`, band),
      detail: [sandhiNote(z), phonemeInfo(`zh:t${t}`).detail].filter(Boolean).join(' '),
      zh: { py: z.py, expected: t, heard: z.toneHeard, contour: z.contour },
    };
  }
  const units = zhUnits(z.py);
  if (z.heardAs) {
    const a = parseSyllable(z.py), b = parseSyllable(z.heardAs);
    const unit = (a.initial !== b.initial ? units.initial : units.final) ?? units.initial ?? units.final;
    const heardMark = markSyllable(z.heardAs);
    return {
      word: char, score: w.score, kind: 'sound', phoneme: unit, problem: band === 'little' ? `Your “${char}” sounded like “${heardMark}”!` : `Your ${char} (${mark}) sounded like ${heardMark}.`,
      tip: unit ? tipFor(unit, band) : 'Listen slowly, then copy every part of the sound.', detail: unit ? phonemeInfo(unit).detail : undefined,
      zh: { py: z.py, expected, heardPy: z.heardAs },
    };
  }
  if (w.score >= GOOD) return { word: char, score: w.score, kind: 'fine', problem: 'This sounded clear.', tip: 'Keep saying it just like that!', zh: { py: z.py, expected } };
  const unit = units.initial ?? units.final;
  if (!unit) {
    return { word: char, score: w.score, kind: 'word', problem: `“${char}” (${mark}) wasn’t quite clear yet.`, tip: 'Tap Slow, listen to the whole sound, then copy it.', zh: { py: z.py, expected } };
  }
  const info = phonemeInfo(unit);
  // The scorer can't say what came out instead; for a Cantonese speaker the usual slip is a strong hint, offered as a likelihood.
  const likely = home === 'yue' ? ` Careful — ${info.label} is easy to mix up.` : '';
  return { word: char, score: w.score, kind: 'sound', phoneme: unit, problem: `“${char}” (${mark}) wasn’t quite clear.${likely}`, tip: tipFor(unit, band), detail: info.detail, zh: { py: z.py, expected } };
};

/** Turn provider numbers into something a child can act on: exact sound, what happened, what to do. */
export const correctionFor = (w: WordScore, band: AgeBand, home?: HomeLanguage): Correction => {
  const z = w.syllables[0]?.zh;
  if (z) return correctionForZh(w, z, band, home);
  if (w.errorType === 'omission') {
    return {
      word: w.word, score: w.score, kind: 'omission',
      problem: band === 'little' ? `I didn’t hear “${w.word}”.` : `I couldn’t make out the word “${w.word}” — was it skipped or said differently?`,
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
  const me = isGrownUp(band) ? `/${worst.phoneme}/` : `“${info.label}”`;
  let problem = info.problem;
  if (worst.heardAs === '∅') problem = `The ${me} sound was missing.`;
  else if (worst.heardAs) {
    const foreign = FOREIGN_SOUNDS[worst.heardAs];
    const other = foreign ?? (isGrownUp(band) ? `/${worst.heardAs}/` : `“${soundLabel(worst.heardAs)}”`);
    problem = band === 'little' || foreign ? `Your ${me} sounded like ${other}.` : `Your ${me} sounded closer to ${other}.`;
  } else {
    // The scorer knows the sound was off but not what came out instead (Azure only reports that for en-US).
    // The learner's home language tells us the usual culprit — offered as a likelihood, never as a fact.
    const usual = home ? info.l1?.[home]?.heardAs : undefined;
    if (usual && usual !== '∅' && !FOREIGN_SOUNDS[usual]) {
      const other = isGrownUp(band) ? `/${usual}/` : `“${soundLabel(usual)}”`;
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
