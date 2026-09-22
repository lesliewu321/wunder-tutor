import { describe, expect, it } from 'vitest';
import { mergePages, mergeProfiles } from '../account/merge';
import { emptyMeta, syncAccount, syncOnce, type Local, type PageRow, type Remote, type SyncMeta } from '../account/sync';
import type { ChildProfile } from '../domain/types';
import type { BookPage } from '../features/say/page';
import { emptyProfile } from '../intelligence/profile';

// A family's account, as two pretend devices and a pretend server. The server keeps the rules of the real one
// (supabase/migrations): a revision that goes up by one, tombstones, eight learners at most.

const learner = (id: string, over: Partial<ChildProfile> = {}): ChildProfile => ({
  id, name: 'Tiger', avatar: '🐯', age: 7, band: 'little', homeLanguage: 'yue', level: 'new', goal: 'school', accent: 'en-US', learning: ['en'], course: 'en', zhScript: 'hant',
  createdAt: 1000, xp: 0, dailyGoalXp: 60, streak: { count: 0, lastDay: null, best: 0 }, lessonsCompleted: {}, items: {}, pronunciation: emptyProfile(), achievements: [], conversations: [], ...over,
});
const page = (id: string, text: string, at: number, best: Record<number, number> = {}): BookPage => ({ id, reading: { language: 'en', lines: [{ text, lang: 'en' }] }, best, at, changed: at });

class Server implements Remote {
  learners = new Map<string, { state: ChildProfile | null; rev: number }>();
  rows = new Map<string, PageRow>();
  async learnerHeads() { return [...this.learners].map(([id, l]) => ({ id, rev: l.rev, deleted: l.state === null })); }
  async learnerState(id: string) { const l = this.learners.get(id); return l?.state ? { state: structuredClone(l.state), rev: l.rev } : null; }
  async insertLearner(id: string, state: ChildProfile) {
    if (this.learners.has(id)) return 'exists' as const;
    if ([...this.learners.values()].filter((l) => l.state).length >= 8) return 'full' as const;
    this.learners.set(id, { state: structuredClone(state), rev: 1 });
    return 'ok' as const;
  }
  async updateLearner(id: string, state: ChildProfile, fromRev: number) {
    const l = this.learners.get(id);
    if (!l || !l.state || l.rev !== fromRev) return false;
    this.learners.set(id, { state: structuredClone(state), rev: fromRev + 1 });
    return true;
  }
  async deleteLearner(id: string) {
    const l = this.learners.get(id);
    if (l?.state) this.learners.set(id, { state: null, rev: l.rev + 1 });
    for (const [k, r] of this.rows) if (r.learner === id) this.rows.set(k, { ...r, page: null });
  }
  async pageHeads() { return [...this.rows.values()].map((r) => ({ learner: r.learner, id: r.id, changed: r.changed, deleted: r.page === null })); }
  async pages(l: string, ids: string[]) { return [...this.rows.values()].filter((r) => r.learner === l && ids.includes(r.id)).map((r) => structuredClone(r)); }
  async upsertPages(rows: PageRow[]) { for (const r of rows) this.rows.set(`${r.learner}/${r.id}`, structuredClone(r)); }
}

class Device implements Local {
  all: Record<string, ChildProfile> = {};
  shelves: Record<string, { pages: BookPage[]; gone: Record<string, number> }> = {};
  kept: SyncMeta = emptyMeta();
  profiles() { return this.all; }
  putProfile(p: ChildProfile) { this.all = { ...this.all, [p.id]: p }; }
  async removeLearner(id: string) { const { [id]: _gone, ...rest } = this.all; this.all = rest; delete this.shelves[id]; }
  shelf(l: string) { return this.shelves[l] ?? { pages: [], gone: {} }; }
  putShelf(l: string, pages: BookPage[], gone: Record<string, number>) { this.shelves[l] = { pages, gone }; }
  meta() { return structuredClone(this.kept); }
  putMeta(m: SyncMeta) { this.kept = structuredClone(m); }
  /** The grown-up deletes a learner on this device. */
  deleteLearner(id: string) { const { [id]: _gone, ...rest } = this.all; this.all = rest; delete this.shelves[id]; this.kept.deleted.push(id); }
}

