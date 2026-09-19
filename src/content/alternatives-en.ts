import type { HomeLanguage, PhonemeId } from '../domain/types';
import { tokenize, wordPhones } from './lexicon';
import type { Accent } from '../domain/types';

// "What did it sound like instead?" for English — the same idea as Mandarin (content/zh/alternatives.ts).
//
// Azure scores a take against the text it is given and can be blind to a swapped sound: "fin" said for "thin"
// scored /θ/ 100. Scored against the likely mistake as well, the mistake fits better — on the labelled set that
// caught 85% of swaps (British 90%) with 1–2% false alarms, and it says exactly what came out. The mistake is
// spelled so Azure reads it the way a learner says it ("fank", "wery", "lice"), and only where learners really make
// it: n/l and v/w swap at the start of a syllable, not in "milk" or "flies".

export interface EnAlternative {
  /** Word position in the text (as tokenized). */
  wordIndex: number;
  /** Sound the learner should make, and the sound this alternative puts in its place. */
  target: PhonemeId;
  heard: PhonemeId;
  /** The whole text with that one word respelled. */
  text: string;
}

interface Swap { heard: PhonemeId; from: RegExp; to: string }

/**
 * A consonant at the start of a syllable: first in the word, or between vowels (a doubled letter counts as one) —
 * but not before a silent final e ("have", "hole" end in the consonant).
 */
const onset = (c: string) => new RegExp(`^${c}|(?<=[aeiou])${c}${c}?(?=[aeiouy])(?!e$)`, 'i');

/** Common swaps for Hong Kong (Cantonese-speaking) and other East-Asian learners, most likely first. */
const SWAPS: Record<PhonemeId, Swap[]> = {
  'θ': [{ heard: 'f', from: /th/i, to: 'f' }, { heard: 's', from: /th/i, to: 's' }, { heard: 't', from: /th/i, to: 't' }],
  'ð': [{ heard: 'd', from: /th/i, to: 'd' }],
  v: [{ heard: 'w', from: onset('v'), to: 'w' }, { heard: 'b', from: onset('v'), to: 'b' }, { heard: 'f', from: /ve$|v$/i, to: 'f' }],
  r: [{ heard: 'l', from: /r/i, to: 'l' }, { heard: 'w', from: /r/i, to: 'w' }],
  n: [{ heard: 'l', from: onset('n'), to: 'l' }],
  l: [{ heard: 'n', from: onset('l'), to: 'n' }],
  'ʃ': [{ heard: 's', from: /sh/i, to: 's' }],
  'ɪ': [{ heard: 'i', from: /i(?=[^aeiouy]*$)|i(?=[^aeiouy]{2})/i, to: 'ee' }],
  'æ': [{ heard: 'ɛ', from: /a(?=[^aeiouy])/i, to: 'e' }],
  z: [{ heard: 's', from: /s$|z/i, to: 'ss' }],
};

/** Words the spelling rules get wrong: the letter they would change is not the sound being checked. */
const OVERRIDES: Record<string, Partial<Record<PhonemeId, { heard: PhonemeId; word: string }>>> = {
  banana: { 'æ': { heard: 'ɛ', word: 'banena' } }, // the stressed /æ/ is the second a
};

/** Home languages whose speakers swap θ→f rather than θ→s (Cantonese) — the order of the θ swaps. */
const PREFERS_F: Partial<Record<HomeLanguage, boolean>> = { yue: true };

const keepCase = (orig: string, repl: string) => (orig[0] === orig[0].toUpperCase() && orig[0] !== orig[0].toLowerCase() ? repl[0].toUpperCase() + repl.slice(1) : repl);

/** One word respelled with one swap, or null when the swap doesn't apply to it. */
const respell = (core: string, target: PhonemeId, swap: Swap): string | null => {
  const override = OVERRIDES[core.toLowerCase()]?.[target];
  if (override) return override.heard === swap.heard ? keepCase(core, override.word) : null;
  const m = swap.from.exec(core);
  if (!m) return null;
  // A doubled letter is one sound: "hello" → "henno".
  const to = m[0].length === 2 && m[0][0].toLowerCase() === m[0][1].toLowerCase() && swap.to.length === 1 ? swap.to + swap.to : swap.to;
  let before = core.slice(0, m.index);
  // "cat" → "cet" would read as "set": a c before a new e or i becomes k.
  if (/^[ei]/i.test(to) && /c$/i.test(before)) before = before.slice(0, -1) + (before.endsWith('C') ? 'K' : 'k');
  return before + keepCase(m[0], to) + core.slice(m.index + m[0].length);
};

/** Up to `max` likely-mistake versions of `text`, one swapped sound each, for the sounds the item practises. */
export const englishAlternatives = (text: string, focus: PhonemeId[] = [], accent: Accent = 'en-US', home?: HomeLanguage, max = 3): EnAlternative[] => {
  const tokens = text.split(/(\s+)/);
  const words = tokenize(text);
  const out: EnAlternative[] = [];
  // Each focus sound, then one swap per sound in turn, so three sounds get one alternative each before any gets two.
  const queue: { target: PhonemeId; swap: Swap }[] = [];
  const perSound = focus.filter((f) => SWAPS[f]).map((f) => {
    let swaps = SWAPS[f];
    if (f === 'θ' && home && !PREFERS_F[home]) swaps = [swaps[1], swaps[0], swaps[2]];
    return swaps.map((swap) => ({ target: f, swap }));
  });
  for (let k = 0; perSound.some((s) => s[k]); k++) for (const s of perSound) if (s[k]) queue.push(s[k]);
  for (const { target, swap } of queue) {
    if (out.length >= max) break;
    const wi = words.findIndex((w) => {
      const count = wordPhones(w, accent).syllables.reduce((n, s) => n + s.phonemes.filter((p) => p === target).length, 0);
      // The sound must be in the word — once, so the verdict lands on the right one (or the word has an override).
      return (count === 1 || (count > 1 && !!OVERRIDES[w.toLowerCase()]?.[target])) && respell(w, target, swap) != null;
    });
    if (wi < 0) continue;
    // Map the wi-th word back onto the raw text (keeps punctuation and spacing).
    let seen = -1;
    const next = tokens.map((t) => {
      if (!/\S/.test(t)) return t;
      const core = t.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '');
      if (!core) return t;
      seen++;
      if (seen !== wi) return t;
      const swapped = respell(core, target, swap);
      return swapped ? t.replace(core, swapped) : t;
    }).join('');
    if (next !== text && !out.some((o) => o.text === next)) out.push({ wordIndex: wi, target, heard: swap.heard, text: next });
  }
  return out;
};
