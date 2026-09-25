import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTeacherVoice, selectedVoice, teacherVoiceChoice, setTeacherVoiceChoice, voiceConfigured } from '../speech/teacherPreference';
import type { ApiHealth } from '../speech/health';
afterEach(() => { setTeacherVoiceChoice('auto'); vi.unstubAllGlobals(); });
describe('teacher voice preferences', () => {
  it('persists only recognised choices on this device', () => {
    const storage = new Map(); vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k), setItem: (k: string, v: string) => storage.set(k, v) });
    expect(isTeacherVoice('chirp')).toBe(true); expect(isTeacherVoice('unknown')).toBe(false);
    setTeacherVoiceChoice('qwen'); expect(teacherVoiceChoice()).toBe('qwen'); expect([...storage.values()]).toEqual(['qwen']);
  });
  it('keeps explicit choices and auto-selects only configured voices', () => {
    const h = { gemini: false, voiceProviders: { azure: true, qwen: false, chirp: true } } as ApiHealth;
    setTeacherVoiceChoice('auto'); expect(selectedVoice(h)).toBe('azure');
    expect(selectedVoice({ ...h, gemini: true })).toBe('gemini');
    setTeacherVoiceChoice('qwen'); expect(selectedVoice(h)).toBe('qwen'); expect(voiceConfigured('qwen', h)).toBe(false);
    setTeacherVoiceChoice('device'); expect(selectedVoice(h)).toBe('device');
  });
});
