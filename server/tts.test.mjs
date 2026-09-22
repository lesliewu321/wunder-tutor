import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildInstruction, createTts, pcmToWav, PREVIEW_LINES, transcriptMatches, trimSilence } from './tts.mjs';

/** A stand-in for the Live API socket: replies to setup, then "speaks" whatever the script says. */
function fakeLive(script) {
  const log = { sessions: 0, setups: [], prompts: [] };
  const connect = () => {
    const listeners = {};
    const emit = (type, event) => (listeners[type] ?? []).forEach((fn) => fn(event));
    const reply = (obj) => queueMicrotask(() => emit('message', { data: new TextEncoder().encode(JSON.stringify(obj)).buffer }));
    const session = log.sessions++;
    const ws = {
      addEventListener: (type, fn) => { (listeners[type] ??= []).push(fn); },
      close: () => {},
      send: (raw) => {
        const msg = JSON.parse(raw);
        if (msg.setup) { log.setups.push(msg.setup); reply({ setupComplete: {} }); return; }
        const prompt = msg.clientContent.turns[0].parts[0].text;
        log.prompts.push(prompt);
        const answer = script(prompt, session);
        const said = typeof answer === 'string' ? answer : answer.said;
        const seconds = typeof answer === 'string' ? 0.1 : answer.seconds;
        const pcm = Buffer.alloc(Math.round(24000 * seconds) * 2); // 100 ms of 24 kHz audio unless the script says otherwise
        for (let i = 400; i < Math.min(2000, pcm.length / 2); i++) pcm.writeInt16LE(6000, i * 2);
        reply({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: pcm.toString('base64') } }] }, outputTranscription: { text: said } } });
        reply({ serverContent: { turnComplete: true } });
      },
    };
    setTimeout(() => emit('open', {}), 0); // like a real socket: 'open' arrives as a later task
    return ws;
  };
  return { connect, log };
}

const memoryCache = () => { const m = new Map(); return { m, get: async (k) => m.get(k), put: async (k, v) => { m.set(k, v); } }; };

