import { AzurePronunciationProvider } from './azureProvider';
import { MockPronunciationProvider } from './mockProvider';
import { apiHealth } from './health';
import type { PronunciationProvider } from './types';

export * from './types';

export { apiFetch, apiHealth, deviceId, getAccessCode, redeemInvite, refreshHealth, serviceStatus, setAccessCode, serviceWords, type ApiHealth, type InviteAnswer, type ServiceState, type ServiceStatus } from './health';

let provider: Promise<PronunciationProvider> | null = null;

/** Azure when the proxy has a key (and a real microphone take exists), otherwise the mock learner model. */
export const getProvider = (): Promise<PronunciationProvider> => {
  provider ??= apiHealth().then((h) => (h.azure ? new AzurePronunciationProvider() : new MockPronunciationProvider()));
  return provider;
};

export const mockProvider = new MockPronunciationProvider();
