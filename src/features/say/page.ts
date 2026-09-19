import { useCallback, useEffect, useState } from 'react';
import type { Reading } from '../../speech/read';

// The page a learner photographed (or typed), with their best score for each sentence, and which of Home's two modes
// they last used. Kept on this device for each learner, so the page is still there tomorrow; never uploaded.

export interface BookPage { reading: Reading; best: Record<number, number>; at: number }
export type HomeMode = 'course' | 'book';

const pageKey = (profileId: string) => `wunder-tutor/book/${profileId}`;
const modeKey = (profileId: string) => `wunder-tutor/home-mode/${profileId}`;
const listeners = new Set<() => void>();

export function loadPage(profileId: string): BookPage | null {
  try {
    const v = JSON.parse(localStorage.getItem(pageKey(profileId)) ?? 'null') as BookPage | null;
    return Array.isArray(v?.reading?.lines) ? { ...v!, best: v!.best ?? {} } : null;
  } catch { return null; }
}

export function savePage(profileId: string, page: BookPage | null): void {
  try { if (page) localStorage.setItem(pageKey(profileId), JSON.stringify(page)); else localStorage.removeItem(pageKey(profileId)); } catch { /* private mode: this visit only */ }
  listeners.forEach((f) => f());
}

export const loadMode = (profileId: string): HomeMode => {
  try { return localStorage.getItem(modeKey(profileId)) === 'book' ? 'book' : 'course'; } catch { return 'course'; }
};
export function saveMode(profileId: string, mode: HomeMode): void {
  try { localStorage.setItem(modeKey(profileId), mode); } catch { /* private mode */ }
  listeners.forEach((f) => f());
}

/** Everything this device keeps for a learner's book page — removed with the learner or with all data. */
export function forgetBook(profileId: string): void {
  try { localStorage.removeItem(pageKey(profileId)); localStorage.removeItem(modeKey(profileId)); } catch { /* nothing kept */ }
}

/** The learner's page and Home mode, updated wherever they change (the camera, a practised sentence). */
export function useBook(profileId: string): { page: BookPage | null; mode: HomeMode; setPage: (p: BookPage | null) => void; setMode: (m: HomeMode) => void } {
  const [state, setState] = useState(() => ({ page: loadPage(profileId), mode: loadMode(profileId) }));
  useEffect(() => {
    const f = () => setState({ page: loadPage(profileId), mode: loadMode(profileId) });
    listeners.add(f);
    f();
    return () => { listeners.delete(f); };
  }, [profileId]);
  return {
    ...state,
    setPage: useCallback((p: BookPage | null) => savePage(profileId, p), [profileId]),
    setMode: useCallback((m: HomeMode) => saveMode(profileId, m), [profileId]),
  };
}
