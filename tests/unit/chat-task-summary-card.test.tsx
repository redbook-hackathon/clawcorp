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

describe('chat task summary card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the latest internal excerpt collapsed until toggled open', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: '',
      _taskAnchor: {
        taskId: 'task-123',
        title: 'Implement login feature',
        latestInternalExcerpt: {
          content: 'Research is validating the OAuth callback flow.',
        },
      },
    };

    render(<ChatMessage message={message} showThinking={false} />);

    expect(screen.queryByTestId('task-anchor-excerpt')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('task-anchor-toggle'));
    expect(screen.getByTestId('task-anchor-excerpt')).toBeInTheDocument();
  });
});
