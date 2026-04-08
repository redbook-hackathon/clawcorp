import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TeamCard } from './TeamCard';
import type { TeamSummary } from '@/types/team';
import { Network, ArrowRight } from 'lucide-react';
import { applyLeaderDisplayAliases } from './team-creation-utils';

interface TeamGridProps {
  teams: TeamSummary[];
  loading: boolean;
  onDeleteTeam: (teamId: string) => Promise<void>;
}

export function TeamGrid({ teams, loading, onDeleteTeam }: TeamGridProps) {
  // Sort teams by creation time, newest first (per D-07)
  const sortedTeams = useMemo(() => {
    const teamsWithLeaderAliases = applyLeaderDisplayAliases(teams);
    return [...teamsWithLeaderAliases].sort((a, b) => b.createdAt - a.createdAt);
  }, [teams]);

  // Show empty state when no teams and not loading
  if (!loading && teams.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center justify-center p-12 text-center"
      >
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-slate-100">
          <Network className="h-12 w-12 text-slate-400" />
        </div>
        <h3 className="mb-2 text-xl font-semibold text-slate-900">
          还没有团队
        </h3>
        <p className="mb-6 max-w-md text-sm text-slate-500">
          从右侧拖拽 Agent 到左侧创建区来创建第一个团队
        </p>
        {/* Optional: animated arrow */}
        <motion.div
          animate={{ x: [-20, 20, -20] }}
          transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
          className="text-slate-300"
        >
          <ArrowRight className="h-8 w-8" />
        </motion.div>
      </motion.div>
    );
  }

  // Responsive grid layout (per D-01)
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence>
        {sortedTeams.map((team, index) => (
          <motion.div
            key={team.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ delay: index * 0.05 }}
          >
            <TeamCard
              team={team}
              onDelete={async (teamId) => {
                await onDeleteTeam(teamId);
              }}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
