// Lazy-load electron-store (ESM module) from the main process only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let providerStore: any = null;
const PROVIDER_STORE_NAME = 'clawcorp-providers';
const LEGACY_PROVIDER_STORE_NAME = 'clawx-providers';

function hasProviderStoreData(store: Record<string, unknown>): boolean {
  const providers = store.providers as Record<string, unknown> | undefined;
  const providerAccounts = store.providerAccounts as Record<string, unknown> | undefined;
  const apiKeys = store.apiKeys as Record<string, unknown> | undefined;
  const providerSecrets = store.providerSecrets as Record<string, unknown> | undefined;
  const defaultProvider = typeof store.defaultProvider === 'string' ? store.defaultProvider.trim() : '';
  const defaultProviderAccountId = typeof store.defaultProviderAccountId === 'string'
    ? store.defaultProviderAccountId.trim()
    : '';

  return Object.keys(providers ?? {}).length > 0
    || Object.keys(providerAccounts ?? {}).length > 0
    || Object.keys(apiKeys ?? {}).length > 0
    || Object.keys(providerSecrets ?? {}).length > 0
    || defaultProvider.length > 0
    || defaultProviderAccountId.length > 0;
}

export async function getClawCorpProviderStore() {
  if (!providerStore) {
    const Store = (await import('electron-store')).default;
    providerStore = new Store({
      name: PROVIDER_STORE_NAME,
      defaults: {
        schemaVersion: 0,
        providers: {} as Record<string, unknown>,
        providerAccounts: {} as Record<string, unknown>,
        // Legacy plaintext key cache. New writes should go through providerSecrets only.
        apiKeys: {} as Record<string, string>,
        // Main secret payloads, wrapped by electron safeStorage in secret-store.
        providerSecrets: {} as Record<string, unknown>,
        defaultProvider: null as string | null,
        defaultProviderAccountId: null as string | null,
      },
    });

    const currentStoreData = providerStore.store as Record<string, unknown>;
    if (!hasProviderStoreData(currentStoreData)) {
      const legacyStore = new Store({
        name: LEGACY_PROVIDER_STORE_NAME,
      });
      const legacyStoreData = legacyStore.store as Record<string, unknown>;
      if (hasProviderStoreData(legacyStoreData)) {
        providerStore.set(legacyStoreData);
      }
    }
  }

  return providerStore;
}
