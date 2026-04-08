import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChatMessage } from '@/pages/Chat/ChatMessage';
import type { RawMessage } from '@/stores/chat';

vi.mock('@/pages/Chat/MarkdownContent', () => ({
  default: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock('@/pages/Chat/message-utils', () => ({
  extractText: (msg: RawMessage) => typeof msg.content === 'string' ? msg.content : '',
  extractThinking: () => null,
  extractImages: () => [],
  extractToolGroups: () => [],
  formatTimestamp: () => '10:00 AM',
  isSystemInjectedUserMessage: () => false,
}));

vi.mock('@/pages/Chat/TaskCreationBubble', () => ({
  TaskCreationBubble: ({ title, onCancel }: any) => (
    <div data-testid="task-creation-bubble">
      <div>{title}</div>
      <button data-testid="task-proposal-cancel" onClick={onCancel}>cancel</button>
    </div>
  ),
}));

describe('ChatMessage task cards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders TaskCreationBubble for messages with _taskProposal', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: 'I recommend turning this into a task.',
      _taskProposal: {
        title: 'Implement login feature',
        description: 'Add OAuth login',
        assigneeId: 'agent-1',
        priority: 'high',
      },
    };

    render(<ChatMessage message={message} showThinking={false} />);

    expect(screen.getByTestId('task-creation-bubble')).toBeInTheDocument();
    expect(screen.getByText('Implement login feature')).toBeInTheDocument();
  });

  it('renders a summary-first task anchor card with deep link and latest excerpt', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: '',
      _taskAnchor: {
        taskId: 'task-123',
        title: 'Implement login feature',
        executionStatus: 'working',
        owningTeamLabel: 'Frontend',
        latestInternalExcerpt: {
          content: 'Research is validating the OAuth callback flow.',
        },
      },
    };

    render(<ChatMessage message={message} showThinking={false} />);

    expect(screen.getByTestId('task-anchor-card')).toBeInTheDocument();
    expect(screen.getByText('Implement login feature')).toBeInTheDocument();
    expect(screen.getByText('Frontend')).toBeInTheDocument();
    expect(screen.getByTestId('task-anchor-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('task-anchor-link')).toBeInTheDocument();
  });

  it('task anchor deep links to the task detail surface in kanban', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: '',
      _taskAnchor: {
        taskId: 'task-123',
        title: 'Implement login feature',
      },
    };

    delete (window as Window & { location: Location }).location;
    window.location = { href: '' } as Location;

    render(<ChatMessage message={message} showThinking={false} />);
    fireEvent.click(screen.getByTestId('task-anchor-link'));

    expect(window.location.href).toBe('/kanban?taskId=task-123');
  });

  it('hides task bubble after cancellation', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: 'I recommend turning this into a task.',
      _taskProposal: {
        title: 'Implement login feature',
        description: 'Add OAuth login',
      },
    };

    render(<ChatMessage message={message} showThinking={false} />);
    fireEvent.click(screen.getByTestId('task-proposal-cancel'));

    expect(screen.queryByTestId('task-creation-bubble')).not.toBeInTheDocument();
  });
});
