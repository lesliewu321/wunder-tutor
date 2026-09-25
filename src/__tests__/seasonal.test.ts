import { describe, expect, it } from 'vitest';
import { findLesson, ITEM_INDEX, ALL_LESSONS } from '../content/course';
import { activeSeasons, SEASON_EVENTS, SEASONAL_ITEMS, SEASONAL_LESSONS } from '../content/seasonal';
import { ZH_ITEMS } from '../content/zh/course';

// Leslie, 2026-09-25: "add bonus/seasonal lessons. eg currently is it midautumn festival in hk".
describe('seasonal bonus lessons', () => {
  it('offers Mid-Autumn to Putonghua learners around the day, every year written in the calendar', () => {
    const on = (y: number, m: number, d: number, courses = ['zh'] as const) => activeSeasons(new Date(y, m - 1, d, 12), [...courses]).map((s) => s.event.id);
    expect(on(2026, 9, 25)).toEqual(['mid-autumn']); // the day
    expect(on(2026, 9, 15)).toEqual(['mid-autumn']); // ten days before
    expect(on(2026, 9, 29)).toEqual(['mid-autumn']); // four days after
    expect(on(2026, 9, 14)).toEqual([]);
    expect(on(2026, 9, 30)).toEqual([]);
    expect(on(2027, 9, 15)).toEqual(['mid-autumn']);
    expect(activeSeasons(new Date(2026, 8, 25, 12), ['en', 'ja'])).toEqual([]); // no lesson for those courses yet
  });

  it('every festival names lessons that exist, and dates that are real days in order', () => {
    for (const e of SEASON_EVENTS) {
      for (const id of Object.values(e.lessons)) expect(SEASONAL_LESSONS.some((l) => l.id === id)).toBe(true);
      expect([...e.days].sort()).toEqual(e.days);
      for (const d of e.days) expect(new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10)).toBe(d);
    }
  });

  it('plays like any lesson but stays out of the courses and their progress', () => {
    expect(findLesson('zh-season-mid-autumn-1')?.title).toBe('Mid-Autumn Festival');
    expect(ALL_LESSONS.some((l) => l.id.startsWith('zh-season-'))).toBe(false);
    for (const it of SEASONAL_ITEMS) expect(ITEM_INDEX[it.id]).toBeDefined();
  });

  it('never reuses a course word’s id for something else', () => {
    const course = new Map(ZH_ITEMS.map((it) => [it.id, it]));
    for (const it of SEASONAL_ITEMS) if (course.has(it.id)) expect(course.get(it.id)!.text).toBe(it.text);
  });
});
