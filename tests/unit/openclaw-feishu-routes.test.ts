// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const {
  sendJsonMock,
  serviceStatusMock,
  serviceInstallMock,
  serviceDoctorMock,
  serviceAuthStartMock,
  serviceAuthStatusMock,
  serviceCreateEntryMock,
} = vi.hoisted(() => ({
  sendJsonMock: vi.fn(),
  serviceStatusMock: vi.fn(),
  serviceInstallMock: vi.fn(),
  serviceDoctorMock: vi.fn(),
  serviceAuthStartMock: vi.fn(),
  serviceAuthStatusMock: vi.fn(),
  serviceCreateEntryMock: vi.fn(),
}));

vi.mock('@electron/api/route-utils', () => ({
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
  parseJsonBody: vi.fn().mockResolvedValue({}),
}));

vi.mock('@electron/services/feishu-integration', () => ({
  getFeishuIntegrationStatus: (...args: unknown[]) => serviceStatusMock(...args),
  installOrUpdateFeishuPlugin: (...args: unknown[]) => serviceInstallMock(...args),
  runFeishuIntegrationDoctor: (...args: unknown[]) => serviceDoctorMock(...args),
  startFeishuUserAuthorization: (...args: unknown[]) => serviceAuthStartMock(...args),
  getFeishuUserAuthorizationSession: (...args: unknown[]) => serviceAuthStatusMock(...args),
  getFeishuRobotCreationEntry: (...args: unknown[]) => serviceCreateEntryMock(...args),
}));

function createRequest(method: string): IncomingMessage {
  return { method } as IncomingMessage;
}

describe('feishu routes', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns feishu integration status', async () => {
    serviceStatusMock.mockResolvedValueOnce({ nextAction: 'ready' });
    const { handleFeishuRoutes } = await import('@electron/api/routes/feishu');

    const handled = await handleFeishuRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/feishu/status'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { nextAction: 'ready' });
  });

  it('installs or updates the feishu plugin through the host api', async () => {
    serviceInstallMock.mockResolvedValueOnce({ success: true, source: 'bundled' });
    const { handleFeishuRoutes } = await import('@electron/api/routes/feishu');

    const handled = await handleFeishuRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/feishu/install'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: true, source: 'bundled' });
  });

  it('returns combined doctor payload for feishu integration', async () => {
    serviceDoctorMock.mockResolvedValueOnce({ doctor: { success: true }, validation: { valid: true } });
    const { handleFeishuRoutes } = await import('@electron/api/routes/feishu');

    const handled = await handleFeishuRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/feishu/doctor'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      doctor: { success: true },
      validation: { valid: true },
    });
  });

  it('starts a feishu user auth session', async () => {
    const { parseJsonBody } = await import('@electron/api/route-utils');
    vi.mocked(parseJsonBody).mockResolvedValueOnce({ accountId: 'default' });
    serviceAuthStartMock.mockResolvedValueOnce({ id: 'session-1', state: 'pending' });
    const { handleFeishuRoutes } = await import('@electron/api/routes/feishu');

    const handled = await handleFeishuRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/feishu/auth/start'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { id: 'session-1', state: 'pending' });
  });

  it('returns auth session status when session id exists', async () => {
    serviceAuthStatusMock.mockReturnValueOnce({ id: 'session-1', state: 'success' });
    const { handleFeishuRoutes } = await import('@electron/api/routes/feishu');

    const handled = await handleFeishuRoutes(
      createRequest('GET'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/feishu/auth/status?sessionId=session-1'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { id: 'session-1', state: 'success' });
  });

  it('returns a feishu robot creation qr entry', async () => {
    serviceCreateEntryMock.mockReturnValueOnce({ url: 'https://open.feishu.cn/page/openclaw?form=multiAgent' });
    const { handleFeishuRoutes } = await import('@electron/api/routes/feishu');

    const handled = await handleFeishuRoutes(
      createRequest('POST'),
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/feishu/create/start'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      url: 'https://open.feishu.cn/page/openclaw?form=multiAgent',
    });
  });
});
