import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  testHome,
  testUserData,
  mockLoggerWarn,
  mockLoggerInfo,
  mockLoggerError,
  mockRunOpenClawDoctor,
} = vi.hoisted(() => {
  const suffix = Math.random().toString(36).slice(2);
  return {
    testHome: `/tmp/clawx-channel-config-${suffix}`,
    testUserData: `/tmp/clawx-channel-config-user-data-${suffix}`,
    mockLoggerWarn: vi.fn(),
    mockLoggerInfo: vi.fn(),
    mockLoggerError: vi.fn(),
    mockRunOpenClawDoctor: vi.fn(),
  };
});

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  const mocked = {
    ...actual,
    homedir: () => testHome,
  };
  return {
    ...mocked,
    default: mocked,
  };
});

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => testUserData,
    getVersion: () => '0.0.0-test',
    getAppPath: () => '/tmp',
  },
}));

vi.mock('@electron/utils/logger', () => ({
  warn: mockLoggerWarn,
  info: mockLoggerInfo,
  error: mockLoggerError,
}));

vi.mock('@electron/utils/openclaw-doctor', () => ({
  runOpenClawDoctor: mockRunOpenClawDoctor,
  runOpenClawDoctorFix: vi.fn(),
}));

async function readOpenClawJson(): Promise<Record<string, unknown>> {
  const content = await readFile(join(testHome, '.openclaw', 'openclaw.json'), 'utf8');
  return JSON.parse(content) as Record<string, unknown>;
}

async function writeOpenClawJson(config: unknown): Promise<void> {
  const openclawDir = join(testHome, '.openclaw');
  await mkdir(openclawDir, { recursive: true });
  await writeFile(join(openclawDir, 'openclaw.json'), JSON.stringify(config, null, 2), 'utf8');
}

