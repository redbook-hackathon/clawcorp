import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsMigrationPanel } from '@/components/settings-center/settings-migration-panel';

describe('SettingsMigrationPanel', () => {
  it('renders every migration section and action entry point', () => {
    render(<SettingsMigrationPanel onLaunchWizard={vi.fn()} />);

    expect(screen.getByRole('heading', { name: '从 OpenClaw 迁移配置 (Migrate from OpenClaw)' })).toBeInTheDocument();
    expect(screen.getByText(/自动检测本地磁盘上的 OpenClaw 旧版工作区/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '冷备与导出' })).toBeInTheDocument();
    expect(screen.getByText('备份完整快照包 (Snapshot)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '选择 .clawcorp 导入' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '自动增量备份' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '恢复出厂 (Hard Reset)' })).toBeInTheDocument();
  });

  it('triggers the migration wizard when the CTA is clicked', () => {
    const onLaunchWizard = vi.fn();
    render(<SettingsMigrationPanel onLaunchWizard={onLaunchWizard} />);

    fireEvent.click(screen.getByRole('button', { name: '🪄 启动迁移向导' }));
    expect(onLaunchWizard).toHaveBeenCalledOnce();
  });
});
