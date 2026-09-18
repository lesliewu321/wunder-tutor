export interface ApiHealth { azure: boolean; claude: boolean; gemini: boolean; /** Model + voice behind the teacher takes; part of the on-device cache key. */ ttsVersion: string }

const NONE: ApiHealth = { azure: false, claude: false, gemini: false, ttsVersion: '' };
let health: Promise<ApiHealth> | null = null;

/** Asks the optional API proxy which server-side services are configured. Absent proxy → none. */
export const apiHealth = (): Promise<ApiHealth> => {
  health ??= (async () => {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 1500);
      const res = await fetch('/api/health', { signal: ctl.signal });
      clearTimeout(t);
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) return NONE;
      const j = await res.json();
      return { azure: !!j.azure, claude: !!j.claude, gemini: !!j.gemini, ttsVersion: typeof j.ttsVersion === 'string' ? j.ttsVersion : '' };
    } catch {
      return NONE;
    }
  })();
  return health;
};
