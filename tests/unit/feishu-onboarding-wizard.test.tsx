import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeishuOnboardingWizard } from '@/components/channels/FeishuOnboardingWizard';
import { hostApiFetch } from '@/lib/host-api';

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

describe('FeishuOnboardingWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hostApiFetch).mockImplementation(async (path) => {
      if (path === '/api/feishu/status') {
        return {
          docsVersion: '2026.3.25',
          openClaw: { version: '2026.3.22', minVersion: '2026.3.2', compatible: true },
          plugin: {
            bundledVersion: '2026.3.25',
            bundledSource: 'build/openclaw-plugins/feishu-openclaw-plugin',
            installedVersion: '2026.3.25',
            installedPath: 'C:/Users/test/.openclaw/extensions/feishu-openclaw-plugin',
            recommendedVersion: '2026.3.25',
            installed: true,
            needsUpdate: false,
          },
          channel: {
            configured: true,
            accountIds: ['default'],
            pluginEnabled: true,
          },
          nextAction: 'ready',
        };
      }
      if (path === '/api/feishu/create/start') {
        return {
          url: 'https://open.feishu.cn/page/openclaw?form=multiAgent',
          qrCodeDataUrl: 'data:image/png;base64,create-qr',
        };
      }
      if (path === '/api/channels/config') {
        return {
          success: true,
        };
      }
      if (path === '/api/feishu/auth/start') {
        return {
          id: 'auth-session-1',
          accountId: 'default',
          appId: 'cli_123',
          brand: 'feishu',
          state: 'pending',
          verificationUriComplete: 'https://verify.example/complete',
          qrCodeDataUrl: 'data:image/png;base64,qr',
          userCode: 'user-code',
          scopeCount: 2,
          createdAt: '2026-03-25T18:00:00.000Z',
          expiresAt: '2026-03-25T18:10:00.000Z',
          message: '等待用户在飞书中确认授权。',
        };
      }
      throw new Error(`Unexpected hostApiFetch call: ${String(path)}`);
    });
  });

  it('loads status and starts user authorization from the wizard', async () => {
    render(
      <FeishuOnboardingWizard
        onClose={vi.fn()}
      onLinkExistingRobot={vi.fn()}
      />,
    );

    expect(await screen.findByText('OpenClaw 版本')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始飞书用户授权' }));

    await waitFor(() => {
      expect(hostApiFetch).toHaveBeenCalledWith('/api/feishu/auth/start', expect.objectContaining({ method: 'POST' }));
    });

    expect(await screen.findByText('飞书扫码授权')).toBeInTheDocument();
    expect(screen.getByText(/等待用户在飞书中确认授权/)).toBeInTheDocument();
  });

  it('keeps the new robot flow inside the wizard and continues to credential save', async () => {
    const statusResponses = [
      {
        docsVersion: '2026.3.25',
        openClaw: { version: '2026.3.22', minVersion: '2026.3.2', compatible: true },
        plugin: {
          bundledVersion: '2026.3.25',
          bundledSource: 'build/openclaw-plugins/feishu-openclaw-plugin',
          installedVersion: '2026.3.25',
          installedPath: 'C:/Users/test/.openclaw/extensions/feishu-openclaw-plugin',
          recommendedVersion: '2026.3.25',
          installed: true,
          needsUpdate: false,
        },
        channel: {
          configured: false,
          accountIds: [],
          pluginEnabled: false,
        },
        nextAction: 'configure-channel',
      },
      {
        docsVersion: '2026.3.25',
        openClaw: { version: '2026.3.22', minVersion: '2026.3.2', compatible: true },
        plugin: {
          bundledVersion: '2026.3.25',
          bundledSource: 'build/openclaw-plugins/feishu-openclaw-plugin',
          installedVersion: '2026.3.25',
          installedPath: 'C:/Users/test/.openclaw/extensions/feishu-openclaw-plugin',
          recommendedVersion: '2026.3.25',
          installed: true,
          needsUpdate: false,
        },
        channel: {
          configured: true,
          accountIds: ['default'],
          pluginEnabled: true,
        },
        nextAction: 'ready',
      },
    ];
    const onConfigured = vi.fn(async () => undefined);

    vi.mocked(hostApiFetch).mockImplementation(async (path) => {
      if (path === '/api/feishu/status') {
        return statusResponses.shift() ?? statusResponses[0];
      }
      if (path === '/api/feishu/create/start') {
        return {
          url: 'https://open.feishu.cn/page/openclaw?form=multiAgent',
          qrCodeDataUrl: 'data:image/png;base64,create-qr',
        };
      }
      if (path === '/api/channels/config') {
        return { success: true };
      }
      if (path === '/api/feishu/auth/start') {
        return {
          id: 'auth-session-1',
          accountId: 'default',
          appId: 'cli_123',
          brand: 'feishu',
          state: 'pending',
          verificationUriComplete: 'https://verify.example/complete',
          qrCodeDataUrl: 'data:image/png;base64,auth-qr',
          userCode: 'user-code',
          scopeCount: 2,
          createdAt: '2026-03-25T18:00:00.000Z',
          expiresAt: '2026-03-25T18:10:00.000Z',
          message: '等待用户在飞书中确认授权。',
        };
      }
      throw new Error(`Unexpected hostApiFetch call: ${String(path)}`);
    });

    render(
      <FeishuOnboardingWizard
        initialChannelName="研发飞书群"
        onClose={vi.fn()}
        onConfigured={onConfigured}
      />,
    );

    expect(await screen.findByText('OpenClaw 版本')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '扫码创建飞书机器人' }));
    expect(await screen.findByText('扫码创建飞书机器人')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '我已创建机器人，继续配置' }));
    expect(await screen.findByLabelText('App ID')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('App ID'), { target: { value: 'cli_123' } });
    fireEvent.change(screen.getByLabelText('App Secret'), { target: { value: 'secret_123' } });
    fireEvent.click(screen.getByRole('button', { name: '保存并继续' }));

    await waitFor(() => {
      expect(hostApiFetch).toHaveBeenCalledWith('/api/channels/config', expect.objectContaining({ method: 'POST' }));
    });
    await waitFor(() => {
      expect(hostApiFetch).toHaveBeenCalledWith('/api/feishu/auth/start', expect.objectContaining({ method: 'POST' }));
    });
    expect(onConfigured).toHaveBeenCalledWith({ channelName: '研发飞书群' });
    expect(await screen.findByText('飞书扫码授权')).toBeInTheDocument();
  });

  it('renders app permission recovery actions when tenant scopes are missing', async () => {
    const authResponses = [
      {
        id: 'auth-session-app-scope',
        accountId: 'default',
        appId: 'cli_123',
        brand: 'feishu',
        state: 'failed',
        verificationUriComplete: 'https://open.feishu.cn/app/cli_123/auth?q=im%3Amessage%3Areadonly',
        qrCodeDataUrl: 'data:image/png;base64,permission-qr',
        userCode: 'TENANT_SCOPE_REQUIRED',
        scopeCount: 1,
        createdAt: '2026-03-25T18:00:00.000Z',
        expiresAt: '2026-03-25T18:10:00.000Z',
        message: '飞书应用权限未完整开通，请先在手机飞书里确认权限。',
        appPermissionUrl: 'https://open.feishu.cn/app/cli_123/auth?q=im%3Amessage%3Areadonly',
        missingAppScopes: ['im:message:readonly'],
      },
      {
        id: 'auth-session-1',
        accountId: 'default',
        appId: 'cli_123',
        brand: 'feishu',
        state: 'pending',
        verificationUriComplete: 'https://verify.example/complete',
        qrCodeDataUrl: 'data:image/png;base64,auth-qr',
        userCode: 'user-code',
        scopeCount: 2,
        createdAt: '2026-03-25T18:00:00.000Z',
        expiresAt: '2026-03-25T18:10:00.000Z',
        message: '等待用户在飞书中确认授权。',
      },
    ];

    vi.mocked(hostApiFetch).mockImplementation(async (path) => {
      if (path === '/api/feishu/status') {
        return {
          docsVersion: '2026.3.25',
          openClaw: { version: '2026.3.22', minVersion: '2026.3.2', compatible: true },
          plugin: {
            bundledVersion: '2026.3.25',
            bundledSource: 'build/openclaw-plugins/feishu-openclaw-plugin',
            installedVersion: '2026.3.25',
            installedPath: 'C:/Users/test/.openclaw/extensions/feishu-openclaw-plugin',
            recommendedVersion: '2026.3.25',
            installed: true,
            needsUpdate: false,
          },
          channel: {
            configured: true,
            accountIds: ['default'],
            pluginEnabled: true,
          },
          nextAction: 'ready',
        };
      }
      if (path === '/api/feishu/auth/start') {
        return authResponses.shift();
      }
      throw new Error(`Unexpected hostApiFetch call: ${String(path)}`);
    });

    render(
      <FeishuOnboardingWizard
        onClose={vi.fn()}
        onConfigured={vi.fn(async () => undefined)}
      />,
    );

    expect(await screen.findByText('OpenClaw 版本')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '开始飞书用户授权' }));
    expect(await screen.findByText('应用权限待补齐')).toBeInTheDocument();
    expect(screen.getByText(/im:message:readonly/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '完成权限开通后重新检查' }));

    await waitFor(() => {
      expect(
        vi.mocked(hostApiFetch).mock.calls.filter(([path]) => path === '/api/feishu/auth/start'),
      ).toHaveLength(2);
    });
    expect(await screen.findByText('飞书扫码授权')).toBeInTheDocument();
  });
});
