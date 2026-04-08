// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IncomingMessage, ServerResponse } from 'http';

const {
  runOpenClawDoctorMock,
  runOpenClawDoctorFixMock,
  sendJsonMock,
  sendNoContentMock,
  rmMock,
  readdirMock,
  updaterGetStatusMock,
  updaterCheckForUpdatesMock,
  updaterDownloadUpdateMock,
  updaterQuitAndInstallMock,
  updaterCancelAutoInstallMock,
  updaterSetChannelMock,
  updaterSetAutoDownloadMock,
  updaterGetCurrentVersionMock,
  updaterGetPolicySnapshotMock,
  updaterWaitUntilReadyMock,
} = vi.hoisted(() => ({
  runOpenClawDoctorMock: vi.fn(),
  runOpenClawDoctorFixMock: vi.fn(),
  sendJsonMock: vi.fn(),
  sendNoContentMock: vi.fn(),
  rmMock: vi.fn(),
  readdirMock: vi.fn(),
  updaterGetStatusMock: vi.fn(),
  updaterCheckForUpdatesMock: vi.fn(),
  updaterDownloadUpdateMock: vi.fn(),
  updaterQuitAndInstallMock: vi.fn(),
  updaterCancelAutoInstallMock: vi.fn(),
  updaterSetChannelMock: vi.fn(),
  updaterSetAutoDownloadMock: vi.fn(),
  updaterGetCurrentVersionMock: vi.fn(),
  updaterGetPolicySnapshotMock: vi.fn(),
  updaterWaitUntilReadyMock: vi.fn(),
}));

vi.mock('@electron/utils/openclaw-doctor', () => ({
  runOpenClawDoctor: (...args: unknown[]) => runOpenClawDoctorMock(...args),
  runOpenClawDoctorFix: (...args: unknown[]) => runOpenClawDoctorFixMock(...args),
}));

vi.mock('@electron/main/updater', () => ({
  appUpdater: {
    getStatus: (...args: unknown[]) => updaterGetStatusMock(...args),
    checkForUpdates: (...args: unknown[]) => updaterCheckForUpdatesMock(...args),
    downloadUpdate: (...args: unknown[]) => updaterDownloadUpdateMock(...args),
    quitAndInstall: (...args: unknown[]) => updaterQuitAndInstallMock(...args),
    cancelAutoInstall: (...args: unknown[]) => updaterCancelAutoInstallMock(...args),
    setChannel: (...args: unknown[]) => updaterSetChannelMock(...args),
    setAutoDownload: (...args: unknown[]) => updaterSetAutoDownloadMock(...args),
    getCurrentVersion: (...args: unknown[]) => updaterGetCurrentVersionMock(...args),
    getPolicySnapshot: (...args: unknown[]) => updaterGetPolicySnapshotMock(...args),
    waitUntilReady: (...args: unknown[]) => updaterWaitUntilReadyMock(...args),
  },
}));

vi.mock('@electron/utils/paths', () => ({
  getOpenClawConfigDir: () => 'C:/openclaw',
  getLogsDir: () => 'C:/clawcorp/logs',
}));

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return {
    ...actual,
    rm: (...args: unknown[]) => rmMock(...args),
    readdir: (...args: unknown[]) => readdirMock(...args),
  };
});

vi.mock('@electron/api/route-utils', () => ({
  setCorsHeaders: vi.fn(),
  parseJsonBody: vi.fn().mockResolvedValue({}),
  sendJson: (...args: unknown[]) => sendJsonMock(...args),
  sendNoContent: (...args: unknown[]) => sendNoContentMock(...args),
}));

describe('handleAppRoutes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    rmMock.mockResolvedValue(undefined);
    readdirMock.mockResolvedValue(['main', 'agent-a']);
    updaterGetStatusMock.mockReturnValue({ status: 'idle' });
    updaterCheckForUpdatesMock.mockResolvedValue(null);
    updaterDownloadUpdateMock.mockResolvedValue(undefined);
    updaterGetCurrentVersionMock.mockReturnValue('1.0.0');
    updaterGetPolicySnapshotMock.mockReturnValue({
      attemptCount: 0,
      nextEligibleAt: null,
      rolloutDelayMs: 0,
    });
    updaterWaitUntilReadyMock.mockResolvedValue(undefined);
  });

  it('runs openclaw doctor through the host api', async () => {
    runOpenClawDoctorMock.mockResolvedValueOnce({ success: true, exitCode: 0 });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    const handled = await handleAppRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/openclaw-doctor'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(runOpenClawDoctorMock).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: true, exitCode: 0 });
  });

  it('runs openclaw doctor fix when requested', async () => {
    const { parseJsonBody } = await import('@electron/api/route-utils');
    vi.mocked(parseJsonBody).mockResolvedValueOnce({ mode: 'fix' });
    runOpenClawDoctorFixMock.mockResolvedValueOnce({ success: false, exitCode: 1 });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    const handled = await handleAppRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/openclaw-doctor'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(runOpenClawDoctorFixMock).toHaveBeenCalledTimes(1);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: false, exitCode: 1 });
  });

  it('clears local server data through the host api', async () => {
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    const handled = await handleAppRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/clear-server-data'),
      {
        gatewayManager: {
          getStatus: () => ({ state: 'stopped' }),
          stop: vi.fn().mockResolvedValue(undefined),
          start: vi.fn().mockResolvedValue(undefined),
        },
      } as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, { success: true });
  });

  it('exposes update status and policy through the host api', async () => {
    updaterGetStatusMock.mockReturnValueOnce({ status: 'available', info: { version: '1.2.3' } });
    updaterGetCurrentVersionMock.mockReturnValueOnce('1.0.0');
    updaterGetPolicySnapshotMock.mockReturnValueOnce({
      attemptCount: 3,
      nextEligibleAt: '2026-03-26T01:00:00.000Z',
      rolloutDelayMs: 120000,
    });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    const handled = await handleAppRoutes(
      { method: 'GET' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/update/status'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      currentVersion: '1.0.0',
      status: { status: 'available', info: { version: '1.2.3' } },
      policy: {
        attemptCount: 3,
        nextEligibleAt: '2026-03-26T01:00:00.000Z',
        rolloutDelayMs: 120000,
      },
    });
  });

  it('runs update checks through the host api with policy-aware startup mode', async () => {
    const { parseJsonBody } = await import('@electron/api/route-utils');
    vi.mocked(parseJsonBody).mockResolvedValueOnce({ reason: 'startup', respectPolicy: true });
    updaterGetStatusMock.mockReturnValueOnce({ status: 'checking' });
    updaterCheckForUpdatesMock.mockResolvedValueOnce(null);
    updaterGetPolicySnapshotMock.mockReturnValueOnce({
      attemptCount: 1,
      nextEligibleAt: '2026-03-26T02:00:00.000Z',
      rolloutDelayMs: 1000,
    });
    const { handleAppRoutes } = await import('@electron/api/routes/app');

    const handled = await handleAppRoutes(
      { method: 'POST' } as IncomingMessage,
      {} as ServerResponse,
      new URL('http://127.0.0.1:3210/api/app/update/check'),
      {} as never,
    );

    expect(handled).toBe(true);
    expect(updaterCheckForUpdatesMock).toHaveBeenCalledWith({
      reason: 'startup',
      respectPolicy: true,
    });
    expect(sendJsonMock).toHaveBeenCalledWith(expect.anything(), 200, {
      success: true,
      status: { status: 'checking' },
      policy: {
        attemptCount: 1,
        nextEligibleAt: '2026-03-26T02:00:00.000Z',
        rolloutDelayMs: 1000,
      },
    });
  });
});
