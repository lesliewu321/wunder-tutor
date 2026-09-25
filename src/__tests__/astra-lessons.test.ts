import { describe, expect, it } from 'vitest';
import type { ChildProfile, Course, Lesson } from '../domain/types';
import { COURSE, ALL_LESSONS, EN, ITEM_INDEX } from '../content/course';
import { ZH, ZH_COURSE } from '../content/zh/course';
import { buildCourse, type CourseFile } from '../content/load';
import { courseLessons, currentUnit, lessonUnlocked, sameSentence, shuffled } from '../engine/curriculum';
import { buildReview } from '../engine/learning';
import { parseSyllable } from '../content/zh/pinyin';
import enData from '../../astra-lessons/courses/en.json';
import zhData from '../../astra-lessons/courses/zh.json';
import { emptyProfile } from '../intelligence/profile';

describe('Astra foundation curriculum', () => {
  it('offers sixteen authored units and all skills for each language and age band', () => {
    for (const course of [COURSE, ZH_COURSE]) {
      expect(course.units).toHaveLength(16);
      expect(courseLessons(course)).toHaveLength(112);
      for (const unit of course.units.slice(1)) {
        expect(unit.locked).toBeUndefined();
        expect(unit.lessons).toHaveLength(7);
        for (const band of ['little', 'junior', 'teen'] as const) {
          const exercises = unit.lessons.flatMap(l => l.exercises[band]);
          for (const type of ['speak', 'choose-heard', 'dialogue', 'read-choice', 'arrange'])
            expect(exercises.some(ex => ex.type === type), unit.id + '/' + band + '/' + type).toBe(true);
          expect(unit.lessons.every(l => !!l.guide?.goal && !!l.guide?.practice)).toBe(true);
        }
      }
    }
  });
  it('has unique lesson/exercise identifiers and no missing index entries', () => {
    expect(new Set(ALL_LESSONS.map(l => l.id)).size).toBe(ALL_LESSONS.length);
    for (const built of [EN, ZH]) {
      const exercises = built.course.units.flatMap(u => u.lessons).flatMap(l => Object.values(l.exercises).flat());
      expect(new Set(exercises.map(ex => ex.id)).size).toBe(exercises.length);
      for (const ex of exercises) {
        if (ex.type === 'read-choice') expect(ITEM_INDEX[ex.passage.id]).toBeDefined();
        if (ex.type === 'arrange') expect(ITEM_INDEX[ex.item.id]).toBeDefined();
      }
    }
  });
  it('keeps both character scripts aligned to valid numbered pinyin', () => {
    for (const item of ZH.items) {
      const py = item.zh!.py.split(/\s+/);
      const han = (s: string) => [...s].filter(c => /\p{Script=Han}/u.test(c)).length;
      expect(han(item.text), item.id).toBe(py.length);
      expect(han(item.zh!.hant), item.id).toBe(py.length);
      py.forEach(s => expect(() => parseSyllable(s)).not.toThrow());
    }
  });
  it('rejects a reading answer duplicated among distractors', () => {
    const d = structuredClone(enData) as unknown as CourseFile;
    const ex = d.units[1].lessons[4].exercises.junior[0];
    if (ex.type !== 'read-choice') throw Error('Expected reading');
    ex.others.push(ex.answer);
    expect(() => buildCourse(d)).toThrow(/distinct answer/);
  });
  it('rejects broken sentence chunks and missing Traditional chunks', () => {
    const e = structuredClone(enData) as unknown as CourseFile;
    e.units[1].lessons[1].exercises.junior[4] = { type: 'arrange', item: 'it-water', chunks: ['not', 'water'] };
    expect(() => buildCourse(e)).toThrow(/reconstruct/);
    const z = structuredClone(zhData) as unknown as CourseFile;
    const ex = z.units[1].lessons[1].exercises.junior[4];
    if (ex.type !== 'arrange') throw Error('Expected sentence');
    delete ex.chunksHant;
    expect(() => buildCourse(z)).toThrow(/Traditional/);
  });
  it('preserves reading and sentence application when review becomes personalised', () => {
    const lesson = COURSE.units[1].lessons[6];
    const profile = { band: 'junior', items: {}, pronunciation: emptyProfile() } as ChildProfile;
    const exercises = buildReview(lesson, profile, 0);
    expect(exercises.some(ex => ex.type === 'read-choice')).toBe(true);
    expect(exercises.some(ex => ex.type === 'arrange')).toBe(true);
    expect(exercises.filter(ex => ex.type === 'speak').length).toBeGreaterThan(0);
  });
});

describe('multi-unit progression', () => {
  const completed = Object.fromEntries(COURSE.units[0].lessons.map(l => [l.id, { completedAt: 1, stars: 3, bestAvg: 90 }]));
  it('continues into the second unit after finishing the first', () => {
    expect(currentUnit(COURSE, {}).id).toBe('food');
    expect(currentUnit(COURSE, completed).id).toBe('greetings');
    expect(lessonUnlocked(courseLessons(COURSE), 'greetings-1', 'junior', completed)).toBe(true);
    expect(lessonUnlocked(courseLessons(COURSE), 'greetings-2', 'junior', completed)).toBe(false);
  });
  it('does not unlock later child lessons just because a preceding lesson was completed out of order', () => {
    const partial = { 'greetings-1': { completedAt: 1, stars: 1, bestAvg: 70 } };
    expect(lessonUnlocked(courseLessons(COURSE), 'greetings-2', 'little', partial)).toBe(false);
    expect(lessonUnlocked(courseLessons(COURSE), 'greetings-1', 'little', partial)).toBe(true);
    expect(lessonUnlocked(courseLessons(COURSE), 'plans-7', 'adult', {})).toBe(true);
    expect(lessonUnlocked(courseLessons(COURSE), 'missing', 'adult', {})).toBe(false);
  });
  it('ignores unbuilt units and selects the last playable unit for a completed course', () => {
    const all = Object.fromEntries(courseLessons(COURSE).map(l => [l.id, { completedAt: 1, stars: 3, bestAvg: 90 }]));
    const c: Course = { ...COURSE, units: [...COURSE.units, { ...COURSE.units[0], id: 'future', locked: true, lessons: [] as Lesson[] }] };
    expect(currentUnit(c, all).id).toBe('plans');
    expect(courseLessons(c)).toHaveLength(112);
  });
  it('shuffles repeated tokens without losing one and compares writing without punctuation penalties', () => {
    const tokens = [0, 1, 2, 3];
    const result = shuffled(tokens, 'sentence');
    expect(result).not.toEqual(tokens);
    expect([...result].sort()).toEqual(tokens);
    expect(sameSentence('I am a student', 'I am a student.')).toBe(true);
    expect(sameSentence('我 是 学生', '我是学生。')).toBe(true);
    expect(sameSentence('student a am I', 'I am a student.')).toBe(false);
  });
});
