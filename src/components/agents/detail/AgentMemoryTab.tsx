import { useEffect, useMemo, useState } from 'react';
import { hostApiFetch } from '@/lib/host-api';
import { ScopedMemoryBrowser } from '@/components/memory/ScopedMemoryBrowser';
import type { AgentSummary } from '@/types/agent';
import { useTranslation } from 'react-i18next';

interface MemoryScopeInfo {
  id: string;
  label: string;
  agentName?: string;
  workspaceDir: string;
}

interface MemoryApiResponse {
  files: unknown[];
  scopes?: MemoryScopeInfo[];
  activeScope?: string;
  workspaceDir: string;
}

function resolveAgentScope(scopes: MemoryScopeInfo[] | undefined, agent: AgentSummary): MemoryScopeInfo | null {
  if (!scopes || scopes.length === 0) {
    return null;
  }

  return scopes.find((scope) => (
    scope.id === agent.id
    || scope.agentName === agent.name
    || scope.workspaceDir.toLowerCase().includes(agent.id.toLowerCase())
  )) ?? null;
}

export function AgentMemoryTab({ agent }: { agent: AgentSummary }) {
  const { t } = useTranslation('agents');
  const [loading, setLoading] = useState(true);
  const [response, setResponse] = useState<MemoryApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const nextResponse = await hostApiFetch<MemoryApiResponse>('/api/memory');
        if (!cancelled) {
          setResponse(nextResponse);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [agent.id]);

  const resolvedScope = useMemo(
    () => resolveAgentScope(response?.scopes, agent),
    [agent, response?.scopes],
  );

  if (loading) {
    return <div className="text-sm text-slate-500">{t('detail.loading', { defaultValue: 'Loading agent details...' })}</div>;
  }

  if (!resolvedScope) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
        No shared memory scope found for this agent.
      </div>
    );
  }

  return <ScopedMemoryBrowser scopeId={resolvedScope.id} showScopeSwitcher={false} />;
}
