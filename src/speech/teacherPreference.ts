import type { ApiHealth } from './health';
export const TEACHER_VOICES = ['auto', 'azure', 'qwen', 'chirp', 'gemini', 'device'] as const;
export type TeacherVoiceChoice = typeof TEACHER_VOICES[number];
export type CloudVoice = Exclude<TeacherVoiceChoice, 'auto' | 'device'>;
const KEY = 'wunder-tutor/teacher-voice';
let memory: TeacherVoiceChoice = 'auto';
export const isTeacherVoice = (v: unknown): v is TeacherVoiceChoice => TEACHER_VOICES.some(x => x === v);
export function teacherVoiceChoice(): TeacherVoiceChoice {
  try { const saved = localStorage.getItem(KEY); if (isTeacherVoice(saved)) return saved; } catch { /* private mode */ }
  return memory;
}
export function setTeacherVoiceChoice(choice: TeacherVoiceChoice): void {
  if (!isTeacherVoice(choice)) return;
  memory = choice;
  try { localStorage.setItem(KEY, choice); } catch { /* session only */ }
}
export const voiceConfigured = (id: TeacherVoiceChoice, h: ApiHealth | null): boolean =>
  id === 'auto' || id === 'device' || !!(h?.voiceProviders?.[id] ?? (id === 'gemini' && h?.gemini));
export function selectedVoice(h: ApiHealth): Exclude<TeacherVoiceChoice, 'auto'> {
  const choice = teacherVoiceChoice();
  return choice !== 'auto' ? choice : h.gemini ? 'gemini' : h.voiceProviders?.azure ? 'azure' : 'device';
}
