import { describe, expect, it } from 'vitest';
import { ALL_LESSONS, ASSESSMENT_ITEMS, COURSE, EN, ITEM_INDEX } from '../content/course';
import { LADDERS } from '../content/lab';
import { buildCourse, ContentError, type CourseFile } from '../content/load';
import { LAB_SOUNDS } from '../content/phonemes';
import { translationFor } from '../content/translations';
import { ZH_CHECK_ITEMS, ZH_COURSE, ZH_ITEMS, ZH_LAB_SOUNDS, ZH_LADDERS } from '../content/zh/course';
import golden from './fixtures/content-golden.json';
import enData from '../../content/courses/en.json';
import zhData from '../../content/courses/zh.json';

// The split's proof: the English and Putonghua courses built from their data files are the very objects the
// hand-written TypeScript built on 2026-09-25 (the golden was dumped from it that day), item for item, exercise id
// for exercise id — so a learner's progress, keyed by lesson and item ids, means the same thing after the split.

/** The one deliberate difference: translation prompts now travel on the items (they were a separate table). */
const sansTranslations = <T,>(v: T): T => JSON.parse(JSON.stringify(v, (k, x) => (k === 'translations' ? undefined : x)));

describe('the courses from data are the courses that were code', () => {
  it('English: course, check, ladders, sounds', () => {
    expect(sansTranslations(buildCourse(enData as unknown as CourseFile).course)).toEqual(golden.en.course);
    expect(sansTranslations(COURSE.units[0])).toEqual(golden.en.course.units[0]);
    expect(sansTranslations(ASSESSMENT_ITEMS)).toEqual(golden.en.check);
    expect(sansTranslations(EN.ladders)).toEqual(golden.en.ladders);
    expect(EN.labSounds).toEqual(golden.en.labSounds);
    expect(LAB_SOUNDS).toEqual(golden.en.labSounds);
    for (const sound of Object.keys(golden.en.ladders)) expect(sansTranslations(LADDERS[sound])).toEqual(golden.en.ladders[sound as keyof typeof golden.en.ladders]);
  });

  it('English: the translation prompts travel with their items', () => {
    for (const [id, byLang] of Object.entries(golden.en.translations)) {
      for (const [lang, text] of Object.entries(byLang)) expect(translationFor(id, lang as never)).toBe(text);
    }
    expect(translationFor('it-apple', 'yue')).toBeUndefined();
  });

  it('Putonghua: course, check, ladders, sounds, and every item in order', () => {
    expect(buildCourse(zhData as unknown as CourseFile).course).toEqual(golden.zh.course);
    expect(ZH_COURSE.units[0]).toEqual(golden.zh.course.units[0]);
    expect(ZH_CHECK_ITEMS).toEqual(golden.zh.check);
    expect(ZH_LADDERS).toEqual(golden.zh.ladders);
    expect(ZH_LAB_SOUNDS).toEqual(golden.zh.labSounds);
    expect(ZH_ITEMS.slice(0, golden.zh.items.length)).toEqual(golden.zh.items);
  });

  it('the lessons keep their ids and order', () => {
    expect(ALL_LESSONS.map((l) => l.id).filter((id) => golden.lessonIds.includes(id))).toEqual(golden.lessonIds);
  });

  it('one id, one item: "Thank you very much." keeps its meaning and focus sounds everywhere', () => {
    // It was written twice in the TypeScript course, and the bare copy in the teen café dialogue won the index.
    expect(ITEM_INDEX['it-thank-you-very-much']).toMatchObject({ meaning: 'a big thank-you', focus: ['θ', 'v'] });
  });
});

describe('the loader refuses a broken file', () => {
  const base = enData as unknown as CourseFile;
  const clone = (): CourseFile => JSON.parse(JSON.stringify(base));

  it('an exercise naming an item the file does not have', () => {
    const d = clone();
    d.units[0].lessons[0].exercises.little[0] = { type: 'speak', item: 'it-nothing' };
    expect(() => buildCourse(d, 'x.json')).toThrow(/lesson food-1 little #1: names an item the file does not have: it-nothing/);
  });

  it('a listening exercise with nothing to choose between', () => {
    const d = clone();
    d.units[0].lessons[0].exercises.junior[0] = { type: 'choose-heard', answer: 'it-water', others: [] };
    expect(() => buildCourse(d, 'x.json')).toThrow(ContentError);
  });

  it('a lesson missing an age band, a Mandarin item whose pinyin does not match its id', () => {
    const d = clone();
    d.units[0].lessons[1].exercises.teen = [];
    expect(() => buildCourse(d, 'x.json')).toThrow(/lesson food-2: has no exercises for teen/);
    const z = clone();
    z.items['zh-shui3'] = { text: '水', lang: 'zh-CN', zh: { hant: '水', py: 'shui4' } };
    expect(() => buildCourse(z, 'x.json')).toThrow(/item zh-shui3: its pinyin says its id should be zh-shui4/);
  });

  it('exercise ids count through the file, per course prefix', () => {
    expect(COURSE.units[0].lessons[0].exercises.little[0].id).toBe('ex-1');
    expect(ZH_COURSE.units[0].lessons[0].exercises.little[0].id).toBe('zx-1');
  });
});
