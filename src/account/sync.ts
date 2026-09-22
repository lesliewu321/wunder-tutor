import type { ChildProfile } from '../domain/types';
import type { BookPage } from '../features/say/page';
import { fingerprint, mergePages, mergeProfiles } from './merge';

// Keeping a learner the same on all their devices. The device stays the place where learning happens (it
// works offline, and nothing waits for the network); signing in adds a copy in the learner's account:
//   * a learner is one document with a revision number. A device sends the revision it last saw; if another device
//     was first, the write finds no row — the device then takes that version, merges its own changes in (merge.ts:
//     nothing earned is lost) and sends the result.
//   * a page of My book is a small row of its own: the newer version wins, best scores are kept from both.
//   * a deleted learner or page leaves an empty tombstone, so the other devices delete it too.
// Recordings and attempts stay on the device: they are never part of this.
// `Local` and `Remote` are interfaces so that the engine can be tested with two pretend devices and a pretend server.

export const SCHEMA_VERSION = 1;

export interface LearnerHead { id: string; rev: number; deleted: boolean }
export interface PageHead { learner: string; id: string; changed: number; deleted: boolean }
export interface PageRow { learner: string; id: string; changed: number; page: BookPage | null }

export interface Remote {
  learnerHeads(): Promise<LearnerHead[]>;
  learnerState(id: string): Promise<{ state: ChildProfile; rev: number } | null>;
  /** 'full': the account already holds as many learners as it may (one, since 2026-09-22). */
  insertLearner(id: string, state: ChildProfile): Promise<'ok' | 'exists' | 'full'>;
  /** false: another device wrote first (the revision has moved on). */
  updateLearner(id: string, state: ChildProfile, fromRev: number): Promise<boolean>;
  deleteLearner(id: string): Promise<void>;
  pageHeads(): Promise<PageHead[]>;
  pages(learner: string, ids: string[]): Promise<PageRow[]>;
  /** `page: null` writes a tombstone. */
  upsertPages(rows: PageRow[]): Promise<void>;
}

export interface SyncMeta {
  /** Whose account this device's learners were last synced with. */
  user: string | null;
  /** What this device last saw on the server, and what it last sent. */
  learners: Record<string, { rev: number; sent: string }>;
  /** Learners deleted here that the account has not heard of yet. */
  deleted: string[];
}
export const emptyMeta = (): SyncMeta => ({ user: null, learners: {}, deleted: [] });

export interface Local {
  profiles(): Record<string, ChildProfile>;
  putProfile(p: ChildProfile): void;
  /** A learner deleted on another device: everything about them goes from this one too. */
  removeLearner(id: string): Promise<void>;
  shelf(learner: string): { pages: BookPage[]; gone: Record<string, number> };
  putShelf(learner: string, pages: BookPage[], gone: Record<string, number>): void;
  meta(): SyncMeta;
  putMeta(meta: SyncMeta): void;
}

export interface SyncResult { pulled: number; pushed: number; removed: number; full: boolean }

/** What goes into the account: the learner as the app knows them. (Attempts and recordings live elsewhere, on the device.) */
const documentOf = (p: ChildProfile): ChildProfile => p;

// ---------- One learner per account (Leslie, 2026-09-22: the account is the learner's own) ----------
// The engine below still handles any number of learners; the app shows it one. An empty account takes the device's
// learner. An account that already has a learner is that learner's, so a device signing in to it takes that learner
// (the device's own stays in its storage, unused, and is never sent).

/** The learner this device keeps in step with the account: its own, or the one the account already has. */
export async function accountLearner(remote: Remote, localId: string | null): Promise<{ id: string; state?: ChildProfile } | null> {
  const heads = (await remote.learnerHeads()).filter((h) => !h.deleted);
  if (localId && (!heads.length || heads.some((h) => h.id === localId))) return { id: localId };
  if (!heads.length) return null;
  // Several are left over from the family accounts before 2026-09-22: the one used most recently.
  const states = (await Promise.all(heads.map((h) => remote.learnerState(h.id)))).filter((s): s is { state: ChildProfile; rev: number } => !!s);
  const when = (p: ChildProfile) => p.editedAt ?? p.createdAt;
  const newest = states.sort((a, b) => when(b.state) - when(a.state))[0];
  return newest ? { id: newest.state.id, state: newest.state } : null;
}

