import type { Accent, AgeBand, Assessment, HomeLanguage, Locale, PhonemeId, PronunciationProfile, ZhText } from '../domain/types';
import type { PitchTrack } from './pitch';
import type { SpeakerRef } from './zh/tone';

export type SpeechErrorCode =
  | 'mic-denied'
  | 'mic-unavailable'
  | 'no-speech'
  | 'too-noisy'
  | 'too-short'
  | 'network'
  | 'service'
  | 'timeout';

export class SpeechError extends Error {
  constructor(public code: SpeechErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'SpeechError';
  }
}

/**
 * Why nothing was heard when the teacher should have spoken. 'take' = the voice could not produce this line (the
 * server refused it, or judged its own recording too unclear to teach from); 'playback' = the audio existed and the
 * device would not play it. They deserve different sentences: one is about the line, the other about the phone.
 *
 * It lives here, with the other speech error, rather than beside the voice: the health module has to recognise it,
 * and the voice module reads the health module, so the other direction would be a circle.
 */
export class VoiceError extends Error {
  constructor(readonly reason: 'take' | 'playback') {
    super(`voice: ${reason}`);
    this.name = 'VoiceError';
  }
}

/** Signal-level facts about a recording, computed on-device before any provider is called. */
export interface AudioAnalysis {
  durationMs: number;
  speechMs: number;
  peak: number;
  speechRms: number;
  noiseRms: number;
}

export interface Recording {
  /** Compressed audio for playback ("Hear my attempt"). Absent in simulated-mic mode. */
  blob?: Blob;
  /** 16 kHz mono PCM WAV for the assessment provider. */
  wav?: Blob;
  /** The same audio as samples (speech plus a margin — the pauses around it are trimmed). */
  pcm?: Float32Array;
  /** Pitch of the take, measured on the device (the same 16 kHz audio the scorer hears) — for Mandarin tones. */
  pitch?: PitchTrack | null;
  analysis: AudioAnalysis;
  simulated: boolean;
}

export interface AssessContext {
  itemId: string;
  /** What the take is scored as: English in the child's accent, or Mandarin. */
  locale: Locale;
  /** The child's English accent (for English items; Mandarin items ignore it). */
  accent: Accent;
  /** Mandarin items: Traditional form and numbered pinyin. */
  zh?: ZhText;
  /** Mandarin: the characters the learner reads — feedback uses them (scoring always uses Simplified). */
  script?: 'hant' | 'hans';
  /** Sounds the item deliberately practises — checked first when extra scorings are rationed. */
  focus?: PhonemeId[];
  /** The child's usual pitch, learned across takes, so tones are judged against their own voice. */
  speaker?: SpeakerRef | null;
  band: AgeBand;
  homeLanguage: HomeLanguage;
  profileId: string;
  /** 0 for the first try at this item in this sitting, 1 for the first retry, … */
  attemptIndex: number;
  /** Lets a provider (the mock) model long-term improvement. Real providers ignore it. */
  profile?: PronunciationProfile;
  simulate?: 'none' | 'network' | 'service' | 'slow';
}

/**
 * The only contract the app knows about. Azure, a future on-device model or any other
 * vendor implements this; nothing above the speech layer imports a vendor type.
 */
export interface PronunciationProvider {
  readonly name: string;
  assess(recording: Recording, referenceText: string, ctx: AssessContext): Promise<Assessment>;
}
