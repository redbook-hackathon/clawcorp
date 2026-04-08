import type { AgentSummary } from '@/types/agent';
import { deriveTeamWorkVisibility, type TeamWorkStatusKey } from '@/lib/team-work-visibility';
import type { KanbanTask } from '@/types/task';

export type LeaderProgressBriefMember = {
  id: string;
  name: string;
  statusKey: TeamWorkStatusKey;
  currentWorkTitles: string[];
  ownedEntryPoints: string[];
  etaText: string;
  nextStepText: string;
};

export type LeaderProgressBriefWorkItem = {
  memberId: string;
  memberName: string;
  title: string;
  statusKey: TeamWorkStatusKey;
  etaText: string;
};

export type LeaderProgressBriefDashboard = {
  totalMembers: number;
  activeMemberCount: number;
  workingCount: number;
  waitingApprovalCount: number;
  blockedCount: number;
  idleCount: number;
  activeWorkItems: LeaderProgressBriefWorkItem[];
  riskItems: string[];
  primaryNextAction: string;
};

export type LeaderProgressBrief = {
  overallStatus: TeamWorkStatusKey;
  summaryText: string;
  blockedItems: string[];
  nextSteps: string[];
  members: LeaderProgressBriefMember[];
  dashboard: LeaderProgressBriefDashboard;
};

type BuildLeaderProgressBriefInput = {
  leaderId: string;
  agents: AgentSummary[];
  sessionLastActivity: Record<string, number>;
  configuredChannelTypes: string[];
  channelOwners: Record<string, string>;
  runtimeByAgent?: Record<string, Array<{ status: string; prompt: string }>>;
  tasks?: KanbanTask[];
};

function getOwnedEntryPoints(
  agent: AgentSummary,
  channelOwners: Record<string, string>,
  configuredChannelTypes: string[],
): string[] {
  return (configuredChannelTypes ?? []).filter((channelType) => (channelOwners ?? {})[channelType] === agent.id);
}

function deriveEtaText(statusKey: TeamWorkStatusKey): string {
  switch (statusKey) {
    case 'blocked':
      return 'ETA unavailable until blockers are cleared';
    case 'waiting_approval':
      return 'ETA pending approval';
    case 'working':
      return 'ETA in progress';
    default:
      return 'No active ETA';
  }
}

function deriveNextStepText(statusKey: TeamWorkStatusKey, memberName: string): string {
  switch (statusKey) {
    case 'blocked':
      return `Unblock ${memberName}`;
    case 'waiting_approval':
      return `Review approval for ${memberName}`;
    case 'working':
      return `Track current execution for ${memberName}`;
    case 'active':
      return `Check latest update from ${memberName}`;
    default:
      return `Assign new work to ${memberName}`;
  }
}

function deriveOverallStatus(statuses: TeamWorkStatusKey[]): TeamWorkStatusKey {
  if (statuses.includes('blocked')) return 'blocked';
  if (statuses.includes('waiting_approval')) return 'waiting_approval';
  if (statuses.includes('working')) return 'working';
  if (statuses.includes('active')) return 'active';
  return 'idle';
}

function prioritizeNextAction(members: LeaderProgressBriefMember[]): string {
  const priorityOrder: TeamWorkStatusKey[] = ['blocked', 'waiting_approval', 'working', 'active', 'idle'];
  const prioritized = [...members].sort(
    (left, right) => priorityOrder.indexOf(left.statusKey) - priorityOrder.indexOf(right.statusKey),
  );

  return prioritized.find((member) => member.statusKey !== 'idle')?.nextStepText ?? 'Keep monitoring the team';
}

export function buildLeaderProgressBrief(input: BuildLeaderProgressBriefInput): LeaderProgressBrief {
  void input.leaderId;
  const visibility = deriveTeamWorkVisibility(input.agents, input.sessionLastActivity, input.runtimeByAgent, input.tasks);
  const members = input.agents.map((agent) => {
    const memberVisibility = visibility[agent.id] ?? {
      statusKey: 'idle' as TeamWorkStatusKey,
      activeTaskCount: 0,
      currentWorkTitles: [],
    };
    return {
      id: agent.id,
      name: agent.name,
      statusKey: memberVisibility.statusKey,
      currentWorkTitles: memberVisibility.currentWorkTitles,
      ownedEntryPoints: getOwnedEntryPoints(agent, input.channelOwners, input.configuredChannelTypes),
      etaText: deriveEtaText(memberVisibility.statusKey),
      nextStepText: deriveNextStepText(memberVisibility.statusKey, agent.name),
    };
  });

  const overallStatus = deriveOverallStatus(members.map((member) => member.statusKey));
  const blockedItems = members
    .filter((member) => member.statusKey === 'blocked' || member.statusKey === 'waiting_approval')
    .map((member) => `${member.name}: ${member.currentWorkTitles[0] ?? member.nextStepText}`);
  const nextSteps = members
    .filter((member) => member.statusKey !== 'idle')
    .map((member) => member.nextStepText);
  const activeWorkItems = members
    .filter((member) => member.currentWorkTitles.length > 0)
    .flatMap((member) => member.currentWorkTitles.map((title) => ({
      memberId: member.id,
      memberName: member.name,
      title,
      statusKey: member.statusKey,
      etaText: member.etaText,
    })));

  const waitingCount = members.filter((member) => member.statusKey === 'waiting_approval').length;
  const blockedCount = members.filter((member) => member.statusKey === 'blocked').length;
  const workingCount = members.filter((member) => member.statusKey === 'working').length;
  const activeMemberCount = members.filter((member) => ['blocked', 'waiting_approval', 'working'].includes(member.statusKey)).length;
  const idleCount = members.length - activeMemberCount;
  const summaryParts = [
    blockedCount > 0 ? `${blockedCount} member blocked` : null,
    waitingCount > 0 ? `${waitingCount} member needs approval` : null,
    workingCount > 0 ? `${workingCount} member actively executing` : null,
  ].filter(Boolean);

  return {
    overallStatus,
    summaryText: summaryParts.length > 0 ? summaryParts.join(' | ') : 'Team is stable with no active blockers',
    blockedItems,
    nextSteps,
    members,
    dashboard: {
      totalMembers: members.length,
      activeMemberCount,
      workingCount,
      waitingApprovalCount: waitingCount,
      blockedCount,
      idleCount,
      activeWorkItems,
      riskItems: blockedItems,
      primaryNextAction: prioritizeNextAction(members),
    },
  };
}