describe('Gemini Live teacher voice', () => {
  it('asks for exactly the phrase, in the chosen accent and speed', async () => {
    const live = fakeLive((prompt) => prompt.replace('SAY: ', ''));
    const tts = createTts({ apiKey: 'k', connect: live.connect });
    const { wav, cached } = await tts.speak({ text: 'I would like a cup of hot chocolate.', accent: 'en-GB', slow: true });

    expect(cached).toBe(false);
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.readUInt32LE(24)).toBe(24000);
    expect(live.log.prompts).toEqual(['SAY: I would like a cup of hot chocolate.']);
    const setup = live.log.setups[0];
    expect(setup.model).toBe('models/gemini-3.1-flash-live-preview');
    expect(setup.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(setup.systemInstruction.parts[0].text).toMatch(/British English/);
    expect(setup.systemInstruction.parts[0].text).toMatch(/slowly/);
  });

  it('retries once when the model ad-libs, then accepts the clean take', async () => {
    const live = fakeLive((prompt, session) => (session === 0 ? 'Sure! Here you go: three red apples' : 'three red apples'));
    const tts = createTts({ apiKey: 'k', connect: live.connect });
    await tts.speak({ text: 'three red apples', accent: 'en-US' });
    expect(live.log.sessions).toBe(2);
    expect(live.log.setups[1].systemInstruction.parts[0].text).toMatch(/Say ONLY the text/);
  });

  it('cuts off a take that runs on far past the line, and tries again (the live Bonjour ! Tu as faim ?)', async () => {
    const live = fakeLive((prompt, session) => (session === 0 ? { said: 'Bonjour ! Tu', seconds: 19.6 } : prompt.replace('SAY: ', '')));
    const { wav } = await createTts({ apiKey: 'k', connect: live.connect }).speak({ text: 'Bonjour ! Tu as faim ?', accent: 'fr-FR' });
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(live.log.sessions).toBe(2);
  });

  it('gets a third try when the first two glitch, and no more', async () => {
    const glitchTwice = fakeLive((prompt, session) => (session < 2 ? { said: 'Bon', seconds: 30 } : prompt.replace('SAY: ', '')));
    await createTts({ apiKey: 'k', connect: glitchTwice.connect }).speak({ text: 'Tu veux du lait ?', accent: 'fr-FR' });
    expect(glitchTwice.log.sessions).toBe(3);
    const glitchAlways = fakeLive(() => ({ said: 'Bon', seconds: 30 }));
    await expect(createTts({ apiKey: 'k', connect: glitchAlways.connect }).speak({ text: 'Tu veux du lait ?', accent: 'fr-FR' })).rejects.toMatchObject({ code: 'gemini_unstable' });
    expect(glitchAlways.log.sessions).toBe(3);
  });

  it('refuses to serve a reference take that still does not match', async () => {
    const live = fakeLive(() => 'Hello! What would you like to practise today?');
    const tts = createTts({ apiKey: 'k', connect: live.connect });
    await expect(tts.speak({ text: 'thank you', accent: 'en-US' })).rejects.toMatchObject({ code: 'tts_mismatch' });
  });

  it('generates each phrase once: durable cache and in-flight de-duplication', async () => {
    const cache = memoryCache();
    const live = fakeLive((prompt) => prompt.replace('SAY: ', ''));
    const tts = createTts({ apiKey: 'k', connect: live.connect, cache });
    const [a, b] = await Promise.all([tts.speak({ text: 'water', accent: 'en-US' }), tts.speak({ text: 'water', accent: 'en-US' })]);
    expect(live.log.sessions).toBe(1);
    expect(a.wav.equals(b.wav)).toBe(true);

    const again = await createTts({ apiKey: 'k', connect: live.connect, cache }).speak({ text: 'water', accent: 'en-US' });
    expect(again.cached).toBe(true);
    expect(live.log.sessions).toBe(1);
    await tts.speak({ text: 'water', accent: 'en-US', slow: true }); // a different take
    expect(cache.m.size).toBe(2);
  });

  it('works with sockets that are already open when handed over (Cloudflare fetch-upgrade)', async () => {
    const live = fakeLive((prompt) => prompt.replace('SAY: ', ''));
    const connect = async (url) => ({ socket: live.connect(url), alreadyOpen: true });
    const { wav } = await createTts({ apiKey: 'k', connect }).speak({ text: 'milk', accent: 'en-US' });
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(live.log.setups).toHaveLength(1);
  });

  it('validates input and enforces a generation budget', async () => {
    const live = fakeLive((prompt) => prompt.replace('SAY: ', ''));
    const tts = createTts({ apiKey: 'k', connect: live.connect, maxGenerationsPerWindow: 1 });
    await expect(tts.speak({ text: '   ' })).rejects.toMatchObject({ code: 'missing_text', status: 400 });
    await expect(tts.speak({ text: 'x'.repeat(201) })).rejects.toMatchObject({ code: 'text_too_long' });
    await expect(tts.speak({ text: '12345' })).rejects.toMatchObject({ code: 'invalid_text' });
    await tts.speak({ text: 'milk', accent: 'en-US' });
    await expect(tts.speak({ text: 'bread', accent: 'en-US' })).rejects.toMatchObject({ code: 'tts_budget_exceeded', status: 429 });
  });

  it('tolerates imperfect transcription but not extra speech', () => {
    expect(transcriptMatches('three', '3')).toBe(true);
    expect(transcriptMatches('rah', 'Raw.')).toBe(true);
    expect(transcriptMatches('Can I have some water, please?', 'can i have some water please')).toBe(true);
    expect(transcriptMatches('I think I’ll have the fish.', "I think I'll have the dish")).toBe(true);
    expect(transcriptMatches('milk', 'Sure, milk!')).toBe(false);
    expect(transcriptMatches('thank you', 'thank you very much, that is so kind of you')).toBe(false);
    expect(transcriptMatches('water', '')).toBe(true);
  });

  it('accepts a Japanese take written in kanji where the line has kana, and the reverse, but not English or chatter', () => {
    expect(transcriptMatches('みずをください', '水をください')).toBe(true);
    expect(transcriptMatches('ラーメンをお願いします。', 'ラーメンをおねがいします')).toBe(true);
    expect(transcriptMatches('ありがとう', '')).toBe(true);
    expect(transcriptMatches('ありがとう', 'Sure! ありがとう')).toBe(false);
    expect(transcriptMatches('はい', 'はい、わかりました。それでは次の文を読みますね。どうぞよろしくお願いします。')).toBe(false);
  });

  it('gives the Japanese voice its beats', () => {
    expect(buildInstruction({ accent: 'ja-JP' })).toMatch(/standard Japanese/);
    expect(buildInstruction({ accent: 'ja-JP' })).toMatch(/long vowels/);
  });

  it('describes syllables differently from sentences', () => {
    expect(buildInstruction({ accent: 'en-US', kind: 'syllable' })).toMatch(/single syllable/);
    expect(buildInstruction({ accent: 'en-US' })).toMatch(/General American/);
  });

  it('trims silence and writes a valid WAV header', () => {
    const pcm = Buffer.alloc(48000);
    for (let i = 10000; i < 12000; i++) pcm.writeInt16LE(8000, i * 2);
    const trimmed = trimSilence(pcm, 24000);
    expect(trimmed.length).toBeLessThan(pcm.length / 2);
    expect(trimmed.length).toBeGreaterThanOrEqual(4000);
    const wav = pcmToWav(trimmed, 24000);
    expect(wav.readUInt32LE(40)).toBe(trimmed.length);
    expect(wav.length).toBe(44 + trimmed.length);
  });
});

