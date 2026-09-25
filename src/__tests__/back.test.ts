import { describe, expect, it, vi } from 'vitest';
import { backStep } from '../back';

// The phone's own Back (a tester, 2026-09-21: "System back doesn't go back a page"). It used to close the app.

const at = (path: string, o: { sheetOpen?: boolean; page?: boolean; canGoBack?: boolean } = {}) =>
  backStep({ sheetOpen: !!o.sheetOpen, page: () => !!o.page, path, canGoBack: o.canGoBack ?? true });

describe("the phone's Back", () => {
  it('closes an open sheet first, without asking the page', () => {
    const page = vi.fn(() => true);
    expect(backStep({ sheetOpen: true, page, path: '/lesson/en-food-1', canGoBack: true })).toBe('sheet');
    expect(page).not.toHaveBeenCalled();
  });

  it('then lets the page decide (a lesson asks before it is thrown away)', () => {
    expect(at('/lesson/en-food-1', { page: true })).toBe('page');
  });

  it('goes back a page from the other pages', () => {
    expect(at('/lab/r')).toBe('history');
    expect(at('/parents')).toBe('history');
    expect(at('/speak')).toBe('history');
  });

  it('goes to Learn from another tab, and leaves the app from Learn', () => {
    expect(at('/lab')).toBe('learn');
    expect(at('/book')).toBe('learn');
    expect(at('/progress')).toBe('learn');
    expect(at('/me')).toBe('learn');
    expect(at('/')).toBe('exit');
  });

  it('finds a way out of the page the app opened on', () => {
    expect(at('/lesson/en-food-1', { canGoBack: false })).toBe('learn');
    expect(at('/welcome', { canGoBack: false })).toBe('exit');
  });
});
