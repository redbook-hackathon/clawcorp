import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { IncomingMessage, ServerResponse } from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockParseJsonBody, mockSendJson, mockHomedir } = vi.hoisted(() => ({
  mockParseJsonBody: vi.fn(),
  mockSendJson: vi.fn(),
  mockHomedir: vi.fn(),
}));

vi.mock('@electron/api/route-utils', () => ({
  parseJsonBody: (...args: unknown[]) => mockParseJsonBody(...args),
  sendJson: (...args: unknown[]) => mockSendJson(...args),
}));

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os');
  return {
    ...actual,
    homedir: () => mockHomedir(),
  };
});

function makeLongAssistantText(): string {
  return [
    '你可以先检查 node 版本和包管理器版本是否匹配，',
    '再删除 node_modules 与 lock 文件后重新安装依赖，',
    '最后确认公司代理和镜像配置是否正确。',
    '如果还有报错，再把完整日志贴出来。',
  ].join('');
}

describe('POST /api/memory/extract', () => {
  let homeDir: string;
  let workspaceDir: string;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-23T08:30:00.000Z'));

    homeDir = mkdtempSync(join(tmpdir(), 'clawx-memory-extract-'));
    workspaceDir = join(homeDir, '.openclaw', 'agents', 'main', 'workspace');
    await mkdir(workspaceDir, { recursive: true });
    mockHomedir.mockReturnValue(homeDir);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    if (homeDir && existsSync(homeDir)) {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('skips extraction for procedural/task conversation to reduce false positives', async () => {
    mockParseJsonBody.mockResolvedValueOnce({
      messages: [
        { role: 'user', content: '帮我看看这个 npm install 报错怎么修复，顺便给一个排查步骤。' },
        { role: 'assistant', content: makeLongAssistantText() },
      ],
      sessionKey: 'session-a',
      label: 'Agent A',
    });

    const { handleMemoryRoutes } = await import('@electron/api/routes/memory');
    const handled = await handleMemoryRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/memory/extract'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(mockSendJson).toHaveBeenCalledTimes(1);
    const [, statusCode, payload] = mockSendJson.mock.calls[0] as [unknown, number, { skipped?: boolean; reason?: string }];
    expect(statusCode).toBe(200);
    expect(payload.skipped).toBe(true);
    expect(payload.reason).toBe('no_durable_memory_candidates');

    const target = join(workspaceDir, 'memory', '2026-03-23.md');
    expect(existsSync(target)).toBe(false);
  });

  it('extracts durable user memory even when assistant reply is short', async () => {
    mockParseJsonBody.mockResolvedValueOnce({
      messages: [
        { role: 'user', content: '我叫李雷。以后请默认用英文回答。' },
        { role: 'assistant', content: '好的。' },
      ],
      sessionKey: 'session-b',
      label: 'Agent B',
    });

    const { handleMemoryRoutes } = await import('@electron/api/routes/memory');
    const handled = await handleMemoryRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/memory/extract'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(mockSendJson).toHaveBeenCalledTimes(1);
    const [, statusCode, payload] = mockSendJson.mock.calls[0] as [unknown, number, { ok?: boolean; skipped?: boolean; filePath?: string }];
    expect(statusCode).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.skipped).toBeFalsy();
    expect(payload.filePath?.endsWith(join('memory', '2026-03-23.md'))).toBe(true);

    const target = join(workspaceDir, 'memory', '2026-03-23.md');
    expect(existsSync(target)).toBe(true);
    const content = readFileSync(target, 'utf-8');
    expect(content).toContain('我叫李雷');
    expect(content).toContain('以后请默认用英文回答');
  });

  it('falls back to rule decision when optional judge fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('judge network down'));
    vi.stubGlobal('fetch', fetchMock);

    mockParseJsonBody.mockResolvedValueOnce({
      messages: [
        { role: 'user', content: '我通常用 TypeScript 开发。' },
        { role: 'assistant', content: '收到。' },
      ],
      sessionKey: 'session-c',
      label: 'Agent C',
      judge: {
        enabled: true,
        endpoint: 'http://127.0.0.1:3210/v1/messages',
        model: 'fake-model',
        apiKey: 'fake-key',
        timeoutMs: 100,
      },
    });

    const { handleMemoryRoutes } = await import('@electron/api/routes/memory');
    const handled = await handleMemoryRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/memory/extract'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(mockSendJson).toHaveBeenCalledTimes(1);
    const [, statusCode, payload] = mockSendJson.mock.calls[0] as [unknown, number, { ok?: boolean; skipped?: boolean }];
    expect(statusCode).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.skipped).toBeFalsy();

    const target = join(workspaceDir, 'memory', '2026-03-23.md');
    expect(existsSync(target)).toBe(true);
    const content = readFileSync(target, 'utf-8');
    expect(content).toContain('TypeScript');
  });
});
