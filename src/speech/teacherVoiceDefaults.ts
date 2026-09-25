import type { CourseId } from '../domain/types';
import type { VoicePair } from './teacherPreference';

/** Owner-managed defaults. Edit this table and deploy; saved user overrides stay unchanged. */
export const TEACHER_VOICE_DEFAULTS: Record<CourseId, VoicePair> = {
  en: { primary: 'chirp', backup: 'azure' },
  zh: { primary: 'qwen', backup: 'chirp' },
  yue: { primary: 'qwen', backup: 'chirp' },
  ja: { primary: 'chirp', backup: 'azure' },
  ko: { primary: 'chirp', backup: 'azure' },
  fr: { primary: 'chirp', backup: 'azure' },
  es: { primary: 'chirp', backup: 'azure' },
};
