import type { SpeechErrorCode } from '../../speech';
import { useProfile } from '../../state/store';
import { Button } from '../../ui/kit';

const COPY: Record<SpeechErrorCode, { icon: string; title: string; body: string; retry: string }> = {
  'mic-denied': { icon: '🎙️', title: 'I can’t hear you yet', body: 'The microphone is switched off for Wunder Tutor. Ask a grown-up to allow it in the browser’s site settings, then try again.', retry: 'Try again' },
  'mic-unavailable': { icon: '🔌', title: 'No microphone found', body: 'Plug in or switch on a microphone, then try again.', retry: 'Try again' },
  'no-speech': { icon: '🤫', title: 'I didn’t hear anything', body: 'Tap the mic, wait for Pip’s ears to pop up, then say it nice and loud.', retry: 'Try again' },
  'too-noisy': { icon: '🔊', title: 'It’s a bit noisy here', body: 'Find a quieter spot or hold the device closer, then try again.', retry: 'Try again' },
  'too-short': { icon: '⚡', title: 'That was super quick!', body: 'Say the whole thing, slowly and clearly.', retry: 'Try again' },
  network: { icon: '📡', title: 'No internet right now', body: 'Check your connection. Your progress is safe — try again when you’re back online.', retry: 'Try again' },
  service: { icon: '🛠️', title: 'Pip’s ears need a moment', body: 'Something went wrong on our side, not yours. Please try again.', retry: 'Try again' },
  timeout: { icon: '⏳', title: 'That took too long', body: 'Checking your voice took longer than it should. Please try again.', retry: 'Try again' },
};

/** Grown-ups get plainer wording — and they are the ones who can change the browser's settings. */
const ADULT: Partial<Record<SpeechErrorCode, { title: string; body: string }>> = {
  'mic-denied': { title: 'The microphone is off', body: 'Microphone access is blocked for Wunder Tutor. Allow it in your browser’s site settings, then try again.' },
  'no-speech': { title: 'No speech heard', body: 'Tap the mic, wait until it shows it’s listening, then speak clearly.' },
  'too-short': { title: 'That was very quick', body: 'Say the whole thing clearly, at a natural pace.' },
  service: { title: 'Scoring is unavailable for a moment', body: 'Something went wrong on our side, not yours. Please try again.' },
};

export function ErrorPanel({ code, onRetry, onUseDemo }: { code: SpeechErrorCode; onRetry: () => void; onUseDemo: () => void }) {
  const adult = useProfile()?.band === 'adult';
  const c = { ...COPY[code], ...(adult ? ADULT[code] : undefined) };
  const micProblem = code === 'mic-denied' || code === 'mic-unavailable';
  return (
    <div className="error-panel" role="alert">
      <div className="error-panel__icon" aria-hidden>{c.icon}</div>
      <h2>{c.title}</h2>
      <p>{c.body}</p>
      <Button variant="coral" size="lg" icon="mic" block onClick={onRetry}>{c.retry}</Button>
      {micProblem && <button type="button" className="link" onClick={onUseDemo}>No microphone on this device? Use the demo microphone</button>}
    </div>
  );
}
