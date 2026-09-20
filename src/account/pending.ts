// What this device remembers between syncs. Kept apart from the rest of the account code so that the store can note a
// deleted learner without pulling the account (and its libraries) into the app's first load.

import type { SyncMeta } from './sync';

const META = 'wunder-tutor/sync/v1';
/** The sign-in itself (the auth library keeps it here). Its presence means: this device has an account, start syncing. */
export const SESSION = 'wunder-tutor/auth';

const read = (): SyncMeta => {
  try {
    const v = JSON.parse(localStorage.getItem(META) ?? 'null') as Partial<SyncMeta> | null;
    return { user: typeof v?.user === 'string' ? v.user : null, learners: v?.learners ?? {}, deleted: Array.isArray(v?.deleted) ? v!.deleted : [] };
  } catch { return { user: null, learners: {}, deleted: [] }; }
};
const write = (meta: SyncMeta): void => { try { localStorage.setItem(META, JSON.stringify(meta)); } catch { /* private mode: synced again next visit */ } };

export const loadMeta = read;
/** The engine's view goes back, except the deletions: those may have grown while it was working. */
export function saveMeta(meta: SyncMeta, done: string[] = []): void {
  const now = read();
  write({ ...meta, deleted: now.deleted.filter((id) => !done.includes(id)) });
}

/** A grown-up deleted a learner here. If the family has an account, it must hear of it, or the learner would come back. */
export function noteLearnerDeleted(id: string): void {
  const meta = read();
  if (!meta.user || !meta.learners[id]) return;         // never reached the account: nothing to tell it
  const { [id]: _gone, ...learners } = meta.learners;
  write({ ...meta, learners, deleted: [...new Set([...meta.deleted, id])] });
}

/** Everything was erased from this device (and the account, if there was one). */
export function forgetSync(): void { try { localStorage.removeItem(META); } catch { /* nothing kept */ } }

export const hasAccountHere = (): boolean => { try { return localStorage.getItem(SESSION) != null; } catch { return false; } };

/** The signed-in parent's token, for this app's own /api (it recognises the family by it). Null when signed out or expired. */
export const accessToken = (): string | null => {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION) ?? 'null') as { access_token?: string; expires_at?: number } | null;
    return s?.access_token && (s.expires_at ?? 0) * 1000 > Date.now() + 10_000 ? s.access_token : null;
  } catch { return null; }
};
