import { type AgeBand, type ContentBand, type Course, type CourseId, isGrownUp, type Lesson, type SpeakItem, type Unit } from '../domain/types';
import { tc } from '../i18n';
import { FR_COURSE, FR_ITEMS } from './fr/course';
import { JA_COURSE, JA_ITEMS } from './ja/course';
import { KO_COURSE, KO_ITEMS } from './ko/course';
import { ES_COURSE, ES_ITEMS } from './es/course';
import { buildCourse, type CourseFile } from './load';
import { inScript } from './zh/script';
import { ZH_COURSE, ZH_ITEMS } from './zh/course';
import enData from '../../astra-lessons/courses/en.json';

// The courses as the app runs them. English and Putonghua are DATA (astra-lessons/courses/en.json, zh.json), read through
// the loader; French and Japanese are still written in TypeScript (fr/course.ts, ja/course.ts) until their turn.
// Everything below is the same surface it always was: the engine and the screens import from here and never notice
// where a course came from.

export const EN = buildCourse(enData as unknown as CourseFile, 'astra-lessons/courses/en.json');

export const COURSE: Course = EN.course;
export const COURSES: Record<CourseId, Course> = { en: COURSE, zh: ZH_COURSE, fr: FR_COURSE, ja: JA_COURSE, ko: KO_COURSE, es: ES_COURSE };
export const courseFor = (id: CourseId): Course => COURSES[id] ?? COURSE;

/**
 * Course, unit and lesson names as this learner sees them: plainer for teens and adults, Chinese in their script, and
 * in the app's language — the English stays in the data, the translation is looked up by id each time it is read
 * (src/i18n/zh-Hant/content-course.json: `course.<id>.title`, `unit.<id>.title`, `unit.<id>.subtitle`, each with an
 * `.adult` line for the plainer name, and `lesson.<id>.title`).
 */
export const courseTitle = (c: Course, band: AgeBand): string => {
  const plain = isGrownUp(band) && c.grownUpTitle;
  return plain ? tc(`course.${c.id}.title.adult`, plain) : tc(`course.${c.id}.title`, c.title);
};
export const unitTitle = (u: Unit, band: AgeBand): string => {
  const plain = isGrownUp(band) && u.grownUp?.title;
  return inScript(plain ? tc(`unit.${u.id}.title.adult`, plain) : tc(`unit.${u.id}.title`, u.title));
};
export const unitSubtitle = (u: Unit, band: AgeBand): string => {
  const plain = isGrownUp(band) && u.grownUp?.subtitle;
  return inScript(plain ? tc(`unit.${u.id}.subtitle.adult`, plain) : tc(`unit.${u.id}.subtitle`, u.subtitle));
};
export const lessonTitle = (l: Pick<Lesson, 'id' | 'title'>): string => tc(`lesson.${l.id}.title`, l.title);

export const ALL_LESSONS: Lesson[] = [...COURSE.units, ...ZH_COURSE.units, ...FR_COURSE.units, ...JA_COURSE.units, ...KO_COURSE.units, ...ES_COURSE.units].flatMap((u) => u.lessons);
export const findLesson = (id: string): Lesson | undefined => ALL_LESSONS.find((l) => l.id === id);
export const lessonsOf = (id: CourseId): Lesson[] => courseFor(id).units.flatMap((u) => u.lessons);

/**
 * Every item a lesson can ask for, by id, plus every Mandarin, French and Japanese item (their Lab ladders and checks
 * included). English Lab and check-only items are deliberately NOT here — the review engine builds its lessons from
 * this index, and it never handed out Lab syllables; keep it that way until that is decided on purpose.
 */
export const ITEM_INDEX: Record<string, SpeakItem> = {};
for (const l of ALL_LESSONS) {
  for (const band of ['little', 'junior', 'teen'] as const) {
    for (const ex of l.exercises[band]) {
      const items = ex.type === 'speak' || ex.type === 'arrange' ? [ex.item] : ex.type === 'read-choice' ? [ex.passage, ...ex.options] : ex.type === 'choose-heard' ? ex.options : ex.type === 'minimal-pair' ? ex.pair : ex.replies;
      for (const it of items) ITEM_INDEX[it.id] = it;
    }
  }
}
for (const it of ZH_ITEMS) ITEM_INDEX[it.id] ??= it;
for (const it of FR_ITEMS) ITEM_INDEX[it.id] ??= it;
for (const it of JA_ITEMS) ITEM_INDEX[it.id] ??= it;
for (const it of KO_ITEMS) ITEM_INDEX[it.id] ??= it;
for (const it of ES_ITEMS) ITEM_INDEX[it.id] ??= it;

/** Onboarding speaking check: short, covers the classic trouble sounds (w, r, θ, æ, v, ɪ). */
export const ASSESSMENT_ITEMS: Record<ContentBand, SpeakItem[]> = EN.check;
