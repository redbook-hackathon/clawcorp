export interface WorkbenchTeamData {
  id: string;
  name: string;
  description: string;
}

export interface WorkbenchChannelData {
  id: string;
  name: string;
  status: string;
}

export interface WorkbenchTaskData {
  id: string;
  title: string;
  due: string;
}

export interface WorkbenchData {
  team: WorkbenchTeamData;
  channel: WorkbenchChannelData;
  task: WorkbenchTaskData;
}

export const FALLBACK_WORKBENCH_DATA: WorkbenchData = {
  team: {
    id: 'team-default',
    name: '开天执行组 Team KaiTian',
    description: '跨团队协同推进核心工作台任务',
  },
  channel: {
    id: 'channel-default',
    name: '#运营中枢 operations-hub',
    status: '实时状态流已开启',
  },
  task: {
    id: 'task-default',
    title: '复核 Gateway 健康快照与告警分派',
    due: '今日截止',
  },
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value : fallback;

export function shapeWorkbenchData(input?: Partial<WorkbenchData>): WorkbenchData {
  const source = asRecord(input);
  const team = asRecord(source.team);
  const channel = asRecord(source.channel);
  const task = asRecord(source.task);

  return {
    team: {
      id: asString(team.id, FALLBACK_WORKBENCH_DATA.team.id),
      name: asString(team.name, FALLBACK_WORKBENCH_DATA.team.name),
      description: asString(team.description, FALLBACK_WORKBENCH_DATA.team.description),
    },
    channel: {
      id: asString(channel.id, FALLBACK_WORKBENCH_DATA.channel.id),
      name: asString(channel.name, FALLBACK_WORKBENCH_DATA.channel.name),
      status: asString(channel.status, FALLBACK_WORKBENCH_DATA.channel.status),
    },
    task: {
      id: asString(task.id, FALLBACK_WORKBENCH_DATA.task.id),
      title: asString(task.title, FALLBACK_WORKBENCH_DATA.task.title),
      due: asString(task.due, FALLBACK_WORKBENCH_DATA.task.due),
    },
  };
}
