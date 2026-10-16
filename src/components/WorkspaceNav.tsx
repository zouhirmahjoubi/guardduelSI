import { Brain, Globe, Cpu, TerminalSquare, Atom, BookOpen, Network, Cloud } from 'lucide-react';
import type { WorkspaceId } from '@/types';
import { sfx } from '@/utils/soundEngine';

interface WorkspaceNavProps {
  active: WorkspaceId;
  onSelect: (id: WorkspaceId) => void;
}

const WORKSPACES: { id: WorkspaceId; label: string; icon: typeof Brain; short: string }[] = [
  { id: 'redteam', label: 'LLM Red-Teaming & AI Firewall', icon: Brain, short: 'Red-Team' },
  { id: 'osint', label: 'OSINT & Web Exploit Lab', icon: Globe, short: 'OSINT' },
  { id: 'memory', label: 'Memory & Buffer Overflow Lab', icon: Cpu, short: 'Memory' },
  { id: 'privesc', label: 'Privilege Escalation Arena', icon: TerminalSquare, short: 'PrivEsc' },
  { id: 'crypto', label: 'Quantum Cryptology Workbench', icon: Atom, short: 'Crypto' },
  { id: 'vault', label: 'Knowledge Vault & Notebook', icon: BookOpen, short: 'Vault' },
  { id: 'activedir', label: 'Active Directory & Kerberos Arena', icon: Network, short: 'AD' },
  { id: 'supplychain', label: 'AI Supply-Chain & Deepfake Forensics', icon: Cloud, short: 'Supply' },
];

export function WorkspaceNav({ active, onSelect }: WorkspaceNavProps) {
  return (
    <div className="border-b border-obsidian-700 bg-obsidian-900/80 shrink-0">
      <div className="flex items-center gap-1 px-3 h-10 overflow-x-auto">
        {WORKSPACES.map((ws) => {
          const Icon = ws.icon;
          const isActive = active === ws.id;
          return (
            <button
              key={ws.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all whitespace-nowrap border ${
                isActive
                  ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                  : 'text-slate-500 border-transparent hover:text-slate-300 hover:bg-obsidian-800'
              }`}
              onClick={() => {
                onSelect(ws.id);
                sfx.tab();
              }}
            >
              <Icon size={14} />
              <span className="hidden md:inline">{ws.label}</span>
              <span className="md:hidden">{ws.short}</span>
              {isActive && <span className="ml-1 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
