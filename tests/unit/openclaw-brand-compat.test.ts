// @vitest-environment node
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

describe('ClawCorp brand compatibility (stores and paths)', () => {
  it('uses clawcorp provider store and migrates legacy clawx provider data', async () => {
    vi.resetModules();

    const createdStoreNames: string[] = [];
    const storeData = new Map<string, Record<string, unknown>>([
      ['clawx-providers', {
        schemaVersion: 0,
        providers: { openai: { id: 'openai' } },
        providerAccounts: {},
        apiKeys: {},
        providerSecrets: {},
        defaultProvider: 'openai',
        defaultProviderAccountId: null,
      }],
    ]);

    class MockStore {
      name: string;
      store: Record<string, unknown>;

      constructor(options: { name: string; defaults?: Record<string, unknown> }) {
        this.name = options.name;
        createdStoreNames.push(options.name);
        const existing = storeData.get(options.name);
        this.store = existing
          ? structuredClone(existing)
          : structuredClone(options.defaults ?? {});
        storeData.set(options.name, this.store);
      }

      set(keyOrValue: string | Record<string, unknown>, value?: unknown) {
        if (typeof keyOrValue === 'string') {
          this.store[keyOrValue] = value;
          return;
        }
        this.store = {
          ...this.store,
          ...keyOrValue,
        };
      }
    }

    vi.doMock('electron-store', () => ({
      default: MockStore,
    }));

    const { getClawCorpProviderStore } = await import('@electron/services/providers/store-instance');
    const store = await getClawCorpProviderStore();
    const providers = store.store.providers as Record<string, unknown>;

    expect(createdStoreNames).toContain('clawcorp-providers');
    expect(providers.openai).toBeDefined();
  });

  it('prefers ~/.clawcorp and falls back to ~/.clawx when needed', async () => {
    vi.resetModules();

    const homeDir = 'C:/Users/clawcorp-test';
    const existingPaths = new Set<string>();

    vi.doMock('electron', () => ({
      app: {
        isPackaged: false,
        getPath: vi.fn(() => 'C:/Users/clawcorp-test/AppData/Roaming/ClawCorp'),
        getAppPath: vi.fn(() => 'C:/Users/clawcorp-test/app'),
        getVersion: vi.fn(() => '0.0.0-test'),
      },
    }));
    vi.doMock('os', async () => {
      const actual = await vi.importActual<typeof import('os')>('os');
      return {
        ...actual,
        homedir: () => homeDir,
      };
    });
    vi.doMock('fs', async () => {
      const actual = await vi.importActual<typeof import('fs')>('fs');
      return {
        ...actual,
        existsSync: (path: string) => existingPaths.has(path),
      };
    });

    const { getClawCorpConfigDir } = await import('@electron/utils/paths');
    const clawcorpDir = join(homeDir, '.clawcorp');
    const legacyDir = join(homeDir, '.clawx');

    existingPaths.add(clawcorpDir);
    existingPaths.add(legacyDir);
    expect(getClawCorpConfigDir()).toBe(clawcorpDir);

    existingPaths.delete(clawcorpDir);
    expect(getClawCorpConfigDir()).toBe(legacyDir);
  });

  it('generates gateway tokens with clawcorp prefix', async () => {
    vi.resetModules();

    class MockStore<T extends Record<string, unknown>> {
      store: T;

      constructor(options: { defaults: T }) {
        this.store = structuredClone(options.defaults);
      }

      get<K extends keyof T>(key: K): T[K] {
        return this.store[key];
      }

      set<K extends keyof T>(key: K, value: T[K]): void {
        this.store[key] = value;
      }

      clear(): void {
        this.store = {} as T;
      }
    }

    vi.doMock('electron-store', () => ({
      default: MockStore,
    }));
    vi.doMock('electron', () => ({
      app: {
        getPreferredSystemLanguages: () => ['en-US'],
        getLocale: () => 'en-US',
      },
    }));

    const { getSetting } = await import('@electron/utils/store');
    const token = await getSetting('gatewayToken');

    expect(token.startsWith('clawcorp-')).toBe(true);
  });
});

