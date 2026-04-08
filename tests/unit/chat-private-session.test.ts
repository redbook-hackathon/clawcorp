import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { gatewayRpcMock, hostApiFetchMock, agentsState } = vi.hoisted(() => ({
  gatewayRpcMock: vi.fn(),
  hostApiFetchMock: vi.fn(),
  agentsState: {
    agents: [] as Array<Record<string, unknown>>,
  },
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: {
    getState: () => ({
      rpc: gatewayRpcMock,
    }),
  },
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: {
    getState: () => agentsState,
  },
}));

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: (...args: unknown[]) => hostApiFetchMock(...args),
}));

describe('chat private sessions', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-02T12:00:00Z'));

    agentsState.agents = [
      {
        id: 'main',
        name: 'Main',
        isDefault: true,
        modelDisplay: 'GPT-5.4',
        inheritedModel: false,
        workspace: '~/.openclaw/workspace',
        agentDir: '~/.openclaw/agents/main/agent',
        mainSessionKey: 'agent:main:main',
        channelTypes: [],
        chatAccess: 'direct',
        teamRole: 'leader',
        reportsTo: null,
      },
      {
        id: 'research',
        name: 'Research',
        isDefault: false,
        modelDisplay: 'Claude Sonnet 4',
        inheritedModel: false,
        workspace: '~/.openclaw/workspace-research',
        agentDir: '~/.openclaw/agents/research/agent',
        mainSessionKey: 'agent:research:desk',
        channelTypes: [],
        chatAccess: 'direct',
        teamRole: 'worker',
        reportsTo: 'main',
      },
    ];

    gatewayRpcMock.mockReset();
    gatewayRpcMock.mockImplementation(async (method: string, payload: Record<string, unknown>) => {
      if (method === 'chat.history') {
        return { messages: [], thinkingLevel: null, sessionKey: payload.sessionKey };
      }
      if (method === 'chat.send') {
        return { runId: 'run-private' };
      }
      if (method === 'sessions.list') {
        return { sessions: [] };
      }
      if (method === 'chat.abort') {
        return { ok: true };
      }
      throw new Error(`Unexpected gateway RPC: ${method}`);
    });

    hostApiFetchMock.mockReset();
    hostApiFetchMock.mockResolvedValue({ success: true, result: { runId: 'run-media' } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a synthetic private session but loads history from the underlying agent main session', async () => {
    const { useChatStore } = await import('@/stores/chat');

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [{ key: 'agent:main:main', displayName: 'Main' }],
      messages: [],
      sessionLabels: {},
      sessionLastActivity: {},
      sessionUnreadCounts: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
      showThinking: true,
      composerDraft: '',
    });

    const key = useChatStore.getState().openDirectAgentSession('research', {
      teamId: 'team-alpha',
      teamName: 'Alpha Team',
    });

    expect(key).toBe('agent:research:private-research');
    expect(useChatStore.getState().currentSessionKey).toBe('agent:research:private-research');

    const session = useChatStore.getState().sessions.find((entry) => entry.key === key);
    expect(session).toMatchObject({
      key: 'agent:research:private-research',
      agentId: 'research',
      targetAgentId: 'research',
      isPrivateChat: true,
      isLeaderChat: false,
      teamId: 'team-alpha',
      teamName: 'Alpha Team',
    });

    await vi.runAllTimersAsync();

    const historyCall = gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.history');
    expect(historyCall?.[1]).toEqual({ sessionKey: 'agent:research:desk', limit: 200 });
  });

  it('routes sendMessage from a synthetic private session to the underlying agent main session', async () => {
    const { useChatStore } = await import('@/stores/chat');

    useChatStore.setState({
      currentSessionKey: 'agent:main:main',
      currentAgentId: 'main',
      sessions: [{ key: 'agent:main:main', displayName: 'Main' }],
      messages: [],
      sessionLabels: {},
      sessionLastActivity: {},
      sessionUnreadCounts: {},
      sending: false,
      activeRunId: null,
      streamingText: '',
      streamingMessage: null,
      streamingTools: [],
      pendingFinal: false,
      lastUserMessageAt: null,
      pendingToolImages: [],
      error: null,
      loading: false,
      thinkingLevel: null,
      showThinking: true,
      composerDraft: '',
    });

    useChatStore.getState().openDirectAgentSession('research');
    await useChatStore.getState().sendMessage('Hello private session');

    const sendCall = gatewayRpcMock.mock.calls.find(([method]) => method === 'chat.send');
    expect(sendCall?.[1]).toMatchObject({
      sessionKey: 'agent:research:desk',
      message: 'Hello private session',
      deliver: false,
    });
  });
});
