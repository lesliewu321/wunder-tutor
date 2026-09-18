import type { Accent, AgeBand, Assessment, HomeLanguage, PronunciationProfile } from '../domain/types';

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
  analysis: AudioAnalysis;
  simulated: boolean;
}

export interface AssessContext {
  itemId: string;
  accent: Accent;
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
