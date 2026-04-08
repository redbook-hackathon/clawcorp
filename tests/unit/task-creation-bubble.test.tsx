import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TaskCreationBubble } from '@/pages/Chat/TaskCreationBubble';
import { useApprovalsStore } from '@/stores/approvals';
import { useAgentsStore } from '@/stores/agents';
import { useChatStore } from '@/stores/chat';
import type { KanbanTask } from '@/types/task';

vi.mock('@/stores/approvals');
vi.mock('@/stores/agents');
vi.mock('@/stores/chat');
vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

import { hostApiFetch } from '@/lib/host-api';

describe('TaskCreationBubble', () => {
  const mockCreateTask = vi.fn();
  const mockStartTaskExecution = vi.fn();
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  const createdTask: KanbanTask = {
    id: 'task-123',
    title: 'Implement login feature',
    description: 'Add OAuth login',
    status: 'todo',
    priority: 'high',
    workState: 'idle',
    isTeamTask: true,
    teamId: 'team-1',
    teamName: 'Frontend',
    canonicalExecution: null,
    createdAt: '2026-04-07T00:00:00.000Z',
    updatedAt: '2026-04-07T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useApprovalsStore).mockImplementation((selector: any) => {
      const state = {
        createTask: mockCreateTask,
        startTaskExecution: mockStartTaskExecution,
      };
      return selector ? selector(state) : state;
    });

    vi.mocked(useAgentsStore).mockImplementation((selector: any) => {
      const state = {
        agents: [
          { id: 'agent-1', name: 'Agent Alpha', teamRole: 'developer' },
          { id: 'agent-2', name: 'Agent Beta', teamRole: 'designer' },
        ],
      };
      return selector ? selector(state) : state;
    });

    vi.mocked(useChatStore).mockImplementation((selector: any) => {
      const state = {
        currentAgentId: 'agent-1',
        currentSessionKey: 'agent:main:main',
      };
      return selector ? selector(state) : state;
    });

    mockCreateTask.mockResolvedValue(createdTask);
    mockStartTaskExecution.mockResolvedValue({
      ...createdTask,
      workState: 'starting',
      canonicalExecution: {
        sessionId: 'runtime-1',
        sessionKey: 'agent:main:main:subagent:runtime-1',
        status: 'active',
        startedAt: '2026-04-07T00:01:00.000Z',
      },
      runtimeSessionId: 'runtime-1',
      runtimeSessionKey: 'agent:main:main:subagent:runtime-1',
    });
    vi.mocked(hostApiFetch).mockResolvedValue({
      success: true,
      session: {
        id: 'runtime-1',
        sessionKey: 'agent:main:main:subagent:runtime-1',
      },
    });
  });

  it('renders separate create-only and create-and-start actions', () => {
    render(
      <TaskCreationBubble
        title="Implement login feature"
        description="Add OAuth login"
      />,
    );

    expect(screen.getByTestId('task-create-only')).toBeInTheDocument();
    expect(screen.getByTestId('task-create-start')).toBeInTheDocument();
    expect(screen.getByTestId('task-cancel')).toBeInTheDocument();
  });

  it('create-only calls createTask without starting execution', async () => {
    render(
      <TaskCreationBubble
        title="Implement login feature"
        description="Add OAuth login"
        assigneeId="agent-1"
        priority="high"
        teamId="team-1"
        teamName="Frontend"
        deadline="2026-04-15T10:00:00Z"
        onConfirm={mockOnConfirm}
      />,
    );

    fireEvent.click(screen.getByTestId('task-create-only'));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith({
        title: 'Implement login feature',
        description: 'Add OAuth login',
        priority: 'high',
        assigneeId: 'agent-1',
        assigneeRole: 'developer',
        teamId: 'team-1',
        teamName: 'Frontend',
        deadline: '2026-04-15T10:00:00Z',
      });
    });

    expect(hostApiFetch).not.toHaveBeenCalled();
    expect(mockStartTaskExecution).not.toHaveBeenCalled();
    expect(mockOnConfirm).toHaveBeenCalled();
    expect(screen.getByTestId('task-anchor-card')).toBeInTheDocument();
  });

  it('create-and-start spawns a runtime session and starts canonical task execution', async () => {
    render(
      <TaskCreationBubble
        title="Implement login feature"
        description="Add OAuth login"
        assigneeId="agent-1"
        priority="high"
      />,
    );

    fireEvent.click(screen.getByTestId('task-create-start'));

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledOnce();
      expect(hostApiFetch).toHaveBeenCalledWith('/api/sessions/spawn', {
        method: 'POST',
        body: JSON.stringify({
          parentSessionKey: 'agent:main:main',
          prompt: 'Start task execution: Implement login feature\n\nAdd OAuth login',
        }),
      });
      expect(mockStartTaskExecution).toHaveBeenCalledWith('task-123', {
        sessionId: 'runtime-1',
        sessionKey: 'agent:main:main:subagent:runtime-1',
        entrySessionKey: 'agent:main:main',
        agentId: 'agent-1',
      });
    });

    expect(screen.getByTestId('task-anchor-card')).toBeInTheDocument();
  });

  it('calls onCancel callback when cancel button is clicked', () => {
    render(
      <TaskCreationBubble
        title="Implement login feature"
        description="Add OAuth login"
        onCancel={mockOnCancel}
      />,
    );

    fireEvent.click(screen.getByTestId('task-cancel'));
    expect(mockOnCancel).toHaveBeenCalled();
  });
});
