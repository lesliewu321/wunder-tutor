import type { Achievement, ChildProfile } from '../domain/types';
import { phonemeInfo, PHONEMES } from '../content/phonemes';
import { tc } from '../i18n';
import { dayKey } from '../intelligence/profile';

// Light gamification: rewards effort and improvement, never raw talent.

export const XP = { attempt: 1, mastered: 5, firstTry: 2, lesson: 10, conversation: 15, labStage: 5 } as const;

export const DAILY_GOALS = [
  { xp: 30, label: 'Easy', detail: 'a few minutes' },
  { xp: 60, label: 'Steady', detail: 'one lesson' },
  { xp: 100, label: 'Super', detail: 'a lesson + extra' },
];

/** A daily goal's name and size in the app's language (the list above keeps the English): `goal.<xp>.label`. */
export const goalLabel = (g: { xp: number; label: string }): string => tc(`goal.${g.xp}.label`, g.label);
export const goalDetail = (g: { xp: number; detail: string }): string => tc(`goal.${g.xp}.detail`, g.detail);

export const bumpStreak = (streak: ChildProfile['streak'], now: number): ChildProfile['streak'] => {
  const today = dayKey(now);
  if (streak.lastDay === today) return streak;
  const yesterday = dayKey(now - 86400000);
  const count = streak.lastDay === yesterday ? streak.count + 1 : 1;
  return { count, lastDay: today, best: Math.max(streak.best, count) };
};

/** Streak as it should be displayed today (a missed day silently resets it to 0). */
export const liveStreak = (streak: ChildProfile['streak'], now = Date.now()): number =>
  streak.lastDay === dayKey(now) || streak.lastDay === dayKey(now - 86400000) ? streak.count : 0;

export const todayXp = (p: ChildProfile, now = Date.now()): number => p.pronunciation.days[dayKey(now)]?.xp ?? 0;

const DEFS: Record<string, Omit<Achievement, 'earnedAt' | 'id'>> = {
  'first-word': { title: 'First words', detail: 'You said your first words out loud!', icon: '🎤' },
  'first-lesson': { title: 'Lesson one, done', detail: 'You finished your first lesson.', icon: '🎓' },
  comeback: { title: 'Big comeback', detail: 'You jumped 15 points on a retry.', icon: '🚀' },
  perfect: { title: 'Bullseye', detail: 'A pronunciation score of 98 or more.', icon: '🎯' },
  'streak-3': { title: '3-day streak', detail: 'Three days of speaking in a row.', icon: '🔥' },
  'streak-7': { title: '7-day speaking streak', detail: 'A whole week of speaking!', icon: '🌟' },
  chatterbox: { title: 'Chatterbox', detail: 'You finished a whole conversation.', icon: '💬' },
  'lab-ladder': { title: 'Ladder climber', detail: 'You climbed a whole sound ladder in the Lab.', icon: '🪜' },
  'unit-food': { title: 'Food champion', detail: 'You finished every lesson in the English food unit.', icon: '🏆' },
  'unit-zh-food': { title: 'Putonghua food champion', detail: 'You finished every lesson in the Putonghua food unit.', icon: '🥢' },
  // A unit badge's id is `unit-<unit id>` (store.ts); without its line here the French one showed as "unit-fr-cafe".
  'unit-fr-cafe': { title: 'French café champion', detail: 'You finished every lesson in the French café unit.', icon: '🥐' },
  'unit-ja-food': { title: 'Japanese food champion', detail: 'You finished every lesson in the Japanese food unit.', icon: '🍙' },
};

export const achievement = (id: string, now: number): Achievement => {
  if (id.startsWith('sound-')) {
    // A badge is stored in English whatever the App language (`badgeName` shows it), so: the sound's own English name.
    const info = PHONEMES[id.slice(6)] ?? phonemeInfo(id.slice(6));
    return { id, title: `Sound mastered: ${info.name}`, detail: `Your “${info.label}” is now clear and steady.`, icon: '👅', earnedAt: now };
  }
  return { id, ...(DEFS[id] ?? { title: id, detail: '', icon: '⭐' }), earnedAt: now };
};

export const ACHIEVEMENT_CATALOGUE = Object.entries(DEFS).map(([id, d]) => ({ id, ...d }));

/**
 * A badge's name and description in the app's language. A badge is stored with the English it was earned with, so
 * these go by its id: `badge.<id>.name`, `badge.<id>.detail`. The "sound mastered" badges share one line each
 * (`badge.sound.name`, `badge.sound.detail`), filled with the sound they are about — `phonemeInfo` names it in the
 * app's language.
 */
const badgeSound = (id: string): string | null => (id.startsWith('sound-') ? id.slice(6) : null);
export const badgeName = (a: Pick<Achievement, 'id' | 'title'>): string => {
  const sound = badgeSound(a.id);
  return sound ? tc('badge.sound.name', a.title, { name: phonemeInfo(sound).name }) : tc(`badge.${a.id}.name`, a.title);
};
export const badgeDetail = (a: Pick<Achievement, 'id' | 'detail'>): string => {
  const sound = badgeSound(a.id);
  return sound ? tc('badge.sound.detail', a.detail, { label: phonemeInfo(sound).label }) : tc(`badge.${a.id}.detail`, a.detail);
};
