import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasTeacherVoiceOverride, isTeacherVoice, selectedVoice, teacherVoiceChoice, setTeacherVoiceChoice, voiceConfigured, recommendedVoicePair, teacherVoicePair, teacherVoiceOrder, setTeacherVoicePair, resetTeacherVoicePair } from '../speech/teacherPreference';
import { TEACHER_VOICE_DEFAULTS } from '../speech/teacherVoiceDefaults';
import type { ApiHealth } from '../speech/health';
import type { Locale } from '../domain/types';
const KEY = 'wunder-tutor/teacher-voices-by-course';
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v) });
});
afterEach(() => { setTeacherVoiceChoice('auto'); vi.unstubAllGlobals(); });

describe('per-course teacher voice preferences', () => {
  it.each<Locale>(['en-US', 'en-GB', 'zh-CN', 'zh-HK', 'ja-JP', 'ko-KR', 'fr-FR', 'es-ES'])('inherits the owner default for %s', locale => {
    expect(teacherVoicePair(locale)).toEqual(locale.startsWith('zh') ? { primary: 'qwen', backup: 'chirp' } : { primary: 'chirp', backup: 'azure' });
    expect(hasTeacherVoiceOverride(locale)).toBe(false);
  });
  it('keeps a language override separate and shares it between English accents', () => {
    setTeacherVoicePair('en-US', { primary: 'qwen', backup: 'azure' });
    expect(teacherVoicePair('en-GB')).toEqual({ primary: 'qwen', backup: 'azure' });
    expect(teacherVoicePair('fr-FR')).toEqual({ primary: 'chirp', backup: 'azure' });
    expect(JSON.parse(storage.get(KEY)!)).toEqual({ en: { primary: 'qwen', backup: 'azure' } });
    expect(hasTeacherVoiceOverride('en-US')).toBe(true);
  });
  it('owner changes update inherited defaults without overwriting overrides, and reset resumes inheritance', () => {
    const original = { ...TEACHER_VOICE_DEFAULTS.en };
    try {
      setTeacherVoicePair('en-US', { primary: 'chirp', backup: 'qwen' });
      TEACHER_VOICE_DEFAULTS.en = { primary: 'azure', backup: 'chirp' };
      expect(teacherVoicePair('en-US')).toEqual({ primary: 'chirp', backup: 'qwen' });
      resetTeacherVoicePair('en-US');
      expect(teacherVoicePair('en-US')).toEqual(TEACHER_VOICE_DEFAULTS.en);
      TEACHER_VOICE_DEFAULTS.en = original;
      expect(teacherVoicePair('en-US')).toEqual(original);
      expect(hasTeacherVoiceOverride('en-US')).toBe(false);
    } finally { TEACHER_VOICE_DEFAULTS.en = original; }
  });
  it('preserves the legacy device-only opt-out until a course is reset', () => {
    expect(isTeacherVoice('chirp')).toBe(true); expect(isTeacherVoice('unknown')).toBe(false);
    setTeacherVoiceChoice('device'); expect(teacherVoiceChoice()).toBe('device');
    expect(teacherVoiceOrder('zh-HK')).toEqual(['device']);
    resetTeacherVoicePair('zh-HK');
    expect(teacherVoiceOrder('zh-HK')).toEqual(['qwen', 'chirp', 'device']);
    expect(teacherVoiceOrder('en-US')).toEqual(['device']);

  });
  it('skips an unavailable primary but never mutates the saved selection', () => {
    const h = { gemini: true, voiceProviders: { azure: true, qwen: false, chirp: true } } as ApiHealth;
    expect(selectedVoice(h, 'zh-HK')).toBe('chirp');
    expect(teacherVoicePair('zh-HK').primary).toBe('qwen');
    expect(voiceConfigured('qwen', h)).toBe(false);
    setTeacherVoicePair('zh-HK', { primary: 'qwen', backup: 'none' });
    expect(selectedVoice(h, 'zh-HK')).toBeUndefined();
  });
  it('rejects unsupported, duplicate and malformed settings', () => {
    for (const pair of [{ primary: 'gemini', backup: 'azure' }, { primary: 'qwen', backup: 'qwen' }, { primary: 'qwen', backup: 'bogus' }]) {
      setTeacherVoicePair('zh-HK', pair as any);
      expect(teacherVoicePair('zh-HK')).toEqual(recommendedVoicePair('zh-HK'));
    }
    storage.set(KEY, '{broken'); expect(teacherVoicePair('en-US')).toEqual(recommendedVoicePair('en-US'));
    storage.set(KEY, JSON.stringify({ en: { primary: 'bogus', backup: 'chirp' }, yue: { primary: 'gemini', backup: 'azure' }, fr: { primary: 'azure', backup: 'none' } }));
    expect(teacherVoicePair('zh-HK')).toEqual(recommendedVoicePair('zh-HK'));
    expect(teacherVoicePair('fr-FR')).toEqual({ primary: 'azure', backup: 'none' });
  });
  it.each(['azure', 'qwen', 'chirp'] as const)('old global %s does not override any course default', legacy => {
    storage.set('wunder-tutor/teacher-voice', legacy);
    const locales: Locale[] = ['en-US', 'en-GB', 'zh-CN', 'zh-HK', 'ja-JP', 'ko-KR', 'fr-FR', 'es-ES'];
    for (const locale of locales) {
      expect(teacherVoicePair(locale)).toEqual(recommendedVoicePair(locale));
      expect(hasTeacherVoiceOverride(locale)).toBe(false);
    }
    expect(teacherVoiceOrder('en-US')).toEqual(['chirp', 'azure', 'device']);
    expect(teacherVoiceOrder('zh-CN')).toEqual(['qwen', 'chirp', 'device']);
    expect(teacherVoiceOrder('zh-HK')).toEqual(['qwen', 'chirp', 'device']);
  });
  it('retains an explicit per-language Qwen override and no-backup choice beside an old global preference', () => {
    storage.set('wunder-tutor/teacher-voice', 'qwen');
    storage.set(KEY, JSON.stringify({ en: { primary: 'qwen', backup: 'none' }, yue: null }));
    expect(teacherVoicePair('en-US')).toEqual({ primary: 'qwen', backup: 'none' });
    expect(hasTeacherVoiceOverride('en-US')).toBe(true);
    expect(teacherVoicePair('zh-CN')).toEqual({ primary: 'qwen', backup: 'chirp' });
    expect(teacherVoicePair('zh-HK')).toEqual({ primary: 'qwen', backup: 'chirp' });
    resetTeacherVoicePair('en-US');
    expect(teacherVoicePair('en-US')).toEqual({ primary: 'chirp', backup: 'azure' });
    expect(hasTeacherVoiceOverride('en-US')).toBe(false);
  });
  it('keeps settings during a session when storage is unavailable', () => {
    teacherVoicePair('en-US');
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked'); }, setItem: () => { throw Error('blocked'); } });
    setTeacherVoicePair('en-US', { primary: 'azure', backup: 'device' });
    expect(teacherVoiceOrder('en-US')).toEqual(['azure', 'device']);
    resetTeacherVoicePair('en-US'); expect(teacherVoicePair('en-US')).toEqual(recommendedVoicePair('en-US'));
  });
});
