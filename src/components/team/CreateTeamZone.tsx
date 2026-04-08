import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useDroppable } from '@dnd-kit/core';
import { UserPlus, Users, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useTeamsStore } from '@/stores/teams';
import { useAgentsStore } from '@/stores/agents';
import {
  buildLeaderTeamNaming,
  getLeaderReuseCount,
} from './team-creation-utils';

interface DroppedAgent {
  id: string;
  name: string;
  avatar?: string | null;
}

interface CreateTeamZoneProps {
  initialLeader?: DroppedAgent | null;
  onCancel?: () => void;
  onSuccess?: () => void;
  isDragging?: boolean;
}

export interface CreateTeamZoneRef {
  handleLeaderDrop: (agentId: string) => void;
  handleMemberDrop: (agentId: string) => void;
}

const AgentChip = memo(function AgentChip({
  agent,
  onRemove,
}: {
  agent: DroppedAgent;
  onRemove: () => void;
}) {
  const initials = agent.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <Avatar className="h-6 w-6">
        {agent.avatar ? (
          <img src={agent.avatar} alt={agent.name} className="object-cover" />
        ) : (
          <AvatarFallback className="bg-gradient-to-br from-blue-100 to-indigo-100 text-xs font-semibold text-blue-600">
            {initials}
          </AvatarFallback>
        )}
      </Avatar>
      <span className="flex-1 text-sm font-medium text-slate-700">{agent.name}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-md p-0.5 transition-colors hover:bg-slate-100"
        aria-label="移除"
      >
        <X className="h-3.5 w-3.5 text-slate-400 hover:text-slate-600" />
      </button>
    </div>
  );
});

AgentChip.displayName = 'AgentChip';

const DropBucket = memo(function DropBucket({
  title,
  icon,
  supplementalHint,
  isActive,
  isFilled,
  setNodeRef,
  children,
}: {
  title: string;
  icon: ReactNode;
  supplementalHint?: string;
  isActive: boolean;
  isFilled: boolean;
  setNodeRef: (element: HTMLElement | null) => void;
  children: ReactNode;
}) {
  return (
    <div className="flex-1">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-slate-700">{title}</span>
        {supplementalHint ? (
          <span className="text-xs text-slate-400">{supplementalHint}</span>
        ) : null}
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'min-h-[80px] rounded-xl border-2 p-3 transition-all',
          isActive
            ? 'border-solid border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
            : isFilled
              ? 'border-solid border-slate-200 bg-white'
              : 'border-dashed border-slate-300 bg-white/50'
        )}
      >
        {children}
      </div>
    </div>
  );
});

DropBucket.displayName = 'DropBucket';

