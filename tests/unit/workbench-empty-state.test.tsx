import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { WorkbenchEmptyState } from '@/components/workbench/workbench-empty-state';
import { useChatStore } from '@/stores/chat';
import { useGatewayStore } from '@/stores/gateway';

describe('WorkbenchEmptyState', () => {
  const sendMessageMock = vi.fn();
  const setComposerDraftMock = vi.fn();

  beforeEach(() => {
    sendMessageMock.mockReset();
    setComposerDraftMock.mockReset();
    useChatStore.setState({ sendMessage: sendMessageMock, setComposerDraft: setComposerDraftMock, composerDraft: '' });
  });

  it('renders a quick action toolbar with persistent selected-action controls and 2x2 suggestion cards', async () => {
    useGatewayStore.setState({ status: { state: 'running', port: 18789 } });
    const { container } = render(<WorkbenchEmptyState />);

    expect(screen.getByRole('heading')).toBeInTheDocument();
    expect(screen.getByTestId('workbench-empty-illustration')).toBeInTheDocument();

    const quickActionBar = screen.getByRole('toolbar', { name: /quick action bar/i });
    expect(quickActionBar).toBeInTheDocument();
    expect(within(quickActionBar).getByText(/ready to run/i)).toBeInTheDocument();
    expect(within(quickActionBar).getByRole('button', { name: /use selected action/i })).toBeEnabled();

    const quickActionButtons = within(quickActionBar).getAllByRole('button', { name: /quick action:/i });
    expect(quickActionButtons).toHaveLength(6);
    expect(quickActionButtons[0]).toHaveAttribute('aria-pressed', 'true');

    const buttons = screen.getAllByRole('button');
    const suggestionCards = buttons.slice(-4);
    expect(suggestionCards).toHaveLength(4);
    for (const card of suggestionCards) {
      expect(card).not.toBeDisabled();
    }

    expect(await axe(container)).toHaveNoViolations();
  });

  it('opens a prompt panel and refills the composer instead of sending immediately', () => {
    useGatewayStore.setState({ status: { state: 'running', port: 18789 } });
    render(<WorkbenchEmptyState />);

    const quickActionBar = screen.getByRole('toolbar', { name: /quick action bar/i });
    const quickActionButtons = within(quickActionBar).getAllByRole('button', { name: /quick action:/i });
    const runSelectedButton = within(quickActionBar).getByRole('button', { name: /use selected action/i });

    fireEvent.click(quickActionButtons[1]);
    expect(quickActionButtons[1]).toHaveAttribute('aria-pressed', 'true');
    expect(sendMessageMock).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: /quick action prompt/i })).toBeInTheDocument();
    expect(screen.getByText(/mapped skills/i)).toBeInTheDocument();

    fireEvent.click(runSelectedButton);
    expect(screen.getByRole('dialog', { name: /quick action prompt/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /fill composer/i }));
    expect(setComposerDraftMock).toHaveBeenCalledTimes(1);
    expect(typeof setComposerDraftMock.mock.calls[0]?.[0]).toBe('string');
    expect(sendMessageMock).not.toHaveBeenCalled();
  });

  it('shows a disconnected hint and disables suggestion cards when gateway is down', () => {
    useGatewayStore.setState({ status: { state: 'stopped', port: 18789 } });
    render(<WorkbenchEmptyState />);

    expect(screen.getByText(/Gateway disconnected/)).toBeInTheDocument();

    const quickActionBar = screen.getByRole('toolbar', { name: /quick action bar/i });
    const quickActionButtons = within(quickActionBar).getAllByRole('button', { name: /quick action:/i });
    const runSelectedButton = within(quickActionBar).getByRole('button', { name: /use selected action/i });
    expect(runSelectedButton).toBeDisabled();
    for (const actionButton of quickActionButtons) {
      expect(actionButton).toBeDisabled();
    }

    const buttons = screen.getAllByRole('button');
    const suggestionCards = buttons.slice(-4);
    expect(suggestionCards).toHaveLength(4);
    for (const card of suggestionCards) {
      expect(card).toBeDisabled();
    }
  });
});
