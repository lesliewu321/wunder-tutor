// Talking to the API proxy: which services exist, and the beta access code that unlocks them.

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
  /** "Say it right" can read photos and prepare typed text (Gemini). */
  read: boolean;
}

const NONE: ApiHealth = { azure: false, claude: false, gemini: false, ttsVersion: '', needsCode: false, authorized: false, read: false };
const CODE_KEY = 'wunder-tutor/access-code';
const ACCESS_HEADER = 'x-wunder-access';

export const getAccessCode = (): string => { try { return localStorage.getItem(CODE_KEY) ?? ''; } catch { return ''; } };

/** Stored only on this device, and only ever sent to this app's own /api. */
export const setAccessCode = (code: string): void => {
  try { code ? localStorage.setItem(CODE_KEY, code.trim()) : localStorage.removeItem(CODE_KEY); } catch { /* private mode */ }
  health = null;
};

/** fetch() for /api/* — attaches the access code when there is one. */
export const apiFetch = (path: string, init: RequestInit = {}): Promise<Response> => {
  const headers = new Headers(init.headers);
  const code = getAccessCode();
  if (code) headers.set(ACCESS_HEADER, code);
  return fetch(path, { ...init, headers });
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
        needsCode: !!j.needsCode, authorized: !!j.authorized, read: !!j.read,
      };
    } catch {
      // Offline, too slow, or a passing server fault: not remembered, so the next screen asks again.
      health = null;
      return NONE;
    }
  })();
  return health;
};
