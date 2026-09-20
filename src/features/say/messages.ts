import { t, type Key } from '../../i18n';
import { serviceWords, type ApiHealth, type ServiceState, type ServiceStatus } from '../../speech/health';
import { ReadError, type Reading } from '../../speech/read';

/** What to tell the learner, and — when there is something they can do about it — where to send them. */
export interface Problem { text: string; fix?: 'code' | 'connections' }

// Keys, not wording: a message is put into the app's language when it is produced (src/i18n/README.md, rule 2).
const ERRORS: Record<Exclude<ReadError['code'], 'cancelled'>, { key: Key; fix?: Problem['fix'] }> = {
  offline: { key: 'home.read.error.offline' },
  busy: { key: 'home.read.error.busy' },
  locked: { key: 'home.read.error.locked', fix: 'code' },
  lockout: { key: 'home.read.error.lockout', fix: 'code' },
  unavailable: { key: 'home.read.error.unavailable', fix: 'connections' },
  photo: { key: 'home.read.error.photo' },
  // Photo advice ("closer, brighter") is only ever given when the reader looked and found no words — see readingProblem.
  failed: { key: 'home.read.error.failed' },
};

/** `detail`: the server's own reason in brackets, " (read_timeout)" — never translated; "" when there is none to show. */
const problem = (code: keyof typeof ERRORS, detail = ''): Problem => {
  const { key, fix } = ERRORS[code];
  const text = t(key, { detail });
  return fix ? { text, fix } : { text };
};

/** The server's own setup, not this attempt: a key Google refuses, a place Google doesn't serve, a model that's gone. */
const SETUP = /^read_(key|region|model)\b/;
/** Google's reader looked at the page and declined it (it won't recite long published text, or a safety filter). Trying again won't help. */
const DECLINED = /\b(RECITATION|SAFETY|PROHIBITED_CONTENT|BLOCKLIST|SPII)\b/;

/** Reading failed: what to say, and whose fault it is. The server's reason is added in brackets, for testers' screenshots. */
export const readProblem = (e: unknown): Problem => {
  if (!(e instanceof ReadError) || e.code === 'cancelled') return problem('failed');
  const detail = e.detail ? ` (${e.detail})` : '';
  if (e.code === 'failed' && e.detail) {
    if (SETUP.test(e.detail)) return { text: t('home.read.error.serverSetup', { detail }), fix: 'connections' };
    if (/^read_quota\b/.test(e.detail)) return { text: t('home.read.error.quota', { detail }) };
    if (DECLINED.test(e.detail)) return { text: t('home.read.error.declined', { detail }) };
  }
  return problem(e.code, e.code === 'failed' || e.code === 'unavailable' ? detail : '');
};

/** A page with nothing to practise: why. Null when it has sentences. */
export const readingProblem = (r: Reading, kid: boolean): string | null =>
  r.language === 'none' || !r.lines.length
    ? t(kid ? 'home.read.nothing.kid' : 'home.read.nothing.adult')
    : r.language === 'other' ? t('home.read.nothing.otherLanguage') : null;

/** A live check that found the service itself wrong. A timeout, a server error or a rate limit is NOT one: reading may well work. */
const BROKEN: ReadonlySet<ServiceState> = new Set(['not_set', 'key_refused', 'region', 'model_missing']);

/**
 * Before the first photo: can this device read pages at all? Every failed attempt on the live app (2026-09-19/20)
 * was a setup problem that only showed after the photo was taken. Null when all is well — and whenever the check
 * couldn't run or wasn't sure, which must never block the camera.
 */
export function setupProblem(health: ApiHealth, hasCode: boolean, status: ServiceStatus | null): Problem | null {
  if (health.needsCode && !health.authorized) {
    if (!health.codeSet) return { text: t('home.read.setup.noCodeSet') };
    return hasCode ? problem('locked') : { text: t('home.read.setup.needsCode'), fix: 'code' };
  }
  if (!health.read) return health.needsCode || health.azure ? problem('unavailable') : null; // no API at all: offline, or a static preview
  if (status && BROKEN.has(status.reading)) {
    return { text: t('home.read.setup.broken', { state: serviceWords(status.reading).toLowerCase() }), fix: 'connections' };
  }
  return null;
}

/** Home's "My book": why photos can't be read from this device right now (null: they can, or we can't tell). */
export function bookNotice(health: ApiHealth, hasCode: boolean, kid: boolean, settings: string): string | null {
  if (health.read) return null;
  if (health.needsCode && !health.authorized) {
    if (!health.codeSet) return t('home.book.notice.noCodeSet');
    // One whole sentence per case: who enters the code, and where, sit in different places in another language.
    return hasCode
      ? t(kid ? 'home.book.notice.refused.kid' : 'home.book.notice.refused.adult', { settings })
      : t(kid ? 'home.book.notice.needsCode.kid' : 'home.book.notice.needsCode.adult', { settings });
  }
  return health.needsCode || health.azure ? t('home.book.notice.unavailable') : null;
}
