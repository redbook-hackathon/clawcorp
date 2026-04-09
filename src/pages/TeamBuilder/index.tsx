import { memo, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAgentsStore } from '@/stores/agents';
import { useTeamsStore } from '@/stores/teams';
import type { AgentSummary } from '@/types/agent';

// ── Colors (from spec) ───────────────────────────────────────────
const C = {
  bg: '#F2F0E9',            // warm cream background (same as app)
  card: '#FFFFFF',          // white card
  inputLeader: '#F2F0E9',   // warm cream for leader zone
  inputMember: '#FFFFFF',    // white for member zone
  primary: '#1A1C1E',       // dark button (same as app)
  yellow: '#FFC107',        // yellow accent
  textDark: '#1A1C1E',
  textGray: '#9CA3AF',
  border: '#E5E7EB',
} as const;

// ── Draggable agent card for right panel ─────────────────────────
const AVATAR_COLORS = [
  'bg-blue-100 text-blue-600',
  'bg-amber-100 text-amber-600',
  'bg-emerald-100 text-emerald-600',
  'bg-violet-100 text-violet-600',
  'bg-pink-100 text-pink-600',
  'bg-cyan-100 text-cyan-600',
];

function getAvatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

const DraggableAgentCard = memo(function DraggableAgentCard({
  agent,
  teamCount,
  isActiveDrag,
}: {
  agent: AgentSummary;
  teamCount: number;
  isActiveDrag: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: agent.id,
    data: { agent },
  });

  const initials = agent.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const colorClass = getAvatarColor(agent.id);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'relative rounded-2xl border border-gray-200 bg-white p-4 cursor-grab active:cursor-grabbing transition-all',
        'hover:border-gray-300 hover:shadow-md',
        isDragging && 'opacity-30 border-[#FFC107]/50',
        isActiveDrag && !isDragging && 'ring-2 ring-[#FFC107]/40',
      )}
      style={{ touchAction: 'none' }}
    >
      {/* DRAGGING label */}
      <AnimatePresence>
        {isActiveDrag && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute -top-2 -right-2 rounded-full bg-[#FFC107] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-black shadow-sm"
          >
            Dragging
          </motion.span>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        {/* Avatar */}
        <Avatar className="h-10 w-10 ring-2 ring-gray-100">
          {agent.avatar ? (
            <img src={agent.avatar} alt={agent.name} className="object-cover" />
          ) : (
            <AvatarFallback className={cn('text-sm font-bold', colorClass)}>
              {initials}
            </AvatarFallback>
          )}
        </Avatar>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-bold text-[#1A1C1E]">{agent.name}</p>
          <p className="truncate text-xs text-gray-400 mt-0.5">
            {agent.persona || agent.responsibility || '暂无描述'}
          </p>
        </div>
      </div>

      {/* Bottom: team membership status */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={cn(
            'h-1.5 w-1.5 rounded-full transition-colors',
            teamCount > 0 ? 'bg-[#FFC107]' : 'bg-gray-300',
          )} />
          <span className="text-[10px] text-gray-400">
            已加入{teamCount > 0 ? teamCount : '0'}个团队
          </span>
        </div>
        <button
          type="button"
          className="text-gray-300 hover:text-gray-500 transition-colors"
          aria-label="更多操作"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <circle cx="8" cy="3" r="1.5" />
            <circle cx="8" cy="8" r="1.5" />
            <circle cx="8" cy="13" r="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
});

DraggableAgentCard.displayName = 'DraggableAgentCard';

// ── Drag overlay preview ───────────────────────────────────────────
const DragPreview = memo(function DragPreview({
  agentId,
  agents,
}: {
  agentId: string;
  agents: AgentSummary[];
}) {
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return null;

  const initials = agent.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-3 rounded-2xl border-2 border-[#FFC107] bg-white p-4 shadow-2xl">
      <Avatar className="h-10 w-10 ring-2 ring-[#FFC107]/30">
        {agent.avatar ? (
          <img src={agent.avatar} alt={agent.name} className="object-cover" />
        ) : (
          <AvatarFallback className="bg-[#FFC107]/20 text-[#1A1C1E] text-sm font-bold">
            {initials}
          </AvatarFallback>
        )}
      </Avatar>
      <span className="font-bold text-sm text-[#1A1C1E]">{agent.name}</span>
    </div>
  );
});

DragPreview.displayName = 'DragPreview';

// ── Drop zone ─────────────────────────────────────────────────────
function DropZone({
  id,
  icon,
  label,
  sublabel,
  progress,
  placeholder,
  bgColor,
  isFilled,
  isDragging,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
  progress: string;
  placeholder: React.ReactNode;
  bgColor: string;
  isFilled: boolean;
  isDragging: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div className="flex flex-col gap-3">
      {/* Zone header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl transition-all',
              isOver ? 'bg-[#FFC107]/20' : 'bg-[#F5F1E9]',
            )}
          >
            {icon}
          </div>
          <span className="text-sm font-bold text-[#1A1C1E]">{label}</span>
          <span className="text-xs text-gray-400">{sublabel}</span>
        </div>
        <span className="text-xs text-gray-400 font-medium">{progress}</span>
      </div>

      {/* Zone body */}
      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[80px] rounded-2xl border-2 border-dashed p-4 transition-all',
          isOver
            ? 'border-[#FFC107] bg-[#FFC107]/5 shadow-lg'
            : isFilled
              ? 'border-gray-200 bg-white'
              : bgColor,
        )}
      >
        {children || (
          <div className="flex items-center gap-3 h-full">
            <div
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full shrink-0 transition-colors',
                isDragging && !isFilled ? 'bg-[#FFC107]/10' : 'bg-[#F5F1E9]/80',
              )}
            >
              {placeholder}
            </div>
            <span
              className={cn(
                'text-sm transition-colors',
                isDragging && !isFilled ? 'text-[#FFC107] font-medium' : 'text-gray-400',
              )}
            >
              {id === 'leader-zone'
                ? '拖拽 Agent 到这里作为负责人员'
                : '拖拽 Agent 加入团队 (可选多个)'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agent chip (shown when dropped) ──────────────────────────────
const AgentChip = memo(function AgentChip({
  agent,
  onRemove,
}: {
  agent: AgentSummary;
  onRemove: () => void;
}) {
  const initials = agent.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 shadow-sm">
      <Avatar className="h-9 w-9">
        {agent.avatar ? (
          <img src={agent.avatar} alt={agent.name} className="object-cover" />
        ) : (
          <AvatarFallback className="bg-[#FFC107]/20 text-[#1A1C1E] text-xs font-bold">
            {initials}
          </AvatarFallback>
        )}
      </Avatar>
      <span className="flex-1 text-sm font-semibold text-[#1A1C1E]">{agent.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-6 w-6 items-center justify-center rounded-full transition-all hover:bg-gray-100"
        aria-label="移除"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 2l8 8M10 2l-8 8" />
        </svg>
      </button>
    </div>
  );
});

AgentChip.displayName = 'AgentChip';

// ── Main TeamBuilder page ──────────────────────────────────────────
export function TeamBuilder() {
  const navigate = useNavigate();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [leader, setLeader] = useState<AgentSummary | null>(null);
  const [members, setMembers] = useState<AgentSummary[]>([]);
  const [showConfirmForm, setShowConfirmForm] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const { agents, fetchAgents } = useAgentsStore();
  const { teams, fetchTeams, createTeam } = useTeamsStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    void fetchAgents();
    void fetchTeams();
  }, [fetchAgents, fetchTeams]);

  const agentTeamCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    teams.forEach((team) => {
      [team.leaderId, ...team.memberIds].forEach((id) => {
        counts[id] = (counts[id] || 0) + 1;
      });
    });
    return counts;
  }, [teams]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const agent = agents.find((a) => a.id === active.id);
    if (!agent) return;

    if (over.id === 'leader-zone') {
      // Remove from members if present
      setMembers((prev) => prev.filter((m) => m.id !== agent.id));
      setLeader(agent);
      // Auto-generate team name
      const leaderReuse = teams.filter((t) => t.leaderId === agent.id).length;
      const suffix = leaderReuse > 0 ? `-${leaderReuse + 1}` : '';
      setTeamName(`${agent.name}${suffix}团队`);
    } else if (over.id === 'member-zone') {
      if (leader?.id === agent.id) return;
      if (members.some((m) => m.id === agent.id)) return;
      setMembers((prev) => [...prev, agent]);
    }
  };

  const handleCancel = () => {
    navigate('/team-overview');
  };

  const handleConfirm = async () => {
    if (!leader || !teamName.trim()) return;
    setCreating(true);
    try {
      await createTeam({
        leaderId: leader.id,
        memberIds: members.map((m) => m.id),
        name: teamName.trim(),
        description: description.trim() || undefined,
      });
      toast.success(`已成功创建团队「${teamName.trim()}」`);
      navigate('/team-overview');
    } catch (err) {
      toast.error(`创建失败: ${String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full min-h-0" style={{ background: C.bg }}>
        <div className="flex h-full">
          {/* ── Left: Team formation card ──────────────────────── */}
          <div className="flex flex-1 items-center justify-center overflow-y-auto p-8">
            <div className="w-full max-w-xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="rounded-[32px] p-8"
                style={{ background: C.card }}
              >
                {/* Back + Title */}
                <div className="flex items-start justify-between mb-8">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-gray-600"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    选择类型
                  </button>
                  <div className="text-center">
                    <h2 className="text-2xl font-bold text-[#1A1C1E]">组建团队</h2>
                    <p className="mt-1 text-xs text-gray-400">
                      负责人员 LEADER <span className="ml-1">(限1人)</span>
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">{leader ? '1/1' : '0/1'}</span>
                </div>

                {/* Leader drop zone */}
                <DropZone
                  id="leader-zone"
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFC107">
                      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                    </svg>
                  }
                  label="负责人"
                  sublabel="LEADER"
                  progress={leader ? '1/1' : '0/1'}
                  placeholder={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#FFC107">
                      <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
                    </svg>
                  }
                  bgColor="bg-[#F2F0E9]/50"
                  isFilled={!!leader}
                  isDragging={activeId !== null}
                >
                  {leader && (
                    <AgentChip
                      agent={leader}
                      onRemove={() => {
                        setLeader(null);
                        setTeamName('');
                      }}
                    />
                  )}
                </DropZone>

                {/* Connector */}
                <div className="flex justify-center py-3">
                  <div className="flex items-center gap-2 text-gray-300">
                    <div className="h-6 w-px bg-gray-300" />
                    <ChevronRight className="h-4 w-4 rotate-90" />
                    <div className="h-6 w-px bg-gray-300" />
                  </div>
                </div>

                {/* Members drop zone */}
                <DropZone
                  id="member-zone"
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  }
                  label="团队成员"
                  sublabel=""
                  progress={`${members.length}/∞`}
                  placeholder={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  }
                  bgColor={C.inputMember}
                  isFilled={members.length > 0}
                  isDragging={activeId !== null}
                >
                  {members.length > 0 ? (
                    <div className="space-y-2">
                      {members.map((member, i) => (
                        <AgentChip
                          key={`${member.id}-${i}`}
                          agent={member}
                          onRemove={() => setMembers((prev) => prev.filter((m) => m.id !== member.id))}
                        />
                      ))}
                    </div>
                  ) : null}
                </DropZone>

                {/* Action bar */}
                <div
                  className="mt-8 flex items-center justify-between rounded-2xl bg-[#F2F0E9] px-1"
                >
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-full px-5 py-2.5 text-sm font-medium text-gray-500 transition-all hover:bg-black/5"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowConfirmForm(true)}
                    disabled={!leader}
                    className={cn(
                      'flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all',
                      leader
                        ? 'text-white shadow-md hover:shadow-lg active:scale-95'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                    )}
                    style={leader ? { background: C.primary } : {}}
                  >
                    下一步
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </motion.div>
            </div>
          </div>

          {/* ── Right: Available agents ───────────────────────── */}
          <div
            className="h-full w-80 shrink-0 flex flex-col overflow-hidden border-l border-gray-200/50 bg-[#FAF9F6]"
          >
            {/* Header */}
            <div className="shrink-0 px-6 pt-8 pb-4">
              <h3 className="text-lg font-bold text-[#1A1C1E]">可用员工</h3>
              <p className="mt-1 text-xs text-gray-400">
                拖拽员工卡片至左侧区域组建团队
              </p>
            </div>

            {/* Agent list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <div className="space-y-2.5">
                {agents.map((agent) => (
                  <DraggableAgentCard
                    key={agent.id}
                    agent={agent}
                    teamCount={agentTeamCounts[agent.id] || 0}
                    isActiveDrag={activeId === agent.id}
                  />
                ))}

                {/* ENROLL MORE AGENT placeholder */}
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 py-8 mt-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <Plus className="h-5 w-5 text-gray-400" />
                  </div>
                  <span className="mt-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                    Enroll More Agent
                  </span>
                </div>
              </div>
            </div>

            {/* Builder Tips */}
            <div className="shrink-0 px-4 pb-8">
              <div
                className="rounded-2xl bg-[#F2F0E9] p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-2 w-2 rounded-full bg-[#FFC107]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1A1C1E]">
                    Builder Tips
                  </span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  团队组建后，将自动同步至指令中心，您可以直接在该中心为团队指派架构任务。
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Drag overlay ──────────────────────────────────── */}
        <DragOverlay dropAnimation={null}>
          {activeId ? <DragPreview agentId={activeId} agents={agents} /> : null}
        </DragOverlay>

        {/* ── Confirm form modal ───────────────────────────── */}
        <AnimatePresence>
          {showConfirmForm && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowConfirmForm(false)}
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-[32px] p-8 shadow-2xl"
                style={{ background: C.card }}
              >
                <h3 className="mb-6 text-xl font-bold text-[#1A1C1E]">确认创建团队</h3>

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-gray-400">
                      团队名称
                    </label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      placeholder="输入团队名称"
                      className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-[#1A1C1E] outline-none transition-all focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/10"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-gray-400">
                      职责描述 <span className="font-normal normal-case tracking-normal">(可选)</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="描述团队的职责和目标"
                      rows={3}
                      className="w-full resize-none rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-[#1A1C1E] outline-none transition-all focus:border-[#FFC107] focus:ring-2 focus:ring-[#FFC107]/10"
                    />
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfirmForm(false)}
                    disabled={creating}
                    className="flex-1 rounded-full border border-gray-200 py-3 text-sm font-semibold text-gray-500 transition-colors hover:bg-black/5"
                  >
                    返回
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={creating || !teamName.trim()}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-all',
                      teamName.trim() && !creating
                        ? 'text-white shadow-md hover:shadow-lg active:scale-95'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed',
                    )}
                    style={teamName.trim() && !creating ? { background: C.primary } : {}}
                  >
                    {creating ? '创建中...' : '确认创建'}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </DndContext>
  );
}

export default TeamBuilder;
