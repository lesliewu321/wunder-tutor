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
  /** The languages it is for: the courses whose learners are offered it (Mid-Autumn: Putonghua; Christmas: all). */
  courses: CourseId[];
  /** The lesson per course; a course listed in `courses` without one yet shows nothing. */
  lessons: Partial<Record<CourseId, string>>;
  /** A festival that moves (lunar): the day in every year, YYYY-MM-DD, written out. */
  days?: string[];
  /** A festival on a fixed date: MM-DD, every year. */
  every?: string;
  before: number;
  after: number;
}

export const SEASON_EVENTS: SeasonEvent[] = (events as { events: SeasonEvent[] }).events;

const DAY = 86_400_000;
/** A YYYY-MM-DD day as a local midnight, so the window follows the learner's own calendar. */
const localDay = (iso: string): number => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).getTime(); };

/** The festival's day in the years around `year`, as YYYY-MM-DD. */
const daysAround = (event: SeasonEvent, year: number): string[] =>
  event.days ?? (event.every ? [year - 1, year, year + 1].map((y) => `${y}-${event.every}`) : []);

export interface ActiveSeason { event: SeasonEvent; course: CourseId; lesson: Lesson; /** The festival day this time (local midnight). */ day: Date }

/** Festivals with an authored lesson in the currently selected course. Previous courses must not change its language. */
export function activeSeasons(now: Date, course: CourseId): ActiveSeason[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const out: ActiveSeason[] = [];
  for (const event of SEASON_EVENTS) {
    const day = daysAround(event, now.getFullYear()).map(localDay).find((d) => today >= d - event.before * DAY && today <= d + event.after * DAY);
    if (day === undefined) continue;
    if (!event.courses.includes(course)) continue;
    const lesson = SEASONAL_LESSONS.find((l) => l.id === event.lessons[course]);
    if (lesson) out.push({ event, course, lesson, day: new Date(day) });
  }
  return out;
}
