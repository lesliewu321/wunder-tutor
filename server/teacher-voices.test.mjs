import { describe, expect, it, vi } from 'vitest';
import { createTeacherVoices } from './teacher-voices.mjs';
import { pcmToWav } from './tts.mjs';
import { createApi } from './core.mjs';
const wav = pcmToWav(Buffer.alloc(480), 24000);
const req = { provider: 'azure', text: 'Hello!', accent: 'en-US' };
const azure = () => Promise.resolve({ pcm: Buffer.alloc(480), rate: 24000 });
describe('selected teacher voices', () => {
  it('serves Azure directly without a Gemini key, still behind the same access control', async () => {
    const api = createApi({ AZURE_SPEECH_KEY: 'test', AZURE_SPEECH_REGION: 'eastasia', BETA_ACCESS_CODE: 'test-code' }, { backupVoice: azure });
    const post = headers => api.handle(new Request('http://x/api/tts', { method: 'POST', headers, body: JSON.stringify(req) }));
    expect((await post()).status).toBe(401);
    const locked = await (await api.handle(new Request('http://x/api/health'))).json();
    expect(locked.voiceProviders.azure).toBe(false);
    const response = await post({ 'x-wunder-access': 'test-code' });
    expect(response.status).toBe(200); expect(response.headers.get('x-tts-voice')).toBe('azure');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(wav);
  });
  it('uses separate caches, coalesces duplicate requests, and never caches personal text', async () => {
    const call = vi.fn(azure), cache = new Map();
    const service = createTeacherVoices({ azure: call, cache: { get: async k => cache.get(k), put: async (k, v) => cache.set(k, v) } });
    await Promise.all([service.speak(req), service.speak(req)]); expect(call).toHaveBeenCalledTimes(1);
    expect((await service.speak(req)).cached).toBe(true);
    await service.speak({ ...req, slow: true }); expect(call).toHaveBeenCalledTimes(2);
    await service.speak({ ...req, ephemeral: true }); await service.speak({ ...req, ephemeral: true });
    expect(call).toHaveBeenCalledTimes(4); expect(cache.size).toBe(2);
    const next = createTeacherVoices({ azure: call, cache: { get: async k => cache.get(k) } });
    expect((await next.speak(req)).cached).toBe(true); expect(call).toHaveBeenCalledTimes(4);
  });
  it('sends Chirp the right voice and Mandarin locale and returns decoded WAV', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ audioContent: wav.toString('base64') }));
    const service = createTeacherVoices({ chirpKey: 'test', fetchImpl });
    for (const locale of ['en-US', 'en-GB', 'zh-CN', 'fr-FR', 'ja-JP', 'ko-KR', 'es-ES']) {
      const got = await service.speak({ ...req, provider: 'chirp', accent: locale, slow: true });
      expect(got.wav).toEqual(wav);
      const [url, init] = fetchImpl.mock.calls[fetchImpl.mock.calls.length - 1];
      expect(url).toBe('https://texttospeech.googleapis.com/v1/text:synthesize');
      const body = JSON.parse(init.body); const language = locale === 'zh-CN' ? 'cmn-CN' : locale;
      expect(body.voice).toEqual({ languageCode: language, name: language + '-Chirp3-HD-Aoede' });
      expect(body.audioConfig.speakingRate).toBe(0.65);
    }
  });
  it('uses Qwen Singapore by default, fetches only its audio URL and never forwards credentials there', async () => {
    const fetchImpl = vi.fn(async (url) => url.includes('/generation') ? Response.json({ output: { audio: { url: 'http://dashscope-result-sg.oss-ap-southeast-1.aliyuncs.com/test.wav' } } }) : new Response(wav));
    const service = createTeacherVoices({ qwenKey: 'test', fetchImpl });
    await service.speak({ ...req, provider: 'qwen', accent: 'ja-JP' });
    expect(fetchImpl.mock.calls[0][0]).toContain('dashscope-intl.aliyuncs.com');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).input.language_type).toBe('Japanese');
    expect(fetchImpl.mock.calls[1][0]).toMatch(/^https:/);
    expect(fetchImpl.mock.calls[1][1].headers).toBeUndefined();
    expect(fetchImpl.mock.calls[1][1].redirect).toBe('error');
    const unsafe = createTeacherVoices({ qwenKey: 'test', fetchImpl: async () => Response.json({ output: { audio: { url: 'https://private.example/a.wav' } } }) });
    await expect(unsafe.speak({ ...req, provider: 'qwen' })).rejects.toMatchObject({ code: 'voice_audio_url' });
  });
  it('rejects unknown, unconfigured, oversized and unsupported requests before making a paid call', async () => {
    const call = vi.fn(azure); const service = createTeacherVoices({ azure: call, maxGenerationsPerWindow: 1 });
    for (const [input, code] of [[{ ...req, provider: 'unknown' }, 'invalid_voice_provider'], [{ ...req, provider: 'qwen' }, 'voice_not_configured'], [{ ...req, text: 'a'.repeat(201) }, 'text_too_long'], [{ ...req, accent: 'nope' }, 'invalid_locale']]) await expect(service.speak(input)).rejects.toMatchObject({ code });
    expect(call).not.toHaveBeenCalled();
    await service.speak(req);
    await expect(service.speak({ ...req, text: 'Goodbye!' })).rejects.toMatchObject({ code: 'tts_budget_exceeded' });
    expect((await service.speak(req)).cached).toBe(true);
  });
});
