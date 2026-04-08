import { useEffect, useRef, useState } from 'react';
import { hostApiFetch } from '@/lib/host-api';

export type RuntimeSessionSummary = {
  id: string;
  parentSessionKey: string;
  sessionKey: string;
  status: 'running' | 'blocked' | 'waiting_approval' | 'error' | 'completed' | 'killed';
  prompt: string;
  agentName?: string;
  createdAt: string;
  updatedAt: string;
  history: Array<{
    role: string;
    content: unknown;
    timestamp?: number;
    toolName?: string;
    isError?: boolean;
  }>;
};

export type TeamRuntimeState = {
  byAgent: Record<string, RuntimeSessionSummary[]>;
  allSessions: RuntimeSessionSummary[];
  loading: boolean;
};

function extractAgentId(parentSessionKey: string): string | null {
  const match = parentSessionKey.match(/^agent:([^:]+):/);
  return match ? match[1] : null;
}

export function useTeamRuntime(enabled = true): TeamRuntimeState {
  const [state, setState] = useState<TeamRuntimeState>({
    byAgent: {},
    allSessions: [],
    loading: true,
  });
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const fetchSessions = async () => {
      try {
        const result = await hostApiFetch<{ success: boolean; sessions: RuntimeSessionSummary[] }>(
          '/api/sessions/subagents',
        );
        if (!result.success) return;

        const activeSessions = result.sessions
          .filter(
            (s) => s.status === 'running' || s.status === 'blocked' || s.status === 'waiting_approval',
          )
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); // newest first

        const byAgent: Record<string, RuntimeSessionSummary[]> = {};
        for (const session of activeSessions) {
          const agentId = extractAgentId(session.parentSessionKey);
          if (!agentId) continue;
          if (!byAgent[agentId]) byAgent[agentId] = [];
          byAgent[agentId].push(session);
        }

        setState({ byAgent, allSessions: activeSessions, loading: false });
      } catch {
        setState((prev) => ({ ...prev, loading: false }));
      }
    };

    void fetchSessions();
    timerRef.current = setInterval(() => void fetchSessions(), 3000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled]);

  return state;
}
