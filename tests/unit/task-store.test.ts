import { mkdir, readFile, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { testHome, testUserData } = vi.hoisted(() => {
  const suffix = Math.random().toString(36).slice(2);
  return {
    testHome: `/tmp/clawx-task-config-${suffix}`,
    testUserData: `/tmp/clawx-task-config-user-data-${suffix}`,
  };
});

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  const mocked = {
    ...actual,
    homedir: () => testHome,
  };
  return {
    ...mocked,
    default: mocked,
  };
});

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => testUserData,
    getVersion: () => '0.0.0-test',
  },
}));

async function writeOpenClawJson(config: unknown): Promise<void> {
  const openclawDir = join(testHome, '.openclaw');
  await mkdir(openclawDir, { recursive: true });
  await writeFile(join(openclawDir, 'openclaw.json'), JSON.stringify(config, null, 2), 'utf8');
}

async function readOpenClawJson(): Promise<Record<string, unknown>> {
  const content = await readFile(join(testHome, '.openclaw', 'openclaw.json'), 'utf8');
  return JSON.parse(content) as Record<string, unknown>;
}

describe('task config lifecycle', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.restoreAllMocks();
    await rm(testHome, { recursive: true, force: true });
    await rm(testUserData, { recursive: true, force: true });
  });

  it('persists canonical tasks in a dedicated tasks.json document', async () => {
    await writeOpenClawJson({
      agents: {
        list: [{ id: 'main', name: 'Main', default: true }],
      },
    });

    const { createTask, listTaskSnapshots } = await import('@electron/utils/task-config');

    const created = await createTask({
      title: 'Review execution wiring',
      description: 'Validate the canonical task spine',
      priority: 'high',
      teamId: 'team-alpha',
      teamName: 'Alpha',
    });

    expect(created).toMatchObject({
      title: 'Review execution wiring',
      description: 'Validate the canonical task spine',
      priority: 'high',
      teamId: 'team-alpha',
      teamName: 'Alpha',
      isTeamTask: true,
      canonicalExecution: null,
    });

    const storedTasks = await listTaskSnapshots();
    expect(storedTasks).toHaveLength(1);
    expect(storedTasks[0]).toMatchObject({
      id: created.id,
      title: 'Review execution wiring',
      canonicalExecution: null,
    });

    const tasksJson = JSON.parse(
      await readFile(join(testHome, '.openclaw', 'tasks.json'), 'utf8'),
    ) as { tasks?: unknown[] };
    expect(tasksJson.tasks).toHaveLength(1);

    const openclawJson = await readOpenClawJson();
    expect(openclawJson).toEqual({
      agents: {
        list: [{ id: 'main', name: 'Main', default: true }],
      },
    });
  });

  it('tracks one canonical execution thread plus latest internal excerpt and blocker rollup', async () => {
    const { createTask, startTaskExecution, appendTaskExecutionEvent } = await import('@electron/utils/task-config');

    const created = await createTask({
      title: 'Investigate blocker',
      description: 'Find out why execution stalled',
      priority: 'medium',
      teamId: 'team-alpha',
      teamName: 'Alpha',
    });

    const started = await startTaskExecution(created.id, {
      sessionId: 'runtime-1',
      sessionKey: 'agent:main:main:subagent:runtime-1',
      entrySessionKey: 'agent:main:main',
      agentId: 'main',
      startedAt: '2026-04-07T00:00:00.000Z',
    });

    expect(started.canonicalExecution).toMatchObject({
      sessionId: 'runtime-1',
      sessionKey: 'agent:main:main:subagent:runtime-1',
      status: 'active',
      startedAt: '2026-04-07T00:00:00.000Z',
    });
    expect(started.runtimeSessionId).toBe('runtime-1');
    expect(started.runtimeSessionKey).toBe('agent:main:main:subagent:runtime-1');
    expect(started.relatedSessionKeys).toEqual(
      expect.arrayContaining(['agent:main:main', 'agent:main:main:subagent:runtime-1']),
    );

    const updated = await appendTaskExecutionEvent(created.id, {
      type: 'assistant_excerpt',
      status: 'blocked',
      content: 'Waiting on leader approval for the next step.',
      sessionKey: 'agent:main:main:subagent:runtime-1',
      createdAt: '2026-04-07T00:05:00.000Z',
    });

    expect(updated.workState).toBe('blocked');
    expect(updated.latestInternalExcerpt).toMatchObject({
      content: 'Waiting on leader approval for the next step.',
      sessionKey: 'agent:main:main:subagent:runtime-1',
    });
    expect(updated.blocker).toMatchObject({
      state: 'blocked',
      summary: 'Waiting on leader approval for the next step.',
    });
  });
});
