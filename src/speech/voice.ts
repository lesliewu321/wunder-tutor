import { voiceSupports, automaticVoices, selectedVoice, teacherVoiceChoice, voiceConfigured, type CloudVoice } from './teacherPreference';
import { createStore, get, set } from 'idb-keyval';
import type { Accent, Locale, SpeakItem } from '../domain/types';
import { apiFetch, apiHealth, knownHealth } from './health';
import { VoiceError } from './types';
import { teacherToneOk } from './zh/teacherCheck';

/** Course items retain their own language; English uses the learner's selected accent. */
export const localeOf = (item: Pick<SpeakItem, 'lang'> | undefined | null, accent: Accent): Locale => item?.lang ?? accent;

export interface SpeakOptions {
  /** The course's speech locale, including zh-HK for Hong Kong Cantonese. */
  accent: Locale;
  slow?: boolean;
  /** Isolated syllables ("rah", "thee") need different handling from words and sentences. */
  kind?: SpeakItem['kind'];
  /** A learner's own text (Say it right): spoken, but not kept in the server's shared cache. */
  ephemeral?: boolean;
  /** One of the lines the server plays to a device that has no invite code yet (setup's accent preview). */
  preview?: boolean;
  /** The backup voice by name: the teacher's take of this line was turned away by this device's tone check. */
  backup?: boolean;
}

/** Setup's accent preview, heard before the device has a code: the server knows this line (server/tts.mjs PREVIEW_LINES). */
export const ACCENT_PREVIEW_LINE = 'Hello! I would like some water, please.';

/** Reference ("teacher") audio. Implementations: Gemini Live native audio, device speech synthesis. */
export interface ReferenceVoice {
  available(): boolean;
  speak(text: string, opts: SpeakOptions): Promise<void>;
  stop(): void;
}

// ---------------------------------------------------------------- device speech synthesis (fallback)

// Prefer natural-sounding voices when the platform offers several for the accent.
const PREFERRED = [/natural/i, /neural/i, /google/i, /samantha|daniel|karen|serena/i, /microsoft (aria|jenny|libby|sonia)/i];

class WebSpeechVoice implements ReferenceVoice {
  private voices: SpeechSynthesisVoice[] = [];
  private finish: (() => void) | null = null;

  constructor() {
    if (!this.available()) return;
    const load = () => { this.voices = speechSynthesis.getVoices(); };
    load();
    speechSynthesis.addEventListener?.('voiceschanged', load);
  }

  available(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  private pick(accent: Locale): SpeechSynthesisVoice | undefined {
    const norm = (l: string) => l.replace('_', '-').toLowerCase();
    const exact = this.voices.filter((v) => norm(v.lang) === accent.toLowerCase());
    // Mandarin must never fall back to a Cantonese (zh-HK) or Taiwanese voice, nor to English.
    // Other courses may use another regional voice of the same language.
    const sameLanguage = accent === 'zh-HK' ? this.voices.filter((v) => /^(zh-hk|yue-hk)$/.test(norm(v.lang))) : accent === 'zh-CN' ? this.voices.filter((v) => /^(zh-cn|cmn)/.test(norm(v.lang))) : this.voices.filter((v) => norm(v.lang).startsWith(accent.slice(0, 2).toLowerCase()));
    const pool = exact.length ? exact : sameLanguage;
    for (const re of PREFERRED) { const v = pool.find((x) => re.test(x.name)); if (v) return v; }
    return pool[0];
  }

  speak(text: string, { accent, slow }: SpeakOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.available()) return reject(new Error('playback-unavailable'));
      this.stop();
      const u = new SpeechSynthesisUtterance(text);
      const voice = this.pick(accent);
      if (!voice) return reject(new VoiceError('playback', 'device_language_unavailable'));
      u.voice = voice;
      u.lang = voice?.lang ?? accent;
      u.rate = slow ? 0.55 : 0.92;
      u.pitch = 1.05;
      // Some engines never fire onend (or fire nothing at all when no voice is installed):
      // reject on a generous timer so a silent engine does not report successful playback.
      const guard = window.setTimeout(() => { finish(new VoiceError('playback')); speechSynthesis.cancel(); }, 3000 + text.length * (slow ? 220 : 130));
      const finish = (err?: Error) => { clearTimeout(guard); if (this.finish === done) this.finish = null; err ? reject(err) : resolve(); };
      const done = () => finish();
      this.finish = done;
      u.onend = done;
      u.onerror = (e) => finish(e.error === 'interrupted' || e.error === 'canceled' ? undefined : new VoiceError('playback'));
      try { speechSynthesis.speak(u); } catch { finish(new VoiceError('playback')); }
    });
  }

  stop(): void {
    this.finish?.(); this.finish = null;
    if (this.available()) speechSynthesis.cancel();
  }
}

