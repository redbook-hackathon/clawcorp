import type { ProviderSecret } from '../../shared/providers/types';
import { safeStorage } from 'electron';
import { getClawCorpProviderStore } from '../providers/store-instance';

export interface SecretStore {
  get(accountId: string): Promise<ProviderSecret | null>;
  set(secret: ProviderSecret): Promise<void>;
  delete(accountId: string): Promise<void>;
}

interface EncryptedProviderSecret {
  __format: 'clawcorp-safe-storage/v1';
  encryption: 'safe-storage' | 'base64-fallback';
  payload: string;
}

class SecureStorageUnavailableError extends Error {
  constructor(message = 'Secure storage unavailable') {
    super(message);
    this.name = 'SecureStorageUnavailableError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isProviderSecret(value: unknown): value is ProviderSecret {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.accountId !== 'string' || typeof value.type !== 'string') {
    return false;
  }
  if (value.type === 'api_key') {
    return typeof value.apiKey === 'string';
  }
  if (value.type === 'oauth') {
    return (
      typeof value.accessToken === 'string'
      && typeof value.refreshToken === 'string'
      && typeof value.expiresAt === 'number'
    );
  }
  if (value.type === 'local') {
    return typeof value.apiKey === 'undefined' || typeof value.apiKey === 'string';
  }
  return false;
}

function isEncryptedProviderSecret(value: unknown): value is EncryptedProviderSecret {
  if (!isRecord(value)) {
    return false;
  }

  return (
    value.__format === 'clawcorp-safe-storage/v1'
    && (value.encryption === 'safe-storage' || value.encryption === 'base64-fallback')
    && typeof value.payload === 'string'
  );
}

function serializeSecret(secret: ProviderSecret): string {
  return JSON.stringify(secret);
}

function canUseSafeStorage(): boolean {
  return (
    typeof safeStorage !== 'undefined'
    && typeof safeStorage.isEncryptionAvailable === 'function'
    && safeStorage.isEncryptionAvailable()
  );
}

function encodeSecret(secret: ProviderSecret): EncryptedProviderSecret {
  const serialized = serializeSecret(secret);

  if (!canUseSafeStorage()) {
    throw new SecureStorageUnavailableError(
      'Secure storage unavailable; refusing to persist provider secrets without OS encryption.',
    );
  }

  try {
    return {
      __format: 'clawcorp-safe-storage/v1',
      encryption: 'safe-storage',
      payload: safeStorage.encryptString(serialized).toString('base64'),
    };
  } catch {
    throw new SecureStorageUnavailableError(
      'Secure storage encryption failed; refusing to persist provider secrets.',
    );
  }
}

function decodeSecret(secret: EncryptedProviderSecret): ProviderSecret | null {
  try {
    const payloadBuffer = Buffer.from(secret.payload, 'base64');
    const decoded = secret.encryption === 'safe-storage'
      ? (canUseSafeStorage() ? safeStorage.decryptString(payloadBuffer) : null)
      : payloadBuffer.toString('utf8');
    if (decoded === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(decoded);
    return isProviderSecret(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export class ElectronStoreSecretStore implements SecretStore {
  async get(accountId: string): Promise<ProviderSecret | null> {
    const store = await getClawCorpProviderStore();
    const secrets = (store.get('providerSecrets') ?? {}) as Record<string, ProviderSecret | EncryptedProviderSecret>;
    const storedSecret = secrets[accountId];

    if (storedSecret) {
        if (isEncryptedProviderSecret(storedSecret)) {
          if (storedSecret.encryption === 'base64-fallback') {
            if (!canUseSafeStorage()) {
              return null;
            }
            const decoded = decodeSecret(storedSecret);
            if (decoded) {
              await this.set(decoded);
              return decoded;
          }
          delete secrets[accountId];
          store.set('providerSecrets', secrets);
          return null;
        }

        return decodeSecret(storedSecret);
      }

      if (isProviderSecret(storedSecret)) {
        if (!canUseSafeStorage()) {
          return null;
        }
        await this.set(storedSecret);
        return storedSecret;
      }
    }

    const apiKeys = (store.get('apiKeys') ?? {}) as Record<string, string>;
    const apiKey = apiKeys[accountId];
    if (!apiKey) {
      return null;
    }

    if (!canUseSafeStorage()) {
      return null;
    }

    const legacySecret: ProviderSecret = {
      type: 'api_key',
      accountId,
      apiKey,
    };
    await this.set(legacySecret);
    return legacySecret;
  }

  async set(secret: ProviderSecret): Promise<void> {
    const store = await getClawCorpProviderStore();
    const secrets = (store.get('providerSecrets') ?? {}) as Record<string, ProviderSecret | EncryptedProviderSecret>;
    secrets[secret.accountId] = encodeSecret(secret);
    store.set('providerSecrets', secrets);

    const apiKeys = (store.get('apiKeys') ?? {}) as Record<string, string>;
    if (secret.accountId in apiKeys) {
      delete apiKeys[secret.accountId];
      store.set('apiKeys', apiKeys);
    }
  }

  async delete(accountId: string): Promise<void> {
    const store = await getClawCorpProviderStore();
    const secrets = (store.get('providerSecrets') ?? {}) as Record<string, ProviderSecret | EncryptedProviderSecret>;
    delete secrets[accountId];
    store.set('providerSecrets', secrets);

    const apiKeys = (store.get('apiKeys') ?? {}) as Record<string, string>;
    delete apiKeys[accountId];
    store.set('apiKeys', apiKeys);
  }
}

const secretStore = new ElectronStoreSecretStore();

export function getSecretStore(): SecretStore {
  return secretStore;
}

export async function getProviderSecret(accountId: string): Promise<ProviderSecret | null> {
  return getSecretStore().get(accountId);
}

export async function setProviderSecret(secret: ProviderSecret): Promise<void> {
  await getSecretStore().set(secret);
}

export async function deleteProviderSecret(accountId: string): Promise<void> {
  await getSecretStore().delete(accountId);
}
