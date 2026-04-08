import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Agents } from '@/pages/Agents';
import type { AgentSummary } from '@/types/agent';
import type { TeamSummary } from '@/types/team';

type AgentsStoreState = {
  agents: AgentSummary[];
  loading: boolean;
  error: string | null;
  fetchAgents: ReturnType<typeof vi.fn>;
  createAgent: ReturnType<typeof vi.fn>;
  deleteAgent: ReturnType<typeof vi.fn>;
};

type TeamsStoreState = {
  teams: TeamSummary[];
  loading: boolean;
  error: string | null;
  fetchTeams: ReturnType<typeof vi.fn>;
};

const { mockAgentsStore, mockTeamsStore, mockChannelsStore, mockChatState } = vi.hoisted(() => ({
  mockAgentsStore: {
    agents: [] as AgentSummary[],
    loading: false,
    error: null as string | null,
    fetchAgents: vi.fn(async () => undefined),
    createAgent: vi.fn(async () => ({ createdAgentId: 'new-agent' })),
    deleteAgent: vi.fn(async () => undefined),
  } satisfies AgentsStoreState,
  mockTeamsStore: {
    teams: [] as TeamSummary[],
    loading: false,
    error: null as string | null,
    fetchTeams: vi.fn(async () => undefined),
  } satisfies TeamsStoreState,
  mockChannelsStore: {
    channels: [],
    fetchChannels: vi.fn(async () => undefined),
  },
  mockChatState: {
    sessionLastActivity: {} as Record<string, number>,
  },
}));

vi.mock('@/stores/agents', () => ({
  useAgentsStore: () => mockAgentsStore,
}));

vi.mock('@/stores/teams', () => ({
  useTeamsStore: () => mockTeamsStore,
}));

vi.mock('@/stores/channels', () => ({
  useChannelsStore: () => mockChannelsStore,
}));

vi.mock('@/stores/chat', () => ({
  useChatStore: (selector: (state: typeof mockChatState) => unknown) => selector(mockChatState),
}));

vi.mock('@/stores/gateway', () => ({
  useGatewayStore: (selector: (state: { status: { state: string } }) => unknown) =>
    selector({ status: { state: 'running' } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const copy: Record<string, string> = {
        title: '员工广场',
        subtitle: '在同一个广场里浏览、创建，并进入每位员工的专属入口。',
        refresh: '刷新',
        addAgent: '添加员工',
        gatewayWarning: '网关服务未运行。',
        'square.stats.all': '全部员工',
        'square.stats.leaders': '负责人',
        'square.stats.workers': '执行成员',
        'square.filters.all': '全部',
        'square.filters.leader': '负责人',
        'square.filters.worker': '执行成员',
        'square.filters.direct': '可直聊',
        'square.filters.leader_only': '仅负责人转达',
        'square.filters.with_team': '已有团队',
        'square.actions.chat': '对话',
        'square.actions.memory': '记忆',
        'square.actions.details': '详情',
        'square.empty.title': '没有匹配的员工',
        'square.empty.description': '调整当前筛选条件。',
      };

      if (key in copy) {
        return copy[key];
      }

      return String(options?.defaultValue ?? key);
    },
  }),
}));

function createAgent(overrides: Partial<AgentSummary>): AgentSummary {
  return {
    id: 'main',
    name: 'Main',
    persona: 'Coordinates the team',
    isDefault: false,
    model: 'openai/gpt-5.4',
    modelDisplay: 'GPT-5.4',
    inheritedModel: false,
    workspace: '~/.openclaw/workspace',
    agentDir: '~/.openclaw/agents/main/agent',
    mainSessionKey: 'agent:main:main',
    channelTypes: ['feishu'],
    avatar: null,
    teamRole: 'leader',
    chatAccess: 'direct',
    responsibility: 'Coordinate work',
    reportsTo: null,
    directReports: [],
    ...overrides,
  };
}

function createTeam(overrides: Partial<TeamSummary>): TeamSummary {
  return {
    id: 'alpha',
    name: 'Alpha Team',
    leaderId: 'main',
    memberIds: ['alice'],
    description: '',
    status: 'active',
    createdAt: 1,
    updatedAt: 1,
    memberCount: 2,
    activeTaskCount: 1,
    lastActiveTime: undefined,
    leaderName: 'Main',
    memberAvatars: [],
    ...overrides,
  };
}

describe('Agents Employee Square page', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAgentsStore.agents = [
      createAgent({
        id: 'main',
        name: 'Main',
        teamRole: 'leader',
        mainSessionKey: 'agent:main:main',
      }),
      createAgent({
        id: 'alice',
        name: 'Alice',
        teamRole: 'worker',
        mainSessionKey: 'agent:alice:main',
      }),
      createAgent({
        id: 'bravo',
        name: 'Bravo',
        teamRole: 'worker',
        chatAccess: 'leader_only',
        mainSessionKey: 'agent:bravo:main',
      }),
    ];

    mockTeamsStore.teams = [createTeam({ memberIds: ['alice'] })];
    mockChatState.sessionLastActivity = {
      'agent:main:main': Date.UTC(2026, 3, 3, 12, 0, 0) - 60_000,
      'agent:alice:main': Date.UTC(2026, 3, 3, 12, 0, 0) - 30_000,
    };
  });

  it('renders the employee square hero, filter strip, and card action labels in Chinese', async () => {
    render(
      <MemoryRouter>
        <Agents />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockAgentsStore.fetchAgents).toHaveBeenCalled();
      expect(mockChannelsStore.fetchChannels).toHaveBeenCalled();
      expect(mockTeamsStore.fetchTeams).toHaveBeenCalled();
    });

    expect(screen.getByRole('heading', { name: '员工广场' })).toBeInTheDocument();
    expect(screen.queryByText('Employee Square')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '全部' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '负责人' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '已有团队' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '对话' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '记忆' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '详情' }).length).toBeGreaterThan(0);
  });

  it('switches filters for leaders and agents with team membership', async () => {
    render(
      <MemoryRouter>
        <Agents />
      </MemoryRouter>,
    );

    await screen.findByText('Main');
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '负责人' }));
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    expect(screen.queryByText('Bravo')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '已有团队' }));
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.queryByText('Bravo')).not.toBeInTheDocument();
  });
});
