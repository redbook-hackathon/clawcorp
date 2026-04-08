import type { IncomingMessage, ServerResponse } from 'http';
import type { HostApiContext } from '../context';
import { parseJsonBody, sendJson } from '../route-utils';
import {
  appendTaskExecutionEvent,
  createTask,
  deleteTask,
  listTaskSnapshots,
  startTaskExecution,
  updateTask,
} from '../../utils/task-config';
import type { CreateTaskRequest, KanbanTask, StartTaskExecutionRequest, TaskExecutionEventInput } from '../../src/types/task';
import { logger } from '../../utils/logger';

const TASKS_PREFIX = '/api/tasks/';

function decodeTaskPath(pathname: string): string {
  return decodeURIComponent(pathname.slice(TASKS_PREFIX.length));
}

function isPlainTaskPath(pathname: string): boolean {
  return pathname.startsWith(TASKS_PREFIX) && !decodeTaskPath(pathname).includes('/');
}

export async function handleTaskRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  ctx: HostApiContext,
): Promise<boolean> {
  if (url.pathname === '/api/tasks' && req.method === 'GET') {
    try {
      const tasks = await listTaskSnapshots();
      sendJson(res, 200, { success: true, tasks });
    } catch (error) {
      logger.error('[tasks] Failed to list tasks:', error);
      sendJson(res, 500, { success: false, error: String(error), tasks: [] });
    }
    return true;
  }

  if (url.pathname === '/api/tasks' && req.method === 'POST') {
    try {
      const body = await parseJsonBody<CreateTaskRequest>(req);
      if (!body.title?.trim()) {
        sendJson(res, 400, { success: false, error: 'title is required' });
        return true;
      }

      const task = await createTask({
        ...body,
        title: body.title.trim(),
        description: body.description ?? '',
      });
      const tasks = await listTaskSnapshots();
      sendJson(res, 200, { success: true, task, tasks });
    } catch (error) {
      logger.error('[tasks] Failed to create task:', error);
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname.startsWith(TASKS_PREFIX) && req.method === 'POST' && url.pathname.endsWith('/execution/start')) {
    try {
      const taskId = decodeURIComponent(
        url.pathname.slice(TASKS_PREFIX.length, url.pathname.length - '/execution/start'.length),
      );
      const body = await parseJsonBody<StartTaskExecutionRequest>(req);
      if (!taskId) {
        sendJson(res, 400, { success: false, error: 'taskId is required' });
        return true;
      }
      if (!body.sessionId || !body.sessionKey) {
        sendJson(res, 400, { success: false, error: 'sessionId and sessionKey are required' });
        return true;
      }

      const task = await startTaskExecution(taskId, body);
      sendJson(res, 200, { success: true, task });
    } catch (error) {
      logger.error('[tasks] Failed to start task execution:', error);
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (url.pathname.startsWith(TASKS_PREFIX) && req.method === 'POST' && url.pathname.endsWith('/execution/events')) {
    try {
      const taskId = decodeURIComponent(
        url.pathname.slice(TASKS_PREFIX.length, url.pathname.length - '/execution/events'.length),
      );
      const body = await parseJsonBody<TaskExecutionEventInput>(req);
      if (!taskId) {
        sendJson(res, 400, { success: false, error: 'taskId is required' });
        return true;
      }
      if (!body.type) {
        sendJson(res, 400, { success: false, error: 'event type is required' });
        return true;
      }

      const task = await appendTaskExecutionEvent(taskId, body);
      sendJson(res, 200, { success: true, task });
    } catch (error) {
      logger.error('[tasks] Failed to append task execution event:', error);
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (isPlainTaskPath(url.pathname) && req.method === 'PUT') {
    try {
      const taskId = decodeTaskPath(url.pathname);
      const body = await parseJsonBody<Partial<KanbanTask>>(req);
      if (!taskId) {
        sendJson(res, 400, { success: false, error: 'taskId is required' });
        return true;
      }

      const task = await updateTask(taskId, body);
      const tasks = await listTaskSnapshots();
      sendJson(res, 200, { success: true, task, tasks });
    } catch (error) {
      logger.error('[tasks] Failed to update task:', error);
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  if (isPlainTaskPath(url.pathname) && req.method === 'DELETE') {
    try {
      const taskId = decodeTaskPath(url.pathname);
      if (!taskId) {
        sendJson(res, 400, { success: false, error: 'taskId is required' });
        return true;
      }

      await deleteTask(taskId);
      const tasks = await listTaskSnapshots();
      sendJson(res, 200, { success: true, tasks });
    } catch (error) {
      logger.error('[tasks] Failed to delete task:', error);
      sendJson(res, 500, { success: false, error: String(error) });
    }
    return true;
  }

  return false;
}
