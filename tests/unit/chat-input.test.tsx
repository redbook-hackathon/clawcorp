import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ChatInput } from '@/pages/Chat/ChatInput';

const {
  agentsState,
  chatState,
  gatewayState,
  settingsState,
  navigateMock,
  hostApiFetchMock,
  toastInfoMock,
  toastSuccessMock,
  toastErrorMock,
} = vi.hoisted(() => ({
  agentsState: {
    agents: [] as Array<Record<string, unknown>>,
  },
  chatState: {
    currentAgentId: 'main',
    currentSessionKey: 'agent:main:main',
    messages: [] as Array<Record<string, unknown>>,
    newSession: vi.fn(),
  },
  gatewayState: {
    status: { state: 'running', port: 18789 },
  },
  settingsState: {
    defaultModel: 'claude-sonnet-4-6',
  },
  navigateMock: vi.fn(),
  hostApiFetchMock: vi.fn(),
  toastInfoMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/stores/settings', () => ({
  useSettingsStore: (selector: (state: typeof settingsState) => unknown) => selector(settingsState),
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: hostApiFetchMock,
}));

vi.mock('@/lib/api-client', () => ({
  invokeIpc: vi.fn(),
}));

vi.mock('@/pages/Chat/FolderSelectorPopover', () => ({
  FolderSelectorPopover: ({
    onSelectFolder,
  }: {
    onSelectFolder: (path: string) => void;
  }) => (
    <button type="button" onClick={() => onSelectFolder('C:/Users/22688/Desktop/ClawX-main')}>
      mock-select-folder
    </button>
  ),
}));

function translate(key: string, vars?: Record<string, unknown>): string {
  switch (key) {
    case 'composer.attachFiles':
      return 'Attach files';
    case 'composer.pickAgent':
      return 'Choose agent';
    case 'composer.clearTarget':
      return 'Clear target agent';
    case 'composer.targetChip':
      return `@${String(vars?.agent ?? '')}`;
    case 'composer.agentPickerTitle':
      return 'Route the next message to another agent';
    case 'composer.gatewayDisconnectedPlaceholder':
      return 'Gateway not connected...';
    case 'composer.send':
      return 'Send';
    case 'composer.stop':
      return 'Stop';
    case 'composer.gatewayConnected':
      return 'connected';
    case 'composer.gatewayStatus':
      return `gateway ${String(vars?.state ?? '')} | port: ${String(vars?.port ?? '')} ${String(vars?.pid ?? '')}`.trim();
    case 'composer.retryFailedAttachments':
      return 'Retry failed attachments';
    default:
      return key;
  }
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    info: toastInfoMock,
    success: toastSuccessMock,
    error: toastErrorMock,
  },
}));

