import { useCallback, useEffect, useState } from 'react';
import type { Reading } from '../../speech/read';

// "My book": every page a learner photographed (or typed), newest first, with their best score for each sentence — and
// which of Home's two modes they last used. Kept on this device for each learner, so the pages are still there
// tomorrow; never uploaded. One page is "open": the one Home shows in full and /say?s=N practises. (Each page has its
// own id and `changed` time, so that pages can travel with the learner once families have accounts.)

export interface BookPage { id: string; reading: Reading; best: Record<number, number>; at: number; changed: number }
/** `gone`: pages deleted here (id → when), remembered for a while so that the family's other devices delete them too. */
export interface Shelf { pages: BookPage[]; open: string | null; gone?: Record<string, number> }
export type HomeMode = 'course' | 'book';

/** My book holds this many pages; the oldest makes room for a new one (the learner is told). */
export const MAX_PAGES = 30;

const shelfKey = (profileId: string) => `wunder-tutor/pages/${profileId}`;
/** Until 2026-09-20 a learner had one page only, under this key: it becomes the first page of the book. */
const onePageKey = (profileId: string) => `wunder-tutor/book/${profileId}`;
const modeKey = (profileId: string) => `wunder-tutor/home-mode/${profileId}`;
const listeners = new Set<() => void>();
/** What is on the shelves right now. Also the only copy when the browser won't store anything (private mode, full). */
const held = new Map<string, Shelf>();

const newId = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
const readJson = (key: string): unknown => { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } };
const asPage = (v: unknown): BookPage | null => {
  const p = v as Partial<BookPage> | null;
  if (!p || !Array.isArray(p.reading?.lines)) return null;
  const at = typeof p.at === 'number' ? p.at : Date.now();
  return { id: typeof p.id === 'string' && p.id ? p.id : newId(), reading: p.reading!, best: p.best ?? {}, at, changed: typeof p.changed === 'number' ? p.changed : at };
};

function write(profileId: string, shelf: Shelf): void {
  held.set(profileId, shelf);
  try { localStorage.setItem(shelfKey(profileId), JSON.stringify(shelf)); } catch { /* not stored: the book lasts for this visit */ }
  listeners.forEach((f) => f());
}

export function loadShelf(profileId: string): Shelf {
  const now = held.get(profileId);
  if (now) return now;
  const kept = readJson(shelfKey(profileId)) as Partial<Shelf> | null;
  let shelf: Shelf = { pages: [], open: null };
  if (kept && Array.isArray(kept.pages)) {
    const pages = kept.pages.map(asPage).filter((p): p is BookPage => !!p);
    shelf = { pages, open: pages.some((p) => p.id === kept.open) ? kept.open! : pages[0]?.id ?? null, gone: kept.gone && typeof kept.gone === 'object' ? kept.gone : undefined };
  } else {
    const one = asPage(readJson(onePageKey(profileId)));
    if (one) {
      shelf = { pages: [one], open: one.id };
      try { localStorage.setItem(shelfKey(profileId), JSON.stringify(shelf)); localStorage.removeItem(onePageKey(profileId)); } catch { /* moved next time */ }
    }
  }
  held.set(profileId, shelf);
  return shelf;
}

/** A new page goes on top and is opened. `dropped` is the oldest page, when the book was full and it made room. */
export function addPage(profileId: string, reading: Reading, now = Date.now()): { page: BookPage; dropped: BookPage | null } {
  const page: BookPage = { id: newId(), reading, best: {}, at: now, changed: now };
  const shelf = loadShelf(profileId), pages = [page, ...shelf.pages];
  const dropped = pages.length > MAX_PAGES ? pages.pop()! : null;
  write(profileId, { pages, open: page.id, gone: dropped ? remember(shelf.gone, dropped.id, now) : shelf.gone });
  return { page, dropped };
}

export function openPage(profileId: string, id: string): void {
  const shelf = loadShelf(profileId);
  if (shelf.open !== id && shelf.pages.some((p) => p.id === id)) write(profileId, { ...shelf, open: id });
}

/** The best score so far for one sentence of a page. */
export function scorePage(profileId: string, id: string, sentence: number, score: number, now = Date.now()): void {
  const shelf = loadShelf(profileId);
  if (!shelf.pages.some((p) => p.id === id)) return;
  write(profileId, { ...shelf, pages: shelf.pages.map((p) => (p.id === id ? { ...p, best: { ...p.best, [sentence]: Math.max(p.best[sentence] ?? 0, score) }, changed: now } : p)) });
}

