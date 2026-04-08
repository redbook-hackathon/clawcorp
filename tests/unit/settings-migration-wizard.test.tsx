import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SettingsMigrationWizard } from '@/components/settings-center/settings-migration-wizard';

describe('SettingsMigrationWizard', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<SettingsMigrationWizard open={false} onOpenChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it('navigates through the current Chinese flow and enables the start button after acknowledgement', () => {
    const onOpenChange = vi.fn();
    render(<SettingsMigrationWizard open onOpenChange={onOpenChange} />);

    expect(screen.getByRole('heading', { level: 2, name: '迁移兼容性报告' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

    expect(screen.getByRole('heading', { level: 2, name: '选择迁移范围' })).toBeInTheDocument();
    expect(screen.getByText('7/7')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Channels \(IM 通道配置\)/ }));
    expect(screen.getByText('6/7')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /下一步/ }));

    expect(screen.getByRole('heading', { level: 2, name: '确认执行迁移' })).toBeInTheDocument();
    const startButton = screen.getByRole('button', { name: /开始迁移/ });
    expect(startButton).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /我已了解迁移风险，确认执行/ }));
    expect(startButton).not.toBeDisabled();
    fireEvent.click(startButton);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
