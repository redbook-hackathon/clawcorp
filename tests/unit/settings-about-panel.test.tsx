import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsAboutPanel } from '@/components/settings-center/settings-about-panel';

const {
  hostApiFetchMock,
  invokeIpcMock,
  clipboardWriteText,
  settingsState,
  updateState,
} = vi.hoisted(() => ({
  hostApiFetchMock: vi.fn(),
  invokeIpcMock: vi.fn(),
  clipboardWriteText: vi.fn(),
  settingsState: {
    devModeUnlocked: false,
    setDevModeUnlocked: vi.fn(),
    remoteRpcEnabled: false,
    setRemoteRpcEnabled: vi.fn(),
    p2pSyncEnabled: false,
    setP2pSyncEnabled: vi.fn(),
    telemetryEnabled: true,
    setTelemetryEnabled: vi.fn(),
  },
  updateState: {
    currentVersion: '1.0.0',
  },
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: hostApiFetchMock,
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: invokeIpcMock,
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

vi.mock('@/stores/update', () => ({
  useUpdateStore: (selector: (state: typeof updateState) => unknown) => selector(updateState),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? _key,
  }),
}));

describe('SettingsAboutPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hostApiFetchMock.mockResolvedValue({ success: true, exitCode: 0 });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: clipboardWriteText },
    });
  });

  it('renders product information while keeping diagnostics behind folded subsections', () => {
    render(<SettingsAboutPanel onRerunSetup={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'ClawCorp' })).toBeInTheDocument();
    expect(screen.getByText(/Graphical AI assistant for OpenClaw teams/i)).toBeInTheDocument();
    expect(screen.getByText(/Version 1.0.0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '开发者诊断' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '维护与恢复' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: '运行诊断' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '重置所有设置' })).not.toBeInTheDocument();
  });

  it('runs doctor actions and developer controls from the diagnostics subsection', async () => {
    render(<SettingsAboutPanel onRerunSetup={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '开发者诊断' }));

    fireEvent.click(screen.getByRole('button', { name: '运行诊断' }));
    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/openclaw-doctor',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ mode: 'diagnose' }),
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '运行修复' }));
    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/openclaw-doctor',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ mode: 'fix' }),
        }),
      );
    });

    fireEvent.click(screen.getByRole('switch', { name: '开发者模式' }));
    expect(settingsState.setDevModeUnlocked).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('switch', { name: '远程 RPC 访问' }));
    expect(settingsState.setRemoteRpcEnabled).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('switch', { name: '匿名遥测' }));
    expect(settingsState.setTelemetryEnabled).toHaveBeenCalledWith(false);
  });

  it('provides feedback, environment copy, and maintenance actions inside About', async () => {
    const onRerunSetup = vi.fn();
    render(<SettingsAboutPanel onRerunSetup={onRerunSetup} />);

    fireEvent.click(screen.getByRole('button', { name: '提交 Issue' }));
    expect(invokeIpcMock).toHaveBeenCalledWith(
      'shell:openExternal',
      'https://github.com/anthropics/claude-code/issues',
    );

    fireEvent.click(screen.getByRole('button', { name: '复制环境信息' }));
    expect(clipboardWriteText).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '维护与恢复' }));
    fireEvent.click(screen.getByRole('button', { name: '重新运行初始化' }));
    expect(onRerunSetup).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: '重置所有设置' }));
    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/settings/reset',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '清除服务器数据' }));
    await waitFor(() => {
      expect(hostApiFetchMock).toHaveBeenCalledWith(
        '/api/app/clear-server-data',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });
});