/** The engine's view of one learner, on both sides. (Delegates by hand: the sides may be class instances.) */
export const onlyLearner = (id: string, local: Local, remote: Remote): { local: Local; remote: Remote } => ({
  local: {
    profiles: () => { const p = local.profiles()[id]; return p ? { [id]: p } : {}; },
    putProfile: (p) => local.putProfile(p),
    removeLearner: (x) => local.removeLearner(x),
    shelf: (l) => local.shelf(l),
    putShelf: (l, pages, gone) => local.putShelf(l, pages, gone),
    meta: () => local.meta(),
    putMeta: (m) => local.putMeta(m),
  },
  remote: {
    learnerHeads: async () => (await remote.learnerHeads()).filter((h) => h.id === id),
    learnerState: (x) => remote.learnerState(x),
    insertLearner: (x, s) => remote.insertLearner(x, s),
    updateLearner: (x, s, r) => remote.updateLearner(x, s, r),
    deleteLearner: (x) => remote.deleteLearner(x),
    pageHeads: async () => (await remote.pageHeads()).filter((h) => h.learner === id),
    pages: (l, ids) => remote.pages(l, ids),
    upsertPages: (rows) => remote.upsertPages(rows),
  },
});

/**
 * One sync as the app runs it: deletions made here first (a learner deleted on this device must not come back from
 * the account), then the account's learner — `adopt` puts it on this device when it is not this device's own — and
 * the engine for that learner only.
 */
export async function syncAccount(user: string, local: Local, remote: Remote, activeId: string | null, adopt: (p: ChildProfile) => void): Promise<{ id: string | null; result: SyncResult | null }> {
  if (local.meta().deleted.length) { const none = onlyLearner('', local, remote); await syncOnce(user, none.local, none.remote); }
  const chosen = await accountLearner(remote, activeId && local.profiles()[activeId] ? activeId : null);
  if (!chosen) return { id: null, result: null };
  if (chosen.state && chosen.id !== activeId) adopt(chosen.state);
  const one = onlyLearner(chosen.id, local, remote);
  return { id: chosen.id, result: await syncOnce(user, one.local, one.remote) };
}

