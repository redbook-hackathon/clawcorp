import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createChannelConversationBindingStore } from '@electron/services/channel-conversation-bindings';

const tempDirs: string[] = [];

function createTempBindingsPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'clawx-channel-bindings-'));
  tempDirs.push(dir);
  return join(dir, 'bindings.json');
}

afterEach(() => {
  tempDirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  tempDirs.length = 0;
});

describe('channel conversation bindings store', () => {
  it('persists and resolves a feishu conversation binding', async () => {
    const filePath = createTempBindingsPath();
    const store = createChannelConversationBindingStore(filePath);
    const record = {
      channelType: 'feishu',
      accountId: 'default',
      externalConversationId: 'oc_123',
      agentId: 'main',
      sessionKey: 'agent:main:main',
    };

    await store.upsert(record);

    await expect(store.get('feishu', 'default', 'oc_123')).resolves.toEqual(
      expect.objectContaining({
        agentId: 'main',
        sessionKey: 'agent:main:main',
      }),
    );

    const secondStore = createChannelConversationBindingStore(filePath);
    await expect(secondStore.get('feishu', 'default', 'oc_123')).resolves.toEqual(
      expect.objectContaining({
        agentId: 'main',
        sessionKey: 'agent:main:main',
      }),
    );
  });

  it('replaces an existing binding when the session key changes', async () => {
    const filePath = createTempBindingsPath();
    const store = createChannelConversationBindingStore(filePath);
    const original = {
      channelType: 'feishu',
      accountId: 'default',
      externalConversationId: 'oc_123',
      agentId: 'main',
      sessionKey: 'agent:main:old',
    };
    const replacement = {
      ...original,
      sessionKey: 'agent:main:new',
    };

    await store.upsert(original);
    await store.upsert(replacement);

    await expect(store.get('feishu', 'default', 'oc_123')).resolves.toEqual(
      expect.objectContaining({
        agentId: 'main',
        sessionKey: 'agent:main:new',
      }),
    );
  });

  it('deletes only the targeted account bindings for a channel', async () => {
    const filePath = createTempBindingsPath();
    const store = createChannelConversationBindingStore(filePath);

    await store.upsert({
      channelType: 'feishu',
      accountId: 'default',
      externalConversationId: 'oc_default',
      agentId: 'main',
      sessionKey: 'agent:main:main',
    });
    await store.upsert({
      channelType: 'feishu',
      accountId: 'agent-a',
      externalConversationId: 'oc_agent_a',
      agentId: 'agent-a',
      sessionKey: 'agent:agent-a:main',
    });
    await store.upsert({
      channelType: 'wecom',
      accountId: 'default',
      externalConversationId: 'wecom_default',
      agentId: 'main',
      sessionKey: 'agent:main:wecom',
    });

    await store.deleteByChannel('feishu', 'agent-a');

    await expect(store.get('feishu', 'default', 'oc_default')).resolves.toEqual(
      expect.objectContaining({ sessionKey: 'agent:main:main' }),
    );
    await expect(store.get('feishu', 'agent-a', 'oc_agent_a')).resolves.toBeNull();
    await expect(store.get('wecom', 'default', 'wecom_default')).resolves.toEqual(
      expect.objectContaining({ sessionKey: 'agent:main:wecom' }),
    );
  });

  it('deletes all bindings for a channel while preserving unrelated channels', async () => {
    const filePath = createTempBindingsPath();
    const store = createChannelConversationBindingStore(filePath);

    await store.upsert({
      channelType: 'feishu',
      accountId: 'default',
      externalConversationId: 'oc_default',
      agentId: 'main',
      sessionKey: 'agent:main:main',
    });
    await store.upsert({
      channelType: 'feishu',
      accountId: 'agent-a',
      externalConversationId: 'oc_agent_a',
      agentId: 'agent-a',
      sessionKey: 'agent:agent-a:main',
    });
    await store.upsert({
      channelType: 'wecom',
      accountId: 'default',
      externalConversationId: 'wecom_default',
      agentId: 'main',
      sessionKey: 'agent:main:wecom',
    });

    await store.deleteByChannel('feishu');

    await expect(store.get('feishu', 'default', 'oc_default')).resolves.toBeNull();
    await expect(store.get('feishu', 'agent-a', 'oc_agent_a')).resolves.toBeNull();
    await expect(store.get('wecom', 'default', 'wecom_default')).resolves.toEqual(
      expect.objectContaining({ sessionKey: 'agent:main:wecom' }),
    );
  });

  it('fails closed when the bindings file is malformed', async () => {
    const filePath = createTempBindingsPath();
    writeFileSync(filePath, '{ not-valid-json');
    const store = createChannelConversationBindingStore(filePath);

    await expect(store.get('feishu', 'default', 'oc_123')).rejects.toThrow();
  });
});
