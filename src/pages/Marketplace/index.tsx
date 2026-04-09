import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Star, ShoppingCart, Plus, Building2, User, X, Bot, Users, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentsStore } from '@/stores/agents';
import { useTeamsStore } from '@/stores/teams';
import { invokeIpc } from '@/lib/api-client';

type HireType = '雇佣团队' | '雇佣员工';

type MarketplaceTemplate = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  vibe: string;
  role: string;
  hireType: 'single' | 'team';
  capabilities: string[];
  tags: string[];
  price: string;
  avatar: string;
  rating: number;
  hiredCount: number;
};

type TemplateListResponse = {
  success: boolean;
  templates?: MarketplaceTemplate[];
  error?: string;
};

type HireSingleResponse = {
  success: boolean;
  agentId?: string;
  workspacePath?: string;
  error?: string;
};

type HireTeamResponse = {
  success: boolean;
  leaderId?: string;
  workerIds?: string[];
  teamId?: string;
  teamName?: string;
  error?: string;
};

const FILTER_OPTIONS = ['全部', '数据分析', '代码审查', '内容创作', 'SOP', '客服', '翻译', '增长', '营销', '招聘'];

const HIRE_TYPES: HireType[] = ['雇佣团队', '雇佣员工'];

export function Marketplace() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('全部');
  const [activeHireType, setActiveHireType] = useState<HireType | '全部'>('全部');
  const [showListingModal, setShowListingModal] = useState(false);
  const [showPurchasedModal, setShowPurchasedModal] = useState(false);
  const [purchasedAgentName, setPurchasedAgentName] = useState('');
  const [purchasedType, setPurchasedType] = useState<'single' | 'team'>('single');
  const [purchasedCount, setPurchasedCount] = useState(1);
  const [purchasing, setPurchasing] = useState(false);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MarketplaceTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);

  const { fetchAgents } = useAgentsStore();
  const { fetchTeams } = useTeamsStore();

  // Fetch real templates from bundled resources
  useEffect(() => {
    async function loadTemplates() {
      try {
        const res = await invokeIpc<TemplateListResponse>('marketplace:listTemplates');
        if (res.success && res.templates) {
          setTemplates(res.templates);
        }
      } catch (err) {
        console.error('Failed to load marketplace templates:', err);
      } finally {
        setLoadingTemplates(false);
      }
    }
    void loadTemplates();
  }, []);

  const filteredAgents = useMemo(() => {
    return templates.filter((agent) => {
      const matchesSearch =
        !searchQuery ||
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesFilter =
        activeFilter === '全部' || agent.tags.some((tag) => tag.includes(activeFilter));
      const hireType: HireType = agent.hireType === 'team' ? '雇佣团队' : '雇佣员工';
      const matchesHireType =
        activeHireType === '全部' || hireType === activeHireType;
      return matchesSearch && matchesFilter && matchesHireType;
    });
  }, [searchQuery, activeFilter, activeHireType, templates]);

  return (
    <div className="h-full overflow-y-auto bg-[#F2F0E9] p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-start justify-between"
        >
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-[#1A1C1E]">
              {t('marketplace.title', '人才市集')}
            </h1>
            <p className="mt-2 text-lg text-gray-500">
              {t('marketplace.subtitle', '发现并雇佣全球最顶尖的数字员工')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowListingModal(true)}
            className="flex items-center gap-2 rounded-full bg-[#1A1C1E] px-8 py-3 text-sm font-bold text-white shadow-xl transition-all hover:scale-105 hover:bg-[#FF6B4A]"
          >
            <Plus size={18} />
            {t('marketplace.listEmployee', '上架我的员工')}
          </button>
        </motion.div>

        {/* Search & Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('marketplace.searchPlaceholder', '搜索 Agent...')}
              className="h-12 w-full rounded-full border border-gray-100 bg-white/50 pl-11 pr-4 text-sm font-bold text-[#1A1C1E] shadow-sm backdrop-blur-md placeholder:text-gray-400 focus:border-[#FFD233] focus:outline-none focus:ring-2 focus:ring-[#FFD233]/20"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            {FILTER_OPTIONS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-bold transition-all',
                  activeFilter === filter
                    ? 'bg-[#1A1C1E] text-white shadow-lg'
                    : 'border border-gray-100 bg-white text-[#1A1C1E] shadow-sm hover:bg-gray-50',
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Hire Type Toggle */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveHireType('全部')}
            className={cn(
              'rounded-full px-5 py-2.5 text-sm font-bold transition-all',
              activeHireType === '全部'
                ? 'bg-[#FFD233] text-[#1A1C1E] shadow-md'
                : 'border border-gray-100 bg-white text-gray-500 shadow-sm hover:bg-gray-50',
            )}
          >
            {t('marketplace.allTypes', '全部类型')}
          </button>
          {HIRE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setActiveHireType(type)}
              className={cn(
                'flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all',
                activeHireType === type
                  ? 'bg-[#FFD233] text-[#1A1C1E] shadow-md'
                  : 'border border-gray-100 bg-white text-gray-500 shadow-sm hover:bg-gray-50',
              )}
            >
              {type === '雇佣团队' ? <Building2 size={16} /> : <User size={16} />}
              {type === '雇佣团队'
                ? t('marketplace.hireCompany', '雇佣团队')
                : t('marketplace.hireEmployee', '雇佣员工')}
              <span className="ml-1 rounded-full bg-black/10 px-2 py-0.5 text-[10px]">
                {type === '雇佣团队'
                  ? templates.filter((a) => a.hireType === 'team').length
                  : templates.filter((a) => a.hireType === 'single').length}
              </span>
            </button>
          ))}
          <p className="ml-2 text-xs text-gray-400">
            {t('marketplace.hireCompanyHint', '雇佣团队 = SOP 工作流 · 雇佣员工 = 单个 Agent')}
          </p>
        </div>

        {/* Agent Cards Grid */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3 items-stretch">
          {loadingTemplates && (
            <div className="col-span-full flex flex-col items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <p className="mt-3 text-sm font-bold text-gray-400">加载人才市集...</p>
            </div>
          )}
          {!loadingTemplates && filteredAgents.map((agent, i) => (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group relative flex flex-col overflow-hidden rounded-[40px] bg-white p-8 shadow-[0_20px_50px_rgba(0,0,0,0.03)] transition-shadow duration-300 hover:shadow-[0_30px_60px_rgba(0,0,0,0.06)]"
            >
              {/* Decorative blur */}
              <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[#FFD233]/10 blur-3xl transition-colors duration-700 group-hover:bg-[#FFD233]/20" />

              {/* Avatar + Rating */}
              <div className="relative flex items-start justify-between">
                {agent.hireType === 'team' ? (
                  <div className="relative h-20 w-20 shrink-0">
                    {/* Back members */}
                    <div className="absolute left-3 top-0 h-14 w-14 overflow-hidden rounded-[16px] shadow-sm">
                      <img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=member1&backgroundColor=F59E0B" alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="absolute left-7 top-3 h-14 w-14 overflow-hidden rounded-[16px] shadow-sm">
                      <img src="https://api.dicebear.com/7.x/pixel-art/svg?seed=member2&backgroundColor=3B82F6" alt="" className="h-full w-full object-cover" />
                    </div>
                    {/* Front: leader */}
                    <div className="absolute bottom-0 right-0 h-14 w-14 overflow-hidden rounded-[16px] shadow-md ring-2 ring-white transition-transform duration-700 group-hover:scale-110">
                      <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
                    </div>
                    {/* Team badge */}
                    <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white shadow-sm">
                      {agent.capabilities.length}
                    </span>
                  </div>
                ) : (
                  <div className="h-20 w-20 overflow-hidden rounded-[24px] shadow-sm transition-transform duration-700 group-hover:scale-110">
                    <img src={agent.avatar} alt={agent.name} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="flex flex-col items-end gap-2">
                  <div className="flex items-center gap-1 rounded-full bg-[#FFD233]/20 px-3 py-1">
                    <Star size={14} className="fill-[#FFD233] text-[#FFD233]" />
                    <span className="text-sm font-bold text-[#1A1C1E]">{agent.rating.toFixed(1)}</span>
                  </div>
                  <span className={cn(
                    'flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider',
                    agent.hireType === 'team'
                      ? 'bg-emerald-50 text-emerald-600'
                      : 'bg-blue-50 text-blue-600',
                  )}>
                    {agent.hireType === 'team' ? <Building2 size={10} /> : <User size={10} />}
                    {agent.hireType === 'team' ? '雇佣团队' : '雇佣员工'}
                  </span>
                </div>
              </div>

              {/* Name */}
              <h3 className="mt-5 text-2xl font-bold text-[#1A1C1E]">{agent.name}</h3>

              {/* Tags */}
              <div className="mt-3 flex flex-wrap gap-2">
                {agent.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-[#F2F0E9] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Description */}
              <p className="mt-4 text-sm leading-relaxed text-gray-500 line-clamp-2">{agent.description}</p>

              {/* Footer */}
              <div className="mt-auto flex items-end justify-between border-t border-gray-100/60 pt-6">
                {/* Left: Price + Hired */}
                <div className="flex items-end gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
                      {t('marketplace.priceLabel', '部署费用')}
                    </p>
                    <p className="mt-1 text-xl font-bold text-[#1A1C1E]">{agent.price}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400">
                      {t('marketplace.hiredCount', '已雇佣')}
                    </p>
                    <p className="mt-1 text-xl font-bold text-[#1A1C1E]">{agent.hiredCount}</p>
                  </div>
                </div>
                {/* Right: Cart button */}
                <button
                    type="button"
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#1A1C1E] text-white shadow-lg shadow-[#1A1C1E]/10 transition-colors hover:bg-[#FF6B4A] disabled:opacity-50"
                    onClick={async () => {
                      if (purchasingId) return;
                      setPurchasingId(agent.id);
                      setPurchasing(true);
                      try {
                        if (agent.hireType === 'team') {
                          const res = await invokeIpc<HireTeamResponse>('marketplace:hireTeam', agent.id, agent.name, agent.capabilities);
                          if (!res.success) {
                            throw new Error(res.error || '雇佣团队失败');
                          }
                          await fetchTeams();
                          setPurchasedAgentName(agent.name);
                          setPurchasedType('team');
                          setPurchasedCount(agent.capabilities.length + 1);
                        } else {
                          const res = await invokeIpc<HireSingleResponse>('marketplace:hireSingle', agent.id, agent.name);
                          if (!res.success) {
                            throw new Error(res.error || '雇佣员工失败');
                          }
                          setPurchasedAgentName(agent.name);
                          setPurchasedType('single');
                          setPurchasedCount(1);
                        }

                        await fetchAgents();
                        setShowPurchasedModal(true);
                      } catch (err) {
                        toast.error(`雇佣 ${agent.name} 失败: ${String(err)}`);
                      } finally {
                        setPurchasing(false);
                        setPurchasingId(null);
                      }
                    }}
                    disabled={purchasing && purchasingId !== agent.id}
                  >
                    {purchasing && purchasingId === agent.id ? (
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <ShoppingCart size={20} />
                    )}
                  </button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty state */}
        {!loadingTemplates && filteredAgents.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <p className="text-lg font-bold text-gray-400">
              {t('marketplace.empty', '没有找到匹配的 Agent')}
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setActiveFilter('全部');
                setActiveHireType('全部');
              }}
              className="mt-4 rounded-full bg-[#1A1C1E] px-6 py-2.5 text-sm font-bold text-white shadow-xl transition-colors hover:bg-[#FF6B4A]"
            >
              {t('marketplace.clearFilters', '清除筛选')}
            </button>
          </div>
        )}
      </div>

      {/* List Employee Modal */}
      <AnimatePresence>
        {showListingModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => setShowListingModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3 }}
              className="relative mx-4 w-full max-w-lg rounded-[32px] bg-white p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowListingModal(false)}
                className="absolute right-6 top-6 rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={20} />
              </button>

              <h2 className="text-2xl font-bold text-[#1A1C1E]">
                {t('marketplace.listTitle', '上架我的员工')}
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                {t('marketplace.listSubtitle', '将你的 Agent 发布到市集，让更多团队发现和雇佣')}
              </p>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                    {t('marketplace.agentName', 'Agent 名称')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('marketplace.agentNamePlaceholder', '给你的 Agent 取个名字')}
                    className="h-12 w-full rounded-2xl border border-gray-100 bg-[#F2F0E9]/50 px-4 text-sm font-bold text-[#1A1C1E] placeholder:text-gray-400 focus:border-[#FFD233] focus:outline-none focus:ring-2 focus:ring-[#FFD233]/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                    {t('marketplace.agentType', '上架类型')}
                  </label>
                  <div className="flex gap-3">
                    {HIRE_TYPES.map((type) => (
                      <button
                        key={type}
                        type="button"
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-sm font-bold text-[#1A1C1E] transition-all hover:border-[#FFD233] hover:bg-[#FFD233]/10 focus:border-[#FFD233] focus:ring-2 focus:ring-[#FFD233]/20"
                      >
                        {type === '雇佣团队' ? <Building2 size={16} /> : <User size={16} />}
                        {type === '雇佣团队'
                          ? t('marketplace.typeCompany', '团队 (SOP 工作流)')
                          : t('marketplace.typeEmployee', '员工 (单个 Agent)')}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                    {t('marketplace.agentDesc', '简介')}
                  </label>
                  <textarea
                    rows={3}
                    placeholder={t('marketplace.agentDescPlaceholder', '描述你的 Agent 能做什么...')}
                    className="w-full rounded-2xl border border-gray-100 bg-[#F2F0E9]/50 px-4 py-3 text-sm font-bold text-[#1A1C1E] placeholder:text-gray-400 focus:border-[#FFD233] focus:outline-none focus:ring-2 focus:ring-[#FFD233]/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
                    {t('marketplace.agentPrice', '定价')}
                  </label>
                  <input
                    type="text"
                    placeholder={t('marketplace.agentPricePlaceholder', '例如 ¥299/月 或 免费')}
                    className="h-12 w-full rounded-2xl border border-gray-100 bg-[#F2F0E9]/50 px-4 text-sm font-bold text-[#1A1C1E] placeholder:text-gray-400 focus:border-[#FFD233] focus:outline-none focus:ring-2 focus:ring-[#FFD233]/20"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowListingModal(false)}
                className="mt-6 w-full rounded-full bg-[#1A1C1E] py-4 text-sm font-bold text-white shadow-xl transition-all hover:scale-[1.02] hover:bg-[#FF6B4A]"
              >
                {t('marketplace.submitListing', '提交上架')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Purchase Success Modal */}
      <AnimatePresence>
        {showPurchasedModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
            onClick={() => { setShowPurchasedModal(false); navigate('/team-overview'); }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="relative mx-4 w-full max-w-sm rounded-[32px] bg-white p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Checkmark circle */}
              <div className="mb-6 flex justify-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 15 }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50"
                >
                  {purchasedType === 'team' ? (
                    <Users className="h-10 w-10 text-emerald-500" />
                  ) : (
                    <Bot className="h-10 w-10 text-emerald-500" />
                  )}
                </motion.div>
              </div>

              {/* Title */}
              <div className="text-center">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <h2 className="text-2xl font-bold text-[#1A1C1E]">已购买</h2>
                  <p className="mt-2 text-base font-medium text-emerald-500">购买成功</p>
                </motion.div>

                {/* Info */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-4 space-y-2"
                >
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#F2F0E9] px-4 py-2">
                    {purchasedType === 'team' ? (
                      <Users className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Bot className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="text-sm font-bold text-[#1A1C1E]">{purchasedAgentName}</span>
                  </div>
                  <p className="text-sm text-gray-400">
                    {purchasedType === 'team'
                      ? `包含 ${purchasedCount} 个成员`
                      : '已添加至你的人力资产'}
                  </p>
                </motion.div>

                {/* CTA */}
                <motion.button
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  type="button"
                  onClick={() => { setShowPurchasedModal(false); navigate('/team-overview'); }}
                  className="mt-6 w-full rounded-full bg-[#1A1C1E] py-4 text-sm font-bold text-white shadow-xl transition-all hover:bg-[#FF6B4A]"
                >
                  查看人力资产
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
