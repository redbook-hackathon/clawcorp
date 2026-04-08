import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'node:http';

const sendJsonMock = vi.fn();
const providerService = {
  getLegacyProviderApiKey: vi.fn(),
  hasLegacyProviderApiKey: vi.fn(),
  getLegacyProvider: vi.fn(),
  listVendors: vi.fn(),
  listAccounts: vi.fn(),
  getDefaultAccountId: vi.fn(),
};

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: vi.fn(),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
}));

vi.mock('@electron/services/providers/provider-service', () => ({
  getProviderService: () => providerService,
}));

vi.mock('@electron/utils/device-oauth', () => ({
  deviceOAuthManager: {},
}));

vi.mock('@electron/utils/browser-oauth', () => ({
  browserOAuthManager: {
    submitManualCode: vi.fn(),
  },
}));

vi.mock('@electron/services/providers/provider-runtime-sync', () => ({
  syncDefaultProviderToRuntime: vi.fn(),
  syncDeletedProviderApiKeyToRuntime: vi.fn(),
  syncDeletedProviderToRuntime: vi.fn(),
  syncProviderApiKeyToRuntime: vi.fn(),
  syncSavedProviderToRuntime: vi.fn(),
  syncUpdatedProviderToRuntime: vi.fn(),
}));

vi.mock('@electron/services/providers/provider-validation', () => ({
  validateApiKeyWithProvider: vi.fn(),
}));

vi.mock('@electron/services/providers/provider-store', () => ({
  providerAccountToConfig: vi.fn(),
}));

vi.mock('@electron/utils/provider-registry', () => ({
  getProviderConfig: vi.fn(),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe('provider routes security', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    providerService.getLegacyProviderApiKey.mockResolvedValue('sk-secret-token');
    providerService.hasLegacyProviderApiKey.mockResolvedValue(true);
  });

  it('does not expose the raw legacy provider api key', async () => {
    const { handleProviderRoutes } = await import('@electron/api/routes/providers');

    const handled = await handleProviderRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/providers/openai/api-key'),
      {
        gatewayManager: {},
      } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      apiKey: null,
      hasKey: true,
      keyMasked: expect.any(String),
    });
    expect(sendJsonMock.mock.calls[0]?.[2]).not.toMatchObject({ apiKey: 'sk-secret-token' });
  });
});
