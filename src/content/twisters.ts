import type { Assessment, Locale, PhonemeId, SpeakItem } from '../domain/types';
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
