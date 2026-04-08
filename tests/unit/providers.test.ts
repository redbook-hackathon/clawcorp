import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import {
  PROVIDER_TYPES,
  PROVIDER_TYPE_INFO,
  getProviderDocsUrl,
  resolveProviderApiKeyForSave,
  resolveProviderModelForSave,
  shouldShowProviderModelId,
} from '@/lib/providers';
import {
  BUILTIN_PROVIDER_TYPES,
  getProviderConfig,
  getProviderEnvVar,
  getProviderEnvVars,
} from '@electron/utils/provider-registry';

vi.mock('@/components/settings/ProvidersSettings', () => ({
  ProvidersSettings: () => createElement('div', null, 'Providers Settings Mock'),
}));

vi.mock('@/lib/telemetry', () => ({
  trackUiEvent: vi.fn(),
}));

describe('provider metadata', () => {
  it('includes ark in the frontend provider registry', () => {
    expect(PROVIDER_TYPES).toContain('ark');

    expect(PROVIDER_TYPE_INFO).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ark',
          name: 'ByteDance Ark',
          requiresApiKey: true,
          defaultBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
          showBaseUrl: true,
          showModelId: true,
        }),
      ])
    );
  });

  it('includes ark in the backend provider registry', () => {
    expect(BUILTIN_PROVIDER_TYPES).toContain('ark');
    expect(getProviderEnvVar('ark')).toBe('ARK_API_KEY');
    expect(getProviderConfig('ark')).toEqual({
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',
      api: 'openai-completions',
      apiKeyEnv: 'ARK_API_KEY',
    });
  });

  it('uses a single canonical env key for moonshot provider', () => {
    expect(getProviderEnvVar('moonshot')).toBe('MOONSHOT_API_KEY');
    expect(getProviderEnvVars('moonshot')).toEqual(['MOONSHOT_API_KEY']);
    expect(getProviderConfig('moonshot')).toEqual(
      expect.objectContaining({
        baseUrl: 'https://api.moonshot.cn/v1',
        apiKeyEnv: 'MOONSHOT_API_KEY',
      })
    );
  });

  it('keeps builtin provider sources in sync', () => {
    expect(BUILTIN_PROVIDER_TYPES).toEqual(
      expect.arrayContaining(['anthropic', 'openai', 'google', 'openrouter', 'ark', 'moonshot', 'siliconflow', 'minimax-portal', 'minimax-portal-cn', 'qwen-portal', 'ollama'])
    );
  });

  it('uses OpenAI-compatible Ollama default base URL', () => {
    expect(PROVIDER_TYPE_INFO).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'ollama',
          defaultBaseUrl: 'http://localhost:11434/v1',
          requiresApiKey: false,
          showBaseUrl: true,
          showModelId: true,
        }),
      ])
    );
  });

  it('exposes provider documentation links', () => {
    const anthropic = PROVIDER_TYPE_INFO.find((provider) => provider.id === 'anthropic');
    const openrouter = PROVIDER_TYPE_INFO.find((provider) => provider.id === 'openrouter');
    const moonshot = PROVIDER_TYPE_INFO.find((provider) => provider.id === 'moonshot');
    const siliconflow = PROVIDER_TYPE_INFO.find((provider) => provider.id === 'siliconflow');
    const ark = PROVIDER_TYPE_INFO.find((provider) => provider.id === 'ark');
    const custom = PROVIDER_TYPE_INFO.find((provider) => provider.id === 'custom');

    expect(anthropic).toMatchObject({
      docsUrl: 'https://platform.claude.com/docs/en/api/overview',
    });
    expect(getProviderDocsUrl(anthropic, 'en')).toBe('https://platform.claude.com/docs/en/api/overview');
    expect(getProviderDocsUrl(openrouter, 'en')).toBe('https://openrouter.ai/models');
    expect(getProviderDocsUrl(moonshot, 'en')).toBe('https://platform.moonshot.cn/');
    expect(getProviderDocsUrl(siliconflow, 'en')).toBe('https://docs.siliconflow.cn/cn/userguide/introduction');
    expect(getProviderDocsUrl(ark, 'en')).toBe('https://www.volcengine.com/');
    expect(getProviderDocsUrl(custom, 'en')).toBe(
      'https://icnnp7d0dymg.feishu.cn/wiki/BmiLwGBcEiloZDkdYnGc8RWnn6d#Ee1ldfvKJoVGvfxc32mcILwenth'
    );
    expect(getProviderDocsUrl(custom, 'zh-CN')).toBe(
      'https://icnnp7d0dymg.feishu.cn/wiki/BmiLwGBcEiloZDkdYnGc8RWnn6d#IWQCdfe5fobGU3xf3UGcgbLynGh'
    );
  });

  it('exposes OpenRouter and SiliconFlow model overrides by default', () => {
    const openrouter = PROVIDER_TYPE_INFO.find((provider) => provider.id === 'openrouter');
    const siliconflow = PROVIDER_TYPE_INFO.find((provider) => provider.id === 'siliconflow');

    expect(openrouter).toMatchObject({
      showModelId: true,
      defaultModelId: 'openai/gpt-5.4',
    });
    expect(siliconflow).toMatchObject({
      showModelId: true,
      defaultModelId: 'deepseek-ai/DeepSeek-V3',
    });

    expect(shouldShowProviderModelId(openrouter, false)).toBe(true);
    expect(shouldShowProviderModelId(siliconflow, false)).toBe(true);
    expect(shouldShowProviderModelId(openrouter, true)).toBe(true);
    expect(shouldShowProviderModelId(siliconflow, true)).toBe(true);
  });

  it('saves OpenRouter and SiliconFlow model overrides by default', () => {
    const openrouter = PROVIDER_TYPE_INFO.find((provider) => provider.id === 'openrouter');
    const siliconflow = PROVIDER_TYPE_INFO.find((provider) => provider.id === 'siliconflow');
    const ark = PROVIDER_TYPE_INFO.find((provider) => provider.id === 'ark');

    expect(resolveProviderModelForSave(openrouter, 'openai/gpt-5', false)).toBe('openai/gpt-5');
    expect(resolveProviderModelForSave(siliconflow, 'Qwen/Qwen3-Coder-480B-A35B-Instruct', false)).toBe('Qwen/Qwen3-Coder-480B-A35B-Instruct');

    expect(resolveProviderModelForSave(openrouter, 'openai/gpt-5', true)).toBe('openai/gpt-5');
    expect(resolveProviderModelForSave(siliconflow, 'Qwen/Qwen3-Coder-480B-A35B-Instruct', true)).toBe('Qwen/Qwen3-Coder-480B-A35B-Instruct');

    expect(resolveProviderModelForSave(openrouter, '   ', false)).toBe('openai/gpt-5.4');
    expect(resolveProviderModelForSave(openrouter, '   ', true)).toBe('openai/gpt-5.4');
    expect(resolveProviderModelForSave(siliconflow, '   ', true)).toBe('deepseek-ai/DeepSeek-V3');
    expect(resolveProviderModelForSave(ark, '  ep-custom-model  ', false)).toBe('ep-custom-model');
  });

  it('normalizes provider API keys for save flow', () => {
    expect(resolveProviderApiKeyForSave('ollama', '')).toBe('ollama-local');
    expect(resolveProviderApiKeyForSave('ollama', '   ')).toBe('ollama-local');
    expect(resolveProviderApiKeyForSave('ollama', 'real-key')).toBe('real-key');
    expect(resolveProviderApiKeyForSave('openai', '')).toBeUndefined();
    expect(resolveProviderApiKeyForSave('openai', ' sk-test ')).toBe('sk-test');
  });

  it('renders the reusable models and providers settings panel', async () => {
    if (!('electron' in window)) {
      Object.defineProperty(window, 'electron', {
        value: { platform: 'win32' },
        configurable: true,
      });
    }

    const { SettingsModelsProvidersPanel } = await import('@/components/settings-center/settings-models-providers-panel');
    render(createElement(SettingsModelsProvidersPanel));

    expect(screen.getByText('默认模型与回退路由')).toBeInTheDocument();
    expect(screen.getByLabelText('全局默认模型')).toBeInTheDocument();
    expect(screen.getByText('网关连接')).toBeInTheDocument();
    expect(screen.getByText('Providers Settings Mock')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });
});

