import { describe, expect, it } from 'vitest';
import { addDays, delivery, localParts, nextSlot, quietAt, wallTimes, weekStart, preferences } from '../../notifications/policy.mjs';
import { nextPractice, practiceDays, weeklyProgress } from '../notifications/model';
import { emptyProfile } from '../intelligence/profile';
import type { ChildProfile } from '../domain/types';
import { mergeProfiles } from '../account/merge';
const prefs = { days: [1, 3, 5], time: '18:00', quietStart: '20:00', quietEnd: '08:00', timezone: 'Asia/Hong_Kong', locale: 'en', courses: ['en'], weekly: false, pauseUntil: 0, skipDay: '' };
const at = Date.parse('2026-09-25T10:00:00Z');
const profile = (over: Partial<ChildProfile> = {}): ChildProfile => ({ id: 'p', name: 'Learner', age: 9, band: 'junior', avatar: '🐯', homeLanguage: 'cantonese', level: 'beginner', goal: 'confidence', accent: 'en-US', learning: ['en'], course: 'en', zhScript: 'hans', createdAt: 1, xp: 0, dailyGoalXp: 60, streak: { count: 0, lastDay: null, best: 0 }, lessonsCompleted: {}, items: {}, pronunciation: emptyProfile(), achievements: [], conversations: [], ...over } as ChildProfile);
describe('gentle reminder schedule', () => {
  it('uses the learner timezone, not server or Hong Kong time', () => {
    expect(localParts(at, 'Asia/Hong_Kong')).toEqual({ day: '2026-09-25', time: '18:00' });
    expect(nextSlot(prefs, at)).toBe(Date.parse('2026-09-28T10:00:00Z'));
    expect(nextSlot({ ...prefs, timezone: 'America/New_York' }, at)).toBe(Date.parse('2026-09-25T22:00:00Z'));
  });
  it('supports non-hour offsets', () => expect(wallTimes('2026-09-25', '18:15', 'Asia/Kathmandu')).toEqual([Date.parse('2026-09-25T12:30:00Z')]));
  it('skips nonexistent spring-forward times', () => expect(wallTimes('2026-03-08', '02:30', 'America/New_York')).toEqual([]));
  it('uses the first repeated autumn time only', () => {
    expect(wallTimes('2026-11-01', '01:30', 'America/New_York')).toEqual([Date.parse('2026-11-01T05:30:00Z'), Date.parse('2026-11-01T06:30:00Z')]);
    expect(nextSlot({ ...prefs, days: [0], time: '01:30', timezone: 'America/New_York', quietStart: '03:00', quietEnd: '04:00' }, Date.parse('2026-11-01T05:45:00Z'))).toBe(Date.parse('2026-11-08T06:30:00Z'));
  });
  it('handles midnight-crossing and same-day quiet hours', () => {
    expect(quietAt('22:00', '20:00', '08:00')).toBe(true);
    expect(quietAt('07:59', '20:00', '08:00')).toBe(true);
    expect(quietAt('08:00', '20:00', '08:00')).toBe(false);
    expect(quietAt('13:00', '12:00', '14:00')).toBe(true);
    expect(nextSlot({ ...prefs, time: '21:00' }, at)).toBe(null);
  });
  it('honours skip today and a week pause', () => {
    expect(nextSlot({ ...prefs, skipDay: '2026-09-25' }, at - 60000)).toBe(Date.parse('2026-09-28T10:00:00Z'));
    expect(nextSlot({ ...prefs, pauseUntil: at + 7 * 86400000 }, at - 60000)).toBe(at + 7 * 86400000);
  });
  it('validates timezone, days and course scope', () => {
    expect(() => preferences({ ...prefs, timezone: 'not/a/timezone' })).toThrow();
    expect(() => preferences({ ...prefs, days: [] })).toThrow();
    expect(() => preferences({ ...prefs, days: [8] })).toThrow();
    expect(() => preferences({ ...prefs, courses: ['arbitrary'] })).toThrow();
    expect(() => preferences({ ...prefs, time: '24:00' })).toThrow();
    expect(weekStart('2026-09-27')).toBe('2026-09-21');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
describe('one notification across courses', () => {
  const state = { prefs, nextAt: at, subscription: {}, renewedAt: at - 86400000, hasReview: true };
  it('combines reviews into the usual reminder', () => expect(delivery(state, at)).toBe('review'));
  it.each([
    { lastDay: '2026-09-25' }, { practicedDays: ['2026-09-25'] }, { activeAt: at - 30000 },
    { lastSentAt: at - 3600000 }, { renewedAt: at - 8 * 86400000 },
    { prefs: { ...prefs, pauseUntil: at + 1000 } }, { prefs: { ...prefs, skipDay: '2026-09-25' } },
    { prefs: { ...prefs, quietStart: '18:00' } }, { subscription: null },
  ])('suppresses delivery for %j', patch => expect(delivery({ ...state, ...patch }, at)).toBe(null));
  it('drops stale reminders instead of a morning backlog', () => expect(delivery(state, at + 11 * 60000)).toBe(null));
  it('weekly summary replaces practice only with real activity', () => {
    const sunday = at + 2 * 86400000;
    const s = { ...state, prefs: { ...prefs, days: [0], weekly: true }, nextAt: sunday, activityDays: ['2026-09-25'] };
    expect(delivery(s, sunday)).toBe('weekly');
    expect(delivery({ ...s, activityDays: [] }, sunday)).toBe('review');
    expect(delivery({ ...s, prefs: { ...s.prefs, days: [1] }, activityDays: [] }, sunday)).toBe(null);
  });
});
describe('honest weekly progress and safe destinations', () => {
  it('includes repeat completions after account merge', () => {
    const a = profile({ activity: [{ id: 'one', at, kind: 'lesson' }] });
    const b = profile({ activity: [{ id: 'two', at: at - 86400000, kind: 'lesson' }] });
    const merged = mergeProfiles(a, b);
    expect(practiceDays(merged, 'Asia/Hong_Kong')).toEqual(['2026-09-24', '2026-09-25']);
    expect(mergeProfiles(merged, a).activity).toEqual(merged.activity);
  });
  it('does not count one attempt as a complete day unless the goal is met', () => {
    const p = profile(); p.pronunciation.days['2026-09-25'] = { date: '2026-09-25', xp: 10, attempts: 1, speakingMs: 5000, scoreSum: 70 };
    expect(practiceDays(p, 'Asia/Hong_Kong')).toEqual([]);
    p.pronunciation.days['2026-09-25'].xp = 60;
    expect(weeklyProgress(p, 'Asia/Hong_Kong', at).days).toHaveLength(1);
  });
  it('does not inflate old completions into repeat-session counts', () => {
    const p = profile({ lessonsCompleted: { 'old': { completedAt: at, stars: 2, bestAvg: 80 } } });
    expect(weeklyProgress(p, 'Asia/Hong_Kong', at).days).toEqual(['2026-09-25']);
  });
  it('only opens subscribed, unlocked content', () => {
    const p = profile();
    expect(nextPractice(p, ['ja'])).toBe(null);
    expect(nextPractice(p, ['en'])?.review).toBe(false);
    expect(nextPractice(p, ['en'])?.course).toBe('en');
  });
});
