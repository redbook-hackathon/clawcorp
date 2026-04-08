import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { AgentSummary } from '@/types/agent';
import { MemberDetailSheet } from '@/components/team-map/MemberDetailSheet';

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
  id: 'researcher',
  name: 'Researcher',
  persona: 'Finds information',
  isDefault: false,
  model: 'claude-sonnet-4',
  modelDisplay: 'Claude Sonnet 4',
  inheritedModel: true,
  workspace: '~/workspace-researcher',
  agentDir: '~/agents/researcher',
  mainSessionKey: 'agent:researcher:main',
  channelTypes: [],
  teamRole: 'worker',
  chatAccess: 'leader_only',
  responsibility: 'Finds information',
};

describe('MemberDetailSheet', () => {
  it('renders the required tab order and overview actions', () => {
    render(
      <MemberDetailSheet
        open
        onOpenChange={vi.fn()}
        agent={agent}
        teamId="team-alpha"
        isLeader={false}
        ownedEntryPoints={['feishu']}
        onRemoveMember={vi.fn(async () => {})}
        onOpenChat={vi.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Memory' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Skills' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Chat' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove from Team' })).toBeInTheDocument();
  });

  it('hides remove action for the leader and opens a destructive confirm dialog for members', async () => {
    const onRemoveMember = vi.fn(async () => {});

    const { rerender } = render(
      <MemberDetailSheet
        open
        onOpenChange={vi.fn()}
        agent={agent}
        teamId="team-alpha"
        isLeader
        ownedEntryPoints={[]}
        onRemoveMember={onRemoveMember}
        onOpenChat={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Remove from Team' })).not.toBeInTheDocument();

    rerender(
      <MemberDetailSheet
        open
        onOpenChange={vi.fn()}
        agent={agent}
        teamId="team-alpha"
        isLeader={false}
        ownedEntryPoints={[]}
        onRemoveMember={onRemoveMember}
        onOpenChat={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove from Team' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByText('Remove from Team').length).toBeGreaterThan(1);
    expect(
      screen.getByText(
        'Are you sure you want to remove Researcher from this team? This does not delete the agent.',
      ),
    ).toBeInTheDocument();
  });
});