/** Deleting the open page opens the newest one left. */
export function deletePage(profileId: string, id: string, now = Date.now()): void {
  const shelf = loadShelf(profileId), pages = shelf.pages.filter((p) => p.id !== id);
  if (pages.length !== shelf.pages.length) write(profileId, { pages, open: shelf.open === id ? pages[0]?.id ?? null : shelf.open, gone: remember(shelf.gone, id, now) });
}

const FORGET_AFTER = 90 * 86_400_000;
/** The deleted pages worth remembering: the last three months', a hundred at most. */
function remember(gone: Record<string, number> | undefined, id: string, now: number): Record<string, number> {
  const kept = Object.entries({ ...gone, [id]: now }).filter(([, at]) => now - at < FORGET_AFTER).sort((x, y) => y[1] - x[1]).slice(0, 100);
  return Object.fromEntries(kept);
}

/** What sync worked out with the family's other devices: the pages to have now, and the deletions still to pass on. */
export function replacePages(profileId: string, pages: BookPage[], gone: Record<string, number>): void {
  const shelf = loadShelf(profileId);
  const sorted = [...pages].sort((x, y) => y.at - x.at).slice(0, MAX_PAGES);
  write(profileId, { pages: sorted, open: sorted.some((p) => p.id === shelf.open) ? shelf.open : sorted[0]?.id ?? null, gone });
}

/** Called whenever any learner's book or Home mode changes (sync listens). */
export const onBookChange = (f: () => void): (() => void) => { listeners.add(f); return () => { listeners.delete(f); }; };

export const loadMode = (profileId: string): HomeMode => {
  try { return localStorage.getItem(modeKey(profileId)) === 'book' ? 'book' : 'course'; } catch { return 'course'; }
};
export function saveMode(profileId: string, mode: HomeMode): void {
  try { localStorage.setItem(modeKey(profileId), mode); } catch { /* private mode */ }
  listeners.forEach((f) => f());
}

/** "Delete pronunciation history": the pages stay (they are the learner's reading, like lessons), their scores go. */
export function forgetScores(profileId: string, now = Date.now()): void {
  const shelf = loadShelf(profileId);
  if (shelf.pages.some((p) => Object.keys(p.best).length)) write(profileId, { ...shelf, pages: shelf.pages.map((p) => (Object.keys(p.best).length ? { ...p, best: {}, changed: now } : p)) });
}

/** Everything this device keeps for a learner's book — removed with the learner or with all data. */
export function forgetBook(profileId: string): void {
  held.delete(profileId);
  try { for (const key of [shelfKey(profileId), onePageKey(profileId), modeKey(profileId)]) localStorage.removeItem(key); } catch { /* nothing kept */ }
  listeners.forEach((f) => f());
}

export interface Book {
  pages: BookPage[];
  /** The open page: shown in full on Home, practised by /say. */
  page: BookPage | null;
  mode: HomeMode;
  addPage: (reading: Reading) => { page: BookPage; dropped: BookPage | null };
  openPage: (id: string) => void;
  deletePage: (id: string) => void;
  scorePage: (id: string, sentence: number, score: number) => void;
  setMode: (m: HomeMode) => void;
}

/** The learner's book and Home mode, updated wherever they change (the camera, a practised sentence). */
export function useBook(profileId: string): Book {
  const read = useCallback(() => { const shelf = loadShelf(profileId); return { pages: shelf.pages, page: shelf.pages.find((p) => p.id === shelf.open) ?? null, mode: loadMode(profileId) }; }, [profileId]);
  const [state, setState] = useState(read);
  useEffect(() => {
    const f = () => setState(read());
    listeners.add(f);
    f();
    return () => { listeners.delete(f); };
  }, [read]);
  return {
    ...state,
    addPage: useCallback((reading: Reading) => addPage(profileId, reading), [profileId]),
    openPage: useCallback((id: string) => openPage(profileId, id), [profileId]),
    deletePage: useCallback((id: string) => deletePage(profileId, id), [profileId]),
    scorePage: useCallback((id: string, sentence: number, score: number) => scorePage(profileId, id, sentence, score), [profileId]),
    setMode: useCallback((m: HomeMode) => saveMode(profileId, m), [profileId]),
  };
}
