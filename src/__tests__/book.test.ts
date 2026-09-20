import { beforeEach, describe, expect, it } from 'vitest';
import { addPage, deletePage, forgetBook, forgetScores, loadShelf, MAX_PAGES, openPage, scorePage } from '../features/say/page';
import type { Reading } from '../speech/read';

// "My book" keeps every page a learner photographed. These run without a browser: localStorage is a plain map here.
const store = new Map<string, string>();
let blocked = false;
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { if (blocked) throw new Error('QuotaExceededError'); store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  },
});

const reading = (...sentences: string[]): Reading => ({ language: 'en', lines: sentences.map((text) => ({ text, lang: 'en' as const })) });
let n = 0;
const learner = () => `learner-${++n}`;

beforeEach(() => { store.clear(); blocked = false; });

describe('My book: saved pages', () => {
  it('keeps every page, newest first, and opens the new one', () => {
    const id = learner();
    const first = addPage(id, reading('The brown dog sleeps.'), 1000).page;
    const second = addPage(id, reading('Once upon a time.'), 2000).page;
    const shelf = loadShelf(id);
    expect(shelf.pages.map((p) => p.id)).toEqual([second.id, first.id]);
    expect(shelf.open).toBe(second.id);
    expect(JSON.parse(store.get(`wunder-tutor/pages/${id}`)!).pages).toHaveLength(2);
  });

  it('turns the single page of earlier versions into the first page of the book', () => {
    const id = learner();
    store.set(`wunder-tutor/book/${id}`, JSON.stringify({ reading: reading('It is very late.'), best: { 0: 82 }, at: 500 }));
    const shelf = loadShelf(id);
    expect(shelf.pages).toHaveLength(1);
    expect(shelf.pages[0]).toMatchObject({ best: { 0: 82 }, at: 500, changed: 500 });
    expect(shelf.open).toBe(shelf.pages[0].id);
    expect(store.has(`wunder-tutor/book/${id}`)).toBe(false);
    expect(store.has(`wunder-tutor/pages/${id}`)).toBe(true);
  });

  it('opens another page, and ignores a page that is not in the book', () => {
    const id = learner();
    const first = addPage(id, reading('One.'), 1).page;
    addPage(id, reading('Two.'), 2);
    openPage(id, first.id);
    expect(loadShelf(id).open).toBe(first.id);
    openPage(id, 'no-such-page');
    expect(loadShelf(id).open).toBe(first.id);
  });

  it('keeps the best score of a sentence, on the page it belongs to', () => {
    const id = learner();
    const first = addPage(id, reading('One.', 'Two.'), 1).page;
    const second = addPage(id, reading('Three.'), 2).page;
    scorePage(id, first.id, 1, 70, 10);
    scorePage(id, first.id, 1, 55, 20);
    scorePage(id, first.id, 0, 91, 30);
    const pages = loadShelf(id).pages;
    expect(pages.find((p) => p.id === first.id)).toMatchObject({ best: { 0: 91, 1: 70 }, changed: 30 });
    expect(pages.find((p) => p.id === second.id)!.best).toEqual({});
  });

  it('deleting the open page opens the newest one left; deleting the last leaves an empty book', () => {
    const id = learner();
    const first = addPage(id, reading('One.'), 1).page;
    const second = addPage(id, reading('Two.'), 2).page;
    const third = addPage(id, reading('Three.'), 3).page;
    deletePage(id, third.id);
    expect(loadShelf(id)).toMatchObject({ open: second.id, pages: [{ id: second.id }, { id: first.id }] });
    deletePage(id, first.id); // not the open one: the open page stays
    expect(loadShelf(id).open).toBe(second.id);
    deletePage(id, second.id, 77);
    expect(loadShelf(id)).toMatchObject({ pages: [], open: null });
    // Deleted pages are remembered for a while, so that the family's other devices delete them too.
    expect(Object.keys(loadShelf(id).gone ?? {}).sort()).toEqual([first.id, second.id, third.id].sort());
    expect(loadShelf(id).gone?.[second.id]).toBe(77);
  });

  it(`holds ${MAX_PAGES} pages: the oldest makes room, and the caller is told which`, () => {
    const id = learner();
    const oldest = addPage(id, reading('Oldest.'), 1).page;
    for (let i = 2; i <= MAX_PAGES; i += 1) expect(addPage(id, reading(`Page ${i}.`), i).dropped).toBeNull();
    const { dropped } = addPage(id, reading('One too many.'), MAX_PAGES + 1);
    expect(dropped?.id).toBe(oldest.id);
    expect(loadShelf(id).pages).toHaveLength(MAX_PAGES);
    expect(loadShelf(id).pages.some((p) => p.id === oldest.id)).toBe(false);
  });

  it('a browser that stores nothing still keeps the book for the visit', () => {
    const id = learner();
    blocked = true;
    const page = addPage(id, reading('Private window.'), 1).page;
    scorePage(id, page.id, 0, 64);
    expect(loadShelf(id).pages[0]).toMatchObject({ id: page.id, best: { 0: 64 } });
    expect(store.size).toBe(0);
  });

  it('deleting the pronunciation history erases the scores and keeps the pages', () => {
    const id = learner();
    const first = addPage(id, reading('One.'), 1).page;
    const second = addPage(id, reading('Two.'), 2).page;
    scorePage(id, first.id, 0, 88, 5);
    forgetScores(id, 9);
    expect(loadShelf(id)).toMatchObject({ open: second.id, pages: [{ id: second.id, best: {}, changed: 2 }, { id: first.id, best: {}, changed: 9 }] });
  });

  it('forgets everything with the learner', () => {
    const id = learner();
    addPage(id, reading('One.'), 1);
    store.set(`wunder-tutor/home-mode/${id}`, 'book');
    forgetBook(id);
    expect(loadShelf(id)).toEqual({ pages: [], open: null });
    expect([...store.keys()].filter((k) => k.includes(id))).toEqual([]);
  });

  it('skips what is not a page when reading what was stored', () => {
    const id = learner();
    store.set(`wunder-tutor/pages/${id}`, JSON.stringify({ open: 'gone', pages: [{ nonsense: true }, { id: 'a', reading: reading('Fine.'), at: 5 }] }));
    const shelf = loadShelf(id);
    expect(shelf.pages.map((p) => p.id)).toEqual(['a']);
    expect(shelf.open).toBe('a');
    expect(shelf.pages[0].best).toEqual({});
  });
});
