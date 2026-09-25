import { describe, expect, it, vi } from 'vitest';
import { createTeacherVoices } from './teacher-voices.mjs';
import { pcmToWav } from './tts.mjs';
const wav = pcmToWav(Buffer.alloc(480), 24000);
const langs = { 'en-US': 'English', 'en-GB': 'English', 'zh-CN': 'Chinese', 'zh-HK': 'Auto', 'ja-JP': 'Japanese', 'ko-KR': 'Korean', 'fr-FR': 'French', 'es-ES': 'Spanish' };
const providers = ['azure', 'chirp', 'qwen'];
const samples = { 'en-US': 'Hello!', 'en-GB': 'Hello!', 'zh-CN': '你好！', 'zh-HK': '唔該！', 'ja-JP': 'こんにちは。', 'ko-KR': '안녕하세요.', 'fr-FR': 'Bonjour !', 'es-ES': '¡Hola!' };
describe('gauntlet: real provider adapters with controlled upstreams', () => {
  for (const provider of providers) for (const accent of Object.keys(langs)) for (const slow of [false, true]) for (const region of provider === 'qwen' ? ['singapore', 'beijing', 'qwencloud'] : ['singapore']) {
    it(`${provider}/${accent}/slow=${slow}/${region}`, async () => {
      const azure = vi.fn(async () => ({ pcm: Buffer.alloc(480), rate: 24000 }));
      const fetchImpl = vi.fn(async (url, init) => {
        if (url.includes('googleapis.com')) { const b = JSON.parse(init.body); const code = accent === 'zh-CN' ? 'cmn-CN' : accent === 'zh-HK' ? 'yue-HK' : accent; expect(b.voice.name).toBe(code + '-Chirp3-HD-Aoede'); expect(b.input.text).toBe(samples[accent]); expect(b.audioConfig.speakingRate).toBe(slow ? .65 : 1); return Response.json({ audioContent: wav.toString('base64') }); }
        if (url.includes('/generation')) { expect(url).toContain(region === 'qwencloud' ? 'https://maas.qwencloudapi.com/' : region === 'beijing' ? 'https://dashscope.aliyuncs.com/' : 'https://dashscope-intl.aliyuncs.com/'); const b = JSON.parse(init.body); expect(b.input.language_type).toBe(langs[accent]); expect(b.input.voice).toBe(accent === 'zh-HK' ? 'Kiki' : 'Cherry'); expect(b.input.text).toBe(samples[accent]); return Response.json({ output: { audio: { url: 'https://dashscope-result-sg.oss-ap-southeast-1.aliyuncs.com/test.wav' } } }); }
        expect(init.headers).toBeUndefined(); expect(init.redirect).toBe('manual'); return new Response(wav);
      });
      const cache = new Map();
      const s = createTeacherVoices({ azure, chirpKey: 'fixture', qwenKey: 'fixture', qwenRegion: region, fetchImpl, cache: { get: async k => cache.get(k), put: async (k,v) => cache.set(k,v) } });
      const req = { provider, accent, slow, text: samples[accent] };
      const results = await Promise.all(Array.from({ length: 6 }, () => s.speak(req)));
      expect(results.every(r => Buffer.compare(r.wav, wav) === 0)).toBe(true);
      expect(provider === 'azure' ? azure.mock.calls.length : fetchImpl.mock.calls.length).toBe(provider === 'qwen' ? 2 : 1);
      expect((await s.speak(req)).cached).toBe(true); expect(cache.size).toBe(1);
      if (provider === 'qwen') expect((await s.speak({ ...req, slow: !slow })).cached).toBe(true);
    });
  }
  it.each(providers)('%s survives cache read and write failures', async provider => {
    const s = createTeacherVoices({ azure: async () => ({ pcm: Buffer.alloc(480), rate: 24000 }), chirpKey: 'fixture', qwenKey: 'fixture', fetchImpl: async url => url.includes('googleapis') ? Response.json({ audioContent: wav.toString('base64') }) : url.includes('/generation') ? Response.json({ output: { audio: { url: 'https://dashscope-result-sg.oss-ap-southeast-1.aliyuncs.com/test.wav' } } }) : new Response(wav), cache: { get: async () => { throw Error('KV unavailable'); }, put: async () => { throw Error('KV full'); } } });
    expect((await s.speak({ provider, text: 'Hello', accent: 'en-US' })).wav).toEqual(wav);
  });
});
