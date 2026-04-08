// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn(() => 'C:/Users/test/AppData/Roaming/ClawCorp-dev'),
    getVersion: vi.fn(() => '0.0.0-test'),
  },
}));

describe('logger', () => {
  afterEach(() => {
    delete process.env.CLAWCORP_LOG_TO_CONSOLE;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('does not throw when console.info fails with broken pipe', async () => {
    const logger = await import('@electron/utils/logger');
    logger.setLogLevel(logger.LogLevel.INFO);

    const brokenPipe = Object.assign(new Error('EPIPE: broken pipe, write'), { code: 'EPIPE' });
    vi.spyOn(console, 'info').mockImplementation(() => {
      throw brokenPipe;
    });

    expect(() => logger.info('startup log')).not.toThrow();
    expect(logger.getRecentLogs()).toEqual(
      expect.arrayContaining([expect.stringContaining('startup log')]),
    );
  });

  it('does not throw when console.debug fails with broken pipe', async () => {
    const logger = await import('@electron/utils/logger');
    logger.setLogLevel(logger.LogLevel.DEBUG);

    const brokenPipe = Object.assign(new Error('EPIPE: broken pipe, write'), { code: 'EPIPE' });
    vi.spyOn(console, 'debug').mockImplementation(() => {
      throw brokenPipe;
    });

    expect(() => logger.debug('gateway state change')).not.toThrow();
    expect(logger.getRecentLogs()).toEqual(
      expect.arrayContaining([expect.stringContaining('gateway state change')]),
    );
  });

  it('ignores broken-pipe error events from stdout and stderr streams', async () => {
    await import('@electron/utils/logger');
    const brokenPipe = Object.assign(new Error('EPIPE: broken pipe, write'), { code: 'EPIPE' });

    expect(() => process.stdout.emit('error', brokenPipe)).not.toThrow();
    expect(() => process.stderr.emit('error', brokenPipe)).not.toThrow();
  });
});
