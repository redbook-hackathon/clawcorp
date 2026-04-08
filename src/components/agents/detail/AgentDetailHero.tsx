import { MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface AgentDetailHeroProps {
  name: string;
  persona: string;
  avatar?: string | null;
  roleLabel: string;
  modelLabel: string;
  teamLabels: string[];
  onOpenChat: () => void;
  onOpenMemory: () => void;
  onOpenSkills: () => void;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((chunk) => chunk[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function AgentDetailHero({
  name,
  persona,
  avatar,
  roleLabel,
  modelLabel,
  teamLabels,
  onOpenChat,
  onOpenMemory,
  onOpenSkills,
}: AgentDetailHeroProps) {
  const initials = getInitials(name);

  return (
    <section className="rounded-[30px] border border-slate-200/80 bg-white p-6 shadow-sm md:p-8">
      <Link to="/agents" className="text-[13px] text-slate-400 transition-colors hover:text-slate-900">
        Back to agents
      </Link>

      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px] bg-slate-100 text-2xl font-semibold text-slate-500">
            {avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">{name}</h1>
            <p className="mt-3 text-sm leading-7 text-slate-600 md:text-base">
              {persona || 'No persona configured.'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {[roleLabel, modelLabel, ...teamLabels].map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] text-slate-600"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={onOpenChat} className="rounded-full px-4">
            <MessageSquare className="mr-2 h-4 w-4" />
            Chat
          </Button>
          <Button variant="outline" onClick={onOpenMemory} className="rounded-full px-4">
            Memory
          </Button>
          <Button variant="outline" onClick={onOpenSkills} className="rounded-full px-4">
            Skills
          </Button>
        </div>
      </div>
    </section>
  );
}
