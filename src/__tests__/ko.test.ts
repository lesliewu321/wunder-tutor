import { describe, expect, it } from 'vitest';
import { COURSES, ITEM_INDEX } from '../content/course';
import { blocks, romanize } from '../content/ko/hangul';
import { KO_CHECK_ITEMS, KO_COURSE, KO_ITEMS, KO_LAB_SOUNDS, KO_LADDERS } from '../content/ko/course';
import { KO_SOUNDS } from '../content/ko/sounds';
import { LADDERS } from '../content/lab';
import { PHONEMES, phonemeInfo } from '../content/phonemes';
import { scenariosFor } from '../content/scenarios';
import { itemCourse, unitCourse } from '../engine/learning';
import { inCourse } from '../intelligence/profile';
import { nameKorean } from '../speech/ko/assess';

// The Korean course as the app runs it: registered, every item Korean with its pronounced form, every taught sound
// with a ladder, and the scorer's unnamed scores lined up with the blocks.

describe('the Korean course', () => {
  it('is registered, with three age bands in every lesson', () => {
    expect(COURSES.ko).toBe(KO_COURSE);
    expect(KO_COURSE.language).toBe('ko');
    const lessons = KO_COURSE.units.flatMap((u) => u.lessons);
    expect(lessons.length).toBe(7);
    for (const l of lessons) for (const band of ['little', 'junior', 'teen'] as const) expect(l.exercises[band].length).toBeGreaterThan(0);
    expect(unitCourse(KO_COURSE.units[0].id)).toBe('ko');
  });

  it('marks every item Korean, with a pronounced form in hangul and a romanisation', () => {
    expect(KO_ITEMS.length).toBeGreaterThan(30);
    for (const it of KO_ITEMS) {
      expect(it.lang).toBe('ko-KR');
      expect(it.ko?.pron).toMatch(/\p{Script=Hangul}/u);
      expect(it.ko?.romaja).toMatch(/^[a-z ]+$/);
      expect(itemCourse(it)).toBe('ko');
      expect(ITEM_INDEX[it.id]).toBe(it);
      // The written and pronounced forms have the same number of blocks: sound changes never add or drop a syllable.
      expect(blocks(it.ko!.pron).length).toBe(blocks(it.text).length);
    }
  });

  it('romanises the pronounced form the way the data does, where the standard shows the same sounds', () => {
    // Where they differ (tensification is not shown by the standard), the hand-written romaja wins; nothing here guesses.
    const same = KO_ITEMS.filter((it) => romanize(it.ko!.pron) === it.ko!.romaja).length;
    expect(same / KO_ITEMS.length).toBeGreaterThan(0.6);
  });

  it('teaches six namespaced sounds, each with a ladder, none of them an English or French id', () => {
    expect(KO_SOUNDS.map((s) => s.id)).toEqual(['ko:tense', 'ko:aspirated', 'ko:r', 'ko:eo', 'ko:eu', 'ko:batchim']);
    expect(KO_LAB_SOUNDS).toEqual(KO_SOUNDS.map((s) => s.id));
    for (const id of KO_LAB_SOUNDS) {
      expect(PHONEMES[id]).toBeDefined();
      expect(KO_LADDERS[id]).toBeDefined();
      expect(LADDERS[id]).toBe(KO_LADDERS[id]);
      expect(inCourse(id, 'ko')).toBe(true);
      expect(inCourse(id, 'en')).toBe(false);
      expect(inCourse(id, 'fr')).toBe(false);
      expect(phonemeInfo(id).tip?.little?.length ?? 0).toBeGreaterThan(10);
    }
    expect(inCourse('r', 'ko')).toBe(false);
  });

  it('checks a learner with a few lines per age band, and has three conversations', () => {
    for (const band of ['little', 'junior', 'teen'] as const) expect(KO_CHECK_ITEMS[band].length).toBeGreaterThanOrEqual(3);
    expect(scenariosFor('ko').map((s) => s.id)).toEqual(['ko-cafe', 'ko-zoo', 'ko-friend']);
    for (const s of scenariosFor('ko')) for (const t of s.turns) for (const band of ['little', 'junior', 'teen'] as const) {
      expect(t.tutor[band].lang).toBe('ko-KR');
      for (const r of t.replies[band]) expect(r.ko?.pron).toBeTruthy();
    }
  });

  it('puts blocks on the scorer\'s unnamed sounds, and stays silent when they do not line up', () => {
    const word = (phones: number[], syllables: number[] = []) => ({ word: '밥', errorType: 'none' as const, score: 80, phonemes: phones.map((score) => ({ phoneme: '', score })), syllables: syllables.map((score) => ({ text: '', score })) });
    // 밥 = p a p̚: three sounds → one block, named as a 받침, scored by its weakest sound.
    const named = nameKorean([word([90, 85, 40])], { pron: '밥', romaja: 'bap' });
    expect(named[0].phonemes).toEqual([{ phoneme: 'ko:batchim', score: 40 }]);
    // 안녕 came back as two syllables, not sounds: named block by block from the syllable scores.
    const bySyllable = nameKorean([word([1, 2, 3, 4, 5, 6, 7, 8, 9], [70, 50])], { pron: '안녕', romaja: 'annyeong' });
    expect(bySyllable[0].phonemes.map((p) => p.score)).toEqual([70, 50]);
    // Nothing lines up: the words come back untouched.
    const untouched = nameKorean([word([1, 2])], { pron: '안녕하세요', romaja: 'annyeonghaseyo' });
    expect(untouched[0].phonemes.length).toBe(2);
  });
});
