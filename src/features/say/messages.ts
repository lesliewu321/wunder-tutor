import { SERVICE_WORDS, type ApiHealth, type ServiceState, type ServiceStatus } from '../../speech/health';
import { ReadError, type Reading } from '../../speech/read';

/** What to tell the learner, and — when there is something they can do about it — where to send them. */
export interface Problem { text: string; fix?: 'code' | 'connections' }

const ERRORS: Record<Exclude<ReadError['code'], 'cancelled'>, Problem> = {
  offline: { text: 'No internet right now — try again when you’re back online.' },
  busy: { text: 'That was a lot of pages! Wait a few minutes, then try again.' },
  locked: { text: 'This device’s access code isn’t accepted — it may have been changed. Enter it again to read pages.', fix: 'code' },
  lockout: { text: 'Too many wrong codes were tried from this network, so even the right one is turned away for now. Wait 10 minutes, then enter the code again.', fix: 'code' },
  unavailable: { text: 'Reading pages isn’t switched on yet on the Wunder Tutor server.', fix: 'connections' },
  photo: { text: 'That photo couldn’t be opened. Take a new one, or choose a JPEG or PNG.' },
  // Photo advice ("closer, brighter") is only ever given when the reader looked and found no words — see readingProblem.
  failed: { text: 'Reading didn’t work this time — a hiccup on our side, not your photo. Try again in a moment.' },
};

/** The server's own setup, not this attempt: a key Google refuses, a place Google doesn't serve, a model that's gone. */
const SETUP = /^read_(key|region|model)\b/;
/** Google's reader looked at the page and declined it (it won't recite long published text, or a safety filter). Trying again won't help. */
const DECLINED = /\b(RECITATION|SAFETY|PROHIBITED_CONTENT|BLOCKLIST|SPII)\b/;

/** Reading failed: what to say, and whose fault it is. The server's reason is added in brackets, for testers' screenshots. */
export const readProblem = (e: unknown): Problem => {
  if (!(e instanceof ReadError) || e.code === 'cancelled') return ERRORS.failed;
  const detail = e.detail ? ` (${e.detail})` : '';
  if (e.code === 'failed' && e.detail) {
    if (SETUP.test(e.detail)) return { text: `Reading pages isn’t working yet — a setup problem on the Wunder Tutor server, not your photo.${detail}`, fix: 'connections' };
    if (/^read_quota\b/.test(e.detail)) return { text: `The reading service is busy right now. Try again in a minute.${detail}` };
    if (DECLINED.test(e.detail)) return { text: `Google’s reader wouldn’t read this page. Try another page, or type the words instead.${detail}` };
  }
  const p = ERRORS[e.code];
  return e.code === 'failed' || e.code === 'unavailable' ? { ...p, text: `${p.text}${detail}` } : p;
};

/** A page with nothing to practise: why. Null when it has sentences. */
export const readingProblem = (r: Reading, kid: boolean): string | null =>
  r.language === 'none' || !r.lines.length
    ? (kid ? 'I couldn’t find any words. Hold the book closer, in good light.' : 'No text found. Hold the page closer, in good light.')
    : r.language === 'other' ? 'Wunder Tutor can check English and Putonghua for now.' : null;

/** A live check that found the service itself wrong. A timeout, a server error or a rate limit is NOT one: reading may well work. */
const BROKEN: ReadonlySet<ServiceState> = new Set(['not_set', 'key_refused', 'region', 'model_missing']);

/**
 * Before the first photo: can this device read pages at all? Every failed attempt on the live app (2026-09-19/20)
 * was a setup problem that only showed after the photo was taken. Null when all is well — and whenever the check
 * couldn't run or wasn't sure, which must never block the camera.
 */
export function setupProblem(health: ApiHealth, hasCode: boolean, status: ServiceStatus | null): Problem | null {
  if (health.needsCode && !health.authorized) {
    if (!health.codeSet) return { text: 'This Wunder Tutor server has no access code set yet, so no code can unlock it.' };
    return hasCode ? ERRORS.locked : { text: 'Reading pages needs the beta access code.', fix: 'code' };
  }
  if (!health.read) return health.needsCode || health.azure ? ERRORS.unavailable : null; // no API at all: offline, or a static preview
  if (status && BROKEN.has(status.reading)) {
    return { text: `Reading pages isn’t working yet: ${SERVICE_WORDS[status.reading].toLowerCase()} (Google). It’s a setup problem on the Wunder Tutor server, not your camera.`, fix: 'connections' };
  }
  return null;
}

/** Home's "My book": why photos can't be read from this device right now (null: they can, or we can't tell). */
export function bookNotice(health: ApiHealth, hasCode: boolean, kid: boolean, settings: string): string | null {
  if (health.read) return null;
  if (health.needsCode && !health.authorized) {
    if (!health.codeSet) return 'This Wunder Tutor server has no access code set yet, so photos can’t be read. Typed English works.';
    return hasCode
      ? `This device’s access code isn’t accepted any more. ${kid ? 'A grown-up can enter it again' : 'Enter it again'} in ${settings} → Beta access. Typed English works without it.`
      : `Photos need the beta access code. ${kid ? 'A grown-up can add it' : 'Add it'} in ${settings} → Beta access. Typed English works without it.`;
  }
  return health.needsCode || health.azure ? 'Reading photos isn’t switched on yet on the Wunder Tutor server. Typed English works.' : null;
}
