import type { Course, PhonemeId, SpeakItem } from '../../domain/types';
import { buildCourse, type CourseFile, type Ladder } from '../load';
import koData from '../../../content/courses/ko.json';

// The Korean course — DATA (content/courses/ko.json), read through the loader. Every item there carries the line as
// written, the line as said (`ko.pron`) and its romanisation; the loader checks each one.

export { ko } from './item';

export const KO = buildCourse(koData as unknown as CourseFile, 'content/courses/ko.json');

export const KO_COURSE: Course = KO.course;

/** Short speaking check the first time a learner opens the Korean course. */
export const KO_CHECK_ITEMS: Record<'little' | 'junior' | 'teen', SpeakItem[]> = KO.check;

/** Pronunciation Lab: sound → syllables → words → phrases → sentence. */
export const KO_LADDERS: Record<PhonemeId, Ladder> = KO.ladders;
export const KO_LAB_SOUNDS: PhonemeId[] = KO.labSounds;

/** A course line by id, for the scenario file; an unknown id fails at start-up, not in a lesson. */
export const koLine = (id: string): SpeakItem => {
  const it = KO.byId[id];
  if (!it) throw new Error(`content/courses/ko.json has no item ${id}`);
  return it;
};

/** Every Korean item, for indexing and for the accuracy test set. */
export const KO_ITEMS: SpeakItem[] = KO.items;
