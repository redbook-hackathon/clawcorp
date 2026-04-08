import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AgentSummary } from '@/types/agent';
import { MemberActivityTab } from '@/components/team-map/MemberActivityTab';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options?.defaultValue && typeof options.defaultValue === 'string') {
        return options.defaultValue;
      }
      return key;
    },
  }),
}));

const agent: AgentSummary = {
  id: 'research',
  name: 'Research',
  persona: 'Finds information',
  isDefault: false,
  model: 'claude-sonnet-4',
  modelDisplay: 'Claude Sonnet 4',
  inheritedModel: false,
  workspace: '~/workspace-research',
  agentDir: '~/agents/research/agent',
  mainSessionKey: 'agent:research:desk',
  channelTypes: [],
  chatAccess: 'direct',
  teamRole: 'worker',
  responsibility: 'Research and evidence synthesis',
};

describe('MemberActivityTab', () => {
  it('renders work status, current work, blocking reason, and next step', () => {
    render(
      <MemberActivityTab
        agent={agent}
        statusLabel="Blocked"
        currentWorkTitles={['Review the latest evidence bundle']}
        blockingReason="Waiting for leader approval"
        nextStep="Review approval for Research"
      />,
    );

    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Review the latest evidence bundle')).toBeInTheDocument();
    expect(screen.getByText('Waiting for leader approval')).toBeInTheDocument();
    expect(screen.getByText('Review approval for Research')).toBeInTheDocument();
  });

  it('shows the empty state when there is no active work', () => {
    render(
      <MemberActivityTab
        agent={agent}
        statusLabel="Idle"
        currentWorkTitles={[]}
        blockingReason={null}
        nextStep="Queue the next work item for Research"
      />,
    );

    expect(screen.getByText('No active work')).toBeInTheDocument();
    expect(screen.getByText('Queue the next work item for Research')).toBeInTheDocument();
  });
});