describe('merging one learner from two devices', () => {
  it('keeps what was earned on either device, and numbers never go backwards', () => {
    const phone = learner('l1', {
      xp: 120, streak: { count: 3, lastDay: '2026-09-20', best: 3 },
      lessonsCompleted: { 'food-1': { completedAt: 50, stars: 2, bestAvg: 71 } },
      achievements: [{ id: 'first-word', title: 'First words', detail: '', icon: '🎉', earnedAt: 10 }],
    });
    const tablet = learner('l1', {
      xp: 90, streak: { count: 5, lastDay: '2026-09-18', best: 5 },
      lessonsCompleted: { 'food-1': { completedAt: 80, stars: 3, bestAvg: 65 }, 'food-2': { completedAt: 90, stars: 1, bestAvg: 55 } },
      achievements: [{ id: 'first-word', title: 'First words', detail: '', icon: '🎉', earnedAt: 30 }, { id: 'streak-3', title: '3 days', detail: '', icon: '🔥', earnedAt: 40 }],
    });
    const m = mergeProfiles(phone, tablet);
    expect(m.xp).toBe(120);
    expect(m.streak).toEqual({ count: 3, lastDay: '2026-09-20', best: 5 });
    expect(m.lessonsCompleted).toEqual({ 'food-1': { completedAt: 50, stars: 3, bestAvg: 71 }, 'food-2': { completedAt: 90, stars: 1, bestAvg: 55 } });
    expect(m.achievements.map((a) => [a.id, a.earnedAt])).toEqual([['first-word', 10], ['streak-3', 40]]);
  });

  it('gives the same learner whichever device merges, and merging again changes nothing', () => {
    const a = learner('l1', { xp: 5, editedAt: 2000, name: 'Tiger T', items: { i1: { itemId: 'i1', text: 'tea', best: 80, mastered: false, box: 1, dueAt: 9, attempts: 2 } } });
    const b = learner('l1', { xp: 9, editedAt: 3000, name: 'Tigger', age: 8, band: 'junior', items: { i1: { itemId: 'i1', text: 'tea', best: 70, mastered: true, box: 2, dueAt: 12, attempts: 3 } } });
    const ab = mergeProfiles(a, b), ba = mergeProfiles(b, a);
    expect(ab).toEqual(ba);
    expect(mergeProfiles(ab, a)).toEqual(ab);
    expect(mergeProfiles(ab, b)).toEqual(ab);
    // Who the learner is: the later edit. What they did: both.
    expect(ab).toMatchObject({ name: 'Tigger', age: 8, band: 'junior', xp: 9, editedAt: 3000 });
    expect(ab.items.i1).toMatchObject({ attempts: 3, box: 2, best: 80, mastered: true });
  });

  it('keeps the evidence for a sound from the device that heard more of it', () => {
    const stat = (count: number, ema: number, best: number, masteredAt?: number) => ({ phoneme: 'θ', ema, first: 40, best, count, lowCount: 1, lastSeen: count, days: 1, heardAs: {}, masteredAt });
    const a = learner('l1'); a.pronunciation.phonemes['θ'] = stat(12, 81, 90, 500);
    const b = learner('l1'); b.pronunciation.phonemes['θ'] = stat(4, 60, 95);
    expect(mergeProfiles(a, b).pronunciation.phonemes['θ']).toMatchObject({ count: 12, ema: 81, best: 95, masteredAt: 500 });
  });

  it('a page: the newer version, the best score of each sentence from both', () => {
    const a = { ...page('p1', 'The brown dog sleeps.', 100, { 0: 70 }), changed: 300 };
    const b = { ...page('p1', 'The brown dog sleeps.', 100, { 0: 88 }), changed: 200 };
    expect(mergePages(a, b)).toMatchObject({ changed: 300, best: { 0: 88 } });
    expect(mergePages(a, b)).toEqual(mergePages(b, a));
  });
});

