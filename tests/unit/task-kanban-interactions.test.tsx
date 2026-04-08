import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TaskKanban from '@/pages/TaskKanban';
import { useApprovalsStore } from '@/stores/approvals';
import { useAgentsStore } from '@/stores/agents';
import { useRightPanelStore } from '@/stores/rightPanelStore';
import type { KanbanTask } from '@/types/task';
import type { AgentSummary } from '@/types/agent';

vi.mock('@/stores/approvals');
vi.mock('@/stores/agents');
vi.mock('@/stores/rightPanelStore');

const mockTask: KanbanTask = {
  id: 'task-123',
  title: 'Test Task',
  description: 'Test description',
  status: 'todo',
  priority: 'high',
  assigneeId: 'agent-1',
  workState: 'working',
  isTeamTask: false,
  createdAt: '2026-03-31T10:00:00Z',
  updatedAt: '2026-03-31T12:00:00Z',
  runtimeSessionId: 'session-abc123',
};

const mockAgent: AgentSummary = {
  id: 'agent-1',
  name: 'Agent Alpha',
  model: 'claude-sonnet-4',
  modelDisplay: 'claude-sonnet-4',
  teamRole: 'worker',
  chatAccess: 'direct',
};

describe('TaskKanban interactions', () => {
  const mockOpenPanel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useApprovalsStore).mockImplementation((selector: any) => selector({
      tasks: [mockTask],
      fetchTasks: vi.fn(),
    }));

    vi.mocked(useAgentsStore).mockImplementation((selector: any) => selector({
      agents: [mockAgent],
      fetchAgents: vi.fn(),
    }));

    vi.mocked(useRightPanelStore).mockImplementation((selector: any) => selector({
      openPanel: mockOpenPanel,
    }));
  });

  it('opens the task panel for task cards when the board renders', async () => {
    render(
      <MemoryRouter initialEntries={['/kanban']}>
        <Routes>
          <Route path="/kanban" element={<TaskKanban />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });
  });

  it('opens the task panel when taskId is provided in the URL search params', async () => {
    render(
      <MemoryRouter initialEntries={['/kanban?taskId=task-123']}>
        <Routes>
          <Route path="/kanban" element={<TaskKanban />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockOpenPanel).toHaveBeenCalledWith('task', 'task-123');
    });
  });
});
