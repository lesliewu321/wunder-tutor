import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildInstruction, createTts, pcmToWav, transcriptMatches, trimSilence } from './tts.mjs';

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
        const said = script(prompt, session);
        const pcm = Buffer.alloc(4800); // 100 ms of 24 kHz audio
        for (let i = 400; i < 2000; i++) pcm.writeInt16LE(6000, i * 2);
        reply({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: pcm.toString('base64') } }] }, outputTranscription: { text: said } } });
        reply({ serverContent: { turnComplete: true } });
      },
    };
    queueMicrotask(() => emit('open', {}));
    return ws;
  };
  return { connect, log };
}

let dir;
afterEach(async () => { if (dir) await rm(dir, { recursive: true, force: true }); dir = undefined; });

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

  it('refuses to serve a reference take that still does not match', async () => {
    const live = fakeLive(() => 'Hello! What would you like to practise today?');
    const tts = createTts({ apiKey: 'k', connect: live.connect });
    await expect(tts.speak({ text: 'thank you', accent: 'en-US' })).rejects.toMatchObject({ code: 'tts_mismatch' });
  });

  it('generates each phrase once: disk cache and in-flight de-duplication', async () => {
    dir = await mkdtemp(join(tmpdir(), 'wunder-tts-'));
    const live = fakeLive((prompt) => prompt.replace('SAY: ', ''));
    const tts = createTts({ apiKey: 'k', connect: live.connect, cacheDir: dir });
    const [a, b] = await Promise.all([tts.speak({ text: 'water', accent: 'en-US' }), tts.speak({ text: 'water', accent: 'en-US' })]);
    expect(live.log.sessions).toBe(1);
    expect(a.wav.equals(b.wav)).toBe(true);

    const again = await createTts({ apiKey: 'k', connect: live.connect, cacheDir: dir }).speak({ text: 'water', accent: 'en-US' });
    expect(again.cached).toBe(true);
    expect(live.log.sessions).toBe(1);
    await tts.speak({ text: 'water', accent: 'en-US', slow: true }); // a different take
    expect((await readdir(dir)).length).toBe(2);
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
