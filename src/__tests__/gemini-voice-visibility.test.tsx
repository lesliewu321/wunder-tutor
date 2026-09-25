import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CourseId, Locale } from '../domain/types';
import type { ApiHealth } from '../speech/health';
import { LANGUAGES, loadLanguage, setLanguage } from '../i18n';
import { TeacherVoiceSelect } from '../features/profile/TeacherVoiceSelect';
import { hasTeacherVoiceOverride, recommendedVoicePair, selectedVoice, setTeacherVoicePair, teacherVoiceChoice, teacherVoiceOrder, teacherVoicePair } from '../speech/teacherPreference';

const profile = vi.hoisted(() => ({ course: 'en' as CourseId, accent: 'en-US' as 'en-US' | 'en-GB', band: 'adult' }));
vi.mock('../state/store', () => ({ useActiveProfile: () => profile, useStore: () => undefined }));
const courses: [CourseId, Locale][] = [['en', 'en-US'], ['zh', 'zh-CN'], ['yue', 'zh-HK'], ['ja', 'ja-JP'], ['ko', 'ko-KR'], ['fr', 'fr-FR'], ['es', 'es-ES']];
const legacyKey = 'wunder-tutor/teacher-voice';
const pairsKey = 'wunder-tutor/teacher-voices-by-course';
const health: ApiHealth = { reached: true, authorized: true, needsCode: true, codeSet: true, azure: true, claude: true, gemini: true, read: true, ttsVersion: 'test', voiceProviders: { azure: true, qwen: true, chirp: true, gemini: true } };
let storage: Map<string, string>;
beforeAll(async () => { await Promise.all(LANGUAGES.map(l => loadLanguage(l.id))); });
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) });
});
afterEach(() => { setLanguage('en'); vi.unstubAllGlobals(); });

describe('Gemini stays out of learner voice settings', () => {
  it.each(LANGUAGES)('$id hides Gemini in both selectors for every course, even when Gemini is configured', ({ id }) => {
    setLanguage(id);
    for (const [course] of courses) {
      profile.course = course;
      const html = renderToStaticMarkup(<TeacherVoiceSelect services={health} onRefresh={async () => {}} />);
      expect(html).not.toContain('value="gemini"');
      for (const provider of ['azure', 'qwen', 'chirp', 'device']) {
        expect(html.match(new RegExp('value="' + provider + '"', 'g'))).toHaveLength(2);
      }
    }
  });
  it.each(courses)('%s restores app defaults for a legacy Gemini choice', (_course, locale) => {
    storage.set(legacyKey, 'gemini');
    expect(teacherVoiceChoice()).toBe('auto');
    expect(teacherVoicePair(locale)).toEqual(recommendedVoicePair(locale));
    expect(hasTeacherVoiceOverride(locale)).toBe(false);
    expect(teacherVoiceOrder(locale)).not.toContain('gemini');
    expect(selectedVoice(health, locale)).toBe(recommendedVoicePair(locale).primary);
  });
  it.each(courses)('%s restores defaults when a saved primary or backup is Gemini', (course, locale) => {
    for (const pair of [{ primary: 'gemini', backup: 'chirp' }, { primary: 'azure', backup: 'gemini' }]) {
      storage.set(pairsKey, JSON.stringify({ [course]: pair }));
      expect(teacherVoicePair(locale)).toEqual(recommendedVoicePair(locale));
      expect(hasTeacherVoiceOverride(locale)).toBe(false);
      expect(teacherVoiceOrder(locale)).not.toContain('gemini');
    }
  });
  it('preserves a valid per-course choice even with an old global Gemini preference', () => {
    storage.set(legacyKey, 'gemini');
    setTeacherVoicePair('zh-HK', { primary: 'azure', backup: 'chirp' });
    expect(teacherVoicePair('zh-HK')).toEqual({ primary: 'azure', backup: 'chirp' });
    expect(hasTeacherVoiceOverride('zh-HK')).toBe(true);
  });
  it('preserves a deliberate device-only preference', () => {
    storage.set(legacyKey, 'device');
    expect(teacherVoiceOrder('en-US')).toEqual(['device']);
    expect(selectedVoice(health, 'en-US')).toBe('device');
  });
  it('rejects new Gemini pair preferences without replacing an existing choice', () => {
    setTeacherVoicePair('en-US', { primary: 'azure', backup: 'none' });
    setTeacherVoicePair('en-US', { primary: 'gemini', backup: 'chirp' });
    expect(teacherVoicePair('en-US')).toEqual({ primary: 'azure', backup: 'none' });
  });
});
