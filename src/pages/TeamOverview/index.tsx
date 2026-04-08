import { useEffect, useState, useRef, memo } from 'react';
import { useTeamsStore } from '@/stores/teams';
import { useAgentsStore } from '@/stores/agents';
import { TeamGrid } from '@/components/team/TeamGrid';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent
} from '@dnd-kit/core';
import { AgentPanel } from '@/components/team/AgentPanel';
import { CreateTeamZone } from '@/components/team/CreateTeamZone';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Plus, Network } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface CreateTeamZoneHandlers {
  handleLeaderDrop: (agentId: string) => void;
  handleMemberDrop: (agentId: string) => void;
}

export function TeamOverview() {
  const { teams, loading, error, fetchTeams, deleteTeam } = useTeamsStore();
  const { agents } = useAgentsStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const createZoneRef = useRef<CreateTeamZoneHandlers | null>(null);

  // 配置传感器：增加容差值，避免微小抖动触发拖拽
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 移动 5px 后才激活拖拽
      },
    })
  );

  useEffect(() => {
    void fetchTeams();
  }, [fetchTeams]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !isCreating || !createZoneRef.current) return;

    const agentId = active.id as string;

    if (over.id === 'leader-zone') {
      createZoneRef.current.handleLeaderDrop(agentId);
    } else if (over.id === 'member-zone') {
      createZoneRef.current.handleMemberDrop(agentId);
    }
  };

  const handleCreateClick = () => {
    setIsCreating(true);
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
  };

  const handleCreateSuccess = () => {
    setIsCreating(false);
    void fetchTeams();
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      {/* 顶层 Flex 容器 - 左右并排布局 */}
      <div className="flex h-full">
        {/* 左侧主区域 - flex-1 自动收缩 */}
        <div className="flex flex-1 flex-col overflow-hidden bg-slate-50/30">
          {/* 顶部操作栏 */}
          <div className="h-20 shrink-0 border-b border-slate-200/60 bg-white/80 backdrop-blur-sm px-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">团队总览</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                {loading ? '加载中...' : `共 ${teams.length} 个团队`}
              </p>
            </div>
            <button
              onClick={handleCreateClick}
              disabled={isCreating}
              className={cn(
                'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all',
                isCreating
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md'
              )}
            >
              <Plus className="w-4 h-4" />
              新建团队
            </button>
          </div>

          {/* 主内容区域 - 居中容器 */}
          <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-6xl mx-auto w-full">
              {/* 创建模式：显示轻量化拖拽区 */}
              <AnimatePresence>
                {isCreating && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="mb-8"
                  >
                    <CreateTeamZone
                      ref={createZoneRef}
                      onCancel={handleCancelCreate}
                      onSuccess={handleCreateSuccess}
                      isDragging={activeId !== null}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* 空状态 */}
              {!loading && !error && teams.length === 0 && !isCreating && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center max-w-md">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center">
                      <Network className="w-10 h-10 text-blue-500" strokeWidth={1.5} />
                    </div>
                    <h2 className="text-2xl font-semibold text-slate-900 mb-3">还没有团队</h2>
                    <p className="text-slate-500 leading-relaxed mb-8">
                      点击右上角"新建团队"按钮开始创建第一个团队
                    </p>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {loading && (
                <div className="flex items-center justify-center h-full text-sm text-slate-400">
                  加载中...
                </div>
              )}

              {/* Error State */}
              {!loading && error && (
                <div className="flex items-center justify-center h-full text-sm text-rose-500">
                  {error}
                </div>
              )}

              {/* Team Grid */}
              {!loading && !error && teams.length > 0 && (
                <TeamGrid teams={teams} loading={loading} onDeleteTeam={deleteTeam} />
              )}
            </div>
          </div>
        </div>

        {/* 右侧 Agent 面板 - 固定宽度，条件渲染，无遮罩 */}
        <AnimatePresence>
          {isCreating && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="shrink-0 overflow-hidden"
            >
              <AgentPanel onClose={handleCancelCreate} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* 轻量级拖拽预览 - 使用 DragOverlay */}
        <DragOverlay dropAnimation={null}>
          {activeId ? <AgentDragPreview agentId={activeId} agents={agents} /> : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}

// 轻量级拖拽预览组件 - 极简设计，开启硬件加速，使用 memo 防止重渲染
const AgentDragPreview = memo(({ agentId, agents }: { agentId: string; agents: any[] }) => {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return null;

  const initials = agent.name
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border-2 border-blue-400 bg-white shadow-2xl"
      style={{
        transform: 'translate3d(0, 0, 0)',
        willChange: 'transform',
      }}
    >
      <Avatar className="h-9 w-9">
        {agent.avatar ? (
          <img src={agent.avatar} alt={agent.name} className="object-cover" />
        ) : (
          <AvatarFallback className="bg-blue-100 text-blue-600 text-sm font-medium">
            {initials}
          </AvatarFallback>
        )}
      </Avatar>
      <span className="font-medium text-sm text-slate-900">{agent.name}</span>
    </div>
  );
});

AgentDragPreview.displayName = 'AgentDragPreview';

export default TeamOverview;