export async function syncOnce(user: string, local: Local, remote: Remote): Promise<SyncResult> {
  const result: SyncResult = { pulled: 0, pushed: 0, removed: 0, full: false };
  let meta = local.meta();
  // Another account than last time: what was known about the server no longer applies; the learners here are new to it.
  if (meta.user !== user) meta = { user, learners: {}, deleted: [] };

  // 1. Deletions made here go first, or the learner would come straight back.
  for (const id of [...meta.deleted]) {
    await remote.deleteLearner(id);
    meta = { ...meta, deleted: meta.deleted.filter((x) => x !== id) };
    delete meta.learners[id];
    local.putMeta(meta);
  }

  // 2. Learners.
  const heads = new Map((await remote.learnerHeads()).map((h) => [h.id, h]));
  for (const head of heads.values()) {
    const mine = local.profiles()[head.id];
    if (head.deleted) {
      if (mine) { await local.removeLearner(head.id); result.removed += 1; }
      delete meta.learners[head.id];
      continue;
    }
    const known = meta.learners[head.id];
    if (mine && known && known.rev === head.rev) continue;            // nothing new there; step 3 sends what is new here
    const theirs = await remote.learnerState(head.id);
    if (!theirs) continue;
    const changedHere = mine && (!known || known.sent !== fingerprint(documentOf(mine)));
    const next = mine && changedHere ? mergeProfiles(mine, theirs.state) : theirs.state;
    if (!mine || fingerprint(next) !== fingerprint(mine)) { local.putProfile(next); result.pulled += 1; }
    meta.learners[head.id] = { rev: theirs.rev, sent: fingerprint(documentOf(theirs.state)) };
  }
  local.putMeta(meta);

  // 3. What is new here goes up. Someone else first? Take theirs, merge, try again.
  for (const id of Object.keys(local.profiles())) {
    for (let tries = 0; tries < 4; tries += 1) {
      const mine = local.profiles()[id];
      if (!mine) break;
      const print = fingerprint(documentOf(mine)), known = meta.learners[id];
      if (known && known.sent === print) break;
      if (!known) {
        const made = heads.get(id)?.deleted ? 'exists' : await remote.insertLearner(id, documentOf(mine));
        if (made === 'full') { result.full = true; break; }
        if (made === 'ok') { meta.learners[id] = { rev: 1, sent: print }; result.pushed += 1; break; }
      } else if (await remote.updateLearner(id, documentOf(mine), known.rev)) {
        meta.learners[id] = { rev: known.rev + 1, sent: print }; result.pushed += 1; break;
      }
      const theirs = await remote.learnerState(id);
      if (!theirs) break;                                               // deleted meanwhile: the next sync removes it here
      local.putProfile(mergeProfiles(mine, theirs.state));
      meta.learners[id] = { rev: theirs.rev, sent: fingerprint(documentOf(theirs.state)) };
    }
    local.putMeta(meta);
  }

  // 4. My book, learner by learner (only learners the account has).
  const pageHeads = await remote.pageHeads();
  for (const id of Object.keys(local.profiles())) {
    if (!meta.learners[id]) continue;
    const theirs = new Map(pageHeads.filter((h) => h.learner === id).map((h) => [h.id, h]));
    const { pages, gone } = local.shelf(id);
    const mine = new Map(pages.map((p) => [p.id, p]));
    const wanted = [...theirs.values()].filter((h) => !h.deleted && !(h.id in gone) && (mine.get(h.id)?.changed ?? -1) !== h.changed).map((h) => h.id);
    const fetched = new Map((wanted.length ? await remote.pages(id, wanted) : []).map((r) => [r.id, r.page]));
    const up: PageRow[] = [];
    let touched = false;
    for (const head of theirs.values()) {
      if (head.deleted) { if (mine.delete(head.id)) { touched = true; result.removed += 1; } continue; }
      if (head.id in gone) { up.push({ learner: id, id: head.id, changed: Math.max(gone[head.id], head.changed + 1), page: null }); continue; }
      const remotePage = fetched.get(head.id);
      if (!remotePage) continue;
      const here = mine.get(head.id);
      let next = here ? mergePages(here, remotePage) : remotePage;
      // Neither version as it was (scores from both): a version of its own, so the other devices fetch it.
      if (here && fingerprint(next) !== fingerprint(here) && fingerprint(next) !== fingerprint(remotePage)) next = { ...next, changed: Math.max(here.changed, remotePage.changed) + 1 };
      if (!here || fingerprint(next) !== fingerprint(here)) { mine.set(head.id, next); touched = true; result.pulled += 1; }
      if (fingerprint(next) !== fingerprint(remotePage)) up.push({ learner: id, id: head.id, changed: next.changed, page: next });
    }
    for (const page of mine.values()) if (!theirs.has(page.id)) up.push({ learner: id, id: page.id, changed: page.changed, page });
    if (up.length) { await remote.upsertPages(up); result.pushed += up.length; }
    // A deletion is remembered only until the account has it.
    const stillGone = Object.fromEntries(Object.entries(gone).filter(([gid]) => theirs.has(gid) && !theirs.get(gid)!.deleted && !up.some((r) => r.id === gid && r.page === null)));
    if (touched || Object.keys(stillGone).length !== Object.keys(gone).length) local.putShelf(id, [...mine.values()], stillGone);
  }
  return result;
}
