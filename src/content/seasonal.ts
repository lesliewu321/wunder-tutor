import type { CourseId, Lesson, SpeakItem } from '../domain/types';
import { buildCourse, type CourseFile } from './load';
import events from '../../content/seasonal/events.json';
import zhSeasonal from '../../content/seasonal/zh.json';

// Seasonal bonus lessons (Leslie, 2026-09-25: "add bonus/seasonal lessons. eg currently is it midautumn festival in hk,
// it would be good to push lessons for chinese learners"). The lessons are data in content/seasonal/<course>.json,
// read by the same loader as the courses; content/seasonal/events.json is the calendar. A festival's lesson is a bonus:
// it plays like any lesson, but stays out of the course's units, progress and badges.

const ZH = buildCourse(zhSeasonal as unknown as CourseFile, 'content/seasonal/zh.json');

export const SEASONAL_LESSONS: Lesson[] = [ZH].flatMap((b) => b.course.units.flatMap((u) => u.lessons));
export const SEASONAL_ITEMS: SpeakItem[] = [ZH].flatMap((b) => b.lessonItems);

export interface SeasonEvent {
  id: string;
  icon: string;
  title: string;
  blurb: string;
  /** The festival's lesson for each course that has one. */
  lessons: Partial<Record<CourseId, string>>;
  /** The day itself, every year, as YYYY-MM-DD (lunar festivals move). */
  days: string[];
  before: number;
  after: number;
}

export const SEASON_EVENTS: SeasonEvent[] = (events as { events: SeasonEvent[] }).events;

const DAY = 86_400_000;
/** A YYYY-MM-DD day as a local midnight, so the window follows the learner's own calendar. */
const localDay = (iso: string): number => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

/** The festivals on now for a learner of these courses, each with the lesson to offer (the first course that has one). */
export function activeSeasons(now: Date, courses: CourseId[]): { event: SeasonEvent; course: CourseId; lesson: Lesson }[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const out: { event: SeasonEvent; course: CourseId; lesson: Lesson }[] = [];
  for (const event of SEASON_EVENTS) {
    const on = event.days.some((d) => today >= localDay(d) - event.before * DAY && today <= localDay(d) + event.after * DAY);
    if (!on) continue;
    const course = courses.find((c) => event.lessons[c]);
    const lesson = course && SEASONAL_LESSONS.find((l) => l.id === event.lessons[course]);
    if (course && lesson) out.push({ event, course, lesson });
  }
  return out;
}
