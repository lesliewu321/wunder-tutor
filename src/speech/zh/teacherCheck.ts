import { parseSyllable, surfaceTones } from '../../content/zh/pinyin';
import { ZH_ITEMS } from '../../content/zh/course';
import { hanChars } from '../../content/zh/script';
import { trackPitch, type PitchTrack } from '../pitch';
import { DEFAULT_TONE_PARAMS, judgeTone, readTone, type SpeakerRef } from './tone';

// Tone check for the TEACHER's Mandarin recordings. The server keeps a Gemini take only if its transcript matches and
// Azure scores it well — but Azure is lenient on tones, so a 麻 má said as 马 mǎ could slip through and teach the
// wrong tone (the minimal-pair listening games rely on single characters). The teacher is one known Gemini voice,
// so its pitch profile is fixed and the tone model (trained on it among others) reads it reliably. A confident
// mismatch means: don't use that take; the device voice speaks instead.

/** Pitch profiles of the teacher voices, as the app's voice profile measures them (eval/teacher-check.ts). */
export const TEACHER_VOICES: Record<string, SpeakerRef> = {
  Kore: { median: 12.1, spread: 10.7, takes: 147 },
};

/**
 * Only a near-certain wrong reading rejects a take. eval/teacher-check.ts (Kore, single characters): 70 of 70 correct
 * takes kept, 27 of 37 takes of the wrong character (a different tone) caught.
 */
const STRICT = { ...DEFAULT_TONE_PARAMS, maxExpected: 0.1 };

/** Single characters in the course, and the tone each should carry when said on its own. */
const SINGLE_TONE = new Map<string, 1 | 2 | 3 | 4>();
for (const it of ZH_ITEMS) {
  const t = it.zh && hanChars(it.text).length === 1 ? parseSyllable(it.zh.py).tone : 5;
  if (t !== 5) SINGLE_TONE.set(hanChars(it.text)[0], t);
}

/** 16-bit PCM WAV → mono samples. Null for anything else. */
export function wavSamples(buf: ArrayBuffer): { samples: Float32Array; rate: number } | null {
  const v = new DataView(buf);
  if (buf.byteLength < 44 || v.getUint32(0, false) !== 0x52494646 || v.getUint32(8, false) !== 0x57415645) return null; // RIFF … WAVE
  let rate = 0, bits = 0, channels = 0;
  for (let p = 12; p + 8 <= buf.byteLength;) {
    const id = v.getUint32(p, false), size = v.getUint32(p + 4, true), body = p + 8;
    if (id === 0x666d7420) { channels = v.getUint16(body + 2, true); rate = v.getUint32(body + 4, true); bits = v.getUint16(body + 14, true); } // "fmt "
    if (id === 0x64617461) { // "data"
      if (bits !== 16 || !rate || !channels) return null;
      const n = Math.floor(Math.min(size, buf.byteLength - body) / (2 * channels));
      const samples = new Float32Array(n);
      for (let i = 0; i < n; i++) samples[i] = v.getInt16(body + i * 2 * channels, true) / 32768;
      return { samples, rate };
    }
    p = body + size + (size & 1);
  }
  return null;
}

/** One character said on its own: is its tone confidently NOT the expected one? */
export function toneClearlyWrong(track: PitchTrack, tone: 1 | 2 | 3 | 4, ref: SpeakerRef): boolean {
  const voiced = Array.from(track.f0).map((f, i) => (f > 0 ? i : -1)).filter((i) => i >= 0);
  if (voiced.length < 8) return false;
  const span = { from: voiced[0] * track.hop, to: (voiced[voiced.length - 1] + 1) * track.hop };
  const reading = readTone(track, [span], 0, ref, 'alone', STRICT);
  return judgeTone(reading, surfaceTones([tone])[0].accept, 0, STRICT).wrong;
}

/**
 * False only when we are confident the teacher said a single character with the wrong tone. Anything we can't check
 * (phrases, unknown characters or voices, unreadable pitch) passes.
 */
export function teacherToneOk(wav: ArrayBuffer, text: string, voiceName: string): boolean {
  const chars = hanChars(text);
  const tone = chars.length === 1 ? SINGLE_TONE.get(chars[0]) : undefined;
  const ref = TEACHER_VOICES[voiceName];
  if (!tone || !ref) return true;
  const pcm = wavSamples(wav);
  if (!pcm) return true;
  return !toneClearlyWrong(trackPitch(pcm.samples, pcm.rate), tone, ref);
}
