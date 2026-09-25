import type { ChildProfile, CourseId } from '../domain/types';
import { courseFor, ITEM_INDEX } from '../content/course';
import { courseLessons, lessonUnlocked } from '../engine/curriculum';
import { dueItems, itemCourse } from '../engine/learning';
import { addDays, localParts, weekStart } from '../../notifications/policy.mjs';

export function deviceTimezone(): string { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
export function practiceDays(p: ChildProfile, timezone: string): string[] {
  const dates = (p.activity ?? []).map(a => localParts(a.at, timezone).day);
  for (const l of Object.values(p.lessonsCompleted)) dates.push(localParts(l.completedAt, timezone).day);
  for (const v of Object.values(p.tests ?? {})) dates.push(localParts(v.at, timezone).day);
  for (const v of p.conversations) dates.push(localParts(v.at, timezone).day);
  for (const [day, stat] of Object.entries(p.pronunciation.days)) if (stat.xp >= p.dailyGoalXp) dates.push(day);
  return [...new Set(dates)].sort();
}
export function activityDays(p: ChildProfile, timezone: string): string[] {
  return [...new Set([...practiceDays(p, timezone), ...Object.entries(p.pronunciation.days).filter(([, s]) => s.xp > 0 || s.attempts > 0).map(([d]) => d)])].sort();
}
export function weeklyProgress(p: ChildProfile, timezone: string, now = Date.now()) {
  const today = localParts(now, timezone).day, start = weekStart(today), end = addDays(start, 7);
  const days = practiceDays(p, timezone).filter(d => d >= start && d < end && d <= today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const xp = Object.entries(p.pronunciation.days).filter(([d]) => d >= start && d < end && d <= today).reduce((n, [, s]) => n + s.xp, 0);
  return { today, start, days, week, xp };
}
export function nextPractice(p: ChildProfile, allowed: string[], now = Date.now()): { course: CourseId; lesson: string; review: boolean } | null {
  const courses = [p.course, ...p.learning.filter(c => c !== p.course)].filter(c => p.learning.includes(c) && allowed.includes(c));
  for (const course of courses) {
    const lessons = courseLessons(courseFor(course, p.band));
    const due = dueItems(p, now).some(d => ITEM_INDEX[d.itemId] && itemCourse(ITEM_INDEX[d.itemId]) === course);
    const review = due && lessons.find(l => l.kind === 'review' && lessonUnlocked(lessons, l.id, p.band, p.lessonsCompleted));
    if (review) return { course, lesson: review.id, review: true };
  }
  for (const course of courses) {
    const lessons = courseLessons(courseFor(course, p.band));
    const lesson = lessons.find(l => !p.lessonsCompleted[l.id] && lessonUnlocked(lessons, l.id, p.band, p.lessonsCompleted)) ?? lessons.find(l => l.kind === 'review' && lessonUnlocked(lessons, l.id, p.band, p.lessonsCompleted));
    if (lesson) return { course, lesson: lesson.id, review: false };
  }
  return null;
}
