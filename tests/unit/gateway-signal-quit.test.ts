import { describe, expect, it, vi } from 'vitest';
import { createSignalQuitHandler } from '@electron/main/signal-quit';

describe('signal quit handler', () => {
  it('logs signal and requests app quit', () => {
    const logInfo = vi.fn();
    const requestQuit = vi.fn();
    const handler = createSignalQuitHandler({ logInfo, requestQuit });

    handler('SIGTERM');

    expect(logInfo).toHaveBeenCalledWith('Received SIGTERM; requesting app quit');
    expect(requestQuit).toHaveBeenCalledTimes(1);
  });
});
