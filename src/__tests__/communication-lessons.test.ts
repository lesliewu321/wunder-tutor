import { describe, expect, it } from 'vitest';
import { COMMUNICATION } from '../../astra-lessons/communication';
import catalogs from '../../astra-lessons/i18n/communication.json';
import { ALL_LESSONS, COURSES, findLesson } from '../content/course';
import { sameSentence, courseLessons, lessonUnlocked } from '../engine/curriculum';
import { buildReview, itemCourse } from '../engine/learning';
import { emptyProfile } from '../intelligence/profile';
import { frFullyKnown } from '../content/fr/course';
import type { ChildProfile, Exercise, SpeakItem } from '../domain/types';

const langs = ['en','zh','ja','ko','fr','es'] as const;
const bands = ['little','junior','teen'] as const;
const items = (ex: Exercise): SpeakItem[] => ex.type === 'speak' || ex.type === 'arrange' ? [ex.item]
  : ex.type === 'read-choice' ? [ex.passage, ...ex.options]
  : ex.type === 'choose-heard' ? ex.options : ex.type === 'minimal-pair' ? ex.pair
  : [...(ex.tutor ? [ex.tutor] : []), ...ex.replies];
const compact = (s: string) => s.normalize('NFC').replace(/[\s\p{P}]/gu, '').toLowerCase();

describe('communication lessons in all six courses', () => {
  for (const lang of langs) {
    it(lang + ': has three playable topics, nine lessons each and three supported age bands', () => {
      const course = COURSES[lang];
      for (const suffix of ['out','people','work']) {
        const id = (lang === 'en' ? '' : lang + '-') + suffix;
        const unit = course.units.find(u => u.id === id)!;
        expect(unit, id).toBeDefined();
        expect(unit.locked).toBeFalsy();
        expect(unit.lessons).toHaveLength(9);
        expect(unit.lessons.every(l => findLesson(l.id) === l && l.guide?.goal && l.guide.practice)).toBe(true);
        for (const band of bands) {
          const ex = unit.lessons.flatMap(l => l.exercises[band]);
          for (const kind of ['speak','choose-heard','dialogue','read-choice','arrange']) expect(ex.some(x => x.type === kind), id + '/' + band + '/' + kind).toBe(true);
          for (const lesson of unit.lessons) expect(lesson.exercises[band].length).toBeGreaterThanOrEqual(5);
          const replies = unit.lessons[6].exercises[band];
          expect(replies).toHaveLength(6);
          expect(replies.every(x => x.type === 'dialogue' && x.tutor?.lang === (lang === 'en' ? undefined : {zh:'zh-CN',ja:'ja-JP',ko:'ko-KR',fr:'fr-FR',es:'es-ES'}[lang]))).toBe(true);
        }
        expect(unit.lessons[1].exercises.little).not.toEqual(unit.lessons[1].exercises.teen);
        expect(lessonUnlocked(courseLessons(course), unit.lessons[0].id, 'adult', {})).toBe(true);
      }
    });

    it(lang + ': runtime sentences reconstruct in both scripts and answers are present in the reading', () => {
      const ids = new Set(COMMUNICATION[lang].course.units.map(u => u.id));
      const exercises = COURSES[lang].units.filter(u => ids.has(u.id)).flatMap(u => u.lessons).flatMap(l => Object.values(l.exercises).flat());
      for (const ex of exercises) {
        for (const item of items(ex)) {
          expect(itemCourse(item), item.text).toBe(lang);
          if (lang === 'fr') expect(frFullyKnown(item), item.text).toBe(true);
        }
        if (ex.type === 'arrange') {
          expect(sameSentence(ex.chunks.join(' '), ex.item.text), ex.id).toBe(true);
          if (ex.item.zh) expect(sameSentence(ex.chunksHant!.join(''), ex.item.zh.hant), ex.id).toBe(true);
        }
        if (ex.type === 'read-choice') {
          expect(ex.options.filter(x => x.id === ex.answer.id)).toHaveLength(1);
          expect(new Set(ex.options.map(x => compact(x.text))).size).toBe(ex.options.length);
          if (ex.question.startsWith('What time')) expect(ex.options.every(x => /eight|ten|twelve/i.test(x.meaning ?? x.text)), ex.id + ' needs clock-time alternatives').toBe(true);
          expect(compact(ex.passage.text), ex.id).toContain(compact(ex.answer.text).replace(/oclock$/, ''));
        }
        if (ex.type === 'choose-heard') expect(new Set(ex.options.map(x => compact(x.text))).size, ex.id).toBe(ex.options.length);
      }
    });
  }

  it('keeps every lesson and exercise id unique across the complete curriculum', () => {
    const exercises = ALL_LESSONS.flatMap(l => Object.values(l.exercises).flat());
    expect(new Set(ALL_LESSONS.map(l => l.id)).size).toBe(ALL_LESSONS.length);
    expect(new Set(exercises.map(ex => ex.id)).size).toBe(exercises.length);
  });

  it('localises the new titles, guides, reading prompts and meanings in every supported interface language', () => {
    for (const [locale, catalog] of Object.entries(catalogs)) for (const pack of Object.values(COMMUNICATION)) {
      for (const unit of pack.course.units) {
        expect(catalog.content['unit.'+unit.id+'.title' as keyof typeof catalog.content], locale + '/' + unit.id).toBeTruthy();
        for (const lesson of unit.lessons) {
          const g = lesson.guide!;
          for (const text of [g.goal, g.tip, g.practice]) expect(catalog.lessons[text as keyof typeof catalog.lessons], locale+'/'+text).toBeTruthy();
          for (const ex of Object.values(lesson.exercises).flat()) if (ex.type === 'read-choice') {
            for (const text of [ex.question, ex.explanation]) expect(catalog.lessons[text as keyof typeof catalog.lessons], locale+'/'+text).toBeTruthy();
          }
        }
      }
      for (const item of pack.items) if (item.meaning) expect(catalog.meanings[item.meaning as keyof typeof catalog.meanings], locale + '/' + item.meaning).toBeTruthy();
    }
  });

  it('keeps listening, reading and sentence building when the review becomes personalised', () => {
    for (const lang of langs) {
      const id = (lang === 'en' ? '' : lang + '-') + 'work-9';
      const profile = {band:'teen',items:{},pronunciation:emptyProfile()} as ChildProfile;
      const review = buildReview(findLesson(id)!, profile, 0);
      for (const type of ['speak','choose-heard','read-choice','arrange']) expect(review.some(ex => ex.type === type), lang+'/'+type).toBe(true);
      expect(review.flatMap(items).every(it => itemCourse(it) === lang)).toBe(true);
    }
  });
});
