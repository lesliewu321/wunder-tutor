import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { AGE_BANDS, ageGuidance, lessonExercises, stageLabel, stageOf, topicOf } from '../../astra-lessons/curriculum';
import { COURSES, courseFor, courseTitle, findLesson, lessonTitle, unitSubtitle, unitTitle } from '../content/course';
import { courseLessons, currentUnit, lessonUnlocked } from '../engine/curriculum';
import { exercisesFor } from '../engine/learning';
import { emptyProfile } from '../intelligence/profile';
import { catalogs, LANGUAGES, loadLanguage, setLanguage, meaningKey, itemMeaning, noteContent } from '../i18n';
import type { ChildProfile, Exercise, SpeakItem } from '../domain/types';
const items = (ex: Exercise): SpeakItem[] => ex.type === 'speak' || ex.type === 'arrange' ? [ex.item] : ex.type === 'read-choice' ? [ex.passage, ...ex.options] : ex.type === 'choose-heard' ? ex.options : ex.type === 'minimal-pair' ? ex.pair : [...(ex.tutor ? [ex.tutor] : [{ id: ex.id, text: ex.tutorLine, kind: 'sentence' as const }]), ...ex.replies];
beforeAll(async () => { await Promise.all(LANGUAGES.map(l => loadLanguage(l.id))); });
afterEach(() => setLanguage('en'));
describe('merged courses in all four age bands', () => {
  it('keeps every original lesson exactly once with foundation, everyday and applied stages in order', () => {
    for (const base of Object.values(COURSES)) for (const band of AGE_BANDS) {
      const path = courseFor(base.language, band), lessons = courseLessons(path);
      expect(lessons.map(l => l.id).sort()).toEqual(courseLessons(base).map(l => l.id).sort());
      expect(new Set(lessons.map(l => l.id)).size).toBe(lessons.length);
      const units = path.units.filter(u => !u.locked && u.lessons.length);
      expect(units.map(stageOf)).toEqual(units.map(stageOf).sort());
      const topics = units.map(u => topicOf(u.id));
      expect(topics.indexOf('people')).toBeLessThan(topics.indexOf('out'));
      expect(topics.indexOf('out')).toBeLessThan(topics.indexOf('work'));
      if (topics.includes('town')) {
        expect(topics.indexOf('greetings')).toBeLessThan(topics.indexOf('people'));
        expect(topics.indexOf('travel')).toBeLessThan(topics.indexOf('out'));
        expect(topics.indexOf('plans')).toBeLessThan(topics.indexOf('work'));
      }
      for (const l of lessons) {
        const list = lessonExercises(l, band);
        expect(list.length, l.id + '/' + band).toBeGreaterThan(0);
        expect(new Set(list.map(ex => ex.id)).size, l.id + '/' + band).toBe(list.length);
        expect(findLesson(l.id, band)).toBe(l);
        expect(l.exercises.adult).toBeDefined();
      }
    }
  });
  it('keeps completed lessons accessible and resumes from the first unfinished lesson in the new order', () => {
    const path = courseFor('en', 'junior');
    const completed = { 'food-1': { completedAt: 1, stars: 3, bestAvg: 90 } };
    expect(currentUnit(path, completed).id).toBe('greetings');
    expect(lessonUnlocked(courseLessons(path), 'food-1', 'junior', completed)).toBe(true);
    expect(lessonUnlocked(courseLessons(path), 'greetings-1', 'junior', completed)).toBe(true);
    expect(lessonUnlocked(courseLessons(path), 'work-1', 'junior', completed)).toBe(false);
  });
  it('adds an adult foundation step and uses school/teamwork material for teens', () => {
    const adult = findLesson('greetings-2', 'adult')!;
    expect(lessonExercises(adult, 'adult')[0]).toEqual(adult.exercises.junior[0]);
    expect(lessonExercises(adult, 'adult').length).toBeGreaterThan(adult.exercises.teen.length);
    for (const base of Object.values(COURSES)) {
      const work = courseFor(base.language, 'teen').units.find(u => topicOf(u.id) === 'work')!;
      for (const lesson of work.lessons) expect(lesson.exercises.teen).toEqual(lesson.exercises.junior);
    }
    const profile = { band: 'adult', items: {}, pronunciation: emptyProfile() } as ChildProfile;
    expect(exercisesFor(adult, profile)).toBe(adult.exercises.adult);
    const review = findLesson('greetings-7', 'adult')!;
    expect(exercisesFor(review, profile).some(e => e.type === 'read-choice')).toBe(true);
  });
  it('provides app-language meanings for every course item and tutor prompt, including English and Little learners', () => {
    const own: Record<string, string> = { 'zh-Hant': 'zh-CN', 'zh-Hans': 'zh-CN', ja: 'ja-JP', ko: 'ko-KR', fr: 'fr-FR', es: 'es-ES' };
    for (const { id: language } of LANGUAGES.filter(l => l.id !== 'en')) {
      const missing = new Set<string>(); setLanguage(language);
      for (const c of Object.values(COURSES)) for (const band of AGE_BANDS)
        for (const l of courseLessons(courseFor(c.language, band))) for (const ex of lessonExercises(l, band)) for (const item of items(ex)) {
          if (item.lang === own[language] || item.kind === 'sound' || item.kind === 'syllable') continue;
          const key = meaningKey(item);
          if (!key || !catalogs.meanings[language]?.[key]) missing.add(item.id + ': ' + key);
        }
      expect([...missing], language).toEqual([]);
    }
    setLanguage('zh-Hant'); expect(itemMeaning({ text: 'I would like some orange juice.', kind: 'sentence' })).toBe('我想要一些橙汁。');
    setLanguage('en'); expect(itemMeaning({ text: 'Hello!', kind: 'word' })).toBeNull();
  });
  it('translates all age guidance, stage labels, course names, unit names and lesson names', () => {
    setLanguage('en'); const seen = noteContent(true)!;
    for (const c of Object.values(COURSES)) for (const band of AGE_BANDS) {
      ageGuidance(band); courseTitle(c, band);
      for (const u of courseFor(c.language, band).units) {
        stageLabel(u); unitTitle(u, band); unitSubtitle(u, band);
        u.lessons.forEach(lessonTitle);
      }
    }
    noteContent(false);
    for (const { id } of LANGUAGES.filter(l => l.id !== 'en')) expect([...seen.keys()].filter(k => !catalogs.content[id]?.[k]), id).toEqual([]);
  });
});
