import { trackPitch, type PitchTrack } from './pitch';
import { encodeWav, speechWindow } from './wav';
import { SpeechError, type AudioAnalysis, type Recording } from './types';

export interface RecorderOptions {
  /** Hard cap on recording length. */
  maxMs: number;
  /** Live input level 0–1 for the mic animation. */
  onLevel?: (level: number) => void;
  /** Fired once when the recorder decides the child has finished (silence after speech, or maxMs). */
  onAutoStop?: () => void;
}

const SILENCE_AFTER_SPEECH_MS = 1100;
const SPEECH_LEVEL = 0.045;

type AC = typeof AudioContext;
const AudioCtx: AC | undefined =
  typeof window !== 'undefined' ? (window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext) : undefined;

export const micSupported = (): boolean =>
  typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined' && !!AudioCtx;

/** Tap-to-talk microphone capture with a live level meter and end-of-speech detection. */
export class MicRecorder {
  private stream?: MediaStream;
  private media?: MediaRecorder;
  private ctx?: AudioContext;
  private chunks: Blob[] = [];
  private raf = 0;
  private timer = 0;
  private startedAt = 0;
  private stopped = false;

  async start(opts: RecorderOptions): Promise<void> {
    if (!micSupported()) throw new SpeechError('mic-unavailable');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (e) {
      const name = (e as DOMException)?.name;
      throw new SpeechError(name === 'NotAllowedError' || name === 'SecurityError' ? 'mic-denied' : 'mic-unavailable');
    }

    this.ctx = new AudioCtx!();
    const source = this.ctx.createMediaStreamSource(this.stream);
    const analyser = this.ctx.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    this.chunks = [];
    this.media = new MediaRecorder(this.stream);
    this.media.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.media.start();
    this.startedAt = performance.now();
    this.stopped = false;

    let heardSpeechAt = 0;
    let lastLoudAt = 0;
    let fired = false;
    const fire = () => { if (!fired && !this.stopped) { fired = true; opts.onAutoStop?.(); } };

    const tick = () => {
      if (this.stopped) return;
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const level = Math.min(1, rms * 6);
      opts.onLevel?.(level);
      const now = performance.now();
      if (level > SPEECH_LEVEL) { lastLoudAt = now; heardSpeechAt ||= now; }
      if (heardSpeechAt && now - heardSpeechAt > 350 && now - lastLoudAt > SILENCE_AFTER_SPEECH_MS) fire();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    this.timer = window.setTimeout(fire, opts.maxMs);
  }

  async stop(): Promise<Recording> {
    const media = this.media;
    if (!media) throw new SpeechError('mic-unavailable');
    const durationMs = performance.now() - this.startedAt;
    // If the track already ended (an iOS interruption, a headset unplugged), "stop" has fired before we listened for
    // it — don't wait for it. A timeout guards against a recorder that never reports back.
    const done = media.state === 'inactive'
      ? Promise.resolve()
      : new Promise<void>((resolve) => { media.onstop = () => resolve(); window.setTimeout(resolve, 3000); media.stop(); });
    await done;
    const blob = new Blob(this.chunks, { type: media.mimeType || 'audio/webm' });
    this.release();

    let analysis: AudioAnalysis = { durationMs, speechMs: 0, peak: 0, speechRms: 0, noiseRms: 0 };
    let wav: Blob | undefined;
    let pitch: PitchTrack | null = null;
    let pcm: Float32Array | undefined;
    try {
      const decoded = await decode(blob);
      analysis = analyse(decoded.getChannelData(0), decoded.sampleRate);
      const out = await toWav16k(decoded);
      // The scorer bills for every second it hears: send the speech with a safe margin, not the pauses around it.
      const [from, to] = speechWindow(out.pcm);
      pcm = out.pcm.subarray(from, to);
      wav = new Blob([encodeWav(pcm)], { type: 'audio/wav' });
      // Measured on exactly the audio the scorer receives, so its syllable timings line up with this track.
      try { pitch = trackPitch(pcm, 16000); } catch { pitch = null; }
    } catch {
      // Some browsers cannot decode their own MediaRecorder output; fall back to duration only
      // and let the provider judge the audio.
      analysis = { durationMs, speechMs: durationMs * 0.6, peak: 0.5, speechRms: 0.1, noiseRms: 0.005 };
    }
    return { blob, wav, pcm, pitch, analysis, simulated: false };
  }

  /** Abort without producing a recording (child left the screen, pressed back, …). */
  cancel(): void {
    try { if (this.media && this.media.state !== 'inactive') this.media.stop(); } catch { /* already stopped */ }
    this.release();
  }

  private release(): void {
    this.stopped = true;
    cancelAnimationFrame(this.raf);
    clearTimeout(this.timer);
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.ctx?.close().catch(() => undefined);
    this.stream = undefined;
    this.media = undefined;
    this.ctx = undefined;
  }
}

const decode = async (blob: Blob): Promise<AudioBuffer> => {
  const ctx = new AudioCtx!();
  try { return await ctx.decodeAudioData(await blob.arrayBuffer()); } finally { void ctx.close(); }
};

export const analyse = (samples: Float32Array, sampleRate: number): AudioAnalysis => {
  const frame = Math.floor(sampleRate * 0.02);
  const rms: number[] = [];
  let peak = 0;
  for (let i = 0; i + frame <= samples.length; i += frame) {
    let sum = 0;
    for (let j = i; j < i + frame; j++) { const v = samples[j]; sum += v * v; if (Math.abs(v) > peak) peak = Math.abs(v); }
    rms.push(Math.sqrt(sum / frame));
  }
  const sorted = [...rms].sort((a, b) => a - b);
  const noiseRms = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
  const threshold = Math.max(noiseRms * 3, 0.012);
  const speech = rms.filter((r) => r > threshold);
  return {
    durationMs: (samples.length / sampleRate) * 1000,
    speechMs: speech.length * 20,
    peak,
    speechRms: speech.length ? speech.reduce((a, b) => a + b, 0) / speech.length : 0,
    noiseRms,
  };
};

const toWav16k = async (buffer: AudioBuffer): Promise<{ wav: Blob; pcm: Float32Array }> => {
  const rate = 16000;
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(buffer.duration * rate)), rate);
  const src = offline.createBufferSource();
  src.buffer = buffer;
  src.connect(offline.destination);
  src.start();
  const pcm = (await offline.startRendering()).getChannelData(0);
  return { wav: new Blob([encodeWav(pcm, rate)], { type: 'audio/wav' }), pcm };
};

/** A stored recording (whatever the browser recorded) as 16 kHz mono WAV — for sharing recordings for testing. */
export const blobToWav16k = async (blob: Blob): Promise<Blob> => (await toWav16k(await decode(blob))).wav;

/** How long a fluent speaker needs for a text — used for max recording time and simulated takes. */
export const expectedSpeechMs = (syllables: number): number => 450 + syllables * 260;

/** Simulated-microphone take so the whole loop can be demonstrated on a device without a mic. */
export const simulatedRecording = (syllables: number): Recording => {
  const speechMs = expectedSpeechMs(syllables);
  return { simulated: true, analysis: { durationMs: speechMs + 700, speechMs, peak: 0.6, speechRms: 0.12, noiseRms: 0.004 } };
};
