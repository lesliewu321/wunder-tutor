import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiHealth } from '../speech/health';
import type { Locale } from '../domain/types';

const locales: Locale[] = ['en-US', 'en-GB', 'zh-CN', 'zh-HK', 'ja-JP', 'ko-KR', 'fr-FR', 'es-ES'];
const providers = ['gemini', 'azure', 'chirp', 'qwen'] as const;
const wav = () => new Response(new Uint8Array(100), { headers: { 'content-type': 'audio/wav' } });
const health = (mask = 15) => ({ reached: true, authorized: true, gemini: !!(mask & 1), ttsVersion: 'gauntlet', voiceProviders: Object.fromEntries(providers.map((p, i) => [p, !!(mask & (1 << i))])) } as ApiHealth);
async function setup(mask = 15, reply: (body: any) => Promise<Response> = async () => wav()) {
  const calls: any[] = [], played: any[] = [];
  vi.doMock('../speech/health', () => ({ apiHealth: async () => health(mask), knownHealth: () => health(mask), apiFetch: async (_: string, init: RequestInit) => { const b = JSON.parse(String(init.body)); calls.push(b); return reply(b); } }));
  vi.doMock('../speech/zh/teacherCheck', () => ({ teacherToneOk: async () => true }));
  vi.stubGlobal('Audio', class {
    src = ''; paused = true; playbackRate = 1; preservesPitch = false; onended?: () => void;
    play() { this.paused = false; played.push({ rate: this.playbackRate, pitch: this.preservesPitch }); queueMicrotask(() => this.onended?.()); return Promise.resolve(); }
    pause() { this.paused = true; }
  });
  const pref = await import('../speech/teacherPreference'); pref.setTeacherVoiceChoice('auto');
  const { voice } = await import('../speech/voice');
  return { voice, pref, calls, played };
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); vi.doUnmock('../speech/health'); vi.doUnmock('../speech/zh/teacherCheck'); });

