import type { Assessment, Locale, PhonemeId, SpeakItem, CourseId } from '../domain/types';
import type { Recording } from '../speech/types';
import data from '../../content/twisters.json';

// Tongue twisters for the game (src/features/twisters). Only PROVEN ones are offered: eval/twisters.ts has said the
// teacher's own take of each one passes the scorer — a game that fails a child who said it right is worse than none.

export interface Twister {
  id: string;
  locale: Locale;
  text: string;
  picture: string;
  sounds: PhonemeId[];
  /** 1 short, 2 medium, 3 long. */
  level: 1 | 2 | 3;
  proven: boolean;
  teacherScore?: number;
}

/** The scorer's overall a take needs to count as "said it right". */
export const TWISTER_PASS: number = data.pass;
export const ALL_TWISTERS: Twister[] = data.twisters as Twister[];
export const TWISTERS: Twister[] = ALL_TWISTERS.filter((t) => t.proven);

/** The twisters of one language, shortest first. */
/** The twisters are written per scorer locale; English ones are en-US lines said in the learner's own accent. */
export const COURSE_LOCALE: Record<CourseId, Locale> = { en: 'en-US', yue: 'zh-HK', zh: 'zh-CN', fr: 'fr-FR', ja: 'ja-JP', ko: 'ko-KR', es: 'es-ES' };

/** A learner's best passing time per twister, kept on this device. */
export interface TwisterBest { ms: number; score: number; tries: number }
const bestKey = (profileId: string) => `wunder-tutor/twisters/${profileId}`;
export const loadBests = (profileId: string): Record<string, TwisterBest> => { try { return JSON.parse(localStorage.getItem(bestKey(profileId)) ?? '{}'); } catch { return {}; } };
export const saveBests = (profileId: string, bests: Record<string, TwisterBest>): void => { try { localStorage.setItem(bestKey(profileId), JSON.stringify(bests)); } catch { /* private mode */ } };

/**
 * The bonus round after a unit (Leslie, 2026-09-25: "shown as a bonus round (perhaps after a completed module)"): the
 * easiest twister of the course not yet passed, else the one with the slowest best time — something left to win.
 */
export function bonusTwister(course: CourseId, profileId: string): Twister | null {
  const list = twistersFor(COURSE_LOCALE[course]);
  if (!list.length) return null;
  const bests = loadBests(profileId);
  return list.find((t) => !bests[t.id]) ?? [...list].sort((a, b) => bests[b.id].ms - bests[a.id].ms)[0];
}

export const twistersFor = (locale: Locale): Twister[] => TWISTERS.filter((t) => t.locale === locale).sort((a, b) => a.level - b.level);
export const findTwister = (id: string): Twister | undefined => ALL_TWISTERS.find((t) => t.id === id);

/** A twister as a line to speak and be scored on. */
export const twisterItem = (t: Twister): SpeakItem => ({ id: `tw-${t.id}`, text: t.text, kind: 'sentence', picture: t.picture, focus: t.sounds, ...(t.locale === 'en-US' || t.locale === 'en-GB' ? {} : { lang: t.locale as SpeakItem['lang'] }) });

export interface TwisterResult { passed: boolean; ms: number; score: number; missed: string[] }

/** Said it right = the overall at or above the pass mark and no word missed; the time is the speech itself, not the pause before it. */
export const twisterResult = (assessment: Assessment, rec: Pick<Recording, 'analysis'>): TwisterResult => {
  const missed = assessment.words.filter((w) => w.errorType === 'omission').map((w) => w.word);
  const score = Math.round(assessment.overall);
  const ms = Math.max(200, Math.round(rec.analysis.speechMs || rec.analysis.durationMs));
  return { passed: score >= TWISTER_PASS && missed.length === 0, ms, score, missed };
};

export const formatMs = (ms: number): string => `${(ms / 1000).toFixed(2)} s`;
