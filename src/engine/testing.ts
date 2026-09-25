import type { ChildProfile } from '../domain/types';

// When a test is worth taking (Leslie, 2026-09-25: "when is a good time to show test? random?" — not random):
//   * a few days after the lesson was completed, so it measures what stuck rather than what was just heard — the same
//     spacing the review engine uses for items;
//   * at the end of a unit, the unit's last lesson straight away: a clean number per unit.
// A lesson is due once per completion: taking the test clears it until the lesson is completed again. Nothing here
// nags — Home shows the due test once a day at most, and the Learn / Test switch works whenever a learner likes.

export const TEST_AFTER_MS = 2 * 86_400_000;
/** A test score under this sends the item back to the review schedule (LessonPlayer). */
export const RETEST_BELOW = 75;

export function testDue(p: Pick<ChildProfile, 'lessonsCompleted' | 'tests'>, lessonId: string, unitLessonIds: string[], now = Date.now()): boolean {
  const done = p.lessonsCompleted[lessonId];
  if (!done) return false;
  const tested = p.tests?.[lessonId];
  if (tested && tested.at >= done.completedAt) return false;
  const unitDone = unitLessonIds.every((id) => p.lessonsCompleted[id]);
  const isLast = unitLessonIds[unitLessonIds.length - 1] === lessonId;
  return now - done.completedAt >= TEST_AFTER_MS || (unitDone && isLast);
}

/** The unit's due tests, in lesson order. */
export const dueTests = (p: Pick<ChildProfile, 'lessonsCompleted' | 'tests'>, unitLessonIds: string[], now = Date.now()): string[] =>
  unitLessonIds.filter((id) => testDue(p, id, unitLessonIds, now));
