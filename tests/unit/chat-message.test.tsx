import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { RawMessage } from '@/stores/chat';
import { ChatMessage } from '@/pages/Chat/ChatMessage';

describe('ChatMessage', () => {
  it('renders user bubble with the current accent-token styling', () => {
    const message: RawMessage = {
      role: 'user',
      content: '用户消息',
      timestamp: 1710000000,
    };

    render(<ChatMessage message={message} showThinking={false} />);

    const text = screen.getByText('用户消息');
    const bubble = screen.getByTestId('chat-bubble-user');

    expect(text).toBeInTheDocument();
    expect(bubble).toHaveClass('bg-clawcorp-ac');
    expect(bubble).toHaveClass('text-white');
  });

  it('renders assistant tool card and allows expanding tool input', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'tool-1', name: 'query_k8s_logs', input: { range: '24h' } },
      ],
      timestamp: 1710001000,
    };

    render(<ChatMessage message={message} showThinking={false} />);

    expect(screen.getByText('工具执行')).toBeInTheDocument();
    expect(screen.getByText('query_k8s_logs')).toBeInTheDocument();
    expect(screen.queryByText(/"range": "24h"/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /工具执行/ }));

    expect(screen.getByText(/"range": "24h"/)).toBeInTheDocument();
  });

  it('groups file-change tools by turn and shows both input and result details when expanded', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: [
        {
          type: 'tool_use',
          id: 'tool-write',
          name: 'write',
          input: {
            file_path: '/workspace/src/foo.ts',
            content: 'export const foo = 1;',
          },
        },
        {
          type: 'tool_result',
          id: 'tool-write',
          name: 'write',
          content: [{ type: 'text', text: 'Wrote /workspace/src/foo.ts successfully.' }],
        },
        {
          type: 'tool_use',
          id: 'tool-multiedit',
          name: 'multiedit',
          input: {
            file_path: '/workspace/src/app.tsx',
            edits: [
              { old_string: 'foo', new_string: 'bar' },
              { old_string: 'old', new_string: 'new' },
            ],
          },
        },
        {
          type: 'tool_result',
          id: 'tool-multiedit',
          name: 'multiedit',
          content: [{ type: 'text', text: 'Applied 2 edits to /workspace/src/app.tsx.' }],
        },
      ],
      timestamp: 1710001500,
    };

    render(<ChatMessage message={message} showThinking={false} />);

    expect(screen.getAllByText('文件变更预览').length).toBe(2);
    expect(screen.getByText('/workspace/src/foo.ts')).toBeInTheDocument();
    expect(screen.getByText('2 edits')).toBeInTheDocument();
    expect(screen.queryByText(/Wrote \/workspace\/src\/foo\.ts successfully\./)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /multiedit/i }));

    expect(screen.getByText(/Applied 2 edits to \/workspace\/src\/app\.tsx\./)).toBeInTheDocument();
    expect(screen.getByText(/"file_path": "\/workspace\/src\/app\.tsx"/)).toBeInTheDocument();
  });

  it('hides assistant messages that only contain internal cron tool activity', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: [
        { type: 'tool_use', id: 'tool-cron', name: 'cron', input: { action: 'schedule', delay: '40s' } },
      ],
      timestamp: 1710001800,
    };

    const { container } = render(<ChatMessage message={message} showThinking={false} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders assistant markdown text with inline code in the current neutral assistant surface', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: '结果包含 **重点** 和 `trace_id`。',
      timestamp: 1710002000,
    };

    render(<ChatMessage message={message} showThinking={false} />);

    const strong = screen.getByText('重点');
    const code = screen.getByText('trace_id');
    const bubble = screen.getByTestId('chat-bubble-assistant');

    expect(strong.tagName.toLowerCase()).toBe('strong');
    expect(code.tagName.toLowerCase()).toBe('code');
    expect(bubble).toHaveClass('bg-white');
    expect(bubble).toHaveClass('text-black');
  });

  it('auto-expands streaming thinking blocks while reasoning is active', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: [{ type: 'thinking', thinking: '正在推理...' }],
      timestamp: 1710003000,
    };

    render(<ChatMessage message={message} showThinking={true} isStreaming />);

    expect(screen.getByText('正在推理...')).toBeInTheDocument();
  });

  it('keeps historical thinking collapsed until the user expands it manually', () => {
    const message: RawMessage = {
      role: 'assistant',
      content: [{ type: 'thinking', thinking: '静态思考片段' }],
      timestamp: 1710004000,
    };

    render(<ChatMessage message={message} showThinking={true} />);

    expect(screen.queryByText('静态思考片段')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /思考过程/ }));

    expect(screen.getByText('静态思考片段')).toBeInTheDocument();
  });
});
