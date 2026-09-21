import { describe, expect, it } from 'vitest';
import { FR_SOUNDS } from '../content/fr/sounds';
import { FR_LEXICON_WORDS, frAlignmentCandidates, frPhonemesIn, frSyllableCount, frWordPhones } from '../content/fr/lexicon';
import { FR_COURSE, FR_COURSE_WORDS, FR_ITEMS, FR_LAB_SOUNDS, FR_LADDERS, frFullyKnown } from '../content/fr/course';
import { COURSES, ITEM_INDEX } from '../content/course';
import { PHONEMES, phonemeInfo } from '../content/phonemes';

/**
 * French feedback stands or falls on the lexicon. Azure scores French phonemes but names none of them, so a wrong
 * sequence here would put a confident WRONG name on a sound — worse than saying nothing. These guard the shape.
 */
describe('the French lexicon', () => {
  it('writes every word as syllables and sounds that agree with each other', () => {
    for (const word of FR_LEXICON_WORDS) {
      const w = frWordPhones(word);
      expect(w.syllables.length, word).toBeGreaterThan(0);
      for (const s of w.syllables) expect(s.phonemes.length, `${word} / ${s.text}`).toBeGreaterThan(0);
    }
  });

  it('leaves silent final consonants out, which is the whole point of having a lexicon', () => {
    expect(frPhonemesIn('petit')).toEqual(['p', 'ə', 't', 'i']);      // not …t i t
    expect(frPhonemesIn('français')).toEqual(['f', 'ʁ', 'ɑ̃', '.', 's', 'ɛ'].filter((p) => p !== '.'));
    expect(frPhonemesIn('bonjour')).toEqual(['b', 'ɔ̃', 'ʒ', 'u', 'ʁ']);
  });

  it('keeps the three nasals apart — they are different words', () => {
    expect(frPhonemesIn('pain')).toContain('ɛ̃');
    expect(frPhonemesIn('bon')).toContain('ɔ̃');
    expect(frPhonemesIn('grand')).toContain('ɑ̃');
  });

  it('never writes an English r', () => {
    for (const word of FR_LEXICON_WORDS) expect(frPhonemesIn(word), word).not.toContain('r');
  });

  it('finds a word typed without its accents, as a keyboard often gives it', () => {
    expect(frWordPhones('cafe').syllables.flatMap((s) => s.phonemes)).toEqual(['k', 'a', '.', 'f', 'e'].filter((p) => p !== '.'));
    expect(frWordPhones('francais').key).toBeTruthy();
    expect(frPhonemesIn('ECOLE')).toEqual(['e', 'k', 'ɔ', 'l']);
  });

  it('offers exactly one alignment for a known word and none at all for an unknown one', () => {
    const fit = frAlignmentCandidates('rue');
    expect(fit).toHaveLength(1);
    expect(fit[0].phonemes).toEqual(['ʁ', 'y']);
    expect(fit[0].silent).toEqual([false, false]);
    // Guessing French spelling from sound is the one thing a learner cannot do; the app must not do it either.
    expect(frAlignmentCandidates('anticonstitutionnellement')).toEqual([]);
    expect(frWordPhones('anticonstitutionnellement').syllables[0].phonemes).toEqual([]);
  });

  it('counts syllables for the recording time limit', () => {
    expect(frSyllableCount('bonjour')).toBe(2);
    expect(frSyllableCount('je voudrais un croissant')).toBe(1 + 2 + 1 + 2);
  });
});

