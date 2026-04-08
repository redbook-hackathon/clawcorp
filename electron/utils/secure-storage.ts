/**
 * Provider Storage
 * Manages provider configurations and API keys.
 * This file remains the legacy compatibility layer while the app migrates to
 * account-based provider storage and a dedicated secret-store abstraction.
 */

import { type ProviderType } from './provider-registry';
import { logger } from './logger';
import {
  deleteProviderAccount,
  getProviderAccount,
  listProviderAccounts,
  providerAccountToConfig,
  providerConfigToAccount,
  saveProviderAccount,
  setDefaultProviderAccount,
} from '../services/providers/provider-store';
import { ensureProviderStoreMigrated } from '../services/providers/provider-migration';
import { getClawCorpProviderStore } from '../services/providers/store-instance';
import {
  deleteProviderSecret,
  getProviderSecret,
  setProviderSecret,
} from '../services/secrets/secret-store';

/**
 * Provider configuration
 */
export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl?: string;
  apiProtocol?: 'openai-completions' | 'openai-responses' | 'anthropic-messages';
  model?: string;
  fallbackModels?: string[];
  fallbackProviderIds?: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

type StoredProviderSecret = Awaited<ReturnType<typeof getProviderSecret>>;

function getApiKeyFromSecret(secret: StoredProviderSecret): string | null {
  if (!secret) {
    return null;
  }

  if (secret.type === 'api_key') {
    return secret.apiKey;
  }

  if (secret.type === 'local') {
    return secret.apiKey ?? null;
  }

  return null;
}

function secretContainsApiKey(secret: StoredProviderSecret): boolean {
  if (!secret) {
    return false;
  }

  if (secret.type === 'api_key') {
    return true;
  }

  return secret.type === 'local' && typeof secret.apiKey !== 'undefined';
}

async function clearLegacyApiKey(providerId: string): Promise<void> {
  const s = await getClawCorpProviderStore();
  const keys = (s.get('apiKeys') || {}) as Record<string, string>;
  if (!(providerId in keys)) {
    return;
  }

  delete keys[providerId];
  s.set('apiKeys', keys);
}

// ==================== API Key Storage ====================

/**
 * Store an API key
 */
export async function storeApiKey(providerId: string, apiKey: string): Promise<boolean> {
  try {
    await ensureProviderStoreMigrated();
    await setProviderSecret({
      type: 'api_key',
      accountId: providerId,
      apiKey,
    });
    await clearLegacyApiKey(providerId);
    return true;
  } catch (error) {
    logger.error('Failed to store API key:', error);
    return false;
  }
}

/**
 * Retrieve an API key
 */
export async function getApiKey(providerId: string): Promise<string | null> {
  try {
    await ensureProviderStoreMigrated();
    const secret = await getProviderSecret(providerId);
    const apiKey = getApiKeyFromSecret(secret);
    if (apiKey !== null) {
      return apiKey;
    }

    const s = await getClawCorpProviderStore();
    const keys = (s.get('apiKeys') || {}) as Record<string, string>;
    const legacyApiKey = keys[providerId];
    if (!legacyApiKey) {
      return null;
    }

    await setProviderSecret({
      type: 'api_key',
      accountId: providerId,
      apiKey: legacyApiKey,
    });
    delete keys[providerId];
    s.set('apiKeys', keys);
    return legacyApiKey;
  } catch (error) {
    logger.error('Failed to retrieve API key:', error);
    return null;
  }
}

/**
 * Delete an API key
 */
export async function deleteApiKey(providerId: string): Promise<boolean> {
  try {
    await ensureProviderStoreMigrated();
    await deleteProviderSecret(providerId);
    await clearLegacyApiKey(providerId);
    return true;
  } catch (error) {
    logger.error('Failed to delete API key:', error);
    return false;
  }
}

/**
 * Check if an API key exists for a provider
 */
export async function hasApiKey(providerId: string): Promise<boolean> {
  await ensureProviderStoreMigrated();
  const secret = await getProviderSecret(providerId);
  if (secretContainsApiKey(secret)) {
    return true;
  }

  const s = await getClawCorpProviderStore();
  const keys = (s.get('apiKeys') || {}) as Record<string, string>;
  if (!(providerId in keys)) {
    return false;
  }

  await setProviderSecret({
    type: 'api_key',
    accountId: providerId,
    apiKey: keys[providerId],
  });
  delete keys[providerId];
  s.set('apiKeys', keys);
  return true;
}

/**
 * List all provider IDs that have stored keys
 */