describe('secure-storage api key persistence', () => {
  it('stores keys through secret-store without persisting plaintext apiKeys', async () => {
    vi.resetModules();

    const legacyStoreData: Record<string, unknown> = {
      providers: {},
      apiKeys: {},
      providerSecrets: {},
    };
    const setProviderSecret = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@electron/services/providers/provider-migration', () => ({
      ensureProviderStoreMigrated: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@electron/services/providers/store-instance', () => ({
      getClawCorpProviderStore: vi.fn().mockResolvedValue({
        get: (key: string) => legacyStoreData[key],
        set: (key: string, value: unknown) => {
          legacyStoreData[key] = value;
        },
        delete: (key: string) => {
          delete legacyStoreData[key];
        },
      }),
    }));
    vi.doMock('@electron/services/providers/provider-store', () => ({
      deleteProviderAccount: vi.fn().mockResolvedValue(undefined),
      getProviderAccount: vi.fn().mockResolvedValue(undefined),
      listProviderAccounts: vi.fn().mockResolvedValue([]),
      providerAccountToConfig: vi.fn(),
      providerConfigToAccount: vi.fn(),
      saveProviderAccount: vi.fn().mockResolvedValue(undefined),
      setDefaultProviderAccount: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@electron/services/secrets/secret-store', () => ({
      deleteProviderSecret: vi.fn().mockResolvedValue(undefined),
      getProviderSecret: vi.fn().mockResolvedValue(null),
      setProviderSecret,
    }));

    const { storeApiKey } = await import('@electron/utils/secure-storage');
    const stored = await storeApiKey('openai', 'sk-openai-test');

    expect(stored).toBe(true);
    expect(setProviderSecret).toHaveBeenCalledWith({
      type: 'api_key',
      accountId: 'openai',
      apiKey: 'sk-openai-test',
    });
    expect(legacyStoreData.apiKeys).toEqual({});
  });

  it('migrates legacy plaintext apiKeys on read and clears the legacy entry', async () => {
    vi.resetModules();

    const legacyStoreData: Record<string, unknown> = {
      providers: {},
      apiKeys: {
        openai: 'sk-legacy-openai',
      },
      providerSecrets: {},
    };
    const setProviderSecret = vi.fn().mockResolvedValue(undefined);

    vi.doMock('@electron/services/providers/provider-migration', () => ({
      ensureProviderStoreMigrated: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@electron/services/providers/store-instance', () => ({
      getClawCorpProviderStore: vi.fn().mockResolvedValue({
        get: (key: string) => legacyStoreData[key],
        set: (key: string, value: unknown) => {
          legacyStoreData[key] = value;
        },
        delete: (key: string) => {
          delete legacyStoreData[key];
        },
      }),
    }));
    vi.doMock('@electron/services/providers/provider-store', () => ({
      deleteProviderAccount: vi.fn().mockResolvedValue(undefined),
      getProviderAccount: vi.fn().mockResolvedValue(undefined),
      listProviderAccounts: vi.fn().mockResolvedValue([]),
      providerAccountToConfig: vi.fn(),
      providerConfigToAccount: vi.fn(),
      saveProviderAccount: vi.fn().mockResolvedValue(undefined),
      setDefaultProviderAccount: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@electron/services/secrets/secret-store', () => ({
      deleteProviderSecret: vi.fn().mockResolvedValue(undefined),
      getProviderSecret: vi.fn().mockResolvedValue(null),
      setProviderSecret,
    }));

    const { getApiKey } = await import('@electron/utils/secure-storage');
    const apiKey = await getApiKey('openai');

    expect(apiKey).toBe('sk-legacy-openai');
    expect(setProviderSecret).toHaveBeenCalledWith({
      type: 'api_key',
      accountId: 'openai',
      apiKey: 'sk-legacy-openai',
    });
    expect(legacyStoreData.apiKeys).toEqual({});
  });

  it('lists stored key ids from secret-store backed ids in providerSecrets', async () => {
    vi.resetModules();

    const legacyStoreData: Record<string, unknown> = {
      providers: {},
      apiKeys: {},
      providerSecrets: {
        openai: { wrapped: true },
        anthropic: { wrapped: true },
        local: { wrapped: true },
      },
    };

    vi.doMock('@electron/services/providers/provider-migration', () => ({
      ensureProviderStoreMigrated: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@electron/services/providers/store-instance', () => ({
      getClawCorpProviderStore: vi.fn().mockResolvedValue({
        get: (key: string) => legacyStoreData[key],
        set: (key: string, value: unknown) => {
          legacyStoreData[key] = value;
        },
        delete: (key: string) => {
          delete legacyStoreData[key];
        },
      }),
    }));
    vi.doMock('@electron/services/providers/provider-store', () => ({
      deleteProviderAccount: vi.fn().mockResolvedValue(undefined),
      getProviderAccount: vi.fn().mockResolvedValue(undefined),
      listProviderAccounts: vi.fn().mockResolvedValue([]),
      providerAccountToConfig: vi.fn(),
      providerConfigToAccount: vi.fn(),
      saveProviderAccount: vi.fn().mockResolvedValue(undefined),
      setDefaultProviderAccount: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@electron/services/secrets/secret-store', () => ({
      deleteProviderSecret: vi.fn().mockResolvedValue(undefined),
      getProviderSecret: vi.fn((accountId: string) => {
        if (accountId === 'openai') {
          return Promise.resolve({
            type: 'api_key' as const,
            accountId,
            apiKey: 'sk-openai',
          });
        }
        if (accountId === 'anthropic') {
          return Promise.resolve({
            type: 'local' as const,
            accountId,
            apiKey: 'local-key',
          });
        }
        if (accountId === 'local') {
          return Promise.resolve({
            type: 'local' as const,
            accountId,
          });
        }
        return Promise.resolve(null);
      }),
      setProviderSecret: vi.fn().mockResolvedValue(undefined),
    }));

    const { listStoredKeyIds } = await import('@electron/utils/secure-storage');
    const keyIds = await listStoredKeyIds();

    expect(keyIds).toEqual(['openai', 'anthropic']);
  });
});

