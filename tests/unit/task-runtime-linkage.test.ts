import type { IncomingMessage, ServerResponse } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendJson: vi.fn(),
  parseJsonBody: vi.fn(async (req: IncomingMessage & { __body?: unknown }) => req.__body ?? {}),
  listTaskSnapshots: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  startTaskExecution: vi.fn(),
  appendTaskExecutionEvent: vi.fn(),
}));

vi.mock('@electron/api/route-utils', () => ({
  sendJson: mocks.sendJson,
  parseJsonBody: mocks.parseJsonBody,
}));

vi.mock('@electron/utils/task-config', () => ({
  listTaskSnapshots: mocks.listTaskSnapshots,
  createTask: mocks.createTask,
  updateTask: mocks.updateTask,
  deleteTask: mocks.deleteTask,
  startTaskExecution: mocks.startTaskExecution,
  appendTaskExecutionEvent: mocks.appendTaskExecutionEvent,
}));

function createRequest(
  method: string,
  body?: unknown,
): IncomingMessage & { __body?: unknown } {
  return {
    method,
    __body: body,
  } as IncomingMessage & { __body?: unknown };
}

describe('task runtime linkage routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('lists tasks through /api/tasks', async () => {
    const tasks = [{ id: 'task-1', title: 'Canonical task' }];
    mocks.listTaskSnapshots.mockResolvedValueOnce(tasks);

    const { handleTaskRoutes } = await import('@electron/api/routes/tasks');

    const handled = await handleTaskRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/tasks'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(mocks.listTaskSnapshots).toHaveBeenCalledOnce();
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      tasks,
    });
  });

  it('creates tasks through /api/tasks and returns the canonical snapshot', async () => {
    const createdTask = {
      id: 'task-1',
      title: 'Canonical task',
      canonicalExecution: null,
    };
    mocks.createTask.mockResolvedValueOnce(createdTask);
    mocks.listTaskSnapshots.mockResolvedValueOnce([createdTask]);

    const { handleTaskRoutes } = await import('@electron/api/routes/tasks');

    const handled = await handleTaskRoutes(
      createRequest('POST', {
        title: 'Canonical task',
        description: 'Created from the renderer',
        priority: 'high',
      }),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/tasks'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(mocks.createTask).toHaveBeenCalledWith({
      title: 'Canonical task',
      description: 'Created from the renderer',
      priority: 'high',
    });
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      task: createdTask,
      tasks: [createdTask],
    });
  });

  it('starts canonical task execution through the execution start route', async () => {
    const startedTask = {
      id: 'task-1',
      canonicalExecution: {
        sessionId: 'runtime-1',
        sessionKey: 'agent:main:main:subagent:runtime-1',
        status: 'active',
      },
    };
    mocks.startTaskExecution.mockResolvedValueOnce(startedTask);

    const { handleTaskRoutes } = await import('@electron/api/routes/tasks');

    const handled = await handleTaskRoutes(
      createRequest('POST', {
        sessionId: 'runtime-1',
        sessionKey: 'agent:main:main:subagent:runtime-1',
        entrySessionKey: 'agent:main:main',
      }),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/tasks/task-1/execution/start'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(mocks.startTaskExecution).toHaveBeenCalledWith('task-1', {
      sessionId: 'runtime-1',
      sessionKey: 'agent:main:main:subagent:runtime-1',
      entrySessionKey: 'agent:main:main',
    });
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      task: startedTask,
    });
  });

  it('appends execution events through the execution events route', async () => {
    const updatedTask = {
      id: 'task-1',
      latestInternalExcerpt: {
        content: 'Need leader approval',
      },
    };
    mocks.appendTaskExecutionEvent.mockResolvedValueOnce(updatedTask);

    const { handleTaskRoutes } = await import('@electron/api/routes/tasks');

    const handled = await handleTaskRoutes(
      createRequest('POST', {
        type: 'assistant_excerpt',
        content: 'Need leader approval',
        createdAt: '2026-04-07T00:05:00.000Z',
      }),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/tasks/task-1/execution/events'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(mocks.appendTaskExecutionEvent).toHaveBeenCalledWith('task-1', {
      type: 'assistant_excerpt',
      content: 'Need leader approval',
      createdAt: '2026-04-07T00:05:00.000Z',
    });
    expect(mocks.sendJson).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      task: updatedTask,
    });
  });
});
