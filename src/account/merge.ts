import type { Achievement, ChildProfile, ConversationRecord, DayStat, ItemProgress, PhonemeStat, PronunciationProfile, WordStat } from '../domain/types';
import type { BookPage } from '../features/say/page';

// Two devices of one family changed the same learner without hearing of each other (one was offline). Nothing a child
// has earned may be lost, and numbers never go backwards: what was done on either device counts. The merge gives the
// same answer whichever device does it, and merging twice changes nothing.

const union = <T>(a: Record<string, T>, b: Record<string, T>, both: (x: T, y: T) => T): Record<string, T> => {
  const out: Record<string, T> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = k in a ? both(a[k], v) : v;
  return out;
};
const earliest = (x?: number, y?: number): number | undefined => (x == null ? y : y == null ? x : Math.min(x, y));
/** The one of two with more behind it; when they are level, the same one whichever way round they are given. */
const fuller = <T>(x: T, y: T, weight: (v: T) => number): T => {
  const d = weight(x) - weight(y);
  return d > 0 ? x : d < 0 ? y : JSON.stringify(x) <= JSON.stringify(y) ? x : y;
};

const phoneme = (x: PhonemeStat, y: PhonemeStat): PhonemeStat => {
  const base = fuller(x, y, (s) => s.count);
  return { ...base, best: Math.max(x.best, y.best), lastSeen: Math.max(x.lastSeen, y.lastSeen), days: Math.max(x.days, y.days), masteredAt: earliest(x.masteredAt, y.masteredAt) };
};
const word = (x: WordStat, y: WordStat): WordStat => ({ ...fuller(x, y, (s) => s.attempts), best: Math.max(x.best, y.best), lastSeen: Math.max(x.lastSeen, y.lastSeen) });
const day = (x: DayStat, y: DayStat): DayStat => ({ date: x.date, attempts: Math.max(x.attempts, y.attempts), scoreSum: Math.max(x.scoreSum, y.scoreSum), speakingMs: Math.max(x.speakingMs, y.speakingMs), xp: Math.max(x.xp, y.xp) });
const item = (x: ItemProgress, y: ItemProgress): ItemProgress => ({ ...fuller(x, y, (s) => s.attempts), best: Math.max(x.best, y.best), mastered: x.mastered || y.mastered });

const lastActive = (p: ChildProfile): string => `${p.streak.lastDay ?? ''}/${String(p.xp).padStart(9, '0')}`;

function pronunciation(a: ChildProfile, b: ChildProfile): PronunciationProfile {
  const recent = lastActive(a) >= lastActive(b) ? a.pronunciation : b.pronunciation;
  return {
    phonemes: union(a.pronunciation.phonemes, b.pronunciation.phonemes, phoneme),
    words: union(a.pronunciation.words, b.pronunciation.words, word),
    days: union(a.pronunciation.days, b.pronunciation.days, day),
    ...(recent.fluencyEma != null ? { fluencyEma: recent.fluencyEma } : {}),
    ...(recent.prosodyEma != null ? { prosodyEma: recent.prosodyEma } : {}),
  };
}

const byId = <T extends { id: string }>(list: T[], other: T[], both: (x: T, y: T) => T, order: (v: T) => number): T[] => {
  const out = new Map(list.map((v) => [v.id, v]));
  for (const v of other) out.set(v.id, out.has(v.id) ? both(out.get(v.id)!, v) : v);
  return [...out.values()].sort((x, y) => order(x) - order(y) || (x.id < y.id ? -1 : 1));
};

/** One learner as two devices know them → the learner both should have. */
export function mergeProfiles(a: ChildProfile, b: ChildProfile): ChildProfile {
  // Who they are and how they learn (name, age, accent, courses…): the device where a grown-up changed it last.
  const edited = (p: ChildProfile) => p.editedAt ?? p.createdAt;
  const who = edited(a) === edited(b) ? fuller(a, b, () => 0) : edited(a) > edited(b) ? a : b;
  const streak = a.streak.lastDay === b.streak.lastDay ? fuller(a.streak, b.streak, (s) => s.count) : (a.streak.lastDay ?? '') > (b.streak.lastDay ?? '') ? a.streak : b.streak;
  const voice = a.voice && b.voice ? fuller(a.voice, b.voice, (v) => v.takes) : a.voice ?? b.voice;
  const merged: ChildProfile = {
    id: a.id, name: who.name, avatar: who.avatar, age: who.age, band: who.band, homeLanguage: who.homeLanguage, level: who.level, goal: who.goal,
    accent: who.accent, learning: who.learning, course: who.course, zhScript: who.zhScript, dailyGoalXp: who.dailyGoalXp,
    createdAt: Math.min(a.createdAt, b.createdAt),
    xp: Math.max(a.xp, b.xp),
    streak: { ...streak, best: Math.max(a.streak.best, b.streak.best) },
    lessonsCompleted: union(a.lessonsCompleted, b.lessonsCompleted, (x, y) => ({ completedAt: Math.min(x.completedAt, y.completedAt), stars: Math.max(x.stars, y.stars), bestAvg: Math.max(x.bestAvg, y.bestAvg) })),
    items: union(a.items, b.items, item),
    pronunciation: pronunciation(a, b),
    achievements: byId<Achievement>(a.achievements, b.achievements, (x, y) => (x.earnedAt <= y.earnedAt ? x : y), (v) => v.earnedAt),
    conversations: byId<ConversationRecord>(a.conversations, b.conversations, (x) => x, (v) => v.at).slice(-50),
  };
  if (voice) merged.voice = voice;
  if (a.zhChecked || b.zhChecked) merged.zhChecked = true;
  if (a.editedAt != null || b.editedAt != null) merged.editedAt = Math.max(a.editedAt ?? 0, b.editedAt ?? 0);
  return merged;
}

/** One page of My book as two devices know it: the newer version, with the best score of each sentence from both. */
export function mergePages(a: BookPage, b: BookPage): BookPage {
  const base = a.changed === b.changed ? fuller(a, b, () => 0) : a.changed > b.changed ? a : b;
  const same = a.reading.lines.length === b.reading.lines.length && a.reading.lines.every((l, i) => l.text === b.reading.lines[i].text);
  if (!same) return base;
  const best: Record<number, number> = { ...a.best };
  for (const [k, v] of Object.entries(b.best)) best[Number(k)] = Math.max(best[Number(k)] ?? 0, v);
  return { ...base, best, at: Math.min(a.at, b.at) };
}

/** A small fingerprint of anything that can be written as JSON: has it changed since it was last sent? */
export function fingerprint(value: unknown): string {
  const text = JSON.stringify(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return `${text.length.toString(36)}.${(h >>> 0).toString(36)}`;
}
