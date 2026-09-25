import type { AgeBand, ChildProfile, Course, Lesson } from '../domain/types';

/** Only authored units enter the learning path. */
export const courseLessons = (course: Course): Lesson[] => course.units.filter((u) => !u.locked).flatMap((u) => u.lessons);
export const lessonUnlocked = (lessons: Lesson[], lessonId: string, band: AgeBand, completed: ChildProfile['lessonsCompleted']): boolean => {
  const index = lessons.findIndex((l) => l.id === lessonId);
  return index >= 0 && (band === 'adult' || !!completed[lessonId] || lessons.slice(0, index).every((l) => !!completed[l.id]));
};
/** First unfinished unit; the last authored unit becomes review when the course is complete. */
export const currentUnit = (course: Course, completed: ChildProfile['lessonsCompleted']) => {
  const ready = course.units.filter((u) => !u.locked && u.lessons.length);
  return ready.find((u) => u.lessons.some((l) => !completed[l.id])) ?? ready[ready.length - 1];
};
export const sameSentence = (left: string, right: string): boolean =>
  left.normalize('NFKC').replace(/[\s\p{P}]/gu, '').toLowerCase() === right.normalize('NFKC').replace(/[\s\p{P}]/gu, '').toLowerCase();
export function shuffled<T>(values: readonly T[], seed: string): T[] {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) | 0;
  const result = values.map((value, i) => ({ value, key: Math.sin(h + i * 7.3) })).sort((a, b) => a.key - b.key).map((o) => o.value);
  // A sentence must not arrive already solved.
  if (result.length > 1 && result.every((v, i) => v === values[i])) result.push(result.shift()!);
  return result;
}
