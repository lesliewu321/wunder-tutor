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

  it('every festival has a date and its languages; its lessons exist and are only in those languages', () => {
    for (const e of SEASON_EVENTS) {
      expect(e.courses.length).toBeGreaterThan(0);
      expect(Boolean(e.days?.length) !== Boolean(e.every)).toBe(true); // one way of dating it, not both
      for (const [course, id] of Object.entries(e.lessons)) {
        expect(e.courses).toContain(course);
        expect(SEASONAL_LESSONS.some((l) => l.id === id)).toBe(true);
      }
      if (e.days) {
        expect([...e.days].sort()).toEqual(e.days);
        for (const d of e.days) expect(new Date(`${d}T00:00:00Z`).toISOString().slice(0, 10)).toBe(d);
      }
      if (e.every) expect(e.every).toMatch(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
    }
  });

  // Leslie, 2026-09-25: "mid autumn should only apply to zh learners, whereas christmas lessons will apply to all my languages".
  it('Mid-Autumn is for Putonghua learners only; Christmas is for every course, every 25 December', () => {
    const find = (id: string) => SEASON_EVENTS.find((e) => e.id === id)!;
    expect(find('mid-autumn').courses).toEqual(['zh']);
    expect([...find('christmas').courses].sort()).toEqual(['en', 'es', 'fr', 'ja', 'ko', 'zh']);
    expect(find('christmas').every).toBe('12-25');
    // Christmas has no lessons written yet, so it shows nothing — even on the day.
    expect(activeSeasons(new Date(2026, 11, 25, 12), ['en', 'zh'])).toEqual([]);
  });

  it('says which day the festival is, this time round', () => {
    const [s0] = activeSeasons(new Date(2026, 8, 20, 12), ['en', 'zh']);
    expect(s0.course).toBe('zh');
    expect([s0.day.getFullYear(), s0.day.getMonth() + 1, s0.day.getDate()]).toEqual([2026, 9, 25]);
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
