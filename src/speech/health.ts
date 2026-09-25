// Talking to the API proxy: which services exist, and the beta access code that unlocks them.
import { t, type Key } from '../i18n';
import { accessToken } from '../account/pending';
import { isGrownUp, settingsName, type AgeBand } from '../domain/types';
import { VoiceError } from './types';
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
  /** The server answered. False when it could not be reached (offline, too slow): then nothing above is known. */
  reached: boolean;
  /** The API recognised the signed-in family, and what their account may use ('beta', 'family', 'free', 'unknown'). */
  family?: boolean;
  plan?: string | null;
}

const NONE: ApiHealth = { azure: false, claude: false, gemini: false, ttsVersion: '', needsCode: false, authorized: false, codeSet: true, read: false, reached: false };
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

const DEVICE_KEY = 'wunder-tutor/device';

/**
 * A random id this device makes once and keeps. It is how an invite code counts its places (one per device) and how
 * a contributed recording can be found again to be deleted. It is not a person, a phone number or a sign-in, and it
 * is never sent anywhere but this app's own API.
 */
export const deviceId = (): string => {
  try {
    const kept = localStorage.getItem(DEVICE_KEY);
    if (kept && /^[A-Za-z0-9_-]{8,64}$/.test(kept)) return kept;
    const made = `d-${crypto.randomUUID().replace(/-/g, '')}`;
    localStorage.setItem(DEVICE_KEY, made);
    return made;
  } catch {
    // Storage refused (a private window): an id for this visit only. It still counts one place, once.
    return `d-${crypto.randomUUID().replace(/-/g, '')}`;
  }
};

/**
 * "Delete my recordings": asks the server to forget every practice recording this device contributed (R2 and the
 * table). Best effort: a failure is logged, never shown as a broken deletion of the device's own data.
 */
export async function forgetContributions(): Promise<number> {
  try {
    const res = await fetch(apiUrl('/api/contributions/forget'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device: deviceId() }) });
    if (!res.ok) throw new Error(`forget ${res.status}`);
    return Number((await res.json())?.deleted ?? 0);
  } catch (e) {
    console.warn('[contribute] forget', e);
    return 0;
  }
}

export interface InviteAnswer {
  ok: boolean;
  /** 'new' / 'again' / 'master' when accepted; 'full', 'expired', 'disabled', 'unknown' when not. */
  reason: string;
  places?: number;
  used?: number;
  expiresAt?: string;
}

/**
 * Take a place on an invite code for this device. The code is kept on the device only when the server accepted it,
 * so a full or expired code never sits there looking like it should work. Throws only when the server can't be asked.
 */
export async function redeemInvite(code: string): Promise<InviteAnswer> {
  const clean = normalCode(code);
  const res = await fetch(apiUrl('/api/redeem'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: clean, device: deviceId() }),
  });
  if (!res.ok) throw new Error(`redeem ${res.status}`);
  const answer = (await res.json()) as InviteAnswer;
  if (answer.ok) setAccessCode(clean);
  return answer;
}

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
/** The newest answer the API gave (a failed check doesn't replace it): for questions a screen must answer at once. */
let latest: ApiHealth | null = null;
export const knownHealth = (): ApiHealth | null => latest;

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
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) return (latest = NONE);
      const j = await res.json();
      return (latest = {
        azure: !!j.azure, claude: !!j.claude, gemini: !!j.gemini, ttsVersion: typeof j.ttsVersion === 'string' ? j.ttsVersion : '',
        needsCode: !!j.needsCode, authorized: !!j.authorized, codeSet: j.codeSet !== false, read: !!j.read, reached: true,
      });
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
 * Something chosen from the server's answer (real or practice scoring, the live or scripted tutor), chosen again
 * whenever that answer may have changed: after a new invite code (refreshHealth) or after a failed check. Chosen once
 * for good, the answer at start stuck for the whole session — a tester entered the code in Settings and then got
 * "Sound isn't working on this device" on every word, and simulated scores, until the app was closed (2026-09-21).
 */
export const fromHealth = <T>(choose: (h: ApiHealth) => T): (() => Promise<T>) => {
  let asked: Promise<ApiHealth> | null = null;
  let chosen: Promise<T> | null = null;
  return () => {
    const now = apiHealth();
    if (now !== asked || !chosen) { asked = now; chosen = now.then(choose); }
    return chosen;
  };
};

/**
 * Why the teacher's voice stayed silent — the sentence to show the learner.
 *
 * The app used to give one answer, "Sound isn't working on this device right now", and in the phone app that is
 * usually untrue: the device is fine, but the invite code was never entered on this phone, or the API could not be
 * reached at all. It misleads most exactly where it matters most, because a phone app has no second voice to fall
 * back on — Android's WebView has no `speechSynthesis` at all, so the teacher's voice is the only voice there is,
 * and a learner who is told their phone is broken has nothing left to try.
 */
export const soundProblem = (now: ApiHealth, hasCode: boolean, band: AgeBand, reason?: 'take' | 'playback', code?: string): string => {
  // The server's own word for it, when it gave one: a day's listening used up, or a busy moment, is not about the line.
  if (code === 'daily_limit') return t('common.noSound.dayUsed');
  if (code === 'rate_limited' || code === 'tts_budget_exceeded') return t('common.noSound.busy');
  // The teacher refusing one line says nothing about the code, the connection or the phone: it is about the line.
  if (reason === 'take' && now.gemini) return t('common.noSound.line');
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
export const noSoundMessage = async (band: AgeBand, error?: unknown): Promise<string> =>
  soundProblem(await apiHealth(), getAccessCode() !== '', band, error instanceof VoiceError ? error.reason : undefined, error instanceof VoiceError ? error.code : undefined);

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
