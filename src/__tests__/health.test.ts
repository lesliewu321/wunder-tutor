import { afterEach, describe, expect, it, vi } from 'vitest';
import { AzurePronunciationProvider } from '../speech/azureProvider';
import { MockPronunciationProvider } from '../speech/mockProvider';

// What the server offers a device changes during a session: an invite code entered in Settings, or a phone that was
// offline when the app opened. A tester entered the code and then heard nothing ("Sound isn't working on this
// device") and got simulated scores until the app was closed (2026-09-21): the choices were made once, at start.
// Classes are compared by name: each test imports a fresh copy of the modules.

/** A pretend /api/health: the voice, scoring and the tutor come with the code, as on the live server. */
const server = () => {
  const s = { authorized: false, offline: false };
  vi.stubGlobal('fetch', vi.fn(async () => {
    if (s.offline) throw new TypeError('Failed to fetch');
    const a = s.authorized;
    return new Response(JSON.stringify({ ok: true, needsCode: true, codeSet: true, authorized: a, azure: a, gemini: a, claude: a, ttsVersion: a ? 'v1' : null }), { headers: { 'content-type': 'application/json' } });
  }));
  return s;
};

describe('choices that follow the server', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

  it('switches real scoring on once the code is saved, without restarting the app', async () => {
    const s = server();
    const speech = await import('../speech');
    expect((await speech.getProvider()).constructor.name).toBe(MockPronunciationProvider.name);
    s.authorized = true;
    await speech.refreshHealth(); // what saving the code in Settings does
    expect((await speech.getProvider()).constructor.name).toBe(AzurePronunciationProvider.name);
  });

  it('asks again after a check that failed (offline when the app opened)', async () => {
    const s = server();
    s.offline = true;
    s.authorized = true;
    const speech = await import('../speech');
    expect((await speech.getProvider()).constructor.name).toBe(MockPronunciationProvider.name);
    s.offline = false;
    expect((await speech.getProvider()).constructor.name).toBe(AzurePronunciationProvider.name);
  });

  it('lets the teacher speak, and the live tutor talk, once the code is saved', async () => {
    const s = server();
    const { voice } = await import('../speech/voice');
    const { getTutor } = await import('../tutor/tutor');
    const { SCENARIOS } = await import('../content/scenarios');
    const cafe = SCENARIOS.find((x) => x.course === 'en')!;
    expect(await voice.engine()).toBe('none'); // no device voice here, as in the phone app's WebView
    expect((await getTutor(cafe)).constructor.name).toBe('ScriptedTutor');
    s.authorized = true;
    const { refreshHealth } = await import('../speech');
    await refreshHealth();
    expect(await voice.engine()).toBe('gemini');
    expect((await getTutor(cafe)).constructor.name).toBe('ClaudeTutor');
  });

  it('keeps one choice while the answer stands', async () => {
    const s = server();
    s.authorized = true;
    const speech = await import('../speech');
    const first = await speech.getProvider();
    expect(await speech.getProvider()).toBe(first);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });
});
