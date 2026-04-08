import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useApprovalsStore } from '@/stores/approvals';
import type { KanbanTask } from '@/types/task';

vi.mock('@/lib/host-api', () => ({
  hostApiFetch: vi.fn(),
}));

import { hostApiFetch } from '@/lib/host-api';

describe('Approvals Store - Task Operations', () => {
  beforeEach(() => {
    useApprovalsStore.setState({
      tasks: [],
      tasksLoading: false,
      tasksError: null,
    });
    vi.clearAllMocks();
  });

  it('Store exposes tasks array alongside approvals', () => {
    const state = useApprovalsStore.getState();
    expect(state.tasks).toBeDefined();
    expect(Array.isArray(state.tasks)).toBe(true);
  });

  it('fetchTasks() loads from the canonical host-api route', async () => {
    const mockTasks: KanbanTask[] = [
      {
        id: 'task-1',
        title: 'Test Task',
        description: 'Test description',
        status: 'todo',
        priority: 'high',
        workState: 'idle',
        isTeamTask: false,
        createdAt: '2026-03-31T00:00:00Z',
        updatedAt: '2026-03-31T00:00:00Z',
      },
    ];

    vi.mocked(hostApiFetch).mockResolvedValueOnce({ tasks: mockTasks });

    await useApprovalsStore.getState().fetchTasks();

    expect(hostApiFetch).toHaveBeenCalledWith('/api/tasks');
    const state = useApprovalsStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].id).toBe('task-1');
    expect(state.tasks[0].title).toBe('Test Task');
  });

  it('createTask() posts to the canonical task route and returns the created snapshot', async () => {
    const createdTask: KanbanTask = {
      id: 'task-created',
      title: 'New Task',
      description: 'New task description',
      status: 'todo',
      priority: 'medium',
      workState: 'idle',
      isTeamTask: false,
      canonicalExecution: null,
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:00:00.000Z',
    };
    vi.mocked(hostApiFetch).mockResolvedValueOnce({
      task: createdTask,
      tasks: [createdTask],
    });

    const created = await useApprovalsStore.getState().createTask({
      title: 'New Task',
      description: 'New task description',
      priority: 'medium',
    });

    expect(hostApiFetch).toHaveBeenCalledWith('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'New Task',
        description: 'New task description',
        priority: 'medium',
      }),
    });
    const state = useApprovalsStore.getState();
    expect(state.tasks).toHaveLength(1);
    expect(state.tasks[0].id).toBe('task-created');
    expect(created).toEqual(createdTask);
  });

  it('updateTaskStatus() patches task status through the host-api task route', async () => {
    useApprovalsStore.setState({
      tasks: [
        {
          id: 'task-1',
          title: 'Task to Update',
          description: 'Description',
          status: 'todo',
          priority: 'high',
          workState: 'idle',
          isTeamTask: false,
          canonicalExecution: null,
          createdAt: '2026-03-31T00:00:00Z',
          updatedAt: '2026-03-31T00:00:00Z',
        },
      ],
    });
    const taskId = useApprovalsStore.getState().tasks[0].id;
    vi.mocked(hostApiFetch).mockResolvedValueOnce({
      task: {
        ...useApprovalsStore.getState().tasks[0],
        status: 'in-progress',
      },
      tasks: [
        {
          ...useApprovalsStore.getState().tasks[0],
          status: 'in-progress',
        },
      ],
    });

    await useApprovalsStore.getState().updateTaskStatus(taskId, 'in-progress');

    expect(hostApiFetch).toHaveBeenCalledWith('/api/tasks/task-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in-progress' }),
    });
    const state = useApprovalsStore.getState();
    expect(state.tasks[0].status).toBe('in-progress');
  });

  it('Tasks with teamId set have isTeamTask=true', async () => {
    const createdTask: KanbanTask = {
      id: 'task-team',
      title: 'Team Task',
      description: 'Team task description',
      status: 'todo',
      priority: 'high',
      workState: 'idle',
      canonicalExecution: null,
      teamId: 'team-1',
      teamName: 'Engineering',
      isTeamTask: true,
      createdAt: '2026-04-07T00:00:00.000Z',
      updatedAt: '2026-04-07T00:00:00.000Z',
    };
    vi.mocked(hostApiFetch).mockResolvedValueOnce({
      task: createdTask,
      tasks: [createdTask],
    });

    await useApprovalsStore.getState().createTask({
      title: 'Team Task',
      description: 'Team task description',
      priority: 'high',
      teamId: 'team-1',
      teamName: 'Engineering',
    });

    const state = useApprovalsStore.getState();
    expect(state.tasks[0].isTeamTask).toBe(true);
    expect(state.tasks[0].teamId).toBe('team-1');
    expect(state.tasks[0].teamName).toBe('Engineering');
  });

  it('updateTask() merges updates through the host-api task route', async () => {
    useApprovalsStore.setState({
      tasks: [
        {
          id: 'task-1',
          title: 'Task to Update',
          description: 'Original description',
          status: 'todo',
          priority: 'low',
          workState: 'idle',
          isTeamTask: false,
          canonicalExecution: null,
          createdAt: '2026-03-31T00:00:00Z',
          updatedAt: '2026-03-31T00:00:00Z',
        },
      ],
    });
    const taskId = useApprovalsStore.getState().tasks[0].id;
    vi.mocked(hostApiFetch).mockResolvedValueOnce({
      task: {
        ...useApprovalsStore.getState().tasks[0],
        description: 'Updated description',
        priority: 'high',
      },
      tasks: [
        {
          ...useApprovalsStore.getState().tasks[0],
          description: 'Updated description',
          priority: 'high',
        },
      ],
    });

    await useApprovalsStore.getState().updateTask(taskId, {
      description: 'Updated description',
      priority: 'high',
    });

    expect(hostApiFetch).toHaveBeenCalledWith('/api/tasks/task-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: 'Updated description',
        priority: 'high',
      }),
    });
    const state = useApprovalsStore.getState();
    expect(state.tasks[0].description).toBe('Updated description');
    expect(state.tasks[0].priority).toBe('high');
    expect(state.tasks[0].title).toBe('Task to Update');
  });

  it('deleteTask() removes a task through the canonical host-api route', async () => {
    useApprovalsStore.setState({
      tasks: [
        {
          id: 'task-delete',
          title: 'Task to Delete',
          description: 'Description',
          status: 'todo',
          priority: 'medium',
          workState: 'idle',
          isTeamTask: false,
          canonicalExecution: null,
          createdAt: '2026-03-31T00:00:00Z',
          updatedAt: '2026-03-31T00:00:00Z',
        },
      ],
    });
    const taskId = useApprovalsStore.getState().tasks[0].id;
    vi.mocked(hostApiFetch).mockResolvedValueOnce({ tasks: [] });
    expect(useApprovalsStore.getState().tasks).toHaveLength(1);

    await useApprovalsStore.getState().deleteTask(taskId);

    expect(hostApiFetch).toHaveBeenCalledWith('/api/tasks/task-delete', {
      method: 'DELETE',
    });
    const state = useApprovalsStore.getState();
    expect(state.tasks).toHaveLength(0);
  });

  it('startTaskExecution() starts canonical execution and updates the task in store', async () => {
    const task: KanbanTask = {
      id: 'task-start',
      title: 'Task to Start',
      description: 'Description',
      status: 'todo',
      priority: 'medium',
      workState: 'idle',
      isTeamTask: false,
      canonicalExecution: null,
      createdAt: '2026-03-31T00:00:00Z',
      updatedAt: '2026-03-31T00:00:00Z',
    };
    useApprovalsStore.setState({ tasks: [task] });
    const startedTask: KanbanTask = {
      ...task,
      workState: 'starting',
      canonicalExecution: {
        sessionId: 'runtime-1',
        sessionKey: 'agent:main:main:subagent:runtime-1',
        status: 'active',
        startedAt: '2026-04-07T00:00:00.000Z',
      },
      runtimeSessionId: 'runtime-1',
      runtimeSessionKey: 'agent:main:main:subagent:runtime-1',
      updatedAt: '2026-04-07T00:00:00.000Z',
    };
    vi.mocked(hostApiFetch).mockResolvedValueOnce({ task: startedTask });

    const started = await useApprovalsStore.getState().startTaskExecution('task-start', {
      sessionId: 'runtime-1',
      sessionKey: 'agent:main:main:subagent:runtime-1',
      entrySessionKey: 'agent:main:main',
    });

    expect(hostApiFetch).toHaveBeenCalledWith('/api/tasks/task-start/execution/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'runtime-1',
        sessionKey: 'agent:main:main:subagent:runtime-1',
        entrySessionKey: 'agent:main:main',
      }),
    });
    expect(useApprovalsStore.getState().tasks[0].canonicalExecution).toEqual(startedTask.canonicalExecution);
    expect(started).toEqual(startedTask);
  });
});
