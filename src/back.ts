import { useEffect, useRef } from 'react';

// The phone's own Back (Android's button or gesture). With nobody listening for it, Android closes the app from any
// page — a tester, 2026-09-21: "System back doesn't go back a page". Back now does what the page's own buttons do:
// it closes the sheet on top, lets the page decide (a lesson asks before it throws away the learner's progress),
// goes back a page, from another tab goes to Learn, and on Learn leaves the app, as Android apps do.

/** The bottom bar's tabs other than Learn ("/"). */
const TABS = ['/lab', '/progress', '/me'];

export type BackStep = 'sheet' | 'page' | 'history' | 'learn' | 'exit';

/** What one press of Back does. `page` asks the page on top, and is only asked when no sheet is open. */
export const backStep = (s: { sheetOpen: boolean; page: () => boolean; path: string; canGoBack: boolean }): BackStep => {
  if (s.sheetOpen) return 'sheet';
  if (s.page()) return 'page';
  if (s.path === '/') return 'exit';
  if (TABS.includes(s.path)) return 'learn';
  if (s.canGoBack) return 'history';
  // Opened straight onto a page (a link, a restored app): its way out is Learn. The first setup screen has none.
  return s.path === '/welcome' ? 'exit' : 'learn';
};

const pages: (() => boolean)[] = [];

/** For a page that handles Back itself. The handler returns true when it did. */
export function useBack(handler: () => boolean): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const h = () => latest.current();
    pages.push(h);
    return () => { const i = pages.indexOf(h); if (i >= 0) pages.splice(i, 1); };
  }, []);
}

/** One press of Back, on the page at `path`. */
export function pressBack(path: string, go: { back: () => void; learn: () => void; exit: () => void }): BackStep {
  const step = backStep({
    sheetOpen: !!document.querySelector('.sheet-layer'),
    page: () => pages.length > 0 && pages[pages.length - 1](),
    path,
    // The router numbers its history entries: 0 is the page the app opened on.
    canGoBack: ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0,
  });
  if (step === 'sheet') window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); // what a sheet closes on
  else if (step === 'history') go.back();
  else if (step === 'learn') go.learn();
  else if (step === 'exit') go.exit();
  return step;
}
