// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { proxyAwareFetchMock, loggerInfoMock, loggerErrorMock, renderQrPngDataUrlMock } = vi.hoisted(() => ({
  proxyAwareFetchMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  renderQrPngDataUrlMock: vi.fn(() => 'data:image/png;base64,rendered-qr'),
}));

vi.mock('@electron/utils/proxy-fetch', () => ({
  proxyAwareFetch: (...args: unknown[]) => proxyAwareFetchMock(...args),
}));

vi.mock('@electron/utils/logger', () => ({
  logger: {
    info: loggerInfoMock,
    error: loggerErrorMock,
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@electron/utils/qr-code', () => ({
  renderQrPngDataUrl: (...args: unknown[]) => renderQrPngDataUrlMock(...args as [string]),
}));

describe('WeChat login manager', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    proxyAwareFetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        qrcode: 'qr-token',
        qrcode_img_content: 'https://wechat.test/qr.png',
      }),
    });
  });

  it('requests a QR code with the plugin-supported bot_type value', async () => {
    const { weChatLoginManager } = await import('@electron/utils/wechat-login');

    await weChatLoginManager.start();
    expect(weChatLoginManager.getState()?.qrcodeUrl).toBe('data:image/png;base64,rendered-qr');
    weChatLoginManager.stop();

    expect(proxyAwareFetchMock).toHaveBeenCalledWith(
      expect.stringContaining('bot_type=3'),
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(renderQrPngDataUrlMock).toHaveBeenCalledWith('https://wechat.test/qr.png');
  });
});
