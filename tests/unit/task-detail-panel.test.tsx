/**
 * Tests for TaskDetailPanel component
 * Phase 02-03: Task detail panel
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TaskDetailPanel } from '@/pages/TaskKanban/TaskDetailPanel';
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

import { hostApiFetch } from '@/lib/host-api';

const mockTask: KanbanTask = {
  id: 'task-123',
  title: 'Test Task',
  description: 'This is a test task description',
  status: 'in-progress',
  priority: 'high',
  assigneeId: 'agent-1',
  workState: 'working',
  isTeamTask: true,
  teamId: 'team-1',
  teamName: 'Alpha',
  createdAt: '2026-03-31T10:00:00Z',
  updatedAt: '2026-03-31T12:00:00Z',
  deadline: '2026-04-15T00:00:00Z',
  runtimeSessionId: 'session-abc123',
  runtimeSessionKey: 'session-key-abc',
  runtimeHistory: [
    { role: 'user', content: 'Start working on this task' },
    { role: 'assistant', content: 'I will begin working on the task now' },
  ],
};

const mockAgent: AgentSummary = {
  id: 'agent-1',
  name: 'Agent Alpha',
  model: 'claude-sonnet-4',
  modelDisplay: 'claude-sonnet-4',
  teamRole: 'worker',
  chatAccess: 'full',
};

describe('TaskDetailPanel', () => {
  const mockUpdateTask = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(hostApiFetch).mockResolvedValue({ tree: null });

    vi.mocked(useApprovalsStore).mockImplementation((selector: any) => {
      const state = {
        tasks: [mockTask],
        updateTask: mockUpdateTask,
      };
      return selector ? selector(state) : state;
    });

    vi.mocked(useAgentsStore).mockImplementation((selector: any) => {
      const state = {
        agents: [mockAgent],
      };
      return selector ? selector(state) : state;
    });
  });

  it('should render task title, description, status, and priority', () => {
    render(<TaskDetailPanel taskId="task-123" />);

    expect(screen.getAllByText(/Test Task/).length).toBeGreaterThan(0);
    expect(screen.getByText(/This is a test task description/)).toBeInTheDocument();
    expect(screen.getByText(/高优先级/)).toBeInTheDocument();
    expect(screen.getByText(/进行中/)).toBeInTheDocument();
  });

  it('should display assignee name from agents store', () => {
    render(<TaskDetailPanel taskId="task-123" />);

    expect(screen.getByText(/Agent Alpha/)).toBeInTheDocument();
  });

  it('should show runtime execution records if present', () => {
    render(<TaskDetailPanel taskId="task-123" />);

    expect(screen.getByText(/执行记录/)).toBeInTheDocument();
    expect(screen.getAllByText(/session-abc123/).length).toBeGreaterThan(0);
  });

  it('should display status change history with timestamps', () => {
    render(<TaskDetailPanel taskId="task-123" />);

    expect(screen.getByText(/创建时间/)).toBeInTheDocument();
    expect(screen.getByText(/更新时间/)).toBeInTheDocument();
  });

  it('should have edit button that enables inline editing', async () => {
    render(<TaskDetailPanel taskId="task-123" />);

    const editButton = screen.getByRole('button', { name: /编辑/ });
    expect(editButton).toBeInTheDocument();

    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /保存/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /取消/ })).toBeInTheDocument();
    });
  });

  it('should call updateTask when saving edited description', async () => {
    render(<TaskDetailPanel taskId="task-123" />);

    const editButton = screen.getByRole('button', { name: /编辑/ });
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Updated description' } });

    const saveButton = screen.getByRole('button', { name: /保存/ });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateTask).toHaveBeenCalledWith('task-123', {
        description: 'Updated description',
      });
    });
  });

  it('should show related session link when runtimeSessionKey exists', () => {
    render(<TaskDetailPanel taskId="task-123" />);

    expect(screen.getByText(/关联会话/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看会话/ })).toBeInTheDocument();
  });

  it('should display "任务不存在" when task is not found', () => {
    vi.mocked(useApprovalsStore).mockImplementation((selector: any) => {
      const state = {
        tasks: [],
        updateTask: mockUpdateTask,
      };
      return selector ? selector(state) : state;
    });

    render(<TaskDetailPanel taskId="nonexistent" />);

    expect(screen.getByText(/任务不存在/)).toBeInTheDocument();
  });

  it('should display team prefix when isTeamTask is true', () => {
    render(<TaskDetailPanel taskId="task-123" />);

    expect(screen.getByText(/团队Alpha/)).toBeInTheDocument();
  });

  it('should show work state badge when workState is not idle', () => {
    render(<TaskDetailPanel taskId="task-123" />);

    expect(screen.getByText(/工作中/)).toBeInTheDocument();
  });
});
