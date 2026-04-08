import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskExecutionLineageSection } from '@/pages/TaskKanban/task-detail/TaskExecutionLineageSection';
import type { KanbanTask } from '@/types/task';

describe('TaskExecutionLineageSection', () => {
  it('renders canonical execution root, descendants, and latest internal excerpt', () => {
    const task: KanbanTask = {
      id: 'task-123',
      title: 'Implement login feature',
      description: 'Add OAuth login',
      status: 'in-progress',
      priority: 'high',
      workState: 'working',
      isTeamTask: true,
      teamId: 'team-1',
      teamName: 'Frontend',
      canonicalExecution: {
        sessionId: 'runtime-1',
        sessionKey: 'agent:main:main:subagent:runtime-1',
        status: 'active',
        startedAt: '2026-04-07T00:00:00.000Z',
      },
      latestInternalExcerpt: {
        content: 'Research is validating the OAuth callback flow.',
        createdAt: '2026-04-07T00:05:00.000Z',
      },
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:05:00.000Z',
    };

    render(
      <TaskExecutionLineageSection
        task={task}
        runtimeTree={{
          root: {
            id: 'runtime-1',
            sessionKey: 'agent:main:main:subagent:runtime-1',
            status: 'running',
          },
          descendants: [
            {
              id: 'runtime-2',
              sessionKey: 'agent:worker:main:subagent:runtime-2',
              status: 'blocked',
            },
          ],
        }}
      />,
    );

    expect(screen.getByTestId('task-lineage-root')).toBeInTheDocument();
    expect(screen.getByText('agent:main:main:subagent:runtime-1')).toBeInTheDocument();
    expect(screen.getByText('agent:worker:main:subagent:runtime-2')).toBeInTheDocument();
    expect(screen.getByText('Research is validating the OAuth callback flow.')).toBeInTheDocument();
  });
});
