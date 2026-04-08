import type { IncomingMessage, ServerResponse } from 'http';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  sendJson: vi.fn(),
  parseJsonBody: vi.fn(async (req: IncomingMessage & { __body?: unknown }) => req.__body ?? {}),
}));

vi.mock('@electron/api/route-utils', () => ({
  sendJson: mocks.sendJson,
  parseJsonBody: mocks.parseJsonBody,
}));

function createRequest(method: string, body?: unknown): IncomingMessage & { __body?: unknown } {
  return { method, __body: body } as IncomingMessage & { __body?: unknown };
}

describe('cron routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('passes pipeline delivery and alert fields through cron create/update routes', async () => {
    const rpcMock = vi.fn(async (method: string, params?: Record<string, unknown>) => {
      if (method === 'cron.add') {
        return {
          id: 'job-pipeline',
          name: params?.name,
          enabled: true,
          createdAtMs: Date.parse('2026-03-25T00:00:00.000Z'),
          updatedAtMs: Date.parse('2026-03-25T00:00:00.000Z'),
          schedule: { kind: 'cron', expr: '0 9 * * 1' },
          payload: { kind: 'agentTurn', message: 'Build digest' },
          delivery: params?.delivery,
          failureAlertAfter: params?.failureAlertAfter,
          failureAlertCooldownSeconds: params?.failureAlertCooldownSeconds,
          failureAlertChannel: params?.failureAlertChannel,
          deliveryBestEffort: params?.deliveryBestEffort,
          sessionTarget: 'isolated',
          state: {},
        };
      }
      if (method === 'cron.update') {
        return { ok: true };
      }
      throw new Error(`Unexpected RPC method: ${method}`);
    });
    const ctx = { gatewayManager: { rpc: rpcMock } } as never;
    const { handleCronRoutes } = await import('@electron/api/routes/cron');

    await handleCronRoutes(
      createRequest('POST', {
        name: 'Pipeline Digest',
        message: 'Build digest',
        schedule: '0 9 * * 1',
        delivery: { mode: 'announce', channel: 'feishu', to: 'release-room' },
        failureAlertAfter: 2,
        failureAlertCooldownSeconds: 900,
        failureAlertChannel: 'ops-alerts',
        deliveryBestEffort: true,
      }),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/cron/jobs'),
      ctx,
    );

    expect(rpcMock).toHaveBeenCalledWith('cron.add', expect.objectContaining({
      delivery: { mode: 'announce', channel: 'feishu', to: 'release-room' },
      failureAlertAfter: 2,
      failureAlertCooldownSeconds: 900,
      failureAlertChannel: 'ops-alerts',
      deliveryBestEffort: true,
    }));

    await handleCronRoutes(
      createRequest('PUT', {
        delivery: { mode: 'announce', channel: 'wecom', to: 'platform-room' },
        failureAlertAfter: 5,
        failureAlertCooldownSeconds: 1200,
        failureAlertChannel: 'security-alerts',
        deliveryBestEffort: false,
      }),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/cron/jobs/job-pipeline'),
      ctx,
    );

    expect(rpcMock).toHaveBeenCalledWith('cron.update', {
      id: 'job-pipeline',
      patch: expect.objectContaining({
        delivery: { mode: 'announce', channel: 'wecom', to: 'platform-room' },
        failureAlertAfter: 5,
        failureAlertCooldownSeconds: 1200,
        failureAlertChannel: 'security-alerts',
        deliveryBestEffort: false,
      }),
    });
  });
});
