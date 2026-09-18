import type { Accent } from '../domain/types';

export interface SpeakOptions { accent: Accent; slow?: boolean }

/** Reference ("native") audio. Today: the device's speech synthesis. Later: recorded or neural audio by URL. */
export interface ReferenceVoice {
  available(): boolean;
  speak(text: string, opts: SpeakOptions): Promise<void>;
  stop(): void;
}

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

  private pick(accent: Accent): SpeechSynthesisVoice | undefined {
    const norm = (l: string) => l.replace('_', '-').toLowerCase();
    const exact = this.voices.filter((v) => norm(v.lang) === accent.toLowerCase());
    const pool = exact.length ? exact : this.voices.filter((v) => norm(v.lang).startsWith('en'));
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

export const voice: ReferenceVoice = new WebSpeechVoice();

let current: HTMLAudioElement | null = null;

/** Play back one of the learner's own recordings. */
export const playBlob = (blob: Blob): Promise<void> =>
  new Promise((resolve, reject) => {
    stopPlayback();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    current = audio;
    const end = () => { URL.revokeObjectURL(url); if (current === audio) current = null; };
    audio.onended = () => { end(); resolve(); };
    audio.onerror = () => { end(); reject(new Error('playback-unavailable')); };
    audio.play().catch((e) => { end(); reject(e); });
  });

export const stopPlayback = (): void => {
  voice.stop();
  if (current) { current.pause(); current = null; }
};
