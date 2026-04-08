import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import TaskKanban from '@/pages/TaskKanban';
import { useApprovalsStore } from '@/stores/approvals';
import { useAgentsStore } from '@/stores/agents';
import type { KanbanTask } from '@/types/task';
import type { AgentSummary } from '@/types/agent';

// Mock stores
vi.mock('@/stores/approvals');
vi.mock('@/stores/agents');
vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

const mockAgents: AgentSummary[] = [
  {
    id: 'agent-1',
    name: 'Agent Alpha',
    persona: 'Test persona',
    isDefault: false,
    model: 'claude-3-5-sonnet-20241022',
    modelDisplay: 'Claude 3.5 Sonnet',
    inheritedModel: false,
    workspace: '/workspace',
    agentDir: '/agents/alpha',
    mainSessionKey: 'session-1',
    channelTypes: [],
    teamRole: 'worker',
    chatAccess: 'direct',
    responsibility: 'Testing',
  },
  {
    id: 'agent-2',
    name: 'Agent Beta',
    persona: 'Test persona 2',
    isDefault: false,
    model: 'claude-3-5-sonnet-20241022',
    modelDisplay: 'Claude 3.5 Sonnet',
    inheritedModel: false,
    workspace: '/workspace',
    agentDir: '/agents/beta',
    mainSessionKey: 'session-2',
    channelTypes: [],
    teamRole: 'leader',
    chatAccess: 'direct',
    responsibility: 'Leading',
  },
];

const mockTasks: KanbanTask[] = [
  {
    id: 'task-1',
    title: 'Personal Task',
    description: 'Test task',
    status: 'todo',
    priority: 'high',
    assigneeId: 'agent-1',
    workState: 'idle',
    isTeamTask: false,
    createdAt: '2026-03-31T00:00:00Z',
    updatedAt: '2026-03-31T00:00:00Z',
  },
  {
    id: 'task-2',
    title: 'Team Task',
    description: 'Team task',
    status: 'in-progress',
    priority: 'medium',
    assigneeId: 'agent-2',
    workState: 'working',
    isTeamTask: true,
    teamId: 'team-1',
    teamName: 'Engineering',
    createdAt: '2026-03-31T00:00:00Z',
    updatedAt: '2026-03-31T00:00:00Z',
  },
];

describe('TaskKanban Board View', () => {
  beforeEach(() => {
    const mockFetchAgents = vi.fn();
    const mockFetchTasks = vi.fn();

    vi.mocked(useAgentsStore).mockImplementation((selector: any) => selector({
      agents: mockAgents,
      fetchAgents: mockFetchAgents,
    }));

    vi.mocked(useApprovalsStore).mockImplementation((selector: any) => selector({
      tasks: mockTasks,
      tasksLoading: false,
      tasksError: null,
      fetchTasks: mockFetchTasks,
      createTask: vi.fn(),
      updateTaskStatus: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      startTaskExecution: vi.fn(),
      appendTaskExecutionEvent: vi.fn(),
    }));
  });

  it('renders 4 columns with correct labels', () => {
    render(
      <BrowserRouter>
        <TaskKanban />
      </BrowserRouter>
    );

    expect(screen.getByText('待办')).toBeInTheDocument();
    expect(screen.getByText('进行中')).toBeInTheDocument();
    expect(screen.getByText('审查')).toBeInTheDocument();
    expect(screen.getByText('完成')).toBeInTheDocument();
    expect(screen.queryByText('backlog')).not.toBeInTheDocument();
  });

  it('renders Agent rows for all agents', () => {
    render(
      <BrowserRouter>
        <TaskKanban />
      </BrowserRouter>
    );

    expect(screen.getByText('Agent Alpha')).toBeInTheDocument();
    expect(screen.getByText('Agent Beta')).toBeInTheDocument();
  });

  it('team tasks show left border and prefix', () => {
    const { container } = render(
      <BrowserRouter>
        <TaskKanban />
      </BrowserRouter>
    );

    // Check for team task title with prefix
    expect(screen.getByText(/团队Engineering：/)).toBeInTheDocument();

    // Check for border-l-4 class on team task card
    const teamTaskCard = container.querySelector('.border-l-4');
    expect(teamTaskCard).toBeInTheDocument();
  });

  it('empty agents show placeholder', () => {
    vi.mocked(useAgentsStore).mockImplementation((selector: any) => selector({
      agents: [
        ...mockAgents,
        {
          id: 'agent-3',
          name: 'Agent Gamma',
          persona: 'Empty agent',
          isDefault: false,
          model: 'claude-3-5-sonnet-20241022',
          modelDisplay: 'Claude 3.5 Sonnet',
          inheritedModel: false,
          workspace: '/workspace',
          agentDir: '/agents/gamma',
          mainSessionKey: 'session-3',
          channelTypes: [],
          teamRole: 'worker',
          chatAccess: 'direct',
          responsibility: 'Testing',
        },
      ],
      fetchAgents: vi.fn(),
    }));

    vi.mocked(useApprovalsStore).mockImplementation((selector: any) => selector({
      tasks: mockTasks,
      tasksLoading: false,
      tasksError: null,
      fetchTasks: vi.fn(),
      createTask: vi.fn(),
      updateTaskStatus: vi.fn(),
      updateTask: vi.fn(),
      deleteTask: vi.fn(),
      startTaskExecution: vi.fn(),
      appendTaskExecutionEvent: vi.fn(),
    }));

    render(
      <BrowserRouter>
        <TaskKanban />
      </BrowserRouter>
    );

    expect(screen.getByText('Agent Gamma')).toBeInTheDocument();
    expect(screen.getByText('空闲中')).toBeInTheDocument();
  });
});
