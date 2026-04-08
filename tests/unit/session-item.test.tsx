import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionItem } from '@/components/sessions/SessionItem';

vi.mock('@/lib/session-search', () => ({
  formatRelativeTime: () => 'just now',
}));

describe('SessionItem', () => {
  it('renders a leader-chat indicator for private leader sessions', () => {
    render(
      <SessionItem
        session={{
          key: 'agent:main:private-main',
          displayName: 'Main',
          updatedAt: Date.now(),
          isPrivateChat: true,
          isLeaderChat: true,
          agentStatus: 'online',
        }}
        label="Main"
        isPinned={false}
        isActive={false}
        onClick={vi.fn()}
        onPinToggle={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText('Leader Chat')).toBeInTheDocument();
  });

  it('invokes handlers for click, pin, and delete actions', () => {
    const onClick = vi.fn();
    const onPinToggle = vi.fn();
    const onDelete = vi.fn();

    render(
      <SessionItem
        session={{
          key: 'agent:research:private-research',
          updatedAt: Date.now(),
          agentStatus: 'online',
        }}
        label="Research"
        isPinned={false}
        isActive={false}
        onClick={onClick}
        onPinToggle={onPinToggle}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open session Research' }));
    fireEvent.click(screen.getByLabelText('Pin'));
    fireEvent.click(screen.getByLabelText('Delete'));

    expect(onClick).toHaveBeenCalled();
    expect(onPinToggle).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });
});