describe('the backup voice (Azure), when the teacher cannot say a line', () => {
  /** A pretend Azure voice: 0.3 s of sound, counting how often it was asked. */
  const fakeBackup = (fail = false) => {
    const calls = [];
    const fn = async (req) => {
      calls.push(req);
      if (fail) throw new Error('azure tts 503');
      const pcm = Buffer.alloc(24000 * 2 * 0.3);
      for (let i = 1000; i < 6000; i++) pcm.writeInt16LE(7000, i * 2);
      return { pcm, rate: 24000 };
    };
    return { fn, calls };
  };

  it('reads a line the teacher refuses three times, and keeps it as that line\'s take', async () => {
    const cache = memoryCache();
    const chatty = fakeLive(() => 'Sure! Here you go: four is four');
    const backup = fakeBackup();
    const first = await createTts({ apiKey: 'k', connect: chatty.connect, cache, backup: backup.fn }).speak({ text: 'four is four', accent: 'en-US' });
    expect(first).toMatchObject({ cached: false, voice: 'backup' });
    expect(first.wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(chatty.log.sessions).toBe(3);
    // The next request goes straight to the kept take: no teacher, no second backup call.
    const again = await createTts({ apiKey: 'k', connect: chatty.connect, cache, backup: backup.fn }).speak({ text: 'four is four', accent: 'en-US' });
    expect(again).toMatchObject({ cached: true, voice: 'backup' });
    expect(again.wav.equals(first.wav)).toBe(true);
    expect(chatty.log.sessions).toBe(3);
    expect(backup.calls).toHaveLength(1);
  });

  it('a line the teacher says well is still the teacher\'s', async () => {
    const live = fakeLive((prompt) => prompt.replace('SAY: ', ''));
    const backup = fakeBackup();
    const out = await createTts({ apiKey: 'k', connect: live.connect, backup: backup.fn }).speak({ text: 'milk', accent: 'en-US' });
    expect(out.voice).toBe('teacher');
    expect(backup.calls).toHaveLength(0);
  });

  it('an outage: the backup reads it, but it is not kept for good (the teacher is asked again next time)', async () => {
    const cache = memoryCache();
    const down = { connect: () => { throw new Error('no network'); } };
    const backup = fakeBackup();
    const out = await createTts({ apiKey: 'k', connect: down.connect, cache, backup: backup.fn }).speak({ text: 'water', accent: 'en-US' });
    expect(out.voice).toBe('backup');
    expect(cache.m.size).toBe(0);
  });

  it('both failing: the teacher\'s reason is reported, as before', async () => {
    const chatty = fakeLive(() => 'Sure! thank you');
    await expect(createTts({ apiKey: 'k', connect: chatty.connect, backup: fakeBackup(true).fn }).speak({ text: 'thank you', accent: 'en-US' })).rejects.toMatchObject({ code: 'tts_mismatch' });
  });

  it('no backup for our own limits: a bad request, or the spending guard', async () => {
    const backup = fakeBackup();
    const live = fakeLive((prompt) => prompt.replace('SAY: ', ''));
    const tts = createTts({ apiKey: 'k', connect: live.connect, backup: backup.fn, maxGenerationsPerWindow: 0 });
    await expect(tts.speak({ text: '12345' })).rejects.toMatchObject({ code: 'invalid_text' });
    await expect(tts.speak({ text: 'bread', accent: 'en-US' })).rejects.toMatchObject({ code: 'tts_budget_exceeded' });
    expect(backup.calls).toHaveLength(0);
  });

  it('Mandarin: the backup\'s take is served even when the scorer disagrees, and the disagreement is logged', async () => {
    // The teacher's takes get the full gate; the backup's the reader's — but a reading voice says exactly the text, and on
    // a tongue twister it is the scorer that fails (妈妈骑马，马慢，妈妈骂马。 came back "妈妈，妈妈"), so its take plays.
    const wrong = fakeLive(() => '十');
    const gates = [];
    const refuseAll = async (_wav, _text, _locale, opts) => { gates.push(!!opts?.reader); return false; };
    const warnings = [];
    const tts = createTts({ apiKey: 'k', connect: wrong.connect, verify: refuseAll, backup: fakeBackup().fn, cache: memoryCache(), log: { warn: (m) => warnings.push(m) } });
    const out = await tts.speak({ text: '十', accent: 'zh-CN' });
    expect(out.voice).toBe('backup');
    expect(gates).toEqual([false, false, false, true]);
    expect(warnings).toEqual(['[tts] backup take served although the scorer disagrees: 十']);
    // A learner's own line is never written to a log.
    await tts.speak({ text: '四', accent: 'zh-CN', ephemeral: true });
    expect(warnings[1]).toBe('[tts] backup take served although the scorer disagrees: a learner’s own line');
  });

  it('gives the teacher a time budget, then lets the backup read the line (nothing kept for good)', async () => {
    const cache = memoryCache();
    const hung = { connect: () => ({ addEventListener: () => {}, close: () => {}, send: () => {} }) }; // a socket that never answers
    const backup = fakeBackup();
    const started = Date.now();
    const out = await createTts({ apiKey: 'k', connect: hung.connect, cache, backup: backup.fn, teacherBudgetMs: 300 }).speak({ text: 'water', accent: 'en-US' });
    expect(out.voice).toBe('backup');
    expect(Date.now() - started).toBeLessThan(2000);
    expect(backup.calls).toHaveLength(1);
    expect(cache.m.size).toBe(0); // the teacher is asked again next time
  });

  it('keeps the backup\'s take only for a line the teacher was heard to get wrong three times — not after glitches', async () => {
    const backup = fakeBackup();
    const glitchAlways = fakeLive(() => ({ said: 'Bon', seconds: 30 }));
    const cache = memoryCache();
    const out = await createTts({ apiKey: 'k', connect: glitchAlways.connect, cache, backup: backup.fn }).speak({ text: 'Tu veux du lait ?', accent: 'fr-FR' });
    expect(out.voice).toBe('backup');
    expect(glitchAlways.log.sessions).toBe(3);
    expect(cache.m.size).toBe(0);
    // Without a backup, the reason says what happened: the teacher glitched, it did not refuse the line.
    await expect(createTts({ apiKey: 'k', connect: fakeLive(() => ({ said: 'Bon', seconds: 30 })).connect }).speak({ text: 'Tu veux du lait ?', accent: 'fr-FR' })).rejects.toMatchObject({ code: 'gemini_unstable', status: 504 });
  });

  it('reads a line in the backup voice when the app asks for it by name, beside the teacher\'s take', async () => {
    // The app's own Mandarin tone check turned the teacher's take away: that take stays the line's for everyone else.
    const cache = memoryCache();
    const live = fakeLive((prompt) => prompt.replace('SAY: ', ''));
    const backup = fakeBackup();
    const tts = createTts({ apiKey: 'k', connect: live.connect, cache, backup: backup.fn });
    const teacher = await tts.speak({ text: '你好', accent: 'zh-CN' });
    expect(teacher.voice).toBe('teacher');
    const reading = await tts.speak({ text: '你好', accent: 'zh-CN', backup: true });
    expect(reading).toMatchObject({ cached: false, voice: 'backup' });
    expect(backup.calls).toHaveLength(1);
    expect(live.log.sessions).toBe(1);
    // Kept: the next such request is the same take; the teacher's own take is still served to everyone else.
    expect(await tts.speak({ text: '你好', accent: 'zh-CN', backup: true })).toMatchObject({ cached: true, voice: 'backup' });
    expect(await tts.speak({ text: '你好', accent: 'zh-CN' })).toMatchObject({ cached: true, voice: 'teacher' });
    expect(backup.calls).toHaveLength(1);
    // A learner's own line: read, not kept.
    await tts.speak({ text: '再见', accent: 'zh-CN', backup: true, ephemeral: true });
    expect(cache.m.size).toBe(2);
    await expect(createTts({ apiKey: 'k', connect: live.connect }).speak({ text: '你好', accent: 'zh-CN', backup: true })).rejects.toMatchObject({ code: 'backup_not_configured' });
  });

  it('gives the voice service one more try after a passing hiccup, then reports the failure', async () => {
    let calls = 0;
    const flaky = async (req) => { calls += 1; if (calls === 1) throw new Error('azure tts 503'); return fakeBackup().fn(req); };
    const live = fakeLive((prompt) => prompt.replace('SAY: ', ''));
    expect((await createTts({ apiKey: 'k', connect: live.connect, backup: flaky }).speak({ text: 'milk', accent: 'en-US', backup: true })).voice).toBe('backup');
    expect(calls).toBe(2);
    await expect(createTts({ apiKey: 'k', connect: live.connect, backup: fakeBackup(true).fn }).speak({ text: 'milk', accent: 'en-US', backup: true })).rejects.toMatchObject({ code: 'backup_failed', status: 502 });
  });

  it('names the preview lines exactly as the app plays them', () => {
    // src/features/onboarding/Onboarding.tsx plays the accent preview through the voice's constant.
    const app = readFileSync(new URL('../src/speech/voice.ts', import.meta.url), 'utf8');
    for (const line of PREVIEW_LINES) expect(app).toContain(JSON.stringify(line).replace(/^"|"$/g, ''));
  });
});

describe('Azure\'s voice: the request', () => {
  it('speaks the line in the language\'s voice, slower when asked, with the text escaped', async () => {
    const { backupSsml, BACKUP_VOICES } = await import('./azure-tts.mjs');
    expect(backupSsml({ text: 'Fish & chips <please>', accent: 'en-GB' })).toContain('<voice name="en-GB-SoniaNeural"><prosody rate="-10%">Fish &amp; chips &lt;please&gt;</prosody>');
    expect(backupSsml({ text: '四是四，十是十。', accent: 'zh-CN', slow: true })).toMatch(/xml:lang="zh-CN".*zh-CN-XiaoxiaoNeural.*rate="-40%">四是四，十是十。/);
    expect(Object.keys(BACKUP_VOICES).sort()).toEqual(['en-GB', 'en-US', 'fr-FR', 'ja-JP', 'zh-CN']);
  });

  it('asks the region\'s voice service for the teacher\'s own format, and reads the WAV that comes back', async () => {
    const { createBackupVoice } = await import('./azure-tts.mjs');
    const seen = [];
    const wav = pcmToWav(Buffer.alloc(4800), 24000);
    const fetchImpl = async (url, init) => { seen.push({ url, init }); return new Response(wav, { status: 200 }); };
    const out = await createBackupVoice({ key: 'secret', region: 'eastasia', fetchImpl })({ text: 'bonjour', accent: 'fr-FR' });
    expect(out).toMatchObject({ rate: 24000 });
    expect(out.pcm.length).toBe(4800);
    expect(seen[0].url).toBe('https://eastasia.tts.speech.microsoft.com/cognitiveservices/v1');
    expect(seen[0].init.headers).toMatchObject({ 'X-Microsoft-OutputFormat': 'riff-24khz-16bit-mono-pcm', 'Content-Type': 'application/ssml+xml' });
    expect(seen[0].init.body).toContain('fr-FR-DeniseNeural');
    await expect(createBackupVoice({ key: 'k', region: 'eastasia', fetchImpl: async () => new Response('no', { status: 401 }) })({ text: 'x', accent: 'en-US' })).rejects.toThrow('azure tts 401');
  });
});