describe('gauntlet: teacher voice configuration matrix', () => {
  it.each(Array.from({ length: 16 }, (_, i) => i))('all provider choices with availability mask %i', async mask => {
    const { selectedVoice, setTeacherVoiceChoice } = await import('../speech/teacherPreference');
    setTeacherVoiceChoice('auto');
    expect(selectedVoice(health(mask))).toBe(providers.find((_, i) => mask & (1 << i)) ?? 'device');
    for (const choice of [...providers, 'device'] as const) { setTeacherVoiceChoice(choice); expect(selectedVoice(health(mask))).toBe(choice); }
  });
  it.each(locales.flatMap(accent => providers.filter(p => accent !== 'zh-HK' || p !== 'gemini').flatMap(provider => [false, true].map(slow => ({ accent, provider, slow })))))('$provider / $accent / slow=$slow coalesces rapid taps and replays its own cache', async ({ accent, provider, slow }) => {
    const s = await setup(); s.pref.setTeacherVoiceChoice(provider);
    await Promise.all(Array.from({ length: 5 }, () => s.voice.speak('sample', { accent, slow })));
    await s.voice.speak('sample', { accent, slow });
    expect(s.calls).toHaveLength(1); expect(s.calls[0]).toMatchObject({ provider, accent, slow });
    expect(s.played).toHaveLength(2); expect(s.played[0]).toEqual({ rate: provider === 'qwen' && slow ? .65 : 1, pitch: true });
  });
  it.each(locales)('automatic recovers across every cloud provider for %s', async accent => {
    const s = await setup(15, async b => b.provider === 'qwen' ? wav() : Response.json({ error: 'provider_unavailable' }, { status: 502 }));
    await expect(s.voice.speak('sample', { accent })).resolves.toBeUndefined();
    expect(s.calls.map(c => c.provider)).toEqual(accent === 'zh-HK' ? ['azure', 'chirp', 'qwen'] : providers); expect(s.played).toHaveLength(1);
  });
  it.each(providers)('explicit %s keeps identity on failure; retry can recover', async provider => {
    let fail = true;
    const s = await setup(15, async () => fail ? Response.json({ error: 'provider_unavailable' }, { status: 502 }) : wav());
    s.pref.setTeacherVoiceChoice(provider);
    await expect(s.voice.speak('sample', { accent: 'en-US' })).rejects.toMatchObject({ reason: 'take' });
    fail = false; await s.voice.speak('sample', { accent: 'en-US' });
    expect(s.calls.map(c => c.provider)).toEqual([provider, provider]);
  });
  it.each(['daily_limit', 'rate_limited', 'unauthorized', 'tts_budget_exceeded'])('does not multiply paid requests after %s', async code => {
    const s = await setup(15, async () => Response.json({ error: code }, { status: code === 'unauthorized' ? 401 : 429 }));
    await expect(s.voice.speak('sample', { accent: 'en-US' })).rejects.toMatchObject({ code });
    expect(s.calls).toHaveLength(1);
  });
  it('stop discards delayed audio and settles the pending caller promptly', async () => {
    let deliver!: (r: Response) => void;
    const s = await setup(15, () => new Promise(r => { deliver = r; }));
    let settled = false; const job = s.voice.speak('sample', { accent: 'en-US' }).then(() => { settled = true; });
    await vi.waitFor(() => expect(s.calls).toHaveLength(1));
    s.voice.stop(); await vi.waitFor(() => expect(settled).toBe(true), { timeout: 100 });
    deliver(wav()); await job; expect(s.played).toHaveLength(0);
  });
  it('device speech refuses a wrong-language voice', async () => {
    const speak = vi.fn();
    const synth = { getVoices: () => [{ lang: 'en-US', name: 'English' }], speak, cancel: vi.fn(), addEventListener: vi.fn() };
    vi.stubGlobal('window', { speechSynthesis: synth, setTimeout }); vi.stubGlobal('speechSynthesis', synth);
    vi.stubGlobal('SpeechSynthesisUtterance', class {});
    const s = await setup(0); s.pref.setTeacherVoiceChoice('device');
    await expect(s.voice.speak('你好', { accent: 'zh-CN' })).rejects.toMatchObject({ reason: 'playback' });
    expect(speak).not.toHaveBeenCalled();
  });
  it('refuses explicit Gemini for Cantonese without making a paid request', async () => {
    const s=await setup();s.pref.setTeacherVoiceChoice('gemini');
    await expect(s.voice.speak('唔該',{accent:'zh-HK'})).rejects.toMatchObject({code:'voice_locale_unavailable'});
    expect(s.calls).toHaveLength(0);
  });
  it('Cantonese device fallback refuses a Mandarin-only installation', async () => {
    const speak=vi.fn(), synth={getVoices:()=>[{lang:'zh-CN',name:'Mandarin'}],speak,cancel:vi.fn(),addEventListener:vi.fn()};
    vi.stubGlobal('window',{speechSynthesis:synth,setTimeout});vi.stubGlobal('speechSynthesis',synth);vi.stubGlobal('SpeechSynthesisUtterance',class {});
    const s=await setup(0);s.pref.setTeacherVoiceChoice('device');
    await expect(s.voice.speak('唔該',{accent:'zh-HK'})).rejects.toMatchObject({code:'device_language_unavailable'});
    expect(speak).not.toHaveBeenCalled();
  });
  it('stalled media playback reports failure and releases the player', async () => {
    vi.useFakeTimers();await setup();
    vi.stubGlobal('Audio',class {src='';paused=false;play(){return Promise.resolve();}pause(){this.paused=true;}});
    const {playBlob}=await import('../speech/voice');
    const check=expect(playBlob(new Blob(['fixture']))).rejects.toMatchObject({reason:'playback'});
    await vi.advanceTimersByTimeAsync(120000);await check;
  });
  it('stopping device speech clears its watchdog before another utterance', async () => {
    vi.useFakeTimers();
    const cancel=vi.fn(),synth={getVoices:()=>[{lang:'zh-HK',name:'Hong Kong'}],speak:vi.fn(),cancel,addEventListener:vi.fn()};
    vi.stubGlobal('window',{speechSynthesis:synth,setTimeout});vi.stubGlobal('speechSynthesis',synth);vi.stubGlobal('SpeechSynthesisUtterance',class {});
    const s=await setup(0);s.pref.setTeacherVoiceChoice('device');
    const job=s.voice.speak('唔該',{accent:'zh-HK'});s.voice.stop();await job;
    const stopped=cancel.mock.calls.length;await vi.advanceTimersByTimeAsync(10000);
    expect(cancel).toHaveBeenCalledTimes(stopped);
  });

});
