import type { AgeBand, Assessment, ChildProfile, Exercise, ItemProgress, Lesson, PhonemeId, SpeakItem } from '../domain/types';
import { ITEM_INDEX } from '../content/course';
import { LADDERS } from '../content/lab';
import { weakSounds } from '../intelligence/profile';

// Learning Engine: mastery rules, spaced repetition and in-lesson adaptation.

/** Score needed to master an item. Younger children get a gentler bar. */
export const MASTERY: Record<AgeBand, number> = { little: 70, junior: 76, teen: 80 };
/** After this many tries we move on kindly and bring the item back later — difficulty is never punished. */
export const MAX_TRIES = 3;
export const FAST_TRACK_SCORE = 90;

export const isMastered = (a: Assessment, band: AgeBand): boolean =>
  a.overall >= MASTERY[band] && a.words.every((w) => w.errorType !== 'omission' && w.score >= MASTERY[band] - 22);

const HOUR = 3600000;
const BOX_INTERVAL = [0.15 * HOUR, 24 * HOUR, 3 * 24 * HOUR, 7 * 24 * HOUR, 21 * 24 * HOUR];

export const nextItemProgress = (
  prev: ItemProgress | undefined, item: SpeakItem, best: number, mastered: boolean, tries: number, now: number,
): ItemProgress => {
  const box = !mastered ? 0 : Math.min(4, (prev?.box ?? 0) + (tries === 1 ? 2 : 1));
  return {
    itemId: item.id, text: item.text, best: Math.max(prev?.best ?? 0, best), mastered: mastered || !!prev?.mastered,
    box, dueAt: now + BOX_INTERVAL[box], attempts: (prev?.attempts ?? 0) + tries,
  };
};

export const dueItems = (profile: ChildProfile, now: number): ItemProgress[] =>
  Object.values(profile.items).filter((p) => p.dueAt <= now).sort((a, b) => a.dueAt - b.dueAt);

let seq = 0;
const speakEx = (item: SpeakItem, tag: string): Exercise => ({ id: `${tag}-${++seq}`, type: 'speak', item, prompt: 'text' });

/** Sound → syllable → word mini-drill inserted when a child keeps stumbling on one sound. */
export const drillFor = (sound: PhonemeId, skipText?: string): Exercise[] => {
  const ladder = LADDERS[sound];
  if (!ladder) return [];
  const word = ladder.words.find((w) => w.text.toLowerCase() !== skipText?.toLowerCase()) ?? ladder.words[0];
  return [speakEx(ladder.syllables[0], 'drill'), speakEx(word, 'drill')];
};

export const isDrill = (ex: Exercise): boolean => ex.id.startsWith('drill-');

/** Review lessons are personal: what's due for repetition plus a word for each weak sound. */
export const buildReview = (lesson: Lesson, profile: ChildProfile, now: number): Exercise[] => {
  const fallback = lesson.exercises[profile.band];
  const due = dueItems(profile, now).map((p) => ITEM_INDEX[p.itemId]).filter((i): i is SpeakItem => !!i).slice(0, 4);
  const weak = weakSounds(profile.pronunciation).map((s) => LADDERS[s.phoneme]?.words[0]).filter((i): i is SpeakItem => !!i).slice(0, 2);
  const picked = [...due, ...weak];
  if (picked.length < 3) {
    for (const ex of fallback) {
      if (ex.type === 'speak' && !picked.some((p) => p.id === ex.item.id)) picked.push(ex.item);
      if (picked.length >= 5) break;
    }
  }
  return picked.slice(0, 6).map((it) => speakEx(it, 'review'));
};

export const exercisesFor = (lesson: Lesson, profile: ChildProfile, now = Date.now()): Exercise[] =>
  lesson.kind === 'review' ? buildReview(lesson, profile, now) : lesson.exercises[profile.band];

/** Already solid from earlier sessions — safe to skip when the child is flying through. */
export const canSkip = (ex: Exercise, profile: ChildProfile): boolean =>
  ex.type === 'speak' && !!profile.items[ex.item.id]?.mastered && (profile.items[ex.item.id]?.box ?? 0) >= 2;

export const starsFor = (avg: number): number => (avg >= 90 ? 3 : avg >= 75 ? 2 : 1);

/** Next lesson to play, in course order. */
export const nextLessonId = (profile: ChildProfile, lessonIds: string[]): string | null =>
  lessonIds.find((id) => !profile.lessonsCompleted[id]) ?? null;
