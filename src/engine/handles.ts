import type { ChildProfile } from '../domain/types';

// A random name for the leaderboards (Leslie, 2026-09-25: "I also like a random username for leaderboard"). Made once
// per learner from kid-safe words — "Brave Otter 42" — kept on the profile and shown in Settings, where a grown-up can
// roll a new one. The learner's real nickname never goes on a board.

const ADJECTIVES = ['Brave', 'Sunny', 'Quick', 'Merry', 'Clever', 'Gentle', 'Lucky', 'Mighty', 'Shiny', 'Jolly', 'Swift', 'Bright', 'Happy', 'Curious', 'Bouncy', 'Cosmic', 'Golden', 'Rapid', 'Sparky', 'Zippy'];
const ANIMALS = ['Otter', 'Panda', 'Tiger', 'Koala', 'Dolphin', 'Fox', 'Rabbit', 'Penguin', 'Falcon', 'Turtle', 'Parrot', 'Whale', 'Lion', 'Owl', 'Gecko', 'Puffin', 'Yak', 'Llama', 'Bee', 'Moose'];

const pick = <T,>(list: T[], r: () => number): T => list[Math.floor(r() * list.length)];

/** A new random handle: adjective, animal, two digits. `random` is only swapped for tests. */
export const makeHandle = (random: () => number = Math.random): string => `${pick(ADJECTIVES, random)} ${pick(ANIMALS, random)} ${10 + Math.floor(random() * 90)}`;

export const isHandle = (s: unknown): s is string => typeof s === 'string' && /^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/.test(s);

/** The learner's handle, made and saved the first time it is needed. */
export function handleFor(p: Pick<ChildProfile, 'id' | 'handle'>, save: (id: string, patch: Partial<ChildProfile>) => void): string {
  if (isHandle(p.handle)) return p.handle;
  const handle = makeHandle();
  save(p.id, { handle });
  return handle;
}
