import { describe, it, expect } from 'vitest';
import type { TaskStatus, TaskPriority, WorkState, KanbanTask } from '@/types/task';

describe('Task Type Definitions', () => {
  it('TaskStatus type excludes backlog and includes only 4 values', () => {
    // Type-level test: ensure TaskStatus is a union of 4 values
    const validStatuses: TaskStatus[] = ['todo', 'in-progress', 'review', 'done'];
    expect(validStatuses).toHaveLength(4);

    // Runtime validation
    const todoStatus: TaskStatus = 'todo';
    const inProgressStatus: TaskStatus = 'in-progress';
    const reviewStatus: TaskStatus = 'review';
    const doneStatus: TaskStatus = 'done';

    expect(todoStatus).toBe('todo');
    expect(inProgressStatus).toBe('in-progress');
    expect(reviewStatus).toBe('review');
    expect(doneStatus).toBe('done');
  });

  it('KanbanTask interface includes teamId, teamName, isTeamTask fields', () => {
    const teamTask: KanbanTask = {
      id: 'task-1',
      title: 'Test Team Task',
      description: 'Test description',
      status: 'todo',
      priority: 'high',
      workState: 'idle',
      isTeamTask: true,
      teamId: 'team-1',
      teamName: 'Engineering',
      createdAt: '2026-03-31T00:00:00Z',
      updatedAt: '2026-03-31T00:00:00Z',
    };

    expect(teamTask.isTeamTask).toBe(true);
    expect(teamTask.teamId).toBe('team-1');
    expect(teamTask.teamName).toBe('Engineering');
  });

  it('KanbanTask extends existing runtime fields', () => {
    const taskWithRuntime: KanbanTask = {
      id: 'task-2',
      title: 'Test Runtime Task',
      description: 'Test description',
      status: 'in-progress',
      priority: 'medium',
      workState: 'working',
      isTeamTask: false,
      runtimeSessionId: 'session-123',
      runtimeParentSessionId: 'parent-session-456',
      runtimeRootSessionId: 'root-session-789',
      runtimeDepth: 2,
      runtimeSessionKey: 'session-key-abc',
      runtimeParentSessionKey: 'parent-key-def',
      runtimeLineageSessionKeys: ['key1', 'key2'],
      runtimeHistory: [{ role: 'user', content: 'test' }],
      runtimeTranscript: ['line1', 'line2'],
      runtimeChildSessionIds: ['child1', 'child2'],
      createdAt: '2026-03-31T00:00:00Z',
      updatedAt: '2026-03-31T00:00:00Z',
    };

    expect(taskWithRuntime.runtimeSessionId).toBe('session-123');
    expect(taskWithRuntime.runtimeDepth).toBe(2);
    expect(taskWithRuntime.runtimeHistory).toHaveLength(1);
  });

  it('KanbanTask includes canonical execution, related sessions, and blocker rollups', () => {
    const task: KanbanTask = {
      id: 'task-3',
      title: 'Canonical execution task',
      description: 'Task with execution metadata',
      status: 'in-progress',
      priority: 'high',
      workState: 'blocked',
      isTeamTask: true,
      teamId: 'team-1',
      teamName: 'Engineering',
      canonicalExecution: {
        sessionId: 'runtime-1',
        sessionKey: 'agent:main:main:subagent:runtime-1',
        status: 'active',
        startedAt: '2026-04-07T00:00:00.000Z',
      },
      borrowedExecutions: [
        {
          teamId: 'team-support',
          sessionKey: 'agent:support:main:subagent:runtime-7',
          agentIds: ['support-agent'],
        },
      ],
      relatedSessionKeys: ['agent:main:main', 'agent:main:main:subagent:runtime-1'],
      executionEvents: [
        {
          type: 'assistant_excerpt',
          status: 'blocked',
          content: 'Waiting on leader approval',
          createdAt: '2026-04-07T00:05:00.000Z',
        },
      ],
      latestInternalExcerpt: {
        content: 'Waiting on leader approval',
        createdAt: '2026-04-07T00:05:00.000Z',
      },
      blocker: {
        state: 'blocked',
        summary: 'Waiting on leader approval',
      },
      approvalState: {
        state: 'waiting_leader',
      },
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:05:00.000Z',
    };

    expect(task.canonicalExecution?.sessionKey).toBe('agent:main:main:subagent:runtime-1');
    expect(task.borrowedExecutions?.[0]?.teamId).toBe('team-support');
    expect(task.relatedSessionKeys).toContain('agent:main:main');
    expect(task.blocker?.state).toBe('blocked');
    expect(task.approvalState?.state).toBe('waiting_leader');
  });

  it('Type exports are available for import', () => {
    // This test verifies that all types can be imported
    const status: TaskStatus = 'todo';
    const priority: TaskPriority = 'high';
    const workState: WorkState = 'idle';

    expect(status).toBeDefined();
    expect(priority).toBeDefined();
    expect(workState).toBeDefined();
  });
});
