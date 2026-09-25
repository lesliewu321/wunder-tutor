import { afterEach, describe, expect, it, vi } from 'vitest';

// The teacher's voice on a phone, where there is no device voice to fall back on: every way a line can still be heard.
// Each test imports a fresh copy of the modules (the voice keeps the server's answer and its takes).

/** A pretend server: /api/health, and /api/tts answering with a tiny WAV, whichever voice is asked for. */
const server = (opts: { authorized?: boolean; voices?: Record<string, boolean>; slow?: Promise<void>; tts?: (body: Record<string, unknown>, call: number) => Response } = {}) => {
  const calls: Record<string, unknown>[] = [];
  const wav = (voice: 'teacher' | 'backup') => new Response(new Uint8Array(44 + 3200), { headers: { 'content-type': 'audio/wav', 'x-tts-voice': voice } });
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    if (url.includes('/api/health')) {
      await opts.slow;
      const a = opts.authorized ?? true;
      return new Response(JSON.stringify({ ok: true, needsCode: true, codeSet: true, authorized: a, azure: a, gemini: a, claude: a, voiceProviders: opts.voices ?? { chirp: a, azure: a, qwen: a, gemini: a }, ttsVersion: a ? 'v1' : null }), { headers: { 'content-type': 'application/json' } });
    }
    if (url.includes('/api/tts')) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push(body);
      return opts.tts ? opts.tts(body, calls.length) : wav(body.backup ? 'backup' : 'teacher');
    }
    throw new Error(`unexpected ${url}`);
  }));
  return { calls, wav };
};

/** No <audio> in Node: one that "plays" at once, counting what it was given. */
const audio = () => {
  const played: string[] = [];
  vi.stubGlobal('Audio', class {
    src = '';
    paused = true;
    onended: (() => void) | null = null;
    play() { this.paused = false; played.push(this.src); queueMicrotask(() => { this.paused = true; this.onended?.(); }); return Promise.resolve(); }
    pause() { this.paused = true; }
  });
  return played;
};

describe('the teacher’s voice on a phone', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('says it can speak before the server has answered, and only stops saying so when the server says no', async () => {
    let answer = () => {};
    server({ authorized: false, slow: new Promise<void>((r) => { answer = r; }) }); // a phone on a slow connection
    const { voice } = await import('../speech/voice');
    const { apiHealth, refreshHealth } = await import('../speech');
    expect(voice.available()).toBe(true); // not known yet: let them try, speak() explains if it cannot
    answer();
    await apiHealth();
    expect(voice.available()).toBe(false); // no code on this device
    vi.unstubAllGlobals();
    server({ authorized: true });
    await refreshHealth();
    expect(voice.available()).toBe(true);
  });

  it('asks for the backup voice by name when its own tone check turns the teacher’s take away', async () => {
    vi.doMock('../speech/zh/teacherCheck', () => ({ teacherToneOk: async () => false }));
    const { calls } = server();
    const played = audio();
    const { voice } = await import('../speech/voice');
    await voice.speak('你好', { accent: 'zh-CN', provider: 'gemini' });
    expect(calls.map((c) => c.backup)).toEqual([undefined, true]);
    expect(played).toHaveLength(1);
    // The backup's take is kept as the line's: no second round next time.
    await voice.speak('你好', { accent: 'zh-CN', provider: 'gemini' });
    expect(calls).toHaveLength(2);
    expect(played).toHaveLength(2);
  });

  it('tries once more after a network blip, and not after the server has answered', async () => {
    let blips = 1;
    const { calls } = server({ tts: () => { if (blips-- > 0) throw new TypeError('Failed to fetch'); return new Response(new Uint8Array(44), { headers: { 'content-type': 'audio/wav' } }); } });
    audio();
    const { voice } = await import('../speech/voice');
    await voice.speak('milk', { accent: 'en-US' });
    expect(calls).toHaveLength(2);
    vi.unstubAllGlobals();
    const refused = server({ tts: () => new Response(JSON.stringify({ error: 'daily_limit' }), { status: 429, headers: { 'content-type': 'application/json' } }) });
    await expect(voice.speak('bread', { accent: 'en-US' })).rejects.toMatchObject({ reason: 'take', code: 'daily_limit' });
    expect(refused.calls).toHaveLength(1);
  });

  it('tells the learner the server’s reason when it gave one', async () => {
    server();
    const { soundProblem } = await import('../speech/health');
    const now = { azure: true, claude: true, gemini: true, ttsVersion: 'v1', needsCode: true, authorized: true, codeSet: true, read: true, reached: true };
    expect(soundProblem(now, true, 'junior', 'take', 'daily_limit')).toMatch(/used up/);
    expect(soundProblem(now, true, 'junior', 'take', 'rate_limited')).toMatch(/busy/);
    expect(soundProblem(now, true, 'junior', 'take')).toMatch(/can’t say this one/);
  });

  it('plays setup’s accent preview before the device has a code, and nothing else', async () => {
    const { calls } = server({ authorized: false });
    audio();
    const { voice, ACCENT_PREVIEW_LINE } = await import('../speech/voice');
    await voice.speak(ACCENT_PREVIEW_LINE, { accent: 'en-GB', preview: true });
    expect(calls).toHaveLength(1);
    await expect(voice.speak('water', { accent: 'en-GB' })).rejects.toMatchObject({ reason: 'playback' });
    expect(calls).toHaveLength(1);
  });
  it('routes the same text to each selected provider and keeps their cached takes separate', async () => {
    const { calls } = server({ voices: { azure: true, qwen: true, chirp: true, gemini: true } });
    audio();
    const { voice } = await import('../speech/voice');
    const { setTeacherVoiceChoice } = await import('../speech/teacherPreference');
    for (const provider of ['azure', 'qwen', 'chirp', 'azure'] as const) {
      setTeacherVoiceChoice(provider);
      expect(await voice.engine()).toBe(provider);
      await voice.speak('你好', { accent: 'zh-CN' });
    }
    setTeacherVoiceChoice('qwen');
    await Promise.all([voice.speak('你好', { accent: 'zh-CN', slow: true }), voice.speak('你好', { accent: 'zh-CN', slow: true })]);
    expect(calls.map(c => c.provider)).toEqual(['azure', 'qwen', 'chirp']);
  });

});
