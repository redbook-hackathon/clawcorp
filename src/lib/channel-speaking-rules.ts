export type VisibleSpeakerRole = 'human' | 'main' | 'agent';

export interface ResolveVisibleResponderInput {
  messageText: string;
  mentionedAgentIds: string[];
  speakerRole: VisibleSpeakerRole;
  currentAgentId?: string;
  fallbackAgentId?: string;
}

export interface VisibleResponderDecision {
  visibleResponderId: string | null;
  shouldReply: boolean;
  reason: 'explicit-mention' | 'no-explicit-mention' | 'speaker-cannot-dispatch';
}

export interface VisibleAgentReplyLifecycleInput {
  agentName: string;
  acknowledgement: string;
  completion: string;
}

export interface VisibleAgentReplyLifecycleStep {
  phase: 'acknowledgement' | 'completion';
  authorName: string;
  content: string;
}

export function extractExplicitMentionedAgentId(messageText: string, mentionedAgentIds: string[]): string | null {
  const normalizedMessage = messageText.toLowerCase();
  for (const agentId of mentionedAgentIds) {
    const normalizedAgentId = agentId.trim().toLowerCase();
    if (!normalizedAgentId) continue;
    if (normalizedMessage.includes(`@${normalizedAgentId}`)) {
      return agentId;
    }
  }
  return null;
}

export function resolveVisibleResponder(input: ResolveVisibleResponderInput): VisibleResponderDecision {
  if (input.speakerRole !== 'human' && input.speakerRole !== 'main') {
    return {
      visibleResponderId: null,
      shouldReply: false,
      reason: 'speaker-cannot-dispatch',
    };
  }

  const explicitlyMentionedAgentId = extractExplicitMentionedAgentId(input.messageText, input.mentionedAgentIds);
  if (!explicitlyMentionedAgentId) {
    return {
      visibleResponderId: null,
      shouldReply: false,
      reason: 'no-explicit-mention',
    };
  }

  return {
    visibleResponderId: explicitlyMentionedAgentId,
    shouldReply: true,
    reason: 'explicit-mention',
  };
}

export function buildVisibleAgentReplyLifecycle(
  input: VisibleAgentReplyLifecycleInput,
): VisibleAgentReplyLifecycleStep[] {
  return [
    {
      phase: 'acknowledgement',
      authorName: input.agentName,
      content: input.acknowledgement,
    },
    {
      phase: 'completion',
      authorName: input.agentName,
      content: input.completion,
    },
  ];
}
