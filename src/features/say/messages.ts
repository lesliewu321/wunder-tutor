import { SERVICE_WORDS, type ApiHealth, type ServiceStatus } from '../../speech/health';
import { ReadError, type Reading } from '../../speech/read';

/** What to tell the learner, and — when there is something they can do about it — where to send them. */
export interface Problem { text: string; fix?: 'code' | 'connections' }

const ERRORS: Record<ReadError['code'], Problem> = {
  offline: { text: 'No internet right now — try again when you’re back online.' },
  busy: { text: 'That was a lot of pages! Wait a few minutes, then try again.' },
  locked: { text: 'This device’s access code isn’t accepted — it may have been changed. Enter it again to read pages.', fix: 'code' },
  unavailable: { text: 'Reading pages isn’t switched on yet on the Wunder Tutor server.', fix: 'connections' },
  photo: { text: 'That photo couldn’t be opened. Take a new one, or choose a JPEG or PNG.' },
  failed: { text: 'The page couldn’t be read this time. Try again with the page flat, still and well lit.' },
};

/** A key or server problem isn't the photo's fault: say so, instead of "hold the page flat". */
const SETUP = /^read_(key|region|model|quota)\b/;

/** Reading failed: what to say. The server's reason is added in brackets, for testers' screenshots. */
export const readProblem = (e: unknown): Problem => {
  if (!(e instanceof ReadError)) return ERRORS.failed;
  const p = ERRORS[e.code];
  if (e.code === 'failed' && e.detail && SETUP.test(e.detail)) return { text: `Reading pages isn’t working yet — a setup problem on the Wunder Tutor server, not your photo. (${e.detail})`, fix: 'connections' };
  return e.detail && (e.code === 'failed' || e.code === 'unavailable') ? { ...p, text: `${p.text} (${e.detail})` } : p;
};

/** A page with nothing to practise: why. Null when it has sentences. */
export const readingProblem = (r: Reading, kid: boolean): string | null =>
  r.language === 'none' || !r.lines.length
    ? (kid ? 'I couldn’t find any words. Hold the book closer, in good light.' : 'No text found. Hold the page closer, in good light.')
    : r.language === 'other' ? 'Wunder Tutor can check English and Putonghua for now.' : null;

/**
 * Before the first photo: can this device read pages at all? Every failed attempt on the live app (2026-09-19/20)
 * was a setup problem that only showed after the photo was taken. Null when all is well — or when the check itself
 * couldn't run, which must never block the camera.
 */
export function setupProblem(health: ApiHealth, hasCode: boolean, status: ServiceStatus | null): Problem | null {
  if (health.needsCode && !health.authorized) {
    return hasCode ? ERRORS.locked : { text: 'Reading pages needs the beta access code.', fix: 'code' };
  }
  if (!health.read) return health.needsCode || health.azure ? ERRORS.unavailable : null; // no API at all: the health check failed or this is a static preview
  if (status && status.reading !== 'ok' && status.reading !== 'unchecked') {
    return { text: `Reading pages isn’t working yet: ${SERVICE_WORDS[status.reading].toLowerCase()} (Google). It’s a setup problem on the Wunder Tutor server, not your camera.`, fix: 'connections' };
  }
  return null;
}
