// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { buildWorkbenchComposerPlaceholder, resolveSelectedChannel } from '@/pages/Channels/channel-selection';
import type { Channel } from '@/types/channel';

function createChannel(overrides: Partial<Channel>): Channel {
  return {
    id: 'feishu-default',
    type: 'feishu',
    name: 'Feishu',
    status: 'connected',
    ...overrides,
  };
}

describe('channel workbench selection', () => {
  it('keeps the same channel family when the active channel id becomes stale', () => {
    const channels = [
      createChannel({ id: 'feishu-default', type: 'feishu', name: 'Feishu' }),
      createChannel({ id: 'wechat-e5e00d1a769e-im-bot', type: 'wechat', name: '微信' }),
    ];

    const selected = resolveSelectedChannel(channels, 'wechat-default', 'feishu');

    expect(selected?.id).toBe('wechat-e5e00d1a769e-im-bot');
    expect(selected?.type).toBe('wechat');
  });

  it('still honors the requested channel when there is no active channel id', () => {
    const channels = [
      createChannel({ id: 'feishu-default', type: 'feishu', name: 'Feishu' }),
      createChannel({ id: 'wechat-default', type: 'wechat', name: '微信' }),
    ];

    const selected = resolveSelectedChannel(channels, null, 'wechat');

    expect(selected?.id).toBe('wechat-default');
  });

  it('builds a WeChat-specific composer placeholder', () => {
    expect(buildWorkbenchComposerPlaceholder('wechat', 'group')).toBe('在微信发送消息（将同步至微信）...');
    expect(buildWorkbenchComposerPlaceholder('wechat', 'private')).toBe('在微信私聊发送消息（将同步至微信）...');
  });
});
