import type { Course, PhonemeId, SpeakItem } from '../../domain/types';
import { buildCourse, type CourseFile, type Ladder } from '../load';
import zhData from '../../../content/courses/zh.json';

// The Mandarin (Putonghua) course for Hong Kong children who already meet Putonghua at school — DATA since 2026-09-25
// (content/courses/zh.json), read through the loader. Every item there carries Simplified characters (what the scorer
// is sent), Traditional characters (what a Hong Kong child reads) and numbered pinyin with citation tones; the loader
// checks each one the way zhItem() always did.

export { zi } from './item';

export const ZH = buildCourse(zhData as unknown as CourseFile, 'content/courses/zh.json');

export const ZH_COURSE: Course = ZH.course;

/** Short speaking check the first time a child opens the Mandarin course. */
export const ZH_CHECK_ITEMS: Record<'little' | 'junior' | 'teen', SpeakItem[]> = ZH.check;

/** Pronunciation Lab: sound → syllables → words → phrases → sentence. */
export const ZH_LADDERS: Record<PhonemeId, Ladder> = ZH.ladders;
export const ZH_LAB_SOUNDS: PhonemeId[] = ZH.labSounds;

/** A course line by id, for the scenario file (which still names its lines in TypeScript); an unknown id fails at start-up, not in a lesson. */
export const zhLine = (id: string): SpeakItem => {
  const it = ZH.byId[id];
  if (!it) throw new Error(`content/courses/zh.json has no item ${id}`);
  return it;
};

/** Every Mandarin item, for indexing and for the accuracy test set. */
export const ZH_ITEMS: SpeakItem[] = ZH.items;
