import { describe, expect, it, vi } from 'vitest';
import { qwenHost } from './qwen-endpoint.mjs';
import { createTeacherVoices } from './teacher-voices.mjs';
import { pcmToWav } from './tts.mjs';

const wav = pcmToWav(Buffer.alloc(480), 24000);
const audioUrl = 'https://dashscope-result-sg.oss-ap-southeast-1.aliyuncs.com/test.wav';
const req = { provider: 'qwen', text: 'Hello!', accent: 'en-US' };

describe('Qwen service selection', () => {
  it('resolves only supported services and preserves the existing default', () => {
    expect(qwenHost()).toBe('dashscope-intl.aliyuncs.com');
    expect(qwenHost('singapore')).toBe('dashscope-intl.aliyuncs.com');
    expect(qwenHost('beijing')).toBe('dashscope.aliyuncs.com');
    expect(qwenHost('qwencloud')).toBe('maas.qwencloudapi.com');
    for (const invalid of ['https://example.com', 'constructor', '__proto__', '', 'unknown']) {
      expect(qwenHost(invalid)).toBeUndefined();
      expect(createTeacherVoices({ qwenKey: 'fixture', qwenRegion: invalid }).providers.qwen).toBe(false);
    }
  });

  it.each([
    ['en-US', 'English'], ['en-GB', 'English'], ['zh-CN', 'Chinese'],
    ['ja-JP', 'Japanese'], ['ko-KR', 'Korean'], ['fr-FR', 'French'], ['es-ES', 'Spanish'],
  ])('synthesizes %s through QwenCloud and reuses audio for slow playback', async (accent, language) => {
    const fetchImpl = vi.fn(async url => url.endsWith('/generation')
      ? Response.json({ output: { audio: { url: audioUrl } } })
      : new Response(wav));
    const service = createTeacherVoices({ qwenKey: 'fixture', qwenRegion: 'qwencloud', fetchImpl });
    expect(service.providers.qwen).toBe(true);
    expect((await service.speak({ ...req, accent })).wav).toEqual(wav);
    expect((await service.speak({ ...req, accent, slow: true })).cached).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://maas.qwencloudapi.com/api/v1/services/aigc/multimodal-generation/generation');
    expect(init.redirect).toBe('error');
    expect(init.headers.Authorization).toBe('Bearer fixture');
    expect(JSON.parse(init.body)).toEqual({ model: 'qwen3-tts-flash', input: { text: req.text, voice: 'Cherry', language_type: language } });
    expect(fetchImpl.mock.calls[1][0]).toBe(audioUrl);
    expect(fetchImpl.mock.calls[1][1].headers).toBeUndefined();
    expect(fetchImpl.mock.calls[1][1].redirect).toBe('error');
  });

  it('keeps QwenCloud and regional audio separate in the shared cache', async () => {
    const entries = new Map();
    const cache = { get: async k => entries.get(k), put: async (k, v) => entries.set(k, v) };
    const fetchImpl = vi.fn(async url => url.endsWith('/generation')
      ? Response.json({ output: { audio: { url: audioUrl } } })
      : new Response(wav));
    for (const qwenRegion of ['singapore', 'beijing', 'qwencloud']) {
      const service = createTeacherVoices({ qwenKey: 'fixture', qwenRegion, fetchImpl, cache });
      expect((await service.speak(req)).cached).toBe(false);
    }
    expect(entries.size).toBe(3);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
  });

  it('never retries a refused QwenCloud key against another service', async () => {
    const fetchImpl = vi.fn(async () => new Response('', { status: 401 }));
    const service = createTeacherVoices({ qwenKey: 'fixture', qwenRegion: 'qwencloud', fetchImpl });
    await expect(service.speak(req)).rejects.toMatchObject({ code: 'qwen_unavailable' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toContain('https://maas.qwencloudapi.com/');
  });

  it('rejects untrusted audio locations returned by QwenCloud before fetching them', async () => {
    for (const url of ['https://private.example/a.wav', 'https://dashscope-result-sg.oss-ap-southeast-1.aliyuncs.com.evil.example/a.wav']) {
      const fetchImpl = vi.fn(async () => Response.json({ output: { audio: { url } } }));
      const service = createTeacherVoices({ qwenKey: 'fixture', qwenRegion: 'qwencloud', fetchImpl });
      await expect(service.speak(req)).rejects.toMatchObject({ code: 'voice_audio_url' });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });
});
