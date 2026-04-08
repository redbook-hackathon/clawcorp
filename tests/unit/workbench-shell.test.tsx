import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Chat } from '@/pages/Chat';
import { useRightPanelStore } from '@/stores/rightPanelStore';

const chatState = {
  messages: [] as Array<Record<string, unknown>>,
  currentSessionKey: 'agent:main:main',
  sessions: [{ key: 'agent:main:main', label: 'Main Session', updatedAt: 1711111111111 }],
  sessionLabels: { 'agent:main:main': 'Main Session' },
  sessionLastActivity: { 'agent:main:main': 1711111111111 },
  loading: false,
  sending: false,
  error: null as string | null,
  showThinking: false,
  streamingMessage: null as unknown,
  streamingTools: [] as Array<unknown>,
  pendingFinal: false,
  currentAgentId: 'main',
  sendMessage: vi.fn(),
  abortRun: vi.fn(),
  clearError: vi.fn(),
  cleanupEmptySession: vi.fn(),
  switchSession: vi.fn(),
  deleteSession: vi.fn(),
  newSession: vi.fn(),
};

const gatewayState = {
  status: {
    state: 'running',
    port: 18789,
  },
};

const agentsState = {
  agents: [
    {
      id: 'main',
      name: 'KaiTianClaw',
      isDefault: true,
      modelDisplay: 'GLM-5-Turbo',
      inheritedModel: false,
      workspace: '~/.openclaw/workspace',
      agentDir: '~/.openclaw/agents/main/agent',
      mainSessionKey: 'agent:main:main',
      channelTypes: [],
    },
  ],
  fetchAgents: vi.fn(),
  configuredChannelTypes: [] as string[],
  channelOwners: {} as Record<string, string>,
};

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof chatState) => unknown) => selector(chatState),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: typeof gatewayState) => unknown) => selector(gatewayState),
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: (selector: (state: typeof agentsState) => unknown) => selector(agentsState),
}));

vi.mock('@/hooks/use-stick-to-bottom-instant', () => ({
  useStickToBottomInstant: () => ({
    contentRef: { current: null },
    scrollRef: { current: null },
  }),
}));

vi.mock('@/hooks/use-min-loading', () => ({
  useMinLoading: () => false,
}));

vi.mock('@/pages/Chat/ChatInput', () => ({
  ChatInput: () => <div data-testid="chat-input">composer</div>,
}));

function translate(key: string, vars?: Record<string, unknown>): string {
  const map: Record<string, string> = {
    'common:rightPanel.openFiles': 'Open files panel',
    'common:rightPanel.openAgent': 'Open agent panel',
    'chat:workbench.quickConfig': '蹇€熼厤缃?',
    'workbench.quickConfig': '蹇€熼厤缃?',
    'chat:workbench.hero.subtitle': '鎻忚堪浣犵殑鐩爣锛屼富鍒嗚韩浼氬崗鍚屽垎韬墽琛屽苟瀹炴椂鍙嶉',
    'workbench.hero.subtitle': '鎻忚堪浣犵殑鐩爣锛屼富鍒嗚韩浼氬崗鍚屽垎韬墽琛屽苟瀹炴椂鍙嶉',
    'chat:workbench.quickConfigDescription': '璁剧疆褰撳墠鍒嗚韩鐨勫悕绉般€佽鑹层€佸父鐢ㄩ€氶亾銆侀粯璁ゆ妧鑳戒笌甯哥敤宸ュ叿锛岃瀹冪珛鍒昏繘鍏ュ彲宸ヤ綔鐘舵€併€?',
    'workbench.quickConfigDescription': '璁剧疆褰撳墠鍒嗚韩鐨勫悕绉般€佽鑹层€佸父鐢ㄩ€氶亾銆侀粯璁ゆ妧鑳戒笌甯哥敤宸ュ叿锛岃瀹冪珛鍒昏繘鍏ュ彲宸ヤ綔鐘舵€併€?',
  };

  if (key === 'chat:toolbar.currentAgent') {
    return `褰撳墠宸ヤ綔鍙帮細${String(vars?.agent ?? '')}`;
  }

  return map[key] ?? key;
}

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
  useTranslation: () => ({
    t: translate,
  }),
}));

describe('Chat workbench shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chatState.messages = [];
    chatState.loading = false;
    chatState.sending = false;
    chatState.error = null;
    chatState.showThinking = false;
    gatewayState.status = { state: 'running', port: 18789 };
    useRightPanelStore.setState({ open: false, type: null, agentId: null });
  });

  it('renders right-panel trigger buttons and opens the global panel store', () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );

    const fileButton = screen.getByRole('button', { name: 'Open files panel' });
    const agentButton = screen.getByRole('button', { name: 'Open agent panel' });
    expect(fileButton).toBeInTheDocument();
    expect(agentButton).toBeInTheDocument();
    expect(screen.getAllByText('KaiTianClaw').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /有什么我可以帮你的/ })).toBeInTheDocument();
    expect(screen.getByText('代码重构方案')).toBeInTheDocument();
    expect(screen.getByText('检查系统健康度')).toBeInTheDocument();

    fireEvent.click(fileButton);
    expect(useRightPanelStore.getState()).toMatchObject({ open: true, type: 'file', agentId: 'main' });

    fireEvent.click(agentButton);
    expect(useRightPanelStore.getState()).toMatchObject({ open: true, type: 'agent', agentId: 'main' });
    expect(screen.getByTestId('chat-input')).toBeInTheDocument();
  });

  it('does not show a top-level export action in the chat header tool area', () => {
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('button', { name: /export/i })).not.toBeInTheDocument();
  });

  it('displays the thinking banner when the assistant run is active', () => {
    chatState.sending = true;
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );
    expect(screen.getByText(/正在思考中/)).toBeInTheDocument();
  });

  it('hides the thinking banner when no run is active', () => {
    chatState.sending = false;
    render(
      <MemoryRouter>
        <Chat />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/姝ｅ湪鎬濊€冧腑/)).not.toBeInTheDocument();
  });
});
