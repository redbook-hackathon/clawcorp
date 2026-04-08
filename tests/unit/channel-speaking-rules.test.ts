import { describe, expect, it } from 'vitest';
import {
  buildVisibleAgentReplyLifecycle,
  extractExplicitMentionedAgentId,
  resolveVisibleResponder,
} from '@/lib/channel-speaking-rules';

describe('channel speaking rules', () => {
  it('routes visible speaking to the explicitly mentioned agent', () => {
    const agentId = extractExplicitMentionedAgentId('@agent-a 帮我查一下昨晚的构建日志', ['main', 'agent-a', 'agent-b']);

    expect(agentId).toBe('agent-a');
    expect(resolveVisibleResponder({
      messageText: '@agent-a 帮我查一下昨晚的构建日志',
      mentionedAgentIds: ['main', 'agent-a', 'agent-b'],
      speakerRole: 'human',
      fallbackAgentId: 'main',
    })).toEqual({
      visibleResponderId: 'agent-a',
      shouldReply: true,
      reason: 'explicit-mention',
    });
  });

  it('suppresses proactive replies when no agent is mentioned', () => {
    expect(resolveVisibleResponder({
      messageText: '帮我看一下这个问题',
      mentionedAgentIds: ['main', 'agent-a'],
      speakerRole: 'human',
      fallbackAgentId: 'main',
    })).toEqual({
      visibleResponderId: null,
      shouldReply: false,
      reason: 'no-explicit-mention',
    });
  });

  it('only allows human and main to dispatch other agents', () => {
    expect(resolveVisibleResponder({
      messageText: '@agent-a 帮我查一下这个问题',
      mentionedAgentIds: ['main', 'agent-a'],
      speakerRole: 'agent',
      currentAgentId: 'agent-b',
      fallbackAgentId: 'main',
    })).toEqual({
      visibleResponderId: null,
      shouldReply: false,
      reason: 'speaker-cannot-dispatch',
    });

    expect(resolveVisibleResponder({
      messageText: '@agent-a 帮我查一下这个问题',
      mentionedAgentIds: ['main', 'agent-a'],
      speakerRole: 'main',
      fallbackAgentId: 'main',
    })).toEqual({
      visibleResponderId: 'agent-a',
      shouldReply: true,
      reason: 'explicit-mention',
    });
  });

  it('builds the required acknowledgement then completion lifecycle for the addressed agent', () => {
    expect(buildVisibleAgentReplyLifecycle({
      agentName: 'ClawCorp',
      acknowledgement: '收到，正在处理。',
      completion: '查到了，payment-service-v2 在 23:45 发生了 OOMKilled。',
    })).toEqual([
      {
        phase: 'acknowledgement',
        authorName: 'ClawCorp',
        content: '收到，正在处理。',
      },
      {
        phase: 'completion',
        authorName: 'ClawCorp',
        content: '查到了，payment-service-v2 在 23:45 发生了 OOMKilled。',
      },
    ]);
  });
});