export const CreateTeamZone = forwardRef<CreateTeamZoneRef, CreateTeamZoneProps>(
  ({ initialLeader, onCancel, onSuccess, isDragging = false }, ref) => {
    const [leader, setLeader] = useState<DroppedAgent | null>(initialLeader || null);
    const [members, setMembers] = useState<DroppedAgent[]>([]);
    const [showConfirmForm, setShowConfirmForm] = useState(false);
    const [teamName, setTeamName] = useState('');
    const [description, setDescription] = useState('');
    const [creating, setCreating] = useState(false);

    const createTeam = useTeamsStore((state) => state.createTeam);
    const teams = useTeamsStore((state) => state.teams);
    const agents = useAgentsStore((state) => state.agents);
    const leaderStateRef = useRef<DroppedAgent | null>(initialLeader || null);
    const memberStateRef = useRef<DroppedAgent[]>([]);

    useEffect(() => {
      if (!initialLeader) return;
      setLeader(initialLeader);
      leaderStateRef.current = initialLeader;
    }, [initialLeader]);

    const { setNodeRef: setLeaderRef, isOver: isOverLeader } = useDroppable({
      id: 'leader-zone',
      data: { type: 'leader' },
    });
    const { setNodeRef: setMemberRef, isOver: isOverMember } = useDroppable({
      id: 'member-zone',
      data: { type: 'member' },
    });

    const generateUniqueName = (baseName: string, existingNames: string[]): string => {
      if (!existingNames.includes(baseName)) return baseName;

      let counter = 1;
      let nextName = `${baseName}-${counter}`;
      while (existingNames.includes(nextName)) {
        counter += 1;
        nextName = `${baseName}-${counter}`;
      }
      return nextName;
    };

    const handleLeaderDrop = (agentId: string) => {
      const agent = agents.find((item) => item.id === agentId);
      if (!agent) return;

      const nextMembers = memberStateRef.current.filter((member) => member.id !== agentId);
      memberStateRef.current = nextMembers;
      setMembers(nextMembers);
      const leaderReuseCount = getLeaderReuseCount(teams, agent.id);
      const naming = buildLeaderTeamNaming(agent.name, leaderReuseCount);

      const nextLeader = { id: agent.id, name: naming.leaderDisplayName, avatar: agent.avatar };
      leaderStateRef.current = nextLeader;
      setLeader(nextLeader);
      setTeamName(naming.defaultTeamName);
      setShowConfirmForm(false);
    };

    const handleMemberDrop = (agentId: string) => {
      const agent = agents.find((item) => item.id === agentId);
      if (!agent) return;
      if (leaderStateRef.current?.id === agentId) return;
      if (memberStateRef.current.some((member) => member.id === agentId)) return;

      const existingNames = [
        leaderStateRef.current?.name,
        ...memberStateRef.current.map((member) => member.name),
      ].filter(Boolean) as string[];

      const uniqueName = generateUniqueName(agent.name, existingNames);

      // 直接添加，不检查是否已存在
      const nextMembers = [
        ...memberStateRef.current,
        { id: agent.id, name: uniqueName, avatar: agent.avatar },
      ];
      memberStateRef.current = nextMembers;
      setMembers(nextMembers);
    };

    useImperativeHandle(
      ref,
      () => ({
        handleLeaderDrop,
        handleMemberDrop,
      })
    );

    const handleConfirm = async () => {
      if (!leader || !teamName.trim()) return;

      setCreating(true);
      try {
        await createTeam({
          leaderId: leader.id,
          memberIds: members.map((member) => member.id),
          name: teamName.trim(),
          description: description.trim() || undefined,
        });

        leaderStateRef.current = null;
        memberStateRef.current = [];
        setLeader(null);
        setMembers([]);
        setTeamName('');
        setDescription('');
        setShowConfirmForm(false);
        onSuccess?.();
      } catch (error) {
        console.error('Failed to create team:', error);
      } finally {
        setCreating(false);
      }
    };

    const handleCancel = () => {
      setShowConfirmForm(false);
      setTeamName('');
      setDescription('');
      leaderStateRef.current = null;
      memberStateRef.current = [];
      setLeader(null);
      setMembers([]);
      onCancel?.();
    };

    const handleNextStep = () => {
      if (!leader) return;
      setShowConfirmForm(true);
    };

    // 判断是否应该高亮整个拖拽区
    const shouldHighlight = isDragging && !leader && members.length === 0;

    return (
      <div data-testid="create-team-zone" className="w-full">
        {/* 轻量化拖拽接收区 - 拖拽时高亮 */}
        <motion.div
          animate={{
            borderColor: shouldHighlight ? 'rgb(59, 130, 246)' : 'rgb(203, 213, 225)',
            backgroundColor: shouldHighlight ? 'rgb(239, 246, 255)' : 'rgb(248, 250, 252)',
          }}
          transition={{ duration: 0.2 }}
          className={cn(
            'rounded-2xl border-2 border-dashed p-6 transition-all',
            shouldHighlight && 'shadow-lg shadow-blue-100'
          )}
        >
          {/* 常驻提示 - 拖拽时更明显 */}
          <AnimatePresence>
            {shouldHighlight && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 flex items-center gap-2 rounded-lg bg-blue-100 px-4 py-3 text-sm font-medium text-blue-700"
              >
                <Sparkles className="h-4 w-4" />
                将右侧 Agent 拖拽至此框内作为 Leader 或成员
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-start gap-6">
            <DropBucket
              title="Leader"
              icon={<UserPlus className="h-4 w-4 text-slate-500" />}
              supplementalHint="(限 1 人)"
              isActive={isOverLeader || (!!isDragging && !leader)}
              isFilled={!!leader}
              setNodeRef={setLeaderRef}
            >
                {leader ? (
                  <AgentChip
                    agent={leader}
                    onRemove={() => {
                      leaderStateRef.current = null;
                      setLeader(null);
                      setTeamName('');
                    }}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 py-3">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                        isDragging ? 'bg-blue-100' : 'bg-slate-100'
                      )}
                    >
                      <span className="text-base">👑</span>
                    </div>
                    <span
                      className={cn(
                        'text-xs transition-colors',
                        isDragging ? 'text-blue-600 font-medium' : 'text-slate-400'
                      )} 
                    >
                      拖拽 Agent 到这里
                    </span>
                  </div>
                )}
            </DropBucket>

            <DropBucket
              title="成员"
              icon={<Users className="h-4 w-4 text-slate-500" />}
              supplementalHint={
                members.length > 0 && members.length < 3 ? '建议至少 2-3 人' : undefined
              }
              isActive={isOverMember || (!!isDragging && members.length === 0)}
              isFilled={members.length > 0}
              setNodeRef={setMemberRef}
            >
                {members.length > 0 ? (
                  <div className="space-y-2">
                    {members.map((member, index) => (
                      <AgentChip
                        key={`${member.id}-${member.name}-${index}`}
                        agent={member}
                        onRemove={() => {
                          const nextMembers = memberStateRef.current.filter((_, i) => i !== index);
                          memberStateRef.current = nextMembers;
                          setMembers(nextMembers);
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 py-3">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                        isDragging ? 'bg-blue-100' : 'bg-slate-100'
                      )}
                    >
                      <span className="text-base">👥</span>
                    </div>
                    <span
                      className={cn(
                        'text-xs transition-colors',
                        isDragging ? 'text-blue-600 font-medium' : 'text-slate-400'
                      )} 
                    >
                      拖拽多个 Agent
                    </span>
                  </div>
                )}
            </DropBucket>
          </div>

          {/* 操作按钮 */}
          <div className="mt-6 flex items-center justify-between">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleNextStep}
              disabled={!leader}
              className={cn(
                'px-6 py-2 rounded-lg text-sm font-semibold transition-all',
                leader
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              )}
            >
              下一步
            </button>
          </div>
        </motion.div>

        {/* 确认表单 Modal - 仅在点击"下一步"时显示 */}
        <AnimatePresence>
          {showConfirmForm && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowConfirmForm(false)}
                className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 z-50"
              >
                <h3 className="text-lg font-semibold text-slate-900 mb-4">确认创建团队</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      团队名称
                    </label>
                    <input
                      type="text"
                      value={teamName}
                      onChange={(event) => setTeamName(event.target.value)}
                      placeholder="输入团队名称"
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      职责描述 <span className="text-slate-400 font-normal">(可选)</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="描述团队的职责和目标"
                      rows={3}
                      className="w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfirmForm(false)}
                    disabled={creating}
                    className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    返回
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={creating || !teamName.trim()}
                    className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating ? '创建中...' : '确认创建'}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  }
);

CreateTeamZone.displayName = 'CreateTeamZone';

export default CreateTeamZone;
