import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsToolPermissionsPanel } from '@/components/settings-center/settings-tool-permissions-panel';
import { useSettingsStore } from '@/stores/settings';
import { hostApiFetch } from '@/lib/host-api';

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn().mockResolvedValue({}),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('SettingsToolPermissionsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useSettingsStore.getState().resetSettings();
  });

  it('keeps Tool Permissions as a dedicated top-level panel', () => {
    render(<SettingsToolPermissionsPanel />);

    expect(screen.getByRole('heading', { name: '核心沙箱与内置权限' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '自定义工具授权' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '外观与行为' })).not.toBeInTheDocument();
  });

  it('updates sandbox toggles and manages allowlists and custom grants', async () => {
    render(<SettingsToolPermissionsPanel />);

    fireEvent.change(screen.getByRole('combobox', { name: '全局风险级别设定' }), {
      target: { value: 'strict' },
    });
    expect(useSettingsStore.getState().globalRiskLevel).toBe('strict');

    fireEvent.click(screen.getByRole('button', { name: '路径白名单' }));
    fireEvent.change(screen.getByLabelText('新增允许访问路径'), {
      target: { value: 'C:\\Projects\\ClawCorp' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存路径' }));

    await waitFor(() => {
      expect(screen.getByText('C:\\Projects\\ClawCorp')).toBeInTheDocument();
      expect(vi.mocked(hostApiFetch)).toHaveBeenCalledWith(
        '/api/settings',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ filePathAllowlist: ['C:\\Projects\\ClawCorp'] }),
        }),
      );
    });

    fireEvent.click(screen.getByRole('button', { name: '添加工具许可' }));
    fireEvent.change(screen.getByLabelText('新增工具许可'), {
      target: { value: 'github-cli --repo anthropics/claude-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存许可' }));

    await waitFor(() => {
      expect(screen.getByText('github-cli --repo anthropics/claude-code')).toBeInTheDocument();
      expect(vi.mocked(hostApiFetch)).toHaveBeenCalledWith(
        '/api/settings',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ customToolGrants: ['github-cli --repo anthropics/claude-code'] }),
        }),
      );
    });
  });
});
