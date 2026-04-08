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

describe('chat task thread wiring', () => {
  const mockCreateTask = vi.fn();
  const mockStartTaskExecution = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    const createdTask: KanbanTask = {
      id: 'task-123',
      title: 'Implement login feature',
      description: 'Add OAuth login',
      status: 'todo',
      priority: 'high',
      workState: 'idle',
      isTeamTask: false,
      canonicalExecution: null,
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:00:00.000Z',
    };

    mockCreateTask.mockResolvedValue(createdTask);
    mockStartTaskExecution.mockResolvedValue(createdTask);

    vi.mocked(useApprovalsStore).mockImplementation((selector: any) => selector({
      createTask: mockCreateTask,
      startTaskExecution: mockStartTaskExecution,
    }));

    vi.mocked(useAgentsStore).mockImplementation((selector: any) => selector({
      agents: [{ id: 'agent-1', name: 'Agent Alpha', teamRole: 'developer' }],
    }));

    vi.mocked(useChatStore).mockImplementation((selector: any) => selector({
      currentAgentId: 'agent-1',
      currentSessionKey: 'agent:leader:main',
    }));

    vi.mocked(hostApiFetch).mockResolvedValue({
      session: {
        id: 'runtime-1',
        sessionKey: 'agent:leader:main:subagent:runtime-1',
      },
    });
  });

  it('uses the current chat session as the entry session when create-and-start is chosen', async () => {
    render(
      <TaskCreationBubble
        title="Implement login feature"
        description="Add OAuth login"
      />,
    );

    fireEvent.click(screen.getByTestId('task-create-start'));

    await waitFor(() => {
      expect(hostApiFetch).toHaveBeenCalledWith('/api/sessions/spawn', {
        method: 'POST',
        body: JSON.stringify({
          parentSessionKey: 'agent:leader:main',
          prompt: 'Start task execution: Implement login feature\n\nAdd OAuth login',
        }),
      });
      expect(mockStartTaskExecution).toHaveBeenCalledWith('task-123', expect.objectContaining({
        entrySessionKey: 'agent:leader:main',
      }));
    });
  });
});