describe('channel credential normalization and duplicate checks', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    mockRunOpenClawDoctor.mockResolvedValue({
      mode: 'diagnose',
      success: true,
      exitCode: 0,
      stdout: '',
      stderr: '',
      command: 'openclaw doctor --json',
      cwd: testHome,
      durationMs: 5,
    });
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('assertNoDuplicateCredential detects duplicates with different whitespace', async () => {
    const { saveChannelConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig('feishu', { appId: 'bot-123', appSecret: 'secret-a' }, 'agent-a');

    await expect(
      saveChannelConfig('feishu', { appId: '  bot-123  ', appSecret: 'secret-b' }, 'agent-b'),
    ).rejects.toThrow('already bound to another agent');
  });

  it('assertNoDuplicateCredential does NOT detect duplicates with different case', async () => {
    // Case-sensitive credentials (like tokens) should NOT be normalized to lowercase
    // to avoid false positives where different tokens become the same after lowercasing
    const { saveChannelConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig('feishu', { appId: 'Bot-ABC', appSecret: 'secret-a' }, 'agent-a');

    // Should NOT throw - different case is considered a different credential
    await expect(
      saveChannelConfig('feishu', { appId: 'bot-abc', appSecret: 'secret-b' }, 'agent-b'),
    ).resolves.not.toThrow();
  });

  it('normalizes credential values when saving (trim only, preserve case)', async () => {
    const { saveChannelConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig('feishu', { appId: '  BoT-XyZ  ', appSecret: 'secret' }, 'agent-a');

    const config = await readOpenClawJson();
    const channels = config.channels as Record<string, { accounts: Record<string, { appId?: string }> }>;
    // Should trim whitespace but preserve original case
    expect(channels.feishu.accounts['agent-a'].appId).toBe('BoT-XyZ');
  });

  it('emits warning logs when credential normalization (trim) occurs', async () => {
    const { saveChannelConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig('feishu', { appId: '  BoT-Log  ', appSecret: 'secret' }, 'agent-a');

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Normalized channel credential value for duplicate check',
      expect.objectContaining({ channelType: 'feishu', accountId: 'agent-a', key: 'appId' }),
    );
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      'Normalizing channel credential value before save',
      expect.objectContaining({ channelType: 'feishu', accountId: 'agent-a', key: 'appId' }),
    );
  });

  it('stores wechat config under the OpenClaw plugin channel id', async () => {
    const { saveChannelConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig('wechat', { enabled: true }, 'default');

    const config = await readOpenClawJson();
    const channels = config.channels as Record<string, unknown>;
    expect(channels.wechat).toBeUndefined();
    expect(channels['openclaw-weixin']).toBeDefined();

    const plugins = config.plugins as { allow?: string[]; entries?: Record<string, { enabled?: boolean }> };
    expect(plugins.allow).toContain('openclaw-weixin');
    expect(plugins.entries?.['openclaw-weixin']?.enabled).toBe(true);
  });

  it('maps stored openclaw-weixin back to ui wechat in configured channel list', async () => {
    await writeOpenClawJson({
      channels: {
        'openclaw-weixin': {
          enabled: true,
          defaultAccount: 'default',
          accounts: {
            default: { enabled: true },
          },
        },
      },
    });

    const { listConfiguredChannels } = await import('@electron/utils/channel-config');
    await expect(listConfiguredChannels()).resolves.toContain('wechat');
  });

  it('lists configured channel accounts with default account metadata', async () => {
    await writeOpenClawJson({
      channels: {
        feishu: {
          enabled: true,
          defaultAccount: 'default',
          accounts: {
            default: { enabled: true, appId: 'default-app', appSecret: 'default-secret' },
            'agent-a': { enabled: true, appId: 'agent-app', appSecret: 'agent-secret' },
          },
          appId: 'default-app',
          appSecret: 'default-secret',
        },
        'openclaw-weixin': {
          enabled: true,
          defaultAccount: 'default',
          accounts: {
            default: { enabled: true },
          },
        },
      },
    });

    const { listConfiguredChannelAccounts } = await import('@electron/utils/channel-config');
    await expect(listConfiguredChannelAccounts()).resolves.toEqual(expect.objectContaining({
      feishu: {
        defaultAccountId: 'default',
        accountIds: ['default', 'agent-a'],
      },
      'openclaw-weixin': {
        defaultAccountId: 'default',
        accountIds: ['default'],
      },
    }));
  });

  it('sets the default channel account and re-mirrors top-level credentials', async () => {
    await writeOpenClawJson({
      channels: {
        feishu: {
          enabled: true,
          defaultAccount: 'default',
          accounts: {
            default: { enabled: true, appId: 'default-app', appSecret: 'default-secret' },
            'agent-a': { enabled: true, appId: 'agent-app', appSecret: 'agent-secret' },
          },
          appId: 'default-app',
          appSecret: 'default-secret',
        },
      },
    });

    const { setChannelDefaultAccount } = await import('@electron/utils/channel-config');
    await setChannelDefaultAccount('feishu', 'agent-a');

    const config = await readOpenClawJson();
    const feishu = (config.channels as Record<string, Record<string, unknown>>).feishu;
    expect(feishu.defaultAccount).toBe('agent-a');
    expect(feishu.appId).toBe('agent-app');
    expect(feishu.appSecret).toBe('agent-secret');
  });
});

describe('parseDoctorValidationOutput', () => {
  it('extracts channel error and warning lines', async () => {
    const { parseDoctorValidationOutput } = await import('@electron/utils/channel-config');

    const out = parseDoctorValidationOutput(
      'feishu',
      'feishu error: token invalid\nfeishu warning: fallback enabled\n',
    );

    expect(out.undetermined).toBe(false);
    expect(out.errors).toEqual(['feishu error: token invalid']);
    expect(out.warnings).toEqual(['feishu warning: fallback enabled']);
  });

  it('falls back with hint when output has no channel signal', async () => {
    const { parseDoctorValidationOutput } = await import('@electron/utils/channel-config');

    const out = parseDoctorValidationOutput('feishu', 'all good, no channel details');

    expect(out.undetermined).toBe(true);
    expect(out.errors).toEqual([]);
    expect(out.warnings.some((w) => w.includes('falling back to local channel config checks'))).toBe(true);
  });

  it('falls back with hint when output is empty', async () => {
    const { parseDoctorValidationOutput } = await import('@electron/utils/channel-config');

    const out = parseDoctorValidationOutput('feishu', '   ');

    expect(out.undetermined).toBe(true);
    expect(out.errors).toEqual([]);
    expect(out.warnings.some((w) => w.includes('falling back to local channel config checks'))).toBe(true);
  });

  it('extracts channel error and warning entries from json output', async () => {
    const { parseDoctorValidationOutput } = await import('@electron/utils/channel-config');

    const out = parseDoctorValidationOutput(
      'feishu',
      JSON.stringify({
        checks: [
          { channel: 'feishu', severity: 'error', message: 'token invalid' },
          { channel: 'feishu', severity: 'warning', message: 'fallback enabled' },
        ],
      }),
    );

    expect(out.undetermined).toBe(false);
    expect(out.errors).toEqual(['feishu error: token invalid']);
    expect(out.warnings).toEqual(['feishu warning: fallback enabled']);
  });
});

describe('default channel account deletion mirror cleanup', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('clears stale top-level mirrored credentials when deleting default account directly', async () => {
    const { saveChannelConfig, deleteChannelAccountConfig } = await import('@electron/utils/channel-config');

    await saveChannelConfig('feishu', { appId: 'default-bot', appSecret: 'default-secret' }, 'default');
    await saveChannelConfig('feishu', { appId: 'agent-bot', appSecret: 'agent-secret' }, 'agent-a');

    await deleteChannelAccountConfig('feishu', 'default');

    const config = await readOpenClawJson();
    const feishu = (config.channels as Record<string, Record<string, unknown>>).feishu;
    expect((feishu.accounts as Record<string, unknown>).default).toBeUndefined();
    expect(feishu.appId).toBeUndefined();
    expect(feishu.appSecret).toBeUndefined();
  });

  it('clears stale top-level mirrored credentials when deleting main agent channel accounts', async () => {
    await writeOpenClawJson({
      channels: {
        feishu: {
          enabled: true,
          defaultAccount: 'default',
          appId: 'default-bot',
          appSecret: 'default-secret',
          accounts: {
            default: { enabled: true, appId: 'default-bot', appSecret: 'default-secret' },
            'agent-a': { enabled: true, appId: 'agent-bot', appSecret: 'agent-secret' },
          },
        },
      },
    });

    const { deleteAgentChannelAccounts } = await import('@electron/utils/channel-config');
    await deleteAgentChannelAccounts('main');

    const config = await readOpenClawJson();
    const feishu = (config.channels as Record<string, Record<string, unknown>>).feishu;
    expect((feishu.accounts as Record<string, unknown>).default).toBeUndefined();
    expect(feishu.appId).toBeUndefined();
    expect(feishu.appSecret).toBeUndefined();
  });
});

describe('WeChat dangling plugin cleanup', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('removes dangling openclaw-weixin plugin registration and state when no channel config exists', async () => {
    const { cleanupDanglingWeChatPluginState, writeOpenClawConfig } = await import('@electron/utils/channel-config');

    await writeOpenClawConfig({
      plugins: {
        enabled: true,
        allow: ['openclaw-weixin'],
        entries: {
          'openclaw-weixin': { enabled: true },
        },
      },
    });

    const staleStateDir = join(testHome, '.openclaw', 'openclaw-weixin', 'accounts');
    await mkdir(staleStateDir, { recursive: true });
    await writeFile(join(staleStateDir, 'bot-im-bot.json'), JSON.stringify({ token: 'stale-token' }), 'utf8');
    await writeFile(join(testHome, '.openclaw', 'openclaw-weixin', 'accounts.json'), JSON.stringify(['bot-im-bot']), 'utf8');

    const result = await cleanupDanglingWeChatPluginState();
    expect(result.cleanedDanglingState).toBe(true);

    const config = await readOpenClawJson();
    expect(config.plugins).toBeUndefined();
    expect(existsSync(join(testHome, '.openclaw', 'openclaw-weixin'))).toBe(false);
  });
});

describe('validateChannelConfig doctor integration', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('returns invalid when doctor helper fails even if channel config exists', async () => {
    const { saveChannelConfig, validateChannelConfig } = await import('@electron/utils/channel-config');
    await saveChannelConfig('feishu', { appId: 'default-bot', appSecret: 'default-secret' }, 'default');

    mockRunOpenClawDoctor.mockResolvedValueOnce({
      mode: 'diagnose',
      success: false,
      exitCode: 1,
      stdout: 'doctor failed on feishu',
      stderr: 'fatal',
      command: 'openclaw doctor --json',
      cwd: testHome,
      durationMs: 14,
      error: 'failed',
    });

    const result = await validateChannelConfig('feishu');

    expect(mockRunOpenClawDoctor).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(false);
    expect(result.errors.some((err) => err.includes('doctor failed') || err.includes('fatal'))).toBe(true);
  });
});
