import type { Achievement, ChildProfile } from '../domain/types';
import { phonemeInfo } from '../content/phonemes';
import { dayKey } from '../intelligence/profile';

// Light gamification: rewards effort and improvement, never raw talent.

export const XP = { attempt: 1, mastered: 5, firstTry: 2, lesson: 10, conversation: 15, labStage: 5 } as const;

export const DAILY_GOALS = [
  { xp: 30, label: 'Easy', detail: 'a few minutes' },
  { xp: 60, label: 'Steady', detail: 'one lesson' },
  { xp: 100, label: 'Super', detail: 'a lesson + extra' },
];

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
  'first-word': { title: 'First words', detail: 'You spoke English out loud!', icon: '🎤' },
  'first-lesson': { title: 'Lesson one, done', detail: 'You finished your first lesson.', icon: '🎓' },
  comeback: { title: 'Comeback kid', detail: 'You jumped 15 points on a retry.', icon: '🚀' },
  perfect: { title: 'Bullseye', detail: 'A pronunciation score of 98 or more.', icon: '🎯' },
  'streak-3': { title: '3-day streak', detail: 'Three days of speaking in a row.', icon: '🔥' },
  'streak-7': { title: '7-day speaking streak', detail: 'A whole week of speaking!', icon: '🌟' },
  chatterbox: { title: 'Chatterbox', detail: 'You finished a whole conversation.', icon: '💬' },
  'lab-ladder': { title: 'Ladder climber', detail: 'You climbed a whole sound ladder in the Lab.', icon: '🪜' },
  'unit-food': { title: 'Yummy Food champion', detail: 'You finished every lesson in the unit.', icon: '🏆' },
};

export const achievement = (id: string, now: number): Achievement => {
  if (id.startsWith('sound-')) {
    const info = phonemeInfo(id.slice(6));
    return { id, title: `Sound mastered: ${info.name}`, detail: `Your “${info.label}” is now clear and steady.`, icon: '👅', earnedAt: now };
  }
  return { id, ...(DEFS[id] ?? { title: id, detail: '', icon: '⭐' }), earnedAt: now };
};

export const ACHIEVEMENT_CATALOGUE = Object.entries(DEFS).map(([id, d]) => ({ id, ...d }));
