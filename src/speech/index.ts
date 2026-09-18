import { AzurePronunciationProvider } from './azureProvider';
import { MockPronunciationProvider } from './mockProvider';
import type { PronunciationProvider } from './types';

export * from './types';

export interface ApiHealth { azure: boolean; claude: boolean }

let health: Promise<ApiHealth> | null = null;

/** Asks the optional API proxy which server-side services are configured. Absent proxy → none. */
export const apiHealth = (): Promise<ApiHealth> => {
  health ??= (async () => {
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 1500);
      const res = await fetch('/api/health', { signal: ctl.signal });
      clearTimeout(t);
      if (!res.ok || !res.headers.get('content-type')?.includes('json')) return { azure: false, claude: false };
      const j = await res.json();
      return { azure: !!j.azure, claude: !!j.claude };
    } catch {
      return { azure: false, claude: false };
    }
  })();
  return health;
};

let provider: Promise<PronunciationProvider> | null = null;

/** Azure when the proxy has a key (and a real microphone take exists), otherwise the mock learner model. */
export const getProvider = (): Promise<PronunciationProvider> => {
  provider ??= apiHealth().then((h) => (h.azure ? new AzurePronunciationProvider() : new MockPronunciationProvider()));
  return provider;
};

export const mockProvider = new MockPronunciationProvider();