describe('the French sounds', () => {
  it('teaches the ones an English or Cantonese speaker actually gets wrong', () => {
    const ids = FR_SOUNDS.map((s) => s.id);
    for (const id of ['y', 'ʁ', 'ɑ̃', 'ɛ̃', 'ɔ̃', 'ø', 'œ', 'ʒ', 'ɲ']) expect(ids).toContain(id);
  });

  it('collides with no English or Mandarin sound, so one id always means one sound', () => {
    const others = Object.keys(PHONEMES).filter((id) => !FR_SOUNDS.some((f) => f.id === id));
    for (const s of FR_SOUNDS) expect(others, s.id).not.toContain(s.id);
  });

  it('is reachable through the catalogue the Lab and the drills read', () => {
    const y = phonemeInfo('y');
    expect(y.name).toBe('Pointed U');
    expect(y.example).toBe('tu');
    expect(y.tip.junior).toMatch(/round/i);
  });

  it('gives every sound a tip, three steps and a way to say what went wrong', () => {
    for (const s of FR_SOUNDS) {
      expect(s.tip.junior, s.id).toBeTruthy();
      expect(s.steps, s.id).toHaveLength(3);
      expect(s.problem, s.id).toBeTruthy();
      expect(s.difficulty, s.id).toBeGreaterThan(0);
    }
  });

  it('only ever points at a substitution that is itself a known sound', () => {
    for (const s of FR_SOUNDS) {
      if (s.heardAs) expect(PHONEMES[s.heardAs], `${s.id} heard as ${s.heardAs}`).toBeTruthy();
      for (const [home, l1] of Object.entries(s.l1 ?? {})) {
        if (l1?.heardAs) expect(PHONEMES[l1.heardAs], `${s.id} / ${home}`).toBeTruthy();
      }
    }
  });
});

describe('the French course', () => {
  /**
   * The one that matters. A course word the lexicon does not know is scored but never diagnosed — the learner is
   * told a number and nothing else — and nobody would notice by reading the lesson. So: every word, every band.
   */
  it('says no word the lexicon cannot name the sounds of', () => {
    const unknown = FR_COURSE_WORDS.filter((w) => !frWordPhones(w).syllables.some((s) => s.phonemes.length));
    expect(unknown, `not in fr/lexicon.ts: ${unknown.join(', ')}`).toEqual([]);
    for (const item of FR_ITEMS) expect(frFullyKnown(item), item.text).toBe(true);
  });

  it('teaches all three age bands, not the same lesson three times', () => {
    const unit = FR_COURSE.units[0];
    expect(unit.lessons).toHaveLength(7);
    for (const l of unit.lessons) {
      // Three is the floor: a conversation lesson is three exchanges, the rest are five or six exercises.
      for (const band of ['little', 'junior', 'teen'] as const) expect(l.exercises[band].length, `${l.id}/${band}`).toBeGreaterThanOrEqual(3);
      // A five-year-old and an adult should not be handed identical exercises.
      expect(JSON.stringify(l.exercises.little), l.id).not.toEqual(JSON.stringify(l.exercises.teen));
    }
  });

  it('gives the little ones single words and the grown-ups whole sentences', () => {
    const kinds = (band: 'little' | 'teen') => FR_COURSE.units[0].lessons
      .flatMap((l) => l.exercises[band]).flatMap((ex) => (ex.type === 'speak' ? [ex.item.kind] : []));
    expect(kinds('little').every((k) => k === 'word' || k === 'phrase')).toBe(true);
    expect(kinds('teen').some((k) => k === 'phrase' || k === 'sentence')).toBe(true);
  });

  it('is registered where the app looks for a course', () => {
    expect(COURSES.fr).toBe(FR_COURSE);
    expect(FR_COURSE.language).toBe('fr');
    for (const it of FR_ITEMS) expect(ITEM_INDEX[it.id], it.id).toBeTruthy();
  });

  it('marks every item as French, or the scorer would be sent the wrong language', () => {
    for (const it of FR_ITEMS) expect(it.lang, it.text).toBe('fr-FR');
  });

  it('has a Lab ladder for every sound it teaches', () => {
    for (const id of FR_LAB_SOUNDS) {
      const ladder = FR_LADDERS[id];
      expect(ladder, id).toBeTruthy();
      for (const stage of ['syllables', 'words', 'phrases', 'sentence'] as const) expect(ladder[stage].length, `${id}/${stage}`).toBeGreaterThan(0);
    }
  });
});