describe('a family on two devices', () => {
  it('the first device saves its learners; a new device gets them', async () => {
    const server = new Server(), phone = new Device(), tablet = new Device();
    phone.putProfile(learner('learner-1', { xp: 40 }));
    phone.putShelf('learner-1', [page('page-0001', 'The brown dog sleeps.', 100, { 0: 80 })], {});
    expect(await syncOnce('mum', phone, server)).toMatchObject({ pushed: 2, pulled: 0 });
    expect(await syncOnce('mum', tablet, server)).toMatchObject({ pulled: 2, pushed: 0 });
    expect(tablet.profiles()['learner-1'].xp).toBe(40);
    expect(tablet.shelf('learner-1').pages[0]).toMatchObject({ id: 'page-0001', best: { 0: 80 } });
    // Nothing changed: nothing moves.
    expect(await syncOnce('mum', phone, server)).toMatchObject({ pulled: 0, pushed: 0 });
    expect(await syncOnce('mum', tablet, server)).toMatchObject({ pulled: 0, pushed: 0 });
  });

  it('both used offline: neither device loses what was done on it', async () => {
    const server = new Server(), phone = new Device(), tablet = new Device();
    phone.putProfile(learner('learner-1'));
    await syncOnce('mum', phone, server);
    await syncOnce('mum', tablet, server);
    phone.putProfile({ ...phone.profiles()['learner-1'], xp: 30, lessonsCompleted: { 'food-1': { completedAt: 5, stars: 2, bestAvg: 70 } } });
    tablet.putProfile({ ...tablet.profiles()['learner-1'], xp: 20, lessonsCompleted: { 'food-2': { completedAt: 6, stars: 3, bestAvg: 90 } } });
    await syncOnce('mum', phone, server);
    await syncOnce('mum', tablet, server);   // finds the phone was first: merges, sends
    await syncOnce('mum', phone, server);    // and the phone hears of it
    for (const d of [phone, tablet]) {
      expect(d.profiles()['learner-1'].xp).toBe(30);
      expect(Object.keys(d.profiles()['learner-1'].lessonsCompleted).sort()).toEqual(['food-1', 'food-2']);
    }
    expect(phone.profiles()['learner-1']).toEqual(tablet.profiles()['learner-1']);
  });

  it('a learner deleted on one device goes from the other, and does not come back', async () => {
    const server = new Server(), phone = new Device(), tablet = new Device();
    phone.putProfile(learner('learner-1'));
    phone.putProfile(learner('learner-2', { name: 'Panda' }));
    await syncOnce('mum', phone, server);
    await syncOnce('mum', tablet, server);
    phone.deleteLearner('learner-2');
    await syncOnce('mum', phone, server);
    expect(await syncOnce('mum', tablet, server)).toMatchObject({ removed: 1 });
    expect(Object.keys(tablet.profiles())).toEqual(['learner-1']);
    await syncOnce('mum', phone, server);
    expect(Object.keys(phone.profiles())).toEqual(['learner-1']);
    expect(phone.meta().deleted).toEqual([]);
  });

  it('pages: added on one device, scored on both, deleted on one', async () => {
    const server = new Server(), phone = new Device(), tablet = new Device();
    phone.putProfile(learner('learner-1'));
    phone.putShelf('learner-1', [page('page-0001', 'One.', 100), page('page-0002', 'Two.', 200)], {});
    await syncOnce('mum', phone, server);
    await syncOnce('mum', tablet, server);
    expect(tablet.shelf('learner-1').pages.map((p) => p.id).sort()).toEqual(['page-0001', 'page-0002']);
    // Scores on both, then the tablet deletes page 2.
    phone.putShelf('learner-1', phone.shelf('learner-1').pages.map((p) => (p.id === 'page-0001' ? { ...p, best: { 0: 60 }, changed: 300 } : p)), {});
    tablet.putShelf('learner-1', tablet.shelf('learner-1').pages.filter((p) => p.id !== 'page-0002').map((p) => ({ ...p, best: { 0: 85 }, changed: 250 })), { 'page-0002': 260 });
    await syncOnce('mum', phone, server);
    await syncOnce('mum', tablet, server);
    await syncOnce('mum', phone, server);
    for (const d of [phone, tablet]) {
      expect(d.shelf('learner-1').pages.map((p) => p.id)).toEqual(['page-0001']);
      expect(d.shelf('learner-1').pages[0].best).toEqual({ 0: 85 });
    }
    expect(tablet.shelf('learner-1').gone).toEqual({});
    expect(await syncOnce('mum', tablet, server)).toMatchObject({ pulled: 0, pushed: 0, removed: 0 });
  });

  it('a ninth learner stays on the device, and the grown-up is told', async () => {
    const server = new Server(), phone = new Device();
    for (let i = 1; i <= 9; i += 1) phone.putProfile(learner(`learner-${i}`));
    expect(await syncOnce('mum', phone, server)).toMatchObject({ pushed: 8, full: true });
    expect(Object.keys(phone.profiles())).toHaveLength(9);
  });

  it('signing in to another account: this device\'s learners are new to it (the engine itself, any number)', async () => {
    const server = new Server(), other = new Server(), phone = new Device();
    phone.putProfile(learner('learner-1', { xp: 7 }));
    await syncOnce('mum', phone, server);
    expect(await syncOnce('dad', phone, other)).toMatchObject({ pushed: 1 });
    expect((await other.learnerState('learner-1'))?.state.xp).toBe(7);
  });
});

