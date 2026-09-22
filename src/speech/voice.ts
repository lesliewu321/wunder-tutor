import { createStore, get, set } from 'idb-keyval';
import type { Accent, Locale, SpeakItem } from '../domain/types';
import { apiFetch, apiHealth, knownHealth } from './health';
import { VoiceError } from './types';
import { teacherToneOk } from './zh/teacherCheck';

/** Mandarin items always speak Mandarin; everything else is English in the child's accent. */
export const localeOf = (item: Pick<SpeakItem, 'lang'> | undefined | null, accent: Accent): Locale => item?.lang ?? accent;

export interface SpeakOptions {
  /** The language to speak in: the child's English accent, or 'zh-CN' for Mandarin. */
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
    const pool = exact.length ? exact : accent === 'zh-CN' ? this.voices.filter((v) => /^(zh-cn|cmn)/.test(norm(v.lang))) : this.voices.filter((v) => norm(v.lang).startsWith('en'));
    for (const re of PREFERRED) { const v = pool.find((x) => re.test(x.name)); if (v) return v; }
    return pool[0];
  }

  speak(text: string, { accent, slow }: SpeakOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.available()) return reject(new Error('playback-unavailable'));
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const voice = this.pick(accent);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? accent;
      u.rate = slow ? 0.55 : 0.92;
      u.pitch = 1.05;
      // Some engines never fire onend (or fire nothing at all when no voice is installed):
      // resolve on a generous timer so the UI can never get stuck in a "playing" state.
      const guard = window.setTimeout(done, 1500 + text.length * (slow ? 190 : 110));
      function done() { clearTimeout(guard); resolve(); }
      u.onend = done;
      u.onerror = (e) => { clearTimeout(guard); e.error === 'interrupted' || e.error === 'canceled' ? resolve() : reject(new Error('playback-unavailable')); };
      speechSynthesis.speak(u);
    });
  }

  stop(): void {
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
export const playBlob = (blob: Blob): Promise<void> =>
  new Promise((resolve, reject) => {
    pauseCurrent();
    const el = element();
    const url = URL.createObjectURL(blob);
    const mine = { url, end: (err?: Error) => (err ? reject(err) : resolve()) };
    playing = mine;
    const end = (err?: Error) => { if (playing !== mine) return; playing = null; URL.revokeObjectURL(url); mine.end(err); };
    el.onended = () => end();
    // A pause the app did not ask for (a phone call, the system): over. The 'pause' event of the take before this one
    // arrives late, while this one is already playing (el.paused false) — not this take's business.
    el.onpause = () => { if (el.paused) end(); };
    el.onerror = () => end(new Error('playback-unavailable'));
    el.src = url;
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

  /** Takes that failed the tone check this session — not fetched again. */
  private rejected = new Set<string>();

  fetch(text: string, opts: SpeakOptions): Promise<Blob> {
    const key = ttsKey(this.version, text, opts);
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
    if (opts.accent !== 'zh-CN' || blob.type === BACKUP_TYPE) return true;
    try { return teacherToneOk(await blob.arrayBuffer(), text, this.version.split('/')[1] ?? ''); } catch { return true; }
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
        body: JSON.stringify({ text, accent: opts.accent, slow: !!opts.slow, kind: opts.kind === 'syllable' ? 'syllable' : undefined, ephemeral: opts.ephemeral || undefined, backup: opts.backup || undefined }),
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
  private takes = new GeminiTakes();
  private gemini: boolean | null = null;
  /** Bumped by stop() and by every new speak(), so a slow download can't start talking over something newer. */
  private seq = 0;

  constructor() { void this.ready(); }

  /**
   * What the server offers this device, read again before each use: apiHealth keeps the answer until it may have
   * changed (a new invite code, a failed check). Read once at start, the teacher stayed silent after a code was entered
   * in Settings, until the app was closed (see fromHealth).
   */
  private async ready(): Promise<void> {
    const h = await apiHealth();
    this.gemini = h.gemini;
    this.takes.version = h.ttsVersion;
  }

  /**
   * Answered at once, so from the newest answer the server gave rather than the one this voice last read: after
   * "You're in!" in setup, the speaking check asked before any word had played and got the answer from before the
   * code, "no", which on a phone (no device voice) became "Sound isn't working on this device" (2026-09-22). Before
   * the server has answered at all, the answer is yes: speak() finds out, and says why if it cannot.
   */
  available(): boolean {
    return this.web.available() || knownHealth()?.gemini !== false;
  }

  /** Which engine is in use — shown in the Parent Zone. */
  async engine(): Promise<'gemini' | 'device' | 'none'> {
    await this.ready();
    return this.gemini ? 'gemini' : this.web.available() ? 'device' : 'none';
  }

  /** Warm the cache for something the learner is about to hear. */
  prefetch(text: string, opts: SpeakOptions): void {
    void this.ready().then(() => { if (this.gemini) void this.takes.fetch(text, opts).catch(() => undefined); });
  }

  async speak(text: string, opts: SpeakOptions): Promise<void> {
    const mine = ++this.seq;
    this.web.stop();
    pauseCurrent();
    await this.ready();
    if (mine !== this.seq) return;
    // Which half failed matters to the learner. On the web a failure quietly became the device voice and nobody had
    // to know; in the phone app there is no device voice (Android's WebView has no speechSynthesis), so whatever
    // went wrong is what they are told — and "your device has no sound" is a lie when the truth is that the teacher
    // could not say this particular line. 四是四，十是十。 is exactly that case: the server scores its own take and
    // will not serve one that is not clean enough, and for the hardest tongue twister it never gets one.
    let refused: VoiceError | null = null;
    // Setup's accent preview plays before the device has a code: the server serves those few lines to anyone.
    if (this.gemini || opts.preview) {
      let blob: Blob | undefined;
      try {
        blob = await this.takes.fetch(text, opts);
      } catch (e) {                                       // the take was never made, or was judged not good enough
        refused = e instanceof VoiceError ? e : new VoiceError('take');
      }
      if (mine !== this.seq) return;
      if (blob) {
        try {
          return await playBlob(blob);
        } catch {
          if (mine !== this.seq) return;                  // a real playback fault: the device, or the audio itself
        }
      }
    }
    if (this.web.available()) return this.web.speak(text, opts);
    throw refused ?? new VoiceError('playback');
  }

  stop(): void {
    this.seq += 1;
    this.web.stop();
    pauseCurrent();
  }
}

export const voice = new TeacherVoice();

export const stopPlayback = (): void => voice.stop();
