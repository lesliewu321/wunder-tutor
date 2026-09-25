// Explicit teacher-voice providers. Keys remain on the server; all outputs are cached separately.
import { createHash } from 'node:crypto';
import { BACKUP_VOICES, readWav } from './azure-tts.mjs';
import { MAX_TTS_CHARS, pcmToWav, TtsError } from './tts.mjs';
import { qwenHost as resolveQwenHost } from './qwen-endpoint.mjs';
const LANGUAGES = { 'en-US': 'English', 'en-GB': 'English', 'zh-CN': 'Chinese', 'zh-HK': 'Auto', 'ja-JP': 'Japanese', 'ko-KR': 'Korean', 'fr-FR': 'French', 'es-ES': 'Spanish' };
const MAX_AUDIO = 8 * 1024 * 1024;
async function audioBytes(response) {
  if (!response.ok) throw new TtsError('voice_audio_failed');
  if (Number(response.headers.get('content-length')) > MAX_AUDIO) throw new TtsError('voice_audio_too_large');
  const reader = response.body?.getReader();
  if (!reader) throw new TtsError('voice_no_audio');
  const chunks = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > MAX_AUDIO) throw new TtsError('voice_audio_too_large'); chunks.push(Buffer.from(value)); } }
  finally { await reader.cancel().catch(() => {}); }
  return Buffer.concat(chunks);
}
export function createTeacherVoices({ azure, qwenKey = '', qwenRegion = 'singapore', chirpKey = '', cache, fetchImpl = fetch, maxGenerationsPerWindow = 120, windowMs = 600000 }) {
  const qwenHost = resolveQwenHost(qwenRegion);
  const providers = { azure: !!azure, qwen: !!qwenKey && !!qwenHost, chirp: !!chirpKey };
  const versions = { azure: 'azure-neural-v1/' + Object.values(BACKUP_VOICES).join(','), qwen: 'qwen3-tts-flash/Cherry-Kiki/' + qwenRegion, chirp: 'chirp3-hd/Aoede' };
  const inflight = new Map(); const memory = new Map();
  let start = Date.now(), generated = 0;
  async function generate(provider, req) {
    if (Date.now() - start >= windowMs) { start = Date.now(); generated = 0; }
    if (generated >= maxGenerationsPerWindow) throw new TtsError('tts_budget_exceeded', 429);
    generated++;
    if (provider === 'azure') { const out = await azure(req); return pcmToWav(out.pcm, out.rate); }
    const signal = AbortSignal.timeout(25000);
    let wav;
    if (provider === 'chirp') {
      const locale = req.accent === 'zh-CN' ? 'cmn-CN' : req.accent === 'zh-HK' ? 'yue-HK' : req.accent;
      const res = await fetchImpl('https://texttospeech.googleapis.com/v1/text:synthesize', {
        method: 'POST', signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chirpKey },
        body: JSON.stringify({ input: { text: req.text }, voice: { languageCode: locale, name: locale + '-Chirp3-HD-Aoede' }, audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: 24000, speakingRate: req.slow ? 0.65 : 1 } }),
      });
      if (!res.ok) throw new TtsError('chirp_unavailable', res.status === 429 ? 429 : 502);
      const data = await res.json();
      if (typeof data.audioContent !== 'string' || data.audioContent.length > MAX_AUDIO * 1.4) throw new TtsError('voice_no_audio');
      wav = Buffer.from(data.audioContent, 'base64');
    } else {
      const res = await fetchImpl('https://' + qwenHost + '/api/v1/services/aigc/multimodal-generation/generation', {
        method: 'POST', signal, redirect: 'error', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + qwenKey },
        body: JSON.stringify({ model: 'qwen3-tts-flash', input: { text: req.text, voice: req.accent === 'zh-HK' ? 'Kiki' : 'Cherry', language_type: LANGUAGES[req.accent] } }),
      });
      if (!res.ok) throw new TtsError('qwen_unavailable', res.status === 429 ? 429 : 502);
      const data = await res.json();
      let url; try { url = new URL(data.output?.audio?.url); } catch { throw new TtsError('voice_no_audio'); }
      // Only the provider's signed OSS audio URL is fetched; never forward API credentials or follow redirects.
      if (!/^dashscope[-a-z0-9]*\.oss[-a-z0-9]*\.aliyuncs\.com$/.test(url.hostname) || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new TtsError('voice_audio_url');
      url.protocol = 'https:';
      wav = await audioBytes(await fetchImpl(url.toString(), { signal, redirect: 'error' }));
    }
    const out = readWav(wav);
    if (!out.pcm.length) throw new TtsError('voice_no_audio');
    return wav;
  }
  async function speak(input) {
    const provider = input?.provider;
    if (!Object.hasOwn(providers, provider)) throw new TtsError('invalid_voice_provider', 400);
    if (!providers[provider]) throw new TtsError('voice_not_configured', 503);
    const text = typeof input.text === 'string' ? input.text.replace(/\s+/g, ' ').trim() : '';
    if (!text) throw new TtsError('missing_text', 400);
    if (text.length > MAX_TTS_CHARS) throw new TtsError('text_too_long', 400);
    if (!Object.hasOwn(LANGUAGES, input.accent)) throw new TtsError('invalid_locale', 400);
    const req = { text, accent: input.accent, slow: provider === 'qwen' ? false : !!input.slow };
    const key = 'selected-' + createHash('sha256').update(JSON.stringify([provider, versions[provider], req])).digest('hex');
    const result = (wav, cached) => ({ wav, cached, voice: provider });
    // Learner-authored text is never persisted in a shared or process cache.
    if (input.ephemeral) return result(await generate(provider, req), false);
    let hit = memory.get(key);
    try { hit ??= await cache?.get(key); } catch { /* Cache outage must not silence a configured voice. */ }
    if (hit) return result(hit, true);
    if (!inflight.has(key)) inflight.set(key, (async () => {
      const wav = await generate(provider, req);
      if (memory.size >= 64) memory.delete(memory.keys().next().value);
      memory.set(key, wav);
      try { await cache?.put(key, wav); } catch { /* audio remains playable */ }
      return result(wav, false);
    })().finally(() => inflight.delete(key)));
    return inflight.get(key);
  }
  return { providers, versions, speak };
}
