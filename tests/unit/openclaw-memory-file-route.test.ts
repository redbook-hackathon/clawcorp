import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { IncomingMessage, ServerResponse } from 'http';
import { Readable } from 'stream';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSendJson, mockHomedir } = vi.hoisted(() => ({
  mockSendJson: vi.fn(),
  mockHomedir: vi.fn(),
}));

vi.mock('@electron/api/route-utils', () => ({
  sendJson: (...args: unknown[]) => mockSendJson(...args),
  parseJsonBody: vi.fn(),
}));

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return {
    ...actual,
    homedir: () => mockHomedir(),
  };
});

function makeJsonRequest(method: string, payload: unknown): IncomingMessage {
  const stream = Readable.from([JSON.stringify(payload)]) as IncomingMessage;
  stream.method = method;
  return stream;
}

describe('GET/PUT /api/memory/file path security', () => {
  let homeDir: string;
  let workspaceDir: string;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();

    homeDir = mkdtempSync(join(tmpdir(), 'clawx-memory-file-'));
    workspaceDir = join(homeDir, '.openclaw', 'agents', 'main', 'workspace');
    await mkdir(workspaceDir, { recursive: true });
    mockHomedir.mockReturnValue(homeDir);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (homeDir && existsSync(homeDir)) {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('rejects absolute path reads outside the workspace', async () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'clawx-memory-outside-'));
    const outsideFile = join(outsideDir, 'secret.txt');
    writeFileSync(outsideFile, 'shh', 'utf-8');

    const { handleMemoryRoutes } = await import('@electron/api/routes/memory');
    const handled = await handleMemoryRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL(`http://127.0.0.1:3210/api/memory/file?name=${encodeURIComponent(outsideFile)}`),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(mockSendJson).toHaveBeenCalledTimes(1);
    const [, statusCode, payload] = mockSendJson.mock.calls[0] as [unknown, number, { error?: string }];
    expect(statusCode).toBe(400);
    expect(payload.error).toBe('Invalid file name');
  });

  it('rejects absolute path writes outside the workspace', async () => {
    const outsideDir = mkdtempSync(join(tmpdir(), 'clawx-memory-outside-'));
    const outsideFile = join(outsideDir, 'new-secret.txt');

    const { handleMemoryRoutes } = await import('@electron/api/routes/memory');
    const handled = await handleMemoryRoutes(
      makeJsonRequest('PUT', { relativePath: outsideFile, content: 'nope' }),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/memory/file'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(mockSendJson).toHaveBeenCalledTimes(1);
    const [, statusCode, payload] = mockSendJson.mock.calls[0] as [unknown, number, { error?: string }];
    expect(statusCode).toBe(400);
    expect(payload.error).toBe('Invalid request');
    expect(existsSync(outsideFile)).toBe(false);
  });

  it('rejects writes for non-whitelisted relative paths', async () => {
    const { handleMemoryRoutes } = await import('@electron/api/routes/memory');
    const handled = await handleMemoryRoutes(
      makeJsonRequest('PUT', { relativePath: 'notes.txt', content: 'deny me' }),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/memory/file'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(mockSendJson).toHaveBeenCalledTimes(1);
    const [, statusCode, payload] = mockSendJson.mock.calls[0] as [unknown, number, { error?: string }];
    expect(statusCode).toBe(400);
    expect(payload.error).toMatch(/allowed|whitelist|invalid/i);
  });

  it('rejects stale writes when expected mtime is older than file mtime', async () => {
    const targetPath = join(workspaceDir, 'memory', 'notes.md');
    await mkdir(join(workspaceDir, 'memory'), { recursive: true });
    writeFileSync(targetPath, 'original\n', 'utf-8');
    const staleTime = new Date(statSync(targetPath).mtimeMs - 1_000).toISOString();

    const { handleMemoryRoutes } = await import('@electron/api/routes/memory');
    const handled = await handleMemoryRoutes(
      makeJsonRequest('PUT', {
        relativePath: 'memory/notes.md',
        content: 'new content',
        expectedMtime: staleTime,
      }),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/memory/file'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(mockSendJson).toHaveBeenCalledTimes(1);
    const [, statusCode, payload] = mockSendJson.mock.calls[0] as [unknown, number, { error?: string; currentMtime?: string }];
    expect(statusCode).toBe(409);
    expect(payload.error).toMatch(/stale|modified|conflict/i);
    expect(payload.currentMtime).toBeTruthy();
    expect(readFileSync(targetPath, 'utf-8')).toBe('original\n');
  });

  it('normalizes line endings before writing allowed files', async () => {
    const { handleMemoryRoutes } = await import('@electron/api/routes/memory');
    const handled = await handleMemoryRoutes(
      makeJsonRequest('PUT', {
        relativePath: 'memory/normalize.md',
        content: 'line1\r\nline2\r\n',
      }),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/memory/file'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(mockSendJson).toHaveBeenCalledTimes(1);
    const [, statusCode, payload] = mockSendJson.mock.calls[0] as [unknown, number, { ok?: boolean }];
    expect(statusCode).toBe(200);
    expect(payload.ok).toBe(true);
    expect(readFileSync(join(workspaceDir, 'memory', 'normalize.md'), 'utf-8')).toBe('line1\nline2\n');
  });
});
