import { AzurePronunciationProvider } from './azureProvider';
import { MockPronunciationProvider } from './mockProvider';
import { fromHealth } from './health';
import type { PronunciationProvider } from './types';

export * from './types';

export { apiFetch, apiHealth, deviceId, fromHealth, getAccessCode, redeemInvite, refreshHealth, serviceStatus, setAccessCode, serviceWords, type ApiHealth, type InviteAnswer, type ServiceState, type ServiceStatus } from './health';

/** Azure when the proxy has a key (and a real microphone take exists), otherwise the mock learner model. */
export const getProvider: () => Promise<PronunciationProvider> = fromHealth((h) => (h.azure ? new AzurePronunciationProvider() : new MockPronunciationProvider()));

export const mockProvider = new MockPronunciationProvider();
