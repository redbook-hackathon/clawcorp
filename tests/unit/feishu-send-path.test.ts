import { describe, expect, it, vi } from 'vitest';
import { sendFeishuViaPreferredPath } from '@electron/utils/feishu-send-path';

describe('sendFeishuViaPreferredPath', () => {
  it('prefers direct plugin send before runtime send', async () => {
    const directSend = vi.fn(async () => ({
      messageId: 'om_direct_1',
      chatId: 'oc_direct_1',
    }));
    const runtimeSend = vi.fn(async () => ({
      sessionKey: 'agent:main:feishu:group:oc_direct_1',
      runId: 'run_fallback_1',
    }));

    const result = await sendFeishuViaPreferredPath({
      directSend,
      runtimeSend,
    });

    expect(directSend).toHaveBeenCalledTimes(1);
    expect(runtimeSend).not.toHaveBeenCalled();
    expect(result).toEqual({
      transport: 'direct',
      messageId: 'om_direct_1',
      chatId: 'oc_direct_1',
    });
  });

  it('falls back to runtime send when direct plugin send fails', async () => {
    const directSend = vi.fn(async () => {
      throw new Error('plugin unavailable');
    });
    const runtimeSend = vi.fn(async () => ({
      sessionKey: 'agent:main:feishu:group:oc_fallback_1',
      runId: 'run_fallback_1',
    }));

    const result = await sendFeishuViaPreferredPath({
      directSend,
      runtimeSend,
    });

    expect(directSend).toHaveBeenCalledTimes(1);
    expect(runtimeSend).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      transport: 'runtime',
      sessionKey: 'agent:main:feishu:group:oc_fallback_1',
      runId: 'run_fallback_1',
    });
  });
});
