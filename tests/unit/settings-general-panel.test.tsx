import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsGeneralPanel } from '@/components/settings-center/settings-general-panel';
import { useSettingsStore } from '@/stores/settings';
import { hostApiFetch } from '@/lib/host-api';

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn().mockResolvedValue({}),
}));

describe('SettingsGeneralPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSettingsStore.getState().resetSettings();
  });

  it('keeps General Settings focused on baseline product controls', () => {
    render(<SettingsGeneralPanel />);

    expect(screen.getByRole('heading', { name: '账号与安全' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '外观与行为' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '品牌与身份' })).toBeInTheDocument();

    expect(screen.queryByText('团队与角色策略')).not.toBeInTheDocument();
    expect(screen.queryByText('通道高级配置')).not.toBeInTheDocument();
    expect(screen.queryByText('自动化默认策略')).not.toBeInTheDocument();
    expect(screen.queryByText('Agent 头像')).not.toBeInTheDocument();
  });

  it('updates theme, language, launch, tray, notifications, and brand identity settings', async () => {
    render(<SettingsGeneralPanel />);

    fireEvent.click(screen.getByRole('button', { name: '深色模式' }));
    expect(useSettingsStore.getState().theme).toBe('dark');

    fireEvent.change(screen.getByLabelText('界面语言'), {
      target: { value: 'en' },
    });
    expect(useSettingsStore.getState().language).toBe('en');

    fireEvent.click(screen.getByRole('switch', { name: '开机自启' }));
    expect(useSettingsStore.getState().launchAtStartup).toBe(true);

    fireEvent.click(screen.getByRole('switch', { name: '启动后最小化' }));
    expect(useSettingsStore.getState().startMinimized).toBe(true);

    fireEvent.click(screen.getByRole('switch', { name: '关闭时隐藏到托盘' }));
    expect(useSettingsStore.getState().minimizeToTray).toBe(false);

    fireEvent.click(screen.getByRole('switch', { name: '通知提醒' }));
    expect(useSettingsStore.getState().mobileAlert).toBe(false);

    fireEvent.change(screen.getByLabelText('工作台名称'), {
      target: { value: 'Acme Control' },
    });
    fireEvent.change(screen.getByLabelText('副标题'), {
      target: { value: 'Operator Console' },
    });
    fireEvent.change(screen.getByLabelText('我的名字指代'), {
      target: { value: 'Operator' },
    });

    expect(useSettingsStore.getState().brandName).toBe('Acme Control');
    expect(useSettingsStore.getState().brandSubtitle).toBe('Operator Console');
    expect(useSettingsStore.getState().myName).toBe('Operator');

    await waitFor(() => {
      expect(vi.mocked(hostApiFetch)).toHaveBeenCalledWith(
        '/api/settings/language',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ value: 'en' }),
        }),
      );
      expect(vi.mocked(hostApiFetch)).toHaveBeenCalledWith(
        '/api/settings/launchAtStartup',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ value: true }),
        }),
      );
    });
  });
});
