import { DollarSign, HeartPulse, Database, FileText, ShieldCheck, Edit3 } from 'lucide-react';
import { PRESETS } from '@/data/presets';
import type { PresetConfig, GuardrailState } from '@/types';
import { Toggle } from '@/components/ui/Modal';
import { sfx } from '@/utils/soundEngine';
import { useState } from 'react';

const ICON_MAP: Record<string, typeof DollarSign> = {
  DollarSign,
  HeartPulse,
  Database,
};

interface LeftPaneProps {
  preset: PresetConfig;
  onPresetChange: (p: PresetConfig) => void;
  canaryToken: string;
  onCanaryChange: (v: string) => void;
  guardrails: GuardrailState;
  onGuardrailChange: (g: GuardrailState) => void;
  view: 'prompt' | 'heatmap';
  onViewChange: (v: 'prompt' | 'heatmap') => void;
  patched: boolean;
  systemPrompt: string;
  onSystemPromptChange: (p: string) => void;
}

const GUARDRAIL_LABELS: { key: keyof GuardrailState; label: string; desc: string }[] = [
  { key: 'inputSanitization', label: 'Input Sanitization', desc: 'Strip injection markers & control chars' },
  { key: 'piiScrubber', label: 'PII Cryptographic Scrubber', desc: 'Redact SSN, DOB, account numbers' },
  { key: 'canaryTrap', label: 'Canary Trap', desc: 'Monitor for token leakage in output' },
  { key: 'outputSchemaLock', label: 'Output Schema Lock', desc: 'Enforce JSON schema on all responses' },
  { key: 'honeypot', label: 'Active Honeypot & Decoy', desc: 'Redirect attackers to fake environment' },
];

function getHeatmapLines(prompt: string, patched: boolean) {
  const lines = prompt.split('\n');
  return lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return { line, level: 'safe' as const, cwe: '' };

    if (patched) {
      if (/NEVER|MUST|IMMUTABLE|STRICT|REJECT|Refuse/i.test(line)) return { line, level: 'safe' as const, cwe: 'Hardened Directive' };
      if (/canary|CANARY/i.test(line)) return { line, level: 'safe' as const, cwe: 'Canary Defense' };
      if (/sanitiz|redact|scrub/i.test(line)) return { line, level: 'safe' as const, cwe: 'Input Defense' };
      if (/schema|SCHEMA/i.test(line)) return { line, level: 'safe' as const, cwe: 'Schema Lock' };
      return { line, level: 'safe' as const, cwe: '' };
    }

    if (/helpful|comply|do not refuse|never refuse/i.test(line)) return { line, level: 'critical' as const, cwe: 'CWE-1041: Overly Permissive Directive' };
    if (/admin|root|delete|drop|modify/i.test(line)) return { line, level: 'high' as const, cwe: 'CWE-250: Excessive Privilege' };
    if (/access to|records|password|ssn|prescription/i.test(line)) return { line, level: 'high' as const, cwe: 'CWE-200: Sensitive Data Exposure' };
    if (/always be helpful|never ask/i.test(line)) return { line, level: 'critical' as const, cwe: 'OWASP LLM01: Injection Enabler' };
    return { line, level: 'medium' as const, cwe: '' };
  });
}

