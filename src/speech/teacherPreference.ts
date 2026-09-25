import type { CourseId, Locale } from '../domain/types';
import type { ApiHealth } from './health';
import { TEACHER_VOICE_DEFAULTS } from './teacherVoiceDefaults';
// Gemini remains an internal provider for the onboarding sample; it is not a learner voice choice.
// Old Gemini preferences fail validation and inherit the current app defaults. Scan is independent.
export const TEACHER_VOICES = ['auto', 'azure', 'chirp', 'qwen', 'device'] as const;
export type TeacherVoiceChoice = typeof TEACHER_VOICES[number] | 'gemini';
export type TeacherVoice = Exclude<TeacherVoiceChoice, 'auto'>;
export type CloudVoice = Exclude<TeacherVoice, 'device'>;
export type VoicePair = { primary: TeacherVoice; backup: TeacherVoice | 'none' };
const KEY = 'wunder-tutor/teacher-voice';
const PAIRS_KEY = 'wunder-tutor/teacher-voices-by-course';
const COURSES: CourseId[] = ['en', 'zh', 'yue', 'ja', 'ko', 'fr', 'es'];
// null explicitly inherits owner defaults, including after resetting a legacy global choice.
type SavedPairs = Partial<Record<CourseId, VoicePair | null>>;
let memory: TeacherVoiceChoice = 'auto';
let pairsMemory: SavedPairs = {};
let pendingPairs: SavedPairs | null = null;
export const isTeacherVoice = (v: unknown): v is TeacherVoiceChoice => TEACHER_VOICES.some(x => x === v);
export const isPlaybackVoice = (v: unknown): v is TeacherVoice => v !== 'auto' && isTeacherVoice(v);
export const voiceCourse = (locale: Locale): CourseId => ({ 'en-US': 'en', 'en-GB': 'en', 'zh-CN': 'zh', 'zh-HK': 'yue', 'ja-JP': 'ja', 'ko-KR': 'ko', 'fr-FR': 'fr', 'es-ES': 'es' } as const)[locale];
export const voiceSupports = (id: TeacherVoiceChoice, locale: Locale): boolean => locale !== 'zh-HK' || id !== 'gemini';
export const voiceConfigured = (id: TeacherVoiceChoice, h: ApiHealth | null): boolean =>
  id === 'auto' || id === 'device' || !!(h?.voiceProviders?.[id] ?? (id === 'gemini' && h?.gemini));

/** Read the old whole-device preference only to preserve an explicit device-only opt-out. */
export function teacherVoiceChoice(): TeacherVoiceChoice {
  try { const saved = localStorage.getItem(KEY); return isTeacherVoice(saved) ? saved : 'auto'; } catch { return memory; }
}
export function setTeacherVoiceChoice(choice: TeacherVoiceChoice): void {
  if (!isTeacherVoice(choice)) return;
  memory = choice;
  try { localStorage.setItem(KEY, choice); } catch { /* session only */ }
}
export const recommendedVoicePair = (locale: Locale): VoicePair => ({ ...TEACHER_VOICE_DEFAULTS[voiceCourse(locale)] });
function validPair(value: unknown, course: CourseId): value is VoicePair {
  if (!value || typeof value !== 'object') return false;
  const p = value as VoicePair;
  return isPlaybackVoice(p.primary) && (p.backup === 'none' || isPlaybackVoice(p.backup)) && p.primary !== p.backup
    && (course !== 'yue' || (p.primary !== 'gemini' && p.backup !== 'gemini'));
}
function savedPairs(): SavedPairs {
  if (pendingPairs) return pendingPairs;
  let stored: string | null;
  try { stored = localStorage.getItem(PAIRS_KEY); } catch { return pairsMemory; }
  const clean: SavedPairs = {};
  try {
    const raw: unknown = JSON.parse(stored ?? '{}');
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) for (const course of COURSES) {
      const pair = (raw as Record<string, unknown>)[course];
      if (pair === null) clean[course] = null;
      else if (validPair(pair, course)) clean[course] = { primary: pair.primary, backup: pair.backup };
    }
  } catch { /* malformed storage restores defaults */ }
  pairsMemory = clean;
  return pairsMemory;
}
function legacyDevicePair(): VoicePair | undefined {
  // A cloud choice predating per-course settings must not override every language's defaults.
  // Preserve device-only as an opt-out from sending text to cloud services until explicitly reset.
  return teacherVoiceChoice() === 'device' ? { primary: 'device', backup: 'none' } : undefined;
}
export function hasTeacherVoiceOverride(locale: Locale): boolean {
  const saved = savedPairs()[voiceCourse(locale)];
  return saved === undefined ? !!legacyDevicePair() : saved !== null;
}
export function teacherVoicePair(locale: Locale): VoicePair {
  const saved = savedPairs()[voiceCourse(locale)];
  return saved ? { ...saved } : saved === null ? recommendedVoicePair(locale) : legacyDevicePair() ?? recommendedVoicePair(locale);
}
function persistPair(locale: Locale, pair: VoicePair | null): void {
  pairsMemory = { ...savedPairs(), [voiceCourse(locale)]: pair && { ...pair } };
  try { localStorage.setItem(PAIRS_KEY, JSON.stringify(pairsMemory)); pendingPairs = null; }
  catch { pendingPairs = pairsMemory; }
}
export function setTeacherVoicePair(locale: Locale, pair: VoicePair): void {
  if (validPair(pair, voiceCourse(locale))) persistPair(locale, pair);
}
/** Store inheritance, not a copy of today's defaults, so later owner changes are picked up. */
export function resetTeacherVoicePair(locale: Locale): void { persistPair(locale, null); }
/** Only primary and backup, then same-language device speech. No backup means primary only. */
export function teacherVoiceOrder(locale: Locale): TeacherVoice[] {
  const pair = teacherVoicePair(locale);
  return [...new Set<TeacherVoice>([pair.primary, ...(pair.backup === 'none' ? [] : [pair.backup, 'device'] as TeacherVoice[])])];
}
export const automaticVoices = (h: ApiHealth, locale: Locale = 'en-US'): CloudVoice[] => {
  const pair = recommendedVoicePair(locale);
  return [pair.primary, pair.backup].filter((id): id is CloudVoice => id !== 'none' && id !== 'device' && voiceConfigured(id, h));
};
export function selectedVoice(h: ApiHealth, locale: Locale = 'en-US'): TeacherVoice | undefined {
  return teacherVoiceOrder(locale).find(id => voiceConfigured(id, h));
}