describe('ChatInput agent targeting', () => {
  beforeEach(() => {
    agentsState.agents = [];
    chatState.currentAgentId = 'main';
    chatState.currentSessionKey = 'agent:main:main';
    chatState.messages = [];
    chatState.newSession = vi.fn();
    gatewayState.status = { state: 'running', port: 18789 };
    settingsState.defaultModel = 'claude-sonnet-4-6';
    navigateMock.mockReset();
    hostApiFetchMock.mockReset();
    toastInfoMock.mockReset();
    toastSuccessMock.mockReset();
    toastErrorMock.mockReset();
  });

  it('renders the updated composer shell regions and model pill', () => {
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'MiniMax',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
    ];

    render(<ChatInput onSend={vi.fn()} />);

    expect(screen.getByTestId('chat-composer-shell')).toHaveClass('chat-composer-shell');
    expect(screen.getByTestId('chat-composer-toolbar')).toHaveClass('chat-composer-toolbar');
    expect(screen.getByTestId('chat-composer-footer')).toHaveClass('chat-composer-footer');
    expect(screen.getByTestId('chat-composer-model-pill')).toHaveTextContent('MiniMax');
  });

  it('adds responsive layout classes for narrow-width chat composition', () => {
    render(<ChatInput onSend={vi.fn()} />);

    expect(screen.getByTestId('chat-input-frame')).toHaveClass('px-3', 'sm:px-8');
    expect(screen.getByTestId('chat-composer-toolbar')).toHaveClass('flex-wrap', 'sm:flex-nowrap');
    expect(screen.getByTestId('chat-composer-footer')).toHaveClass('px-2', 'sm:px-0');
  });

  it('applies distinct framing classes for empty vs active chat layouts', () => {
    const { rerender } = render(<ChatInput onSend={vi.fn()} isEmpty />);
    const frame = screen.getByTestId('chat-input-frame');

    expect(frame).toHaveClass('chat-input-layout-empty');
    expect(frame).not.toHaveClass('chat-input-layout-active');

    rerender(<ChatInput onSend={vi.fn()} isEmpty={false} />);

    expect(frame).toHaveClass('chat-input-layout-active');
    expect(frame).not.toHaveClass('chat-input-layout-empty');
  });

  it('hides the @agent picker when only one agent is configured', () => {
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'MiniMax',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
    ];

    render(<ChatInput onSend={vi.fn()} />);

    expect(screen.queryByTitle('Choose agent')).not.toBeInTheDocument();
  });

  it('lets the user select an agent target and sends it with the message', () => {
    const onSend = vi.fn();
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'MiniMax',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
      {
        id: 'research',
        name: 'Research',
        isDefault: false,
        modelDisplay: 'Claude',
        inheritedModel: false,
        workspace: '~/.openclaw/workspace-research',
        agentDir: '~/.openclaw/agents/research/agent',
        mainSessionKey: 'agent:research:desk',
        channelTypes: [],
        chatAccess: 'direct',
      },
    ];

    render(<ChatInput onSend={onSend} />);

    fireEvent.click(screen.getByTitle('Choose agent'));
    fireEvent.click(screen.getByText('Research'));

    expect(screen.getByText('@Research')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Hello direct agent' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(onSend).toHaveBeenCalledWith('Hello direct agent', undefined, 'research', null);
  });

  it('falls back to the default model from settings when current agent has no modelDisplay', () => {
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
    ];
    settingsState.defaultModel = 'gpt-5.2';

    render(<ChatInput onSend={vi.fn()} />);

    expect(screen.getByTestId('chat-composer-model-pill')).toHaveTextContent('gpt-5.2');
  });

  it('passes selected workingDirectory as the 4th onSend argument', () => {
    const onSend = vi.fn();
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'MiniMax',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
    ];

    render(<ChatInput onSend={onSend} />);

    fireEvent.click(screen.getByRole('button', { name: 'mock-select-folder' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Run in selected dir' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(onSend).toHaveBeenCalledWith(
      'Run in selected dir',
      undefined,
      null,
      'C:/Users/22688/Desktop/ClawX-main',
    );
  });

  it('shows slash command menu when input starts with a slash', () => {
    render(<ChatInput onSend={vi.fn()} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/' } });

    expect(screen.getByTestId('chat-slash-menu')).toBeInTheDocument();
    expect(screen.getByText('/new')).toBeInTheDocument();
    expect(screen.getByText('/agent')).toBeInTheDocument();
    expect(screen.getByText('/cwd')).toBeInTheDocument();
  });

  it('accepts the highlighted slash command with Enter instead of sending the partial prefix', () => {
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'ArrowDown' });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });

    expect(screen.getByRole('textbox')).toHaveValue('/stop ');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('executes /new locally without sending a message', () => {
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/new' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(chatState.newSession).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('executes /agent and uses the selected target for the next message', () => {
    const onSend = vi.fn();
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'MiniMax',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
      },
      {
        id: 'research',
        name: 'Research',
        isDefault: false,
        modelDisplay: 'Claude',
        inheritedModel: false,
        workspace: '~/.openclaw/workspace-research',
        agentDir: '~/.openclaw/agents/research/agent',
        mainSessionKey: 'agent:research:desk',
        channelTypes: [],
        chatAccess: 'direct',
      },
    ];

    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/agent research' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(screen.getByText('@Research')).toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Route this' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(onSend).toHaveBeenCalledWith('Route this', undefined, 'research', null);
  });

  it('blocks selecting a leader-only worker as the next target', () => {
    const onSend = vi.fn();
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'MiniMax',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
        chatAccess: 'direct',
      },
      {
        id: 'research',
        name: 'Research',
        isDefault: false,
        modelDisplay: 'Claude',
        inheritedModel: false,
        workspace: '~/.openclaw/workspace-research',
        agentDir: '~/.openclaw/agents/research/agent',
        mainSessionKey: 'agent:research:desk',
        channelTypes: [],
        chatAccess: 'leader_only',
        reportsTo: 'main',
      },
    ];

    render(<ChatInput onSend={onSend} />);

    fireEvent.click(screen.getByTitle('Choose agent'));
    fireEvent.click(screen.getByText('Research'));

    expect(screen.queryByText('@Research')).not.toBeInTheDocument();
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it('blocks /agent when the requested worker is leader-only', () => {
    const onSend = vi.fn();
    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'MiniMax',
        inheritedModel: true,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
        chatAccess: 'direct',
      },
      {
        id: 'research',
        name: 'Research',
        isDefault: false,
        modelDisplay: 'Claude',
        inheritedModel: false,
        workspace: '~/.openclaw/workspace-research',
        agentDir: '~/.openclaw/agents/research/agent',
        mainSessionKey: 'agent:research:desk',
        channelTypes: [],
        chatAccess: 'leader_only',
        reportsTo: 'main',
      },
    ];

    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/agent research' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(screen.queryByText('@Research')).not.toBeInTheDocument();
    expect(onSend).not.toHaveBeenCalled();
    expect(toastErrorMock).toHaveBeenCalledTimes(1);
  });

  it('executes /cwd and uses the selected directory for the next message', () => {
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/cwd C:/tmp/work' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(onSend).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Run in cwd' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(onSend).toHaveBeenCalledWith('Run in cwd', undefined, null, 'C:/tmp/work');
  });

  it('passes through unknown slash commands as normal text', () => {
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/status' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(onSend).toHaveBeenCalledWith('/status', undefined, null, null);
  });

  it('executes /memory locally by navigating without sending', () => {
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/memory' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(navigateMock).toHaveBeenCalledWith('/memory');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('executes /cron locally by navigating without sending', () => {
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/cron' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(navigateMock).toHaveBeenCalledWith('/cron');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('executes /settings locally by navigating without sending', () => {
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/settings' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(navigateMock).toHaveBeenCalledWith('/settings');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('executes /clear as a local conversation reset', () => {
    const onSend = vi.fn();

    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/clear' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(chatState.newSession).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('exports current conversation to markdown for /export', () => {
    const onSend = vi.fn();
    chatState.messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ];
    hostApiFetchMock.mockResolvedValue({ success: true, savedPath: 'C:/tmp/chat-export.md' });

    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/export' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(hostApiFetchMock).toHaveBeenCalledTimes(1);
    expect(hostApiFetchMock).toHaveBeenCalledWith(
      '/api/files/save-image',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    const body = JSON.parse((hostApiFetchMock.mock.calls[0]?.[1] as { body?: string })?.body ?? '{}');
    expect(body.defaultFileName).toMatch(/\.md$/);
    expect(body.base64).toBeTypeOf('string');
    expect(body.base64.length).toBeGreaterThan(0);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows explicit feedback when /export has nothing to export', () => {
    const onSend = vi.fn();
    chatState.messages = [];

    render(<ChatInput onSend={onSend} />);

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '/export' } });
    fireEvent.click(screen.getByTitle('Send'));

    expect(hostApiFetchMock).not.toHaveBeenCalled();
    expect(toastInfoMock).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
  });
});