export async function listStoredKeyIds(): Promise<string[]> {
  await ensureProviderStoreMigrated();
  const s = await getClawCorpProviderStore();
  const providerSecrets = (s.get('providerSecrets') || {}) as Record<string, unknown>;
  const keys = (s.get('apiKeys') || {}) as Record<string, string>;
  const ids = new Set([...Object.keys(providerSecrets), ...Object.keys(keys)]);
  const keyIds: string[] = [];

  for (const id of ids) {
    const secret = await getProviderSecret(id);
    if (secretContainsApiKey(secret)) {
      keyIds.push(id);
      continue;
    }

    if (id in keys) {
      const legacyApiKey = keys[id];
      if (legacyApiKey) {
        await setProviderSecret({
          type: 'api_key',
          accountId: id,
          apiKey: legacyApiKey,
        });
        delete keys[id];
        s.set('apiKeys', keys);
      }
      keyIds.push(id);
    }
  }

  return keyIds;
}

// ==================== Provider Configuration ====================

/**
 * Save a provider configuration
 */
export async function saveProvider(config: ProviderConfig): Promise<void> {
  await ensureProviderStoreMigrated();
  const s = await getClawCorpProviderStore();
  const providers = s.get('providers') as Record<string, ProviderConfig>;
  providers[config.id] = config;
  s.set('providers', providers);

  const defaultProviderId = (s.get('defaultProvider') ?? null) as string | null;
  await saveProviderAccount(
    providerConfigToAccount(config, { isDefault: defaultProviderId === config.id }),
  );
}

/**
 * Get a provider configuration
 */
export async function getProvider(providerId: string): Promise<ProviderConfig | null> {
  await ensureProviderStoreMigrated();
  const s = await getClawCorpProviderStore();
  const providers = s.get('providers') as Record<string, ProviderConfig>;
  if (providers[providerId]) {
    return providers[providerId];
  }

  const account = await getProviderAccount(providerId);
  return account ? providerAccountToConfig(account) : null;
}

/**
 * Get all provider configurations
 */
export async function getAllProviders(): Promise<ProviderConfig[]> {
  await ensureProviderStoreMigrated();
  const s = await getClawCorpProviderStore();
  const providers = s.get('providers') as Record<string, ProviderConfig>;
  const legacyProviders = Object.values(providers);
  if (legacyProviders.length > 0) {
    return legacyProviders;
  }

  const accounts = await listProviderAccounts();
  return accounts.map(providerAccountToConfig);
}

/**
 * Delete a provider configuration and its API key
 */
export async function deleteProvider(providerId: string): Promise<boolean> {
  try {
    await ensureProviderStoreMigrated();
    // Delete the API key
    await deleteApiKey(providerId);

    // Delete the provider config
    const s = await getClawCorpProviderStore();
    const providers = s.get('providers') as Record<string, ProviderConfig>;
    delete providers[providerId];
    s.set('providers', providers);
    await deleteProviderAccount(providerId);

    // Clear default if this was the default
    if (s.get('defaultProvider') === providerId) {
      s.delete('defaultProvider');
      s.delete('defaultProviderAccountId');
    }

    return true;
  } catch (error) {
    logger.error('Failed to delete provider:', error);
    return false;
  }
}

/**
 * Set the default provider
 */
export async function setDefaultProvider(providerId: string): Promise<void> {
  await ensureProviderStoreMigrated();
  const s = await getClawCorpProviderStore();
  s.set('defaultProvider', providerId);
  await setDefaultProviderAccount(providerId);
}

/**
 * Get the default provider
 */
export async function getDefaultProvider(): Promise<string | undefined> {
  await ensureProviderStoreMigrated();
  const s = await getClawCorpProviderStore();
  return (s.get('defaultProvider') as string | undefined)
    ?? (s.get('defaultProviderAccountId') as string | undefined);
}

/**
 * Get provider with masked key info (for UI display)
 */
export async function getProviderWithKeyInfo(
  providerId: string
): Promise<(ProviderConfig & { hasKey: boolean; keyMasked: string | null }) | null> {
  const provider = await getProvider(providerId);
  if (!provider) return null;

  const apiKey = await getApiKey(providerId);
  let keyMasked: string | null = null;

  if (apiKey) {
    if (apiKey.length > 12) {
      keyMasked = `${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.substring(apiKey.length - 4)}`;
    } else {
      keyMasked = '*'.repeat(apiKey.length);
    }
  }

  return {
    ...provider,
    hasKey: !!apiKey,
    keyMasked,
  };
}

/**
 * Get all providers with key info (for UI display)
 * Read-only helper that must not mutate provider configs.
 */
export async function getAllProvidersWithKeyInfo(): Promise<
  Array<ProviderConfig & { hasKey: boolean; keyMasked: string | null }>
> {
  const providers = await getAllProviders();
  const results: Array<ProviderConfig & { hasKey: boolean; keyMasked: string | null }> = [];

  for (const provider of providers) {
    const apiKey = await getApiKey(provider.id);
    let keyMasked: string | null = null;

    if (apiKey) {
      if (apiKey.length > 12) {
        keyMasked = `${apiKey.substring(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.substring(apiKey.length - 4)}`;
      } else {
        keyMasked = '*'.repeat(apiKey.length);
      }
    }

    results.push({
      ...provider,
      hasKey: !!apiKey,
      keyMasked,
    });
  }

  return results;
}