describe('secure-storage provider listing', () => {
  it('does not delete provider configs as a side effect of reads', async () => {
    vi.resetModules();

    const legacyStoreData: Record<string, unknown> = {
      providers: {},
      apiKeys: {
        'custom-provider': 'sk-custom-provider',
      },
    };

    const providerAccount = {
      id: 'custom-provider',
      vendorId: 'custom',
      label: 'Custom Provider',
      baseUrl: 'https://example.com/v1',
      model: 'custom-model',
      fallbackModels: [],
      fallbackAccountIds: [],
      enabled: true,
      createdAt: '2026-03-23T00:00:00.000Z',
      updatedAt: '2026-03-23T00:00:00.000Z',
    };

    const deleteProviderAccount = vi.fn();

    vi.doMock('@electron/services/providers/provider-migration', () => ({
      ensureProviderStoreMigrated: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@electron/services/providers/store-instance', () => ({
      getClawCorpProviderStore: vi.fn().mockResolvedValue({
        get: (key: string) => legacyStoreData[key],
        set: (key: string, value: unknown) => {
          legacyStoreData[key] = value;
        },
        delete: (key: string) => {
          delete legacyStoreData[key];
        },
      }),
    }));
    vi.doMock('@electron/services/providers/provider-store', () => ({
      deleteProviderAccount,
      getProviderAccount: vi.fn().mockResolvedValue(providerAccount),
      listProviderAccounts: vi.fn().mockResolvedValue([providerAccount]),
      providerAccountToConfig: vi.fn((account: typeof providerAccount) => ({
        id: account.id,
        name: account.label,
        type: account.vendorId,
        baseUrl: account.baseUrl,
        model: account.model,
        fallbackModels: account.fallbackModels,
        fallbackProviderIds: account.fallbackAccountIds,
        enabled: account.enabled,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
      })),
      providerConfigToAccount: vi.fn((config: {
        id: string;
        name: string;
        type: string;
        baseUrl?: string;
        model?: string;
        fallbackModels?: string[];
        fallbackProviderIds?: string[];
        enabled: boolean;
        createdAt: string;
        updatedAt: string;
      }) => ({
        id: config.id,
        vendorId: config.type,
        label: config.name,
        baseUrl: config.baseUrl,
        model: config.model,
        fallbackModels: config.fallbackModels ?? [],
        fallbackAccountIds: config.fallbackProviderIds ?? [],
        enabled: config.enabled,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      })),
      saveProviderAccount: vi.fn().mockResolvedValue(undefined),
      setDefaultProviderAccount: vi.fn().mockResolvedValue(undefined),
    }));
    vi.doMock('@electron/services/secrets/secret-store', () => ({
      deleteProviderSecret: vi.fn().mockResolvedValue(undefined),
      getProviderSecret: vi.fn().mockResolvedValue(undefined),
      setProviderSecret: vi.fn().mockResolvedValue(undefined),
    }));
    const { getAllProvidersWithKeyInfo } = await import('@electron/utils/secure-storage');
    const providers = await getAllProvidersWithKeyInfo();

    expect(providers).toHaveLength(1);
    expect(providers[0]).toMatchObject({
      id: 'custom-provider',
      hasKey: true,
    });
    expect(deleteProviderAccount).not.toHaveBeenCalled();
  });
});
