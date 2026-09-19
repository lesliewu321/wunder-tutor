import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Assessment, SpeakItem } from '../../domain/types';
import { syllableCount } from '../../content/lexicon';
import { getProvider, mockProvider, SpeechError, type Recording, type SpeechErrorCode } from '../../speech';
import { expectedSpeechMs, MicRecorder, simulatedRecording } from '../../speech/recorder';
import { localeOf, stopPlayback } from '../../speech/voice';
import { useActiveProfile, useStore } from '../../state/store';

export type TakePhase = 'idle' | 'listening' | 'processing';

interface Options {
  /** The mic button; receives the live input level through the `--level` CSS variable. */
  micRef: RefObject<HTMLElement>;
  onAssessed: (assessment: Assessment, recording: Recording) => void | Promise<void>;
  onError: (code: SpeechErrorCode) => void;
}

/**
 * One spoken take: Ready → Listening → Processing → (assessed | error).
 * Owns the microphone lifecycle so every speaking surface (lessons, Lab, AI practice, onboarding)
 * behaves identically — including cleanup when the child leaves mid-recording.
 */
export function useSpeechTake({ micRef, onAssessed, onError }: Options) {
  const profile = useActiveProfile();
  const settings = useStore((s) => s.settings);
  const [phase, setPhase] = useState<TakePhase>('idle');
  const [slowHint, setSlowHint] = useState(false);
  const recorder = useRef<MicRecorder | null>(null);
  const simTimer = useRef(0);
  const alive = useRef(true);
  const job = useRef<{ item: SpeakItem; attemptIndex: number } | null>(null);
  const handlers = useRef({ onAssessed, onError });
  handlers.current = { onAssessed, onError };

  const cancel = useCallback(() => {
    clearTimeout(simTimer.current);
    recorder.current?.cancel();
    recorder.current = null;
    job.current = null;
    setPhase('idle');
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; clearTimeout(simTimer.current); recorder.current?.cancel(); recorder.current = null; };
  }, []);

  const fail = (e: unknown) => {
    if (!alive.current) return;
    setPhase('idle');
    handlers.current.onError(e instanceof SpeechError ? e.code : 'service');
  };

  const assess = async (rec: Recording) => {
    const j = job.current;
    if (!j || !alive.current) return;
    setPhase('processing');
    setSlowHint(false);
    const slow = window.setTimeout(() => alive.current && setSlowHint(true), 3500);
    try {
      // Simulated takes carry no audio, so they always go to the built-in learner model.
      const provider = rec.simulated ? mockProvider : await getProvider();
      const st = useStore.getState();
      const fresh = st.profiles[profile.id] ?? profile;
      const assessment = await provider.assess(rec, j.item.text, {
        itemId: j.item.id, locale: localeOf(j.item, fresh.accent), accent: fresh.accent, zh: j.item.zh, script: fresh.zhScript, focus: j.item.focus,
        // Tones are judged against the child's own voice once we've heard enough of it.
        speaker: fresh.voice && fresh.voice.takes >= 3 ? fresh.voice : null,
        band: fresh.band, homeLanguage: fresh.homeLanguage, profileId: fresh.id,
        attemptIndex: j.attemptIndex, profile: fresh.pronunciation, simulate: st.settings.simulate,
      });
      if (!alive.current) return;
      await handlers.current.onAssessed(assessment, rec);
      if (alive.current) setPhase('idle');
    } catch (e) {
      fail(e);
    } finally {
      clearTimeout(slow);
    }
  };

  const stop = useCallback(async () => {
    clearTimeout(simTimer.current);
    const j = job.current;
    if (!j) return;
    if (useStore.getState().settings.demoMic) return assess(simulatedRecording(syllableCount(j.item.text)));
    const rec = recorder.current;
    recorder.current = null;
    if (!rec) return;
    setPhase('processing');
    try { await assess(await rec.stop()); } catch (e) { fail(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async (item: SpeakItem, attemptIndex: number) => {
    stopPlayback();
    job.current = { item, attemptIndex };
    const syllables = syllableCount(item.text);
    if (settings.demoMic) {
      setPhase('listening');
      // Fake a lively input level so the listening state still reads as "I hear you".
      const started = performance.now();
      const total = expectedSpeechMs(syllables) + 500;
      const pulse = () => {
        const t = performance.now() - started;
        micRef.current?.style.setProperty('--level', String(0.25 + 0.5 * Math.abs(Math.sin(t / 120)) * (t < total - 400 ? 1 : 0.2)));
        if (t < total) simTimer.current = window.setTimeout(pulse, 60); else void stop();
      };
      pulse();
      return;
    }
    const rec = new MicRecorder();
    try {
      await rec.start({
        maxMs: expectedSpeechMs(syllables) * 2.5 + 2500,
        onLevel: (l) => micRef.current?.style.setProperty('--level', l.toFixed(3)),
        onAutoStop: () => void stop(),
      });
      if (!alive.current) { rec.cancel(); return; }
      recorder.current = rec;
      setPhase('listening');
    } catch (e) {
      fail(e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.demoMic, stop]);

  return { phase, slowHint, start, stop, cancel };
}