// ---------------------------------------------------------------- shared <audio> playback
//
// One <audio> element for every take, the teacher's and the learner's own. Safari on an iPhone or iPad lets a page
// make sound only in answer to a tap, and a take the server needed ten seconds to make arrives long after the tap that
// asked for it; an element that has once played during a tap may play again whenever it likes. So the element is
// unlocked with a moment of silence on the first tap or key press anywhere in the app (the usual way), and reused. The
// phone apps and Chrome need none of this, and are not bothered by it.

/** 0.05 s of silence as a WAV data URL: the 44-byte header, then 800 zero samples at 16 kHz. */
const SILENCE = (() => {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (at: number, s: string) => { for (let i = 0; i < s.length; i++) bytes[at + i] = s.charCodeAt(i); };
  ascii(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  ascii(36, 'data'); view.setUint32(40, samples * 2, true);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:audio/wav;base64,${btoa(bin)}`;
})();

let player: HTMLAudioElement | null = null;
const element = (): HTMLAudioElement => (player ??= new Audio());

/** What is playing now: the object URL to let go of, and how to settle its promise. */
let playing: { url: string; end: (err?: Error) => void } | null = null;
const pauseCurrent = () => { if (playing) { const was = playing; playing = null; player?.pause(); URL.revokeObjectURL(was.url); was.end(); } };

let unlocked = false;
export const unlockPlayback = (): void => {
  if (unlocked || playing) return;
  unlocked = true;
  const el = element();
  el.src = SILENCE;
  // Refused (not a real tap after all): try again on the next one. Done: leave the element idle — unless a take has
  // started on it meanwhile, which is exactly what the silence was for.
  el.play().then(() => { if (el.src === SILENCE) el.pause(); }, () => { unlocked = false; });
};
if (typeof document !== 'undefined') {
  for (const type of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(type, unlockPlayback, { capture: true, passive: true });
}

/** Play a blob (a learner's own take, or a generated teacher take). Resolves when playback ends or is stopped. */
export const playBlob = (blob: Blob, rate = 1): Promise<void> =>
  new Promise((resolve, reject) => {
    pauseCurrent();
    const el = element();
    const url = URL.createObjectURL(blob);
    // A stalled media engine must release the UI; stopped takes also clear this timer.
    const guard = setTimeout(() => { end(new VoiceError('playback')); el.pause(); }, 120000);
    const mine = { url, end: (err?: Error) => { clearTimeout(guard); err ? reject(err) : resolve(); } };
    playing = mine;
    const end = (err?: Error) => { if (playing !== mine) return; playing = null; URL.revokeObjectURL(url); mine.end(err); };
    el.onended = () => end();
    // A pause the app did not ask for (a phone call, the system): over. The 'pause' event of the take before this one
    // arrives late, while this one is already playing (el.paused false) — not this take's business.
    el.onpause = () => { if (el.paused) end(); };
    el.onerror = () => end(new Error('playback-unavailable'));
    el.src = url;
    el.playbackRate = rate;
    el.preservesPitch = true;
    el.play().catch((e) => end(e instanceof Error ? e : new Error('playback-unavailable')));
  });

// ---------------------------------------------------------------- Gemini Live native audio (via /api/tts)

/**
 * A take read by the backup voice (Azure's, when the teacher could not say the line: server/azure-tts.mjs). Marked in
 * its type, which is stored with it, so a kept take is still known for one.
 */
const BACKUP_TYPE = 'audio/wav; voice=backup';

const ttsKey = (version: string, text: string, o: SpeakOptions) => `${version}|${o.accent}|${o.slow ? 'slow' : 'normal'}|${o.kind === 'syllable' ? 'syl' : ''}|${text}`;

/**
 * Teacher takes generated by the server proxy (Gemini Live). Every take is kept on the device, so
 * a phrase is fetched once and then plays instantly — and keeps working offline.
 */
class GeminiTakes {
  private store = typeof indexedDB !== 'undefined' ? createStore('wunder-tutor-tts', 'takes') : undefined;
  private memory = new Map<string, Blob>();
  private inflight = new Map<string, Promise<Blob>>();
  /** Model/voice the server generates with — a different voice is a different take. */
  version = '';
  constructor(readonly provider: CloudVoice = 'gemini') {}

  /** Takes that failed the tone check this session — not fetched again. */
  private rejected = new Set<string>();

  fetch(text: string, opts: SpeakOptions): Promise<Blob> {
    // Qwen slow playback stretches the same recording locally; it needs no second paid take.
    const key = ttsKey(this.version, text, this.provider === 'qwen' ? { ...opts, slow: false } : opts);
    const hit = this.memory.get(key);
    if (hit) return Promise.resolve(hit);
    if (this.rejected.has(key)) return Promise.reject(new Error('tts tone mismatch'));
    let job = this.inflight.get(key);
    if (!job) {
      job = this.load(key, text, opts).finally(() => this.inflight.delete(key));
      this.inflight.set(key, job);
    }
    return job;
  }

  /**
   * Mandarin: a take whose tone is confidently wrong is never played (the device voice speaks instead). The tone model
   * knows the teacher's voice; the backup voice reads exactly the text (and passed the server's tone gate).
   */
  private async toneOk(blob: Blob, text: string, opts: SpeakOptions): Promise<boolean> {
    if (this.provider !== 'gemini' || opts.accent !== 'zh-CN' || blob.type === BACKUP_TYPE) return true;
    try { return teacherToneOk(await blob.arrayBuffer(), text, this.version.split('/').slice(-1)[0] ?? ''); } catch { return true; }
  }

  private async load(key: string, text: string, opts: SpeakOptions): Promise<Blob> {
    try {
      const stored = this.store && (await get<Blob>(key, this.store));
      if (stored && (await this.toneOk(stored, text, opts))) { this.memory.set(key, stored); return stored; }
    } catch { /* storage unavailable — fetch instead */ }

    const got = await this.ask(text, opts);
    const blob = got.voice === 'backup' ? new Blob([got.blob], { type: BACKUP_TYPE }) : got.blob;
    if (!(await this.toneOk(blob, text, opts))) {
      // The teacher's take, turned away by this device's tone check, is not the last word: the backup voice reads the
      // line (the server keeps that take beside the teacher's). Before, the line went silent for the session (2026-09-22).
      if (!opts.backup) return this.load(key, text, { ...opts, backup: true });
      this.rejected.add(key);
      throw new VoiceError('take');
    }
    this.memory.set(key, blob);
    try { if (this.store) await set(key, blob, this.store); } catch { /* memory cache only */ }
    return blob;
  }

  /**
   * One request to the server. It may take a while: the teacher gets up to 24 s of tries, then the backup voice reads
   * the line (server/tts.mjs), so the wait here is longer than that. A network blip (a phone changing networks) gets one
   * more go; an answer that is not audio carries the server's reason, so the learner can be told the right thing.
   */
  private async ask(text: string, opts: SpeakOptions, retried = false): Promise<{ blob: Blob; voice: string | null }> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 40000);
    try {
      const res = await apiFetch('/api/tts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
        body: JSON.stringify({ provider: this.provider, text, accent: opts.accent, slow: !!opts.slow, kind: opts.kind === 'syllable' ? 'syllable' : undefined, ephemeral: opts.ephemeral || undefined, backup: opts.backup || undefined }),
      });
      if (!res.ok || !res.headers.get('content-type')?.startsWith('audio/')) {
        let code = `http_${res.status}`;
        try { code = String(((await res.json()) as { error?: string }).error ?? code); } catch { /* not the API's JSON: Cloudflare's own error page */ }
        throw new VoiceError('take', code);
      }
      return { blob: await res.blob(), voice: res.headers.get('x-tts-voice') };
    } catch (e) {
      if (e instanceof VoiceError || retried || ctl.signal.aborted) throw e;
      await new Promise((r) => setTimeout(r, 700));
      return this.ask(text, opts, true);
    } finally {
      clearTimeout(timer);
    }
  }
}

// ---------------------------------------------------------------- the voice the app uses

class TeacherVoice implements ReferenceVoice {
  private web = new WebSpeechVoice();
  private takes = new Map<CloudVoice, GeminiTakes>();
  /** Bumped by stop() and by every new speak(), so a slow download can't start talking over something newer. */
  private seq = 0;
  private cancelPending: (() => void) | null = null;

  constructor() { void this.ready().catch(() => undefined); }

  /**
   * What the server offers this device, read again before each use: apiHealth keeps the answer until it may have
   * changed (a new invite code, a failed check). Read once at start, the teacher stayed silent after a code was entered
   * in Settings, until the app was closed (see fromHealth).
   */
  private async ready(): Promise<GeminiTakes | null> {
    if (teacherVoiceChoice() === 'device') return null;
    const h = await apiHealth();
    const provider = selectedVoice(h);
    if (provider === 'device') return null;
    if (!voiceConfigured(provider, h)) throw new VoiceError('take', 'voice_not_configured');
    let takes = this.takes.get(provider);
    if (!takes) { takes = new GeminiTakes(provider); this.takes.set(provider, takes); }
    // Preserve existing Gemini cache keys; newly selectable providers get their own namespace.
    takes.version = provider === 'gemini' ? h.ttsVersion : provider + '/' + (h.voiceVersions?.[provider] ?? h.ttsVersion);
    return takes;
  }

  /**
   * Answered at once, so from the newest answer the server gave rather than the one this voice last read: after
   * "You're in!" in setup, the speaking check asked before any word had played and got the answer from before the
   * code, "no", which on a phone (no device voice) became "Sound isn't working on this device" (2026-09-22). Before
   * the server has answered at all, the answer is yes: speak() finds out, and says why if it cannot.
   */
  available(): boolean {
    const h = knownHealth();
    if (!h) return true;
    const provider = selectedVoice(h);
    return provider === 'device' ? this.web.available() : voiceConfigured(provider, h);
  }

  /** Which engine is in use — shown in the Parent Zone. */
  async engine(): Promise<CloudVoice | 'device' | 'none'> {
    const takes = await this.ready();
    return takes?.provider ?? (this.web.available() ? 'device' : 'none');
  }

  /** Warm the cache for something the learner is about to hear. */
  prefetch(text: string, opts: SpeakOptions): void {
    // Preview the locale-aware primary without playing or creating a fallback cascade.
    void apiHealth().then(h => {
      const choice = teacherVoiceChoice(), provider = choice === 'auto' ? automaticVoices(h, opts.accent)[0] : choice;
      if (!provider || provider === 'device' || !voiceSupports(provider, opts.accent) || !voiceConfigured(provider, h)) return;
      let takes = this.takes.get(provider);
      if (!takes) { takes = new GeminiTakes(provider); this.takes.set(provider, takes); }
      takes.version = provider === 'gemini' ? h.ttsVersion : provider + '/' + (h.voiceVersions?.[provider] ?? h.ttsVersion);
      return takes.fetch(text, opts);
    }).catch(() => undefined);
  }

  async speak(text: string, opts: SpeakOptions): Promise<void> {
    this.cancelPending?.();
    const mine = ++this.seq, choice = teacherVoiceChoice();
    this.web.stop(); pauseCurrent();
    const cancelled = new Promise<void>(resolve => { this.cancelPending = resolve; });
    // A stopped/superseded caller settles immediately; shared downloads may still warm the cache.
    try { await Promise.race([this.perform(text, opts, mine, choice), cancelled]); }
    finally { if (mine === this.seq) this.cancelPending = null; }
  }

  private async perform(text: string, opts: SpeakOptions, mine: number, choice: ReturnType<typeof teacherVoiceChoice>): Promise<void> {
    if (choice === 'device') return this.web.speak(text, opts);
    const h = await apiHealth();
    if (mine !== this.seq) return;
    if (!voiceSupports(choice, opts.accent)) throw new VoiceError('take', 'voice_locale_unavailable');
    const candidates: CloudVoice[] = choice === 'auto' ? automaticVoices(h, opts.accent) : [choice];
    if (choice === 'auto' && opts.preview && opts.accent !== 'zh-HK' && !candidates.length) candidates.push('gemini');
    let refused: VoiceError | null = null;
    for (const provider of candidates) {
      if (choice !== 'auto' && !voiceConfigured(provider, h)) throw new VoiceError('take', 'voice_not_configured');
      let takes = this.takes.get(provider);
      if (!takes) { takes = new GeminiTakes(provider); this.takes.set(provider, takes); }
      takes.version = provider === 'gemini' ? h.ttsVersion : provider + '/' + (h.voiceVersions?.[provider] ?? h.ttsVersion);
      let blob: Blob;
      try { blob = await takes.fetch(text, opts); }
      catch (e) {
        if (mine !== this.seq) return;
        refused = e instanceof VoiceError ? e : new VoiceError('take');
        // Access and account/budget limits apply to every cloud provider. Do not multiply paid attempts.
        if (['daily_limit', 'rate_limited', 'tts_budget_exceeded', 'unauthorized', 'http_401', 'http_403'].includes(refused.code ?? '')) break;
        continue;
      }
      if (mine !== this.seq) return;
      try { await playBlob(blob, provider === 'qwen' && opts.slow ? 0.65 : 1); return; }
      catch { if (mine !== this.seq) return; refused = new VoiceError('playback'); }
    }
    if (choice === 'auto' && this.web.available()) {
      try { return await this.web.speak(text, opts); }
      catch (e) { throw refused ?? (e instanceof VoiceError ? e : new VoiceError('playback')); }
    }
    throw refused ?? new VoiceError('playback');
  }

  stop(): void {
    this.cancelPending?.(); this.cancelPending = null;
    this.seq += 1;
    this.web.stop();
    pauseCurrent();
  }
}

export const voice = new TeacherVoice();

export const stopPlayback = (): void => voice.stop();
