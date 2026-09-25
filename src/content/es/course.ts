import { addCommunicationToBuilt } from '../../../astra-lessons/communication';
import type { Course, PhonemeId, SpeakItem } from '../../domain/types';
import { buildCourse, type CourseFile, type Ladder } from '../load';
import esData from '../../../content/courses/es.json';

// The Spanish (Spain) course — DATA (content/courses/es.json), read through the loader. Spelling says how a line
// sounds (es/lexicon.ts), so an item is just its text with a meaning and a picture.

export { es } from './item';

export const ES = addCommunicationToBuilt(buildCourse(esData as unknown as CourseFile, 'content/courses/es.json'));

export const ES_COURSE: Course = ES.course;

/** Short speaking check the first time a learner opens the Spanish course. */
export const ES_CHECK_ITEMS: Record<'little' | 'junior' | 'teen', SpeakItem[]> = ES.check;

/** Pronunciation Lab: sound → syllables → words → phrases → sentence. */
export const ES_LADDERS: Record<PhonemeId, Ladder> = ES.ladders;
export const ES_LAB_SOUNDS: PhonemeId[] = ES.labSounds;

/** A course line by id, for the scenario file; an unknown id fails at start-up, not in a lesson. */
export const esLine = (id: string): SpeakItem => {
  const it = ES.byId[id];
  if (!it) throw new Error(`content/courses/es.json has no item ${id}`);
  return it;
};

/** Every Spanish item, for indexing and for the accuracy test set. */
export const ES_ITEMS: SpeakItem[] = ES.items;
