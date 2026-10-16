import { Search, LogIn, TrendingUp, Anchor, Download } from 'lucide-react';
import { KILL_CHAIN } from '@/data/presets';
import type { KillChainStage } from '@/types';

const ICON_MAP: Record<string, typeof Search> = {
  Search,
  LogIn,
  TrendingUp,
  Anchor,
  Download,
};

interface KillChainBarProps {
  progress: number; // 0-5
  patched: boolean;
}

export function KillChainBar({ progress, patched }: KillChainBarProps) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-obsidian-700 bg-obsidian-900/50 overflow-x-auto">
      <span className="text-[10px] text-slate-600 uppercase tracking-wider mr-2 whitespace-nowrap">MITRE ATLAS Kill-Chain</span>
      {KILL_CHAIN.map((stage: KillChainStage, i: number) => {
        const Icon = ICON_MAP[stage.icon] || Search;
        const reached = i < progress;
        const isBreached = reached && !patched;
        const isBlocked = reached && patched;
        const isActive = i === progress - 1;

        return (
          <div key={stage.id} className="flex items-center gap-1 whitespace-nowrap">
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-semibold transition-all ${
                isBreached
                  ? 'bg-crimson-600/15 border-crimson-600/40 text-crimson-400'
                  : isBlocked
                    ? 'bg-emerald-600/15 border-emerald-600/40 text-emerald-400'
                    : 'bg-obsidian-800 border-obsidian-700 text-slate-600'
              } ${isActive && isBreached ? 'animate-glow-crimson' : ''}`}
              title={stage.detail}
            >
              <Icon size={11} />
              <span className="hidden sm:inline">{stage.name}</span>
            </div>
            {i < KILL_CHAIN.length - 1 && (
              <div className={`w-4 h-px ${isBreached ? 'bg-crimson-600/40' : isBlocked ? 'bg-emerald-600/40' : 'bg-obsidian-700'}`} />
            )}
          </div>
        );
      })}
      <div className="ml-auto shrink-0">
        {patched ? (
          <span className="badge-emerald">FULL CHAIN BLOCKED</span>
        ) : progress > 0 ? (
          <span className="badge-crimson">CHAIN BREACHED ({progress}/5)</span>
        ) : (
          <span className="badge-slate">IDLE</span>
        )}
      </div>
    </div>
  );
}
