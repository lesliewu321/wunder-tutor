// Talking to the API proxy: which services exist, and the beta access code that unlocks them.
import { t, type Key } from '../i18n';
import { accessToken } from '../account/pending';
import { isGrownUp, settingsName, type AgeBand } from '../domain/types';
import { apiUrl } from '../platform';

export interface ApiHealth {
  azure: boolean;
  claude: boolean;
  gemini: boolean;
  /** Model + voice behind the teacher takes; part of the on-device cache key. */
  ttsVersion: string;
  /** The hosted API is locked behind a beta access code… */
  needsCode: boolean;
  /** …and the code stored on this device was accepted. */
  authorized: boolean;
  /** False when the server has no code set at all: then nothing a learner types can unlock it. */
  codeSet: boolean;
  /** "Say it right" can read photos and prepare typed text (Gemini). */
  read: boolean;
  /** The API recognised the signed-in family, and what their account may use ('beta', 'family', 'free', 'unknown'). */
  family?: boolean;
  plan?: string | null;
}

const NONE: ApiHealth = { azure: false, claude: false, gemini: false, ttsVersion: '', needsCode: false, authorized: false, codeSet: true, read: false };
const CODE_KEY = 'wunder-tutor/access-code';
const ACCESS_HEADER = 'x-wunder-access';

/**
 * A code as typed or pasted: what nobody can see (a zero-width space, a line break, a non-breaking space) is taken
 * out, the same way the server does it. One such character used to make every request fail before it was sent — the
 * app then said "No internet", and hid the form that could fix it.
 */
export const normalCode = (code: string): string => code.replace(/[\p{Cc}\p{Cf}]+/gu, '').replace(/[\p{Zs}\s]+/gu, ' ').trim();

export const getAccessCode = (): string => { try { return normalCode(localStorage.getItem(CODE_KEY) ?? ''); } catch { return ''; } };

/** Stored only on this device, and only ever sent to this app's own /api. */
export const setAccessCode = (code: string): void => {
  const clean = normalCode(code);
  try { clean ? localStorage.setItem(CODE_KEY, clean) : localStorage.removeItem(CODE_KEY); } catch { /* private mode */ }
  health = null;
};

/** fetch() for /api/* — attaches the access code when there is one (URI-encoded: a header can't carry every character). */
export const apiFetch = (path: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  const code = getAccessCode();
  if (code) headers.set(ACCESS_HEADER, encodeURIComponent(code));
  // A signed-in family: the API knows them by their token (their plan unlocks it; their use is counted per day).
  const token = accessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  // In the phone app the page lives on the device, so the API's real address is added here (src/platform.ts).
  return fetch(apiUrl(path), { ...init, headers });
};

let health: Promise<ApiHealth> | null = null;

/** Asks the API which server-side services are available to this device. Absent API → none. */
export const apiHealth = (): Promise<ApiHealth> => {
  health ??= (async () => {
    try {
      const ctl = new AbortController();
      // Generous: on a slow phone connection a short wait would silently drop the learner into simulated scores.
      const t = setTimeout(() => ctl.abort(), 8000);
      const res = await apiFetch('/api/health', { signal: ctl.signal });
      clearTimeout(t);
      if (res.status >= 500) throw new Error(`health ${res.status}`);
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) return NONE;
      const j = await res.json();
      return {
        azure: !!j.azure, claude: !!j.claude, gemini: !!j.gemini, ttsVersion: typeof j.ttsVersion === 'string' ? j.ttsVersion : '',
        needsCode: !!j.needsCode, authorized: !!j.authorized, codeSet: j.codeSet !== false, read: !!j.read,
      };
    } catch {
      // Offline, too slow, or a passing server fault: not remembered, so the next screen asks again.
      health = null;
      return NONE;
    }
  })();
  return health;
};

/** Ask again (the code or the server may have changed since the app opened). */
export const refreshHealth = (): Promise<ApiHealth> => { health = null; return apiHealth(); };

/**
 * Why the teacher's voice stayed silent — the sentence to show the learner.
 *
 * The app used to give one answer, "Sound isn't working on this device right now", and in the phone app that is
 * usually untrue: the device is fine, but the invite code was never entered on this phone, or the API could not be
 * reached at all. It misleads most exactly where it matters most, because a phone app has no second voice to fall
 * back on — Android's WebView has no `speechSynthesis` at all, so the teacher's voice is the only voice there is,
 * and a learner who is told their phone is broken has nothing left to try.
 */
export const soundProblem = (now: ApiHealth, hasCode: boolean, band: AgeBand): string => {
  if (now.needsCode && !now.authorized) {
    if (!now.codeSet) return t('common.noSound.noCodeSet');
    // One whole sentence per case: who enters the code, and where, sit in different places in another language.
    const settings = settingsName(band);
    const kid = !isGrownUp(band);
    if (hasCode) return t(kid ? 'common.noSound.refused.kid' : 'common.noSound.refused.adult', { settings });
    return t(kid ? 'common.noSound.needsCode.kid' : 'common.noSound.needsCode.adult', { settings });
  }
  // No API within reach (offline, or a build that cannot see one) lands here too: `gemini` is false until it answers.
  if (!now.gemini) return t('common.noSound.unavailable');
  return t('common.noSound.device');
};

/** What the screens call when a word would not play: asks the API (the answer is cached) and picks the sentence. */
export const noSoundMessage = async (band: AgeBand): Promise<string> =>
  soundProblem(await apiHealth(), getAccessCode() !== '', band);

// ---------------------------------------------------------------- do the services actually work?

/** What a live check of one service found (server: GET /api/status). */
export type ServiceState = 'ok' | 'not_set' | 'key_refused' | 'region' | 'model_missing' | 'quota' | 'unreachable' | 'unchecked' | 'error';
export interface ServiceStatus {
  checkedAt: string;
  scoring: ServiceState;
  reading: ServiceState;
  voice: ServiceState;
  /** Only for a device with the access code: what helps repair a key (never the key). */
  notes?: Partial<Record<'scoring' | 'reading' | 'voice', string>>;
}

const SERVICE_KEY: Record<ServiceState, Key> = {
  ok: 'common.service.ok', not_set: 'common.service.not_set', key_refused: 'common.service.key_refused', region: 'common.service.region',
  model_missing: 'common.service.model_missing', quota: 'common.service.quota', unreachable: 'common.service.unreachable',
  unchecked: 'common.service.unchecked', error: 'common.service.error',
};
/** What a live check found, in the app's language ("Working", "Key refused"). */
export const serviceWords = (state: ServiceState): string => t(SERVICE_KEY[state]);

/** Null when the check itself couldn't run (offline, an older server). */
export const serviceStatus = async (): Promise<ServiceStatus | null> => {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12000);
    const res = await apiFetch('/api/status', { signal: ctl.signal });
    clearTimeout(t);
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) return null;
    return (await res.json()) as ServiceStatus;
  } catch { return null; }
};
