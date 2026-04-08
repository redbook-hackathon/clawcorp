import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ContextRail } from '@/components/workbench/context-rail';
import { useSettingsStore } from '@/stores/settings';

describe('ContextRail', () => {
  beforeEach(() => {
    useSettingsStore.setState({ rightPanelMode: 'agent' });
  });

  it('renders agent inspector drawer in expanded mode', () => {
    render(<ContextRail />);

    expect(screen.getByText('Agent 检查器')).toBeInTheDocument();
    expect(screen.getByText('基础设定（关于我）')).toBeInTheDocument();
    expect(screen.getByText('能力与工具')).toBeInTheDocument();
    expect(screen.getByText('我眼中的你')).toBeInTheDocument();
    expect(screen.getByText('工作记忆')).toBeInTheDocument();
  });

  it('renders files mode and closes via the close button', () => {
    useSettingsStore.getState().setRightPanelMode('files');
    render(<ContextRail />);

    expect(screen.getByText('会话文件')).toBeInTheDocument();
    expect(screen.getByText('当前会话暂无文件')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: '关闭文件面板' });
    fireEvent.click(closeButton);

    expect(useSettingsStore.getState().rightPanelMode).toBe(null);
    expect(screen.queryByText('会话文件')).not.toBeInTheDocument();
  });

  it('renders session mode and closes via the close button', () => {
    useSettingsStore.setState({ rightPanelMode: 'session' as never });
    render(<ContextRail />);

    expect(screen.getByText('会话详情')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: '关闭会话详情面板' });
    fireEvent.click(closeButton);

    expect(useSettingsStore.getState().rightPanelMode).toBe(null);
    expect(screen.queryByText('会话详情')).not.toBeInTheDocument();
  });
});
