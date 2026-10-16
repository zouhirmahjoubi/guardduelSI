import { useState, useEffect, useRef } from 'react';
import { Shield, Activity, Radar, Sparkles, Lock, GitCompare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar, ResponsiveContainer } from 'recharts';
import { OWPAS_RADAR_DATA, CIA_TRIAD_DATA } from '@/data/attackSim';
import { HARDENED_PROMPT } from '@/data/presets';
import { AnimatedCounter } from '@/components/ui/Modal';
import { sfx } from '@/utils/soundEngine';

interface RightPaneProps {
  patched: boolean;
  resilienceScore: number;
  systemPrompt: string;
  onApplyPatch: () => void;
  patchAnimating: boolean;
}

type ViewMode = 'radar' | 'latent';

export function RightPane({ patched, resilienceScore, systemPrompt, onApplyPatch, patchAnimating }: RightPaneProps) {
  const [view, setView] = useState<ViewMode>('radar');
  const [diffOpen, setDiffOpen] = useState(false);
  const [latentData] = useState(() => {
    // Generate deterministic 2D cluster points
    const normal: { x: number; y: number; label: string }[] = [];
    const anomalous: { x: number; y: number; label: string }[] = [];
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const r = 20 + Math.random() * 10;
      normal.push({ x: 50 + Math.cos(angle) * r, y: 50 + Math.sin(angle) * r, label: 'normal' });
    }
    for (let i = 0; i < 12; i++) {
      anomalous.push({
        x: 50 + (Math.random() - 0.5) * 80,
        y: 50 + (Math.random() - 0.5) * 80,
        label: 'anomaly',
      });
    }
    return { normal, anomalous };
  });

  const radarData = OWPAS_RADAR_DATA.map((d) => ({
    category: d.category.split(':')[0],
    Pre: d.pre,
    Post: d.post,
  }));

  // Generate diff lines
  const oldLines = systemPrompt.split('\n');
  const newLines = HARDENED_PROMPT.split('\n');

  return (
    <div className="panel flex flex-col h-full overflow-hidden">
      <div className="panel-header">
        <Activity size={12} className="text-cyan-400" />
        Resilience Gauge & Auto-Patch
      </div>

      <div className="overflow-auto p-3 space-y-3 flex-1">
        {/* Resilience Score Gauge */}
        <div className="panel p-4 flex flex-col items-center">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Resilience Score</div>
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#1A2236" strokeWidth="8" />
              <motion.circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke={patched ? '#10B981' : '#EF4444'}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 50}
                initial={{ strokeDashoffset: 2 * Math.PI * 50 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 50 * (1 - resilienceScore / 100) }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                style={{ filter: `drop-shadow(0 0 6px ${patched ? 'rgba(16,185,129,0.6)' : 'rgba(239,68,68,0.6)'})` }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <AnimatedCounter
                value={resilienceScore}
                suffix="%"
                className={`text-2xl font-bold ${patched ? 'text-emerald-400' : 'text-crimson-400'}`}
              />
              <div className={`text-[8px] uppercase ${patched ? 'text-emerald-500' : 'text-crimson-500'}`}>
                {patched ? 'HARDENED' : 'VULNERABLE'}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 w-full mt-3">
            {CIA_TRIAD_DATA.map((c) => (
              <div key={c.axis} className="text-center">
                <div className="text-[8px] text-slate-600 uppercase">{c.axis.slice(0, 4)}</div>
                <div className={`text-sm font-bold ${patched ? 'text-emerald-400' : 'text-crimson-400'}`}>
                  {patched ? c.post : c.pre}%
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* View toggle: Radar / Latent */}
        <div className="flex items-center gap-1 bg-obsidian-850 border border-obsidian-700 rounded-md p-0.5">
          <button
            className={`flex-1 py-1 text-[10px] font-semibold rounded transition-all flex items-center justify-center gap-1 ${
              view === 'radar' ? 'bg-obsidian-700 text-cyan-400' : 'text-slate-600'
            }`}
            onClick={() => { setView('radar'); sfx.tab(); }}
          >
            <Radar size={10} /> OWASP Radar
          </button>
          <button
            className={`flex-1 py-1 text-[10px] font-semibold rounded transition-all flex items-center justify-center gap-1 ${
              view === 'latent' ? 'bg-obsidian-700 text-cyan-400' : 'text-slate-600'
            }`}
            onClick={() => { setView('latent'); sfx.tab(); }}
          >
            <Activity size={10} /> Latent Cluster
          </button>
        </div>

        {/* Radar / Latent view */}
        {view === 'radar' ? (
          <div className="panel p-2">
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1A2236" />
                <PolarAngleAxis dataKey="category" tick={{ fill: '#64748B', fontSize: 7 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 7 }} stroke="#1A2236" />
                <RechartsRadar name="Pre-Patch" dataKey="Pre" stroke="#EF4444" fill="#EF4444" fillOpacity={0.2} strokeWidth={1.5} />
                {patched && (
                  <RechartsRadar name="Post-Patch" dataKey="Post" stroke="#10B981" fill="#10B981" fillOpacity={0.2} strokeWidth={1.5} />
                )}
              </RadarChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-[8px] text-slate-500">
                <div className="w-2 h-2 rounded-full bg-crimson-500" /> Pre-Patch Risk
              </span>
              {patched && (
                <span className="flex items-center gap-1 text-[8px] text-slate-500">
                  <div className="w-2 h-2 rounded-full bg-emerald-500" /> Post-Patch Risk
                </span>
              )}
            </div>
          </div>
        ) : (
          <div className="panel p-2 relative h-[220px]">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              {/* Grid */}
              {[20, 40, 60, 80].map((v) => (
                <g key={v}>
                  <line x1={v} y1="0" x2={v} y2="100" stroke="#1A2236" strokeWidth="0.2" />
                  <line x1="0" y1={v} x2="100" y2={v} stroke="#1A2236" strokeWidth="0.2" />
                </g>
              ))}
              {/* Normal cluster */}
              {latentData.normal.map((p, i) => (
                <circle key={`n${i}`} cx={p.x} cy={p.y} r="1" fill="#06B6D4" opacity="0.4" />
              ))}
              {/* Anomalous points */}
              {latentData.anomalous.map((p, i) => (
                <motion.circle
                  key={`a${i}`}
                  cx={p.x}
                  cy={p.y}
                  r="1.5"
                  fill={patched ? '#10B981' : '#EF4444'}
                  opacity={0.7}
                  initial={{ scale: 0 }}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
              {/* Center label */}
              <text x="50" y="52" textAnchor="middle" fill="#475569" fontSize="3">Embedding Space</text>
            </svg>
            <div className="absolute bottom-1 left-2 flex gap-3">
              <span className="flex items-center gap-1 text-[8px] text-slate-500">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" /> Normal Inputs
              </span>
              <span className={`flex items-center gap-1 text-[8px] text-slate-500`}>
                <div className={`w-1.5 h-1.5 rounded-full ${patched ? 'bg-emerald-500' : 'bg-crimson-500'}`} />
                {patched ? 'Quarantined' : 'Detected Anomalies'}
              </span>
            </div>
          </div>
        )}

        {/* Auto-Patch Button */}
        {!patched && (
          <button
            className="w-full btn-emerald flex items-center justify-center gap-2 py-2.5 relative overflow-hidden"
            onClick={() => { setDiffOpen(true); sfx.chirp(); }}
          >
            <Sparkles size={14} />
            <span className="font-bold">Auto-Harden System Prompt</span>
          </button>
        )}

        {patched && (
          <div className="panel p-3 border-emerald-600/30">
            <div className="flex items-center gap-2 text-emerald-400">
              <Lock size={14} />
              <span className="text-xs font-bold">Prompt Hardened — All Attacks Deflected</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              5 guardrails active | Canary trap armed | Honeypot decoy operational
            </div>
          </div>
        )}
      </div>

      {/* Diff Viewer Modal */}
      <AnimatePresence>
        {diffOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setDiffOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="panel max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="panel-header justify-between shrink-0">
                <div className="flex items-center gap-2 text-emerald-400">
                  <GitCompare size={14} />
                  Side-by-Side Diff Viewer — Before vs After Hardening
                </div>
                <button onClick={() => setDiffOpen(false)} className="text-slate-500 hover:text-slate-300">✕</button>
              </div>
              <div className="flex-1 overflow-auto p-3">
                <div className="grid grid-cols-2 gap-3 h-full">
                  {/* Before */}
                  <div className="terminal p-3 overflow-auto">
                    <div className="text-[10px] text-crimson-400 uppercase mb-2 border-b border-crimson-600/20 pb-1">
                      VULNERABLE (Pre-Patch)
                    </div>
                    {oldLines.map((line, i) => (
                      <div key={i} className="text-[10px] font-mono leading-relaxed diff-line-del px-1">
                        <span className="text-slate-700 mr-1">-</span>
                        {line || '\u00A0'}
                      </div>
                    ))}
                  </div>
                  {/* After */}
                  <div className="terminal p-3 overflow-auto relative">
                    <div className="text-[10px] text-emerald-400 uppercase mb-2 border-b border-emerald-600/20 pb-1">
                      HARDENED (Post-Patch)
                    </div>
                    {patchAnimating && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/10 to-transparent pointer-events-none"
                        initial={{ y: '-100%' }}
                        animate={{ y: '100%' }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    )}
                    {newLines.map((line, i) => (
                      <div key={i} className="text-[10px] font-mono leading-relaxed diff-line-add px-1">
                        <span className="text-slate-700 mr-1">+</span>
                        {line || '\u00A0'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t border-obsidian-700 p-3 flex items-center justify-between shrink-0">
                <div className="text-[10px] text-slate-500">
                  {patchAnimating ? 'Applying hardening wave...' : 'Review changes, then apply and re-test all attacks.'}
                </div>
                <button
                  className={`btn-emerald flex items-center gap-1 ${patchAnimating ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => { onApplyPatch(); setTimeout(() => setDiffOpen(false), 1500); }}
                >
                  <Shield size={12} />
                  {patchAnimating ? 'Patching...' : 'Apply Patch & Re-Test'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
