import type { Key } from '../../i18n';
import { useT } from '../../i18n/useT';
import type { SpeechErrorCode } from '../../speech';
import { useProfile } from '../../state/store';
import { Button } from '../../ui/kit';

const COPY: Record<SpeechErrorCode, { icon: string; title: Key; body: Key; retry: Key }> = {
  'mic-denied': { icon: '🎙️', title: 'speak.error.micDenied.title', body: 'speak.error.micDenied.body', retry: 'common.tryAgain' },
  'mic-unavailable': { icon: '🔌', title: 'speak.error.micUnavailable.title', body: 'speak.error.micUnavailable.body', retry: 'common.tryAgain' },
  'no-speech': { icon: '🤫', title: 'speak.error.noSpeech.title', body: 'speak.error.noSpeech.body', retry: 'common.tryAgain' },
  'too-noisy': { icon: '🔊', title: 'speak.error.tooNoisy.title', body: 'speak.error.tooNoisy.body', retry: 'common.tryAgain' },
  'too-short': { icon: '⚡', title: 'speak.error.tooShort.title', body: 'speak.error.tooShort.body', retry: 'common.tryAgain' },
  network: { icon: '📡', title: 'speak.error.network.title', body: 'speak.error.network.body', retry: 'common.tryAgain' },
  service: { icon: '🛠️', title: 'speak.error.service.title', body: 'speak.error.service.body', retry: 'common.tryAgain' },
  timeout: { icon: '⏳', title: 'speak.error.timeout.title', body: 'speak.error.timeout.body', retry: 'common.tryAgain' },
};

/** Grown-ups get plainer wording — and they are the ones who can change the browser's settings. */
const ADULT: Partial<Record<SpeechErrorCode, { title: Key; body: Key }>> = {
  'mic-denied': { title: 'speak.error.micDenied.title.adult', body: 'speak.error.micDenied.body.adult' },
  'no-speech': { title: 'speak.error.noSpeech.title.adult', body: 'speak.error.noSpeech.body.adult' },
  'too-short': { title: 'speak.error.tooShort.title.adult', body: 'speak.error.tooShort.body.adult' },
  service: { title: 'speak.error.service.title.adult', body: 'speak.error.service.body' },
};

export function ErrorPanel({ code, onRetry, onUseDemo }: { code: SpeechErrorCode; onRetry: () => void; onUseDemo: () => void }) {
  const { t } = useT();
  const adult = useProfile()?.band === 'adult';
  const c = { ...COPY[code], ...(adult ? ADULT[code] : undefined) };
  const micProblem = code === 'mic-denied' || code === 'mic-unavailable';
  return (
    <div className="error-panel" role="alert">
      <div className="error-panel__icon" aria-hidden>{c.icon}</div>
      <h2>{t(c.title)}</h2>
      <p>{t(c.body)}</p>
      <Button variant="coral" size="lg" icon="mic" block onClick={onRetry}>{t(c.retry)}</Button>
      {micProblem && <button type="button" className="link" onClick={onUseDemo}>{t('speak.error.useDemo')}</button>}
    </div>
  );
}