// One learner per account (Leslie, 2026-09-22): the account is the learner's own. What the app does around the engine
// (src/account/account.ts): choose the account's learner, then sync that one only.
describe('one learner per account', () => {
  /** A device as the app runs it: one active learner; the account's learner takes over if it has one. */
  const signIn = async (user: string, device: Device, server: Server, active: string | null) => {
    const { id, result } = await syncAccount(user, device, server, active, (p) => device.putProfile(p));
    return { active: id, result };
  };

  it('an empty account takes the learner of the device that signs in first', async () => {
    const server = new Server(), phone = new Device();
    phone.putProfile(learner('learner-1', { xp: 12 }));
    expect((await signIn('tiger', phone, server, 'learner-1')).result).toMatchObject({ pushed: 1 });
    expect((await server.learnerState('learner-1'))?.state.xp).toBe(12);
  });

  it('a new device signing in takes the account\'s learner, and never sends its own', async () => {
    const server = new Server(), phone = new Device(), tablet = new Device();
    phone.putProfile(learner('learner-1', { name: 'Tiger', xp: 40 }));
    await signIn('tiger', phone, server, 'learner-1');
    // The tablet was set up first, with a learner of its own, then signs in to Tiger's account.
    tablet.putProfile(learner('learner-9', { name: 'New', xp: 3 }));
    const { active } = await signIn('tiger', tablet, server, 'learner-9');
    expect(active).toBe('learner-1');
    expect(tablet.profiles()['learner-1']).toMatchObject({ name: 'Tiger', xp: 40 });
    expect((await server.learnerHeads()).map((h) => h.id)).toEqual(['learner-1']);
    // From now on the two devices keep Tiger the same.
    tablet.putProfile({ ...tablet.profiles()['learner-1'], xp: 55 });
    await signIn('tiger', tablet, server, 'learner-1');
    await signIn('tiger', phone, server, 'learner-1');
    expect(phone.profiles()['learner-1'].xp).toBe(55);
  });

  it('an account left over with several learners: the one used last, and only that one', async () => {
    const server = new Server(), phone = new Device(), tablet = new Device();
    phone.putProfile(learner('learner-1', { name: 'River', editedAt: 100 }));
    phone.putProfile(learner('learner-2', { name: 'Tiger', editedAt: 900 }));
    phone.putProfile(learner('learner-3', { name: 'Bro', editedAt: 500 }));
    await syncOnce('family', phone, server); // the family accounts before 2026-09-22
    const { active } = await signIn('family', tablet, server, null);
    expect(active).toBe('learner-2');
    expect(Object.keys(tablet.profiles())).toEqual(['learner-2']);
  });

  it('nothing on either side: nothing to do', async () => {
    expect((await signIn('tiger', new Device(), new Server(), null)).active).toBeNull();
  });

  it('the learner deleted: the account is empty again, and takes the next learner set up', async () => {
    const server = new Server(), phone = new Device();
    phone.putProfile(learner('learner-1'));
    await signIn('tiger', phone, server, 'learner-1');
    phone.deleteLearner('learner-1');
    // No learner here now: the deletion goes up, and the learner does not come back from the account.
    expect((await signIn('tiger', phone, server, null)).active).toBeNull();
    expect(phone.profiles()).toEqual({});
    phone.putProfile(learner('learner-2'));
    expect((await signIn('tiger', phone, server, 'learner-2')).result).toMatchObject({ pushed: 1 });
  });
});