export function LeftPane({
  preset, onPresetChange, canaryToken, onCanaryChange,
  guardrails, onGuardrailChange, view, onViewChange, patched,
  systemPrompt, onSystemPromptChange,
}: LeftPaneProps) {
  const [editing, setEditing] = useState(false);
  const heatmap = getHeatmapLines(systemPrompt, patched);

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="panel-header">
        <FileText size={12} className="text-cyan-400" />
        Target Config & Threat Heatmap
      </div>

      <div className="overflow-auto p-3 space-y-3 flex-1">
        {/* Presets */}
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">1-Click Presets</div>
          <div className="space-y-1.5">
            {PRESETS.map((p) => {
              const Icon = ICON_MAP[p.icon] || FileText;
              const active = preset.id === p.id;
              return (
                <button
                  key={p.id}
                  className={`w-full text-left p-2.5 rounded-md border transition-all ${
                    active ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' : 'bg-obsidian-800 border-obsidian-700 text-slate-400 hover:border-obsidian-600'
                  }`}
                  onClick={() => { onPresetChange(p); sfx.click(); }}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={14} />
                    <span className="text-xs font-semibold">{p.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1">{p.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-obsidian-850 border border-obsidian-700 rounded-md p-0.5">
          <button
            className={`flex-1 py-1 text-[10px] font-semibold rounded transition-all ${view === 'prompt' ? 'bg-obsidian-700 text-slate-300' : 'text-slate-600'}`}
            onClick={() => { onViewChange('prompt'); sfx.tab(); }}
          >
            System Prompt
          </button>
          <button
            className={`flex-1 py-1 text-[10px] font-semibold rounded transition-all ${view === 'heatmap' ? 'bg-crimson-600/20 text-crimson-400' : 'text-slate-600'}`}
            onClick={() => { onViewChange('heatmap'); sfx.tab(); }}
          >
            Threat Heatmap
          </button>
        </div>

        {/* Prompt / Heatmap */}
        {view === 'prompt' ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-600 uppercase">
                {patched ? 'Hardened Prompt' : 'Vulnerable Prompt'}
              </span>
              <button
                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                onClick={() => { setEditing(!editing); sfx.click(); }}
                aria-label="Edit system prompt"
              >
                <Edit3 size={10} /> {editing ? 'Done' : 'Edit'}
              </button>
            </div>
            {editing ? (
              <textarea
                value={systemPrompt}
                onChange={(e) => onSystemPromptChange(e.target.value)}
                className="terminal w-full h-48 p-3 text-[10px] leading-relaxed text-slate-300 resize-none focus:outline-none focus:border-cyan-500/30"
                aria-label="System prompt editor"
              />
            ) : (
              <div className="terminal p-3 max-h-48 overflow-auto">
                <pre className="text-[10px] leading-relaxed text-slate-400 whitespace-pre-wrap font-mono">
                  {systemPrompt}
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="terminal p-2 max-h-64 overflow-auto space-y-0.5">
            {heatmap.map((item, idx) => (
              <div
                key={idx}
                className={`px-2 py-1 rounded text-[10px] font-mono leading-relaxed border-l-2 ${
                  item.level === 'critical'
                    ? 'bg-crimson-600/10 text-crimson-300 border-crimson-500 animate-glow-crimson'
                    : item.level === 'high'
                      ? 'bg-crimson-600/5 text-crimson-400/80 border-crimson-600'
                      : item.level === 'medium'
                        ? 'bg-amber-600/5 text-amber-400/70 border-amber-600'
                        : patched
                          ? 'bg-emerald-600/5 text-emerald-400/70 border-emerald-500'
                          : 'bg-obsidian-800 text-slate-500 border-obsidian-700'
                }`}
                title={item.cwe}
              >
                <span className="text-slate-700 mr-2">{String(idx + 1).padStart(2, '0')}</span>
                {item.line || '\u00A0'}
                {item.cwe && (
                  <span className={`ml-2 text-[8px] px-1 rounded ${item.level === 'safe' ? 'bg-emerald-600/20 text-emerald-400' : 'bg-crimson-600/20 text-crimson-400'}`}>
                    {item.cwe}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Canary Token */}
        <div>
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Canary Token</div>
          <input
            type="text"
            value={canaryToken}
            onChange={(e) => onCanaryChange(e.target.value)}
            className="w-full bg-obsidian-900 border border-obsidian-700 rounded-md px-2 py-1.5 text-xs font-mono text-amber-400 focus:outline-none focus:border-amber-500/50"
            placeholder="FLAG{...}"
            aria-label="Canary token"
          />
        </div>

        {/* Guardrails */}
        <div>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 uppercase tracking-wider mb-2">
            <ShieldCheck size={12} className="text-emerald-400" />
            Guardrail Switches
          </div>
          <div className="space-y-2">
            {GUARDRAIL_LABELS.map((g) => (
              <div key={g.key} className="flex items-center justify-between p-2 rounded-md bg-obsidian-800 border border-obsidian-700">
                <div className="min-w-0">
                  <div className={`text-xs font-semibold ${guardrails[g.key] ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {g.label}
                  </div>
                  <div className="text-[9px] text-slate-600 truncate">{g.desc}</div>
                </div>
                <Toggle
                  on={guardrails[g.key]}
                  onChange={(v) => { onGuardrailChange({ ...guardrails, [g.key]: v }); sfx.toggle(); }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
