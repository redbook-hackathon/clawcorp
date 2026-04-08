import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { TaskExecutionGateSection } from '@/pages/TaskKanban/task-detail/TaskExecutionGateSection';
import type { KanbanTask } from '@/types/task';

describe('TaskExecutionGateSection', () => {
  const mockApprove = vi.fn();
  const mockReject = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders blocker state and lets the user approve a pending approval', () => {
    const task: KanbanTask = {
      id: 'task-123',
      title: 'Implement login feature',
      description: 'Add OAuth login',
      status: 'review',
      priority: 'high',
      workState: 'waiting_approval',
      isTeamTask: true,
      teamId: 'team-1',
      teamName: 'Frontend',
      blocker: {
        state: 'waiting_approval',
        summary: 'Waiting on leader approval',
      },
      approvalState: {
        state: 'waiting_leader',
      },
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:05:00.000Z',
    };

    render(
      <TaskExecutionGateSection
        task={task}
        approvals={[
          {
            id: 'approval-1',
            prompt: 'Approve the next execution step',
            sessionKey: 'agent:main:main:subagent:runtime-1',
          },
        ]}
        onApprove={mockApprove}
        onReject={mockReject}
      />,
    );

    expect(screen.getByTestId('task-gate-section')).toBeInTheDocument();
    expect(screen.getByText('Waiting on leader approval')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('task-approve-action'));
    expect(mockApprove).toHaveBeenCalledWith('approval-1');
  });
});
