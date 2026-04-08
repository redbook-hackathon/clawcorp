import { beforeEach, describe, expect, it, vi } from 'vitest';

function createMockStore(storeData: Record<string, unknown>) {
  return {
    get: (key: string) => storeData[key],
    set: (key: string, value: unknown) => {
      storeData[key] = value;
    },
    delete: (key: string) => {
      delete storeData[key];
    },
  };
}

function mockSecretStoreDeps(
  storeData: Record<string, unknown>,
  options: { encryptionAvailable?: boolean } = {},
) {
  const { encryptionAvailable = true } = options;
  vi.doMock('electron', () => ({
    safeStorage: {
      isEncryptionAvailable: vi.fn().mockReturnValue(encryptionAvailable),
      encryptString: vi.fn((value: string) => Buffer.from(`enc:${value}`, 'utf8')),
      decryptString: vi.fn((value: Buffer) => {
        const decoded = value.toString('utf8');
        if (!decoded.startsWith('enc:')) {
          throw new Error('invalid encrypted payload');
        }
        return decoded.slice('enc:'.length);
      }),
    },
  }));
  vi.doMock('@electron/services/providers/store-instance', () => ({
    getClawCorpProviderStore: vi.fn().mockResolvedValue(createMockStore(storeData)),
  }));
}

describe('secret-store encryption', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('stores providerSecrets without plaintext and clears legacy apiKeys entry', async () => {
    const storeData: Record<string, unknown> = {
      providerSecrets: {},
      apiKeys: {
        openai: 'sk-legacy-openai',
      },
    };
    mockSecretStoreDeps(storeData);

    const { setProviderSecret } = await import('@electron/services/secrets/secret-store');
    await setProviderSecret({
      type: 'api_key',
      accountId: 'openai',
      apiKey: 'sk-openai-test',
    });

    const providerSecrets = storeData.providerSecrets as Record<string, unknown>;
    expect(providerSecrets.openai).toBeDefined();
    expect(providerSecrets.openai).not.toEqual({
      type: 'api_key',
      accountId: 'openai',
      apiKey: 'sk-openai-test',
    });
    expect(JSON.stringify(providerSecrets.openai)).not.toContain('sk-openai-test');
    expect(storeData.apiKeys).toEqual({});
  });

  it('migrates legacy apiKeys on read into providerSecrets and removes plaintext', async () => {
    const storeData: Record<string, unknown> = {
      providerSecrets: {},
      apiKeys: {
        anthropic: 'sk-legacy-anthropic',
      },
    };
    mockSecretStoreDeps(storeData);

    const { getProviderSecret } = await import('@electron/services/secrets/secret-store');
    const secret = await getProviderSecret('anthropic');

    expect(secret).toEqual({
      type: 'api_key',
      accountId: 'anthropic',
      apiKey: 'sk-legacy-anthropic',
    });
    const providerSecrets = storeData.providerSecrets as Record<string, unknown>;
    expect(providerSecrets.anthropic).toBeDefined();
    expect(JSON.stringify(providerSecrets.anthropic)).not.toContain('sk-legacy-anthropic');
    expect(storeData.apiKeys).toEqual({});
  });

  it('migrates plaintext providerSecrets entries to encrypted wrappers on read', async () => {
    const storeData: Record<string, unknown> = {
      providerSecrets: {
        moonshot: {
          type: 'api_key',
          accountId: 'moonshot',
          apiKey: 'sk-legacy-moonshot',
        },
      },
      apiKeys: {},
    };
    mockSecretStoreDeps(storeData);

    const { getProviderSecret } = await import('@electron/services/secrets/secret-store');
    const secret = await getProviderSecret('moonshot');

    expect(secret).toEqual({
      type: 'api_key',
      accountId: 'moonshot',
      apiKey: 'sk-legacy-moonshot',
    });
    const providerSecrets = storeData.providerSecrets as Record<string, unknown>;
    expect(providerSecrets.moonshot).not.toEqual({
      type: 'api_key',
      accountId: 'moonshot',
      apiKey: 'sk-legacy-moonshot',
    });
    expect(JSON.stringify(providerSecrets.moonshot)).not.toContain('sk-legacy-moonshot');
  });

  it('re-encrypts legacy base64-fallback entries when safeStorage is available', async () => {
    const legacySecret = {
      type: 'api_key',
      accountId: 'perplexity',
      apiKey: 'sk-legacy-perplexity',
    };
    const storeData: Record<string, unknown> = {
      providerSecrets: {
        perplexity: {
          __format: 'clawcorp-safe-storage/v1',
          encryption: 'base64-fallback',
          payload: Buffer.from(JSON.stringify(legacySecret), 'utf8').toString('base64'),
        },
      },
      apiKeys: {},
    };
    mockSecretStoreDeps(storeData);

    const { getProviderSecret } = await import('@electron/services/secrets/secret-store');
    const secret = await getProviderSecret('perplexity');

    expect(secret).toEqual(legacySecret);
    const providerSecrets = storeData.providerSecrets as Record<string, unknown>;
    expect(JSON.stringify(providerSecrets.perplexity)).not.toContain('sk-legacy-perplexity');
    expect(providerSecrets.perplexity).not.toEqual({
      __format: 'clawcorp-safe-storage/v1',
      encryption: 'base64-fallback',
      payload: Buffer.from(JSON.stringify(legacySecret), 'utf8').toString('base64'),
    });
  });

  it('fails closed when safeStorage is unavailable without erasing secrets', async () => {
    const storeData: Record<string, unknown> = {
      providerSecrets: {
        moonshot: {
          type: 'api_key',
          accountId: 'moonshot',
          apiKey: 'sk-legacy-moonshot',
        },
      },
      apiKeys: {
        anthropic: 'sk-legacy-anthropic',
      },
    };
    const providerSecretsSnapshot = JSON.parse(JSON.stringify(storeData.providerSecrets));
    const apiKeysSnapshot = JSON.parse(JSON.stringify(storeData.apiKeys));
    mockSecretStoreDeps(storeData, { encryptionAvailable: false });

    const { getProviderSecret, setProviderSecret } = await import('@electron/services/secrets/secret-store');

    await expect(setProviderSecret({
      type: 'api_key',
      accountId: 'openai',
      apiKey: 'sk-openai-test',
    })).rejects.toThrow();

    const moonshot = await getProviderSecret('moonshot');
    const anthropic = await getProviderSecret('anthropic');

    expect(moonshot).toBeNull();
    expect(anthropic).toBeNull();
    expect(storeData.providerSecrets).toEqual(providerSecretsSnapshot);
    expect(storeData.apiKeys).toEqual(apiKeysSnapshot);
  });

  it('preserves base64-fallback entries when safeStorage is unavailable', async () => {
    const legacySecret = {
      type: 'api_key',
      accountId: 'perplexity',
      apiKey: 'sk-legacy-perplexity',
    };
    const storeData: Record<string, unknown> = {
      providerSecrets: {
        perplexity: {
          __format: 'clawcorp-safe-storage/v1',
          encryption: 'base64-fallback',
          payload: Buffer.from(JSON.stringify(legacySecret), 'utf8').toString('base64'),
        },
      },
      apiKeys: {},
    };
    const providerSecretsSnapshot = JSON.parse(JSON.stringify(storeData.providerSecrets));
    mockSecretStoreDeps(storeData, { encryptionAvailable: false });

    const { getProviderSecret } = await import('@electron/services/secrets/secret-store');
    const secret = await getProviderSecret('perplexity');

    expect(secret).toBeNull();
    expect(storeData.providerSecrets).toEqual(providerSecretsSnapshot);
  });
});
