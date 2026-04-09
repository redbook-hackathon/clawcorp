import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Bot, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAgentsStore } from '@/stores/agents';
import { useTeamsStore } from '@/stores/teams';
import { cn } from '@/lib/utils';

type BuildMode = 'select' | 'single' | 'team';

export function EmployeeBuilder() {
  const navigate = useNavigate();
  const [buildMode, setBuildMode] = useState<BuildMode>('select');

  // Single-agent form state
  const [agentName, setAgentName] = useState('');
  const [agentPersona, setAgentPersona] = useState('');
  const [creating, setCreating] = useState(false);

  const { fetchTeams } = useTeamsStore();
  const { fetchAgents, createAgent } = useAgentsStore();

  useEffect(() => {
    void fetchAgents();
    void fetchTeams();
  }, [fetchAgents, fetchTeams]);

  const handleCancel = () => {
    navigate('/team-overview');
  };

  const handleCreateSingleAgent = async () => {
    if (!agentName.trim()) return;
    setCreating(true);
    try {
      await createAgent({
        name: agentName.trim(),
        persona: agentPersona.trim() || undefined,
        teamRole: 'worker',
      });
      toast.success(`已成功创建员工「${agentName.trim()}」`);
      setAgentName('');
      setAgentPersona('');
      setBuildMode('select');
      void fetchAgents();
      navigate('/team-overview');
    } catch (err) {
      toast.error(`创建失败: ${String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  const getTitle = () => {
    if (buildMode === 'select') return '添加员工';
    if (buildMode === 'single') return '创建单个员工';
    return '组建团队';
  };

  return (
    <div className="flex h-full flex-col bg-[#F2F0E9]">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-gray-100 bg-[#F2F0E9] px-8">
        <button
          type="button"
          onClick={() => {
            if (buildMode === 'select') {
              handleCancel();
            } else {
              setBuildMode('select');
            }
          }}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 transition-colors hover:text-[#1A1C1E]"
        >
          <ArrowLeft className="h-4 w-4" />
          {buildMode === 'select' ? '返回' : '选择类型'}
        </button>
        <h1 className="text-lg font-bold text-[#1A1C1E]">{getTitle()}</h1>
        <div className="w-14" />
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {buildMode === 'select' ? (
          /* Type selection */
          <div className="flex flex-1 items-center justify-center overflow-y-auto px-8 py-8">
            <div className="flex w-full max-w-2xl gap-6">
              {/* Single Agent */}
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                onClick={() => setBuildMode('single')}
                className="group relative flex flex-1 flex-col items-center gap-4 rounded-[40px] bg-white p-10 text-center shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-xl hover:ring-[#FF6B4A]/30"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#F2F0E9] transition-colors group-hover:bg-[#FF6B4A]/10">
                  <Bot className="h-10 w-10 text-gray-500 transition-colors group-hover:text-[#FF6B4A]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#1A1C1E]">单个员工</h2>
                  <p className="mt-2 text-sm text-gray-400">
                    创建一个独立的数字员工，配备专属人设和 workspace
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {['自定人设', '独立 workspace', '快速创建'].map((tag) => (
                    <span key={tag} className="rounded-full bg-[#F2F0E9] px-3 py-1 text-xs font-medium text-gray-500">
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.button>

              {/* Team */}
              <motion.button
                type="button"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                onClick={() => navigate('/team-builder')}
                className="group relative flex flex-1 flex-col items-center gap-4 rounded-[40px] bg-white p-10 text-center shadow-sm ring-1 ring-gray-100 transition-all hover:shadow-xl hover:ring-[#FF6B4A]/30"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#F2F0E9] transition-colors group-hover:bg-[#FF6B4A]/10">
                  <Users className="h-10 w-10 text-gray-500 transition-colors group-hover:text-[#FF6B4A]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#1A1C1E]">团队 (SOP 工作流)</h2>
                  <p className="mt-2 text-sm text-gray-400">
                    从市集模板或现有员工组建团队，支持 Leader + 多 Worker 层级
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {['Leader', 'Worker 分工', 'SOP 自动化'].map((tag) => (
                    <span key={tag} className="rounded-full bg-[#F2F0E9] px-3 py-1 text-xs font-medium text-gray-500">
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.button>
            </div>
          </div>
        ) : buildMode === 'single' ? (
          /* Single agent form */
          <div className="flex flex-1 items-center justify-center overflow-y-auto px-8 py-8">
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-full max-w-md"
            >
              <div className="rounded-[32px] bg-white p-8 shadow-sm ring-1 ring-gray-100">
                <div className="mb-8 flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[#FF6B4A]/10">
                    <Bot className="h-7 w-7 text-[#FF6B4A]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#1A1C1E]">创建单个员工</h2>
                    <p className="mt-0.5 text-sm text-gray-400">为团队添加新的数字成员</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-gray-400">
                      员工名称
                    </label>
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="例如：数据分析师、客服小助手"
                      className="w-full rounded-2xl border border-gray-100 bg-[#F2F0E9] px-5 py-3 text-sm font-medium text-[#1A1C1E] outline-none transition-all focus:border-[#FF6B4A] focus:ring-2 focus:ring-[#FF6B4A]/10"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-gray-400">
                      人设描述 <span className="font-normal normal-case tracking-normal text-gray-400">(可选)</span>
                    </label>
                    <textarea
                      value={agentPersona}
                      onChange={(e) => setAgentPersona(e.target.value)}
                      placeholder="描述这个员工的专业领域、工作风格和行为准则..."
                      rows={4}
                      className="w-full resize-none rounded-2xl border border-gray-100 bg-[#F2F0E9] px-5 py-3 text-sm font-medium text-[#1A1C1E] outline-none transition-all focus:border-[#FF6B4A] focus:ring-2 focus:ring-[#FF6B4A]/10"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setBuildMode('select')}
                      disabled={creating}
                      className="flex flex-1 items-center justify-center gap-2 rounded-full border border-gray-200 py-3 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateSingleAgent}
                      disabled={creating || !agentName.trim()}
                      className={cn(
                        'flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold transition-all',
                        agentName.trim() && !creating
                          ? 'bg-[#1A1C1E] text-white hover:bg-[#FF6B4A]'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed',
                      )}
                    >
                      {creating ? '创建中...' : '确认创建'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default EmployeeBuilder;
