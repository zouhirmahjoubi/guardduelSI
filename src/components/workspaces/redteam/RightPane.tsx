import { useState } from 'react';
import { Shield, Activity, Radar, Sparkles, Lock, GitCompare, Play, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar as RechartsRadar, ResponsiveContainer } from 'recharts';
import { OWPAS_RADAR_DATA } from '@/data/attackSim';
import { AnimatedCounter } from '@/components/ui/Modal';
import { sfx } from '@/utils/soundEngine';
import type { RunRecord, PatchProposal } from '@/types';

interface RightPaneProps {
  patched: boolean;
  resilienceScore: number;
  systemPrompt: string;
  onApplyPatch: () => void;
  patchAnimating: boolean;
  currentRun: RunRecord | null;
  baselineRun: RunRecord | null;
  retestRun: RunRecord | null;
  onRunTests: () => void;
  onProposePatch: () => void;
  patchProposal: PatchProposal | null;
  isRunning: boolean;
}

type ViewMode = 'radar' | 'metrics';

export function RightPane({
  patched, resilienceScore, systemPrompt, onApplyPatch, patchAnimating,
  currentRun, baselineRun, retestRun, onRunTests, onProposePatch, patchProposal, isRunning,
}: RightPaneProps) {
  const [view, setView] = useState<ViewMode>('radar');
  const [diffOpen, setDiffOpen] = useState(false);

  const radarData = OWPAS_RADAR_DATA.map((d) => ({
    category: d.category.split(':')[0],
    Pre: d.pre,
    Post: d.post,
  }));

  const oldLines = patchProposal ? patchProposal.beforePrompt.split('\n') : systemPrompt.split('\n');
  const newLines = patchProposal ? patchProposal.afterPrompt.split('\n') : systemPrompt.split('\n');

  const hasFailures = currentRun?.results.some((r) => r.outcome === 'breach') ?? false;

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
                cx="60" cy="60" r="50" fill="none"
                stroke={patched ? '#10B981' : '#EF4444'}
                strokeWidth="8" strokeLinecap="round"
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
                {patched ? 'HARDENED' : currentRun ? 'ASSESSED' : 'NO RUN'}
              </div>
            </div>
          </div>
          {currentRun && (
            <div className="text-[9px] text-slate-600 mt-2 text-center">
              Calculated from {currentRun.metrics.attacks} attacks, {currentRun.metrics.benign} benign tests
            </div>
          )}
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-obsidian-850 border border-obsidian-700 rounded-md p-0.5">
          <button
            className={`flex-1 py-1 text-[10px] font-semibold rounded transition-all flex items-center justify-center gap-1 ${view === 'radar' ? 'bg-obsidian-700 text-cyan-400' : 'text-slate-600'}`}
            onClick={() => { setView('radar'); sfx.tab(); }}
          >
            <Radar size={10} /> OWASP Radar
          </button>
          <button
            className={`flex-1 py-1 text-[10px] font-semibold rounded transition-all flex items-center justify-center gap-1 ${view === 'metrics' ? 'bg-obsidian-700 text-cyan-400' : 'text-slate-600'}`}
            onClick={() => { setView('metrics'); sfx.tab(); }}
          >
            <BarChart3 size={10} /> Metrics
          </button>
        </div>

        {view === 'radar' ? (
          <div className="panel p-2">
            <div className="text-[8px] text-slate-600 text-center mb-1">Illustrative reference — not measured data</div>
            <ResponsiveContainer width="100%" height={180}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1A2236" />
                <PolarAngleAxis dataKey="category" tick={{ fill: '#64748B', fontSize: 7 }} />
                <PolarRadiusAxis domain={[0, 100]} tick={{ fill: '#475569', fontSize: 7 }} stroke="#1A2236" />
                <RechartsRadar name="Pre-Patch" dataKey="Pre" stroke="#EF4444" fill="#EF4444" fillOpacity={0.2} strokeWidth={1.5} />
                {patched && <RechartsRadar name="Post-Patch" dataKey="Post" stroke="#10B981" fill="#10B981" fillOpacity={0.2} strokeWidth={1.5} />}
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
          <div className="panel p-3 space-y-2">
            {currentRun ? (
              <>
                <div className="text-[10px] text-slate-500 uppercase mb-1">Current Run Metrics</div>
                <div className="grid grid-cols-2 gap-2 text-[10px]">
                  <div className="flex justify-between"><span className="text-slate-500">Total:</span><span className="text-slate-300">{currentRun.metrics.total}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Attacks:</span><span className="text-slate-300">{currentRun.metrics.attacks}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Breaches:</span><span className="text-crimson-400">{currentRun.metrics.breaches}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Blocked:</span><span className="text-emerald-400">{currentRun.metrics.blocked}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Decoys:</span><span className="text-amber-400">{currentRun.metrics.decoys}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Errors:</span><span className="text-slate-400">{currentRun.metrics.errors}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Not assessed:</span><span className="text-slate-400">{currentRun.metrics.notAssessed}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">False positives:</span><span className="text-amber-400">{currentRun.metrics.falsePositives}</span></div>
                </div>
                <div className="border-t border-obsidian-700 pt-2 mt-2">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-slate-500">Attack success rate:</span>
                    <span className={currentRun.metrics.attackSuccessRate > 0 ? 'text-crimson-400 font-bold' : 'text-emerald-400 font-bold'}>
                      {currentRun.metrics.attackSuccessRate}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[10px] mt-1">
                    <span className="text-slate-500">Benign false positive rate:</span>
                    <span className="text-slate-300">{currentRun.metrics.benignFalsePositiveRate}%</span>
                  </div>
                </div>
                {baselineRun && retestRun && (
                  <div className="border-t border-obsidian-700 pt-2 mt-2">
                    <div className="text-[9px] text-slate-600 uppercase mb-1">Baseline vs Retest</div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <div className="text-slate-500">Baseline breaches:</div>
                        <div className="text-crimson-400 font-bold">{baselineRun.metrics.breaches}</div>
                      </div>
                      <div>
                        <div className="text-slate-500">Retest breaches:</div>
                        <div className={retestRun.metrics.breaches === 0 ? 'text-emerald-400 font-bold' : 'text-crimson-400 font-bold'}>
                          {retestRun.metrics.breaches}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-slate-600 text-xs py-4">
                No run data yet. Click "Run Tests" to generate metrics.
              </div>
            )}
          </div>
        )}

        {/* Run Tests button */}
        <button
          className="w-full btn-cyan flex items-center justify-center gap-2 py-2"
          onClick={() => { onRunTests(); sfx.chirp(); }}
          disabled={isRunning}
        >
          <Play size={14} />
          {isRunning ? 'Running Tests…' : 'Run Baseline Tests'}
        </button>

        {/* Auto-Patch Button */}
        {!patched && hasFailures && (
          <button
            className="w-full btn-emerald flex items-center justify-center gap-2 py-2.5"
            onClick={() => { onProposePatch(); setDiffOpen(true); sfx.chirp(); }}
            id="auto-patch"
          >
            <Sparkles size={14} />
            <span className="font-bold">Auto-Harden System Prompt</span>
          </button>
        )}

        {patched && (
          <div className="panel p-3 border-emerald-600/30">
            <div className="flex items-center gap-2 text-emerald-400">
              <Lock size={14} />
              <span className="text-xs font-bold">Prompt Hardened</span>
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {retestRun ? `${retestRun.metrics.breaches} remaining breach(es) after retest` : 'Retest pending'}
            </div>
            <button
              className="btn-cyan w-full mt-2 flex items-center justify-center gap-1"
              onClick={() => { onRunTests(); sfx.chirp(); }}
              disabled={isRunning}
            >
              <Play size={11} /> Re-Test
            </button>
          </div>
        )}
      </div>

      {/* Diff Viewer Modal */}
      <AnimatePresence>
        {diffOpen && patchProposal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-obsidian-950/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setDiffOpen(false)}
            role="dialog"
            aria-label="Patch diff viewer"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="panel max-w-5xl w-full max-h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="panel-header justify-between shrink-0">
                <div className="flex items-center gap-2 text-emerald-400">
                  <GitCompare size={14} />
                  Side-by-Side Diff Viewer — Before vs After Hardening
                </div>
                <button onClick={() => setDiffOpen(false)} className="text-slate-500 hover:text-slate-300" aria-label="Close">✕</button>
              </div>
              <div className="flex-1 overflow-auto p-3">
                <div className="text-[10px] text-slate-500 mb-2">
                  <span className="text-amber-400">Addresses:</span> {patchProposal.failureAddressed}
                </div>
                <div className="text-[10px] text-slate-400 mb-3">
                  {patchProposal.explanation}
                </div>
                <div className="grid grid-cols-2 gap-3 h-[300px]">
                  <div className="terminal p-3 overflow-auto">
                    <div className="text-[10px] text-crimson-400 uppercase mb-2 border-b border-crimson-600/20 pb-1">VULNERABLE (Before)</div>
                    {oldLines.map((line, i) => (
                      <div key={i} className="text-[10px] font-mono leading-relaxed diff-line-del px-1">
                        <span className="text-slate-700 mr-1">-</span>{line || '\u00A0'}
                      </div>
                    ))}
                  </div>
                  <div className="terminal p-3 overflow-auto relative">
                    <div className="text-[10px] text-emerald-400 uppercase mb-2 border-b border-emerald-600/20 pb-1">HARDENED (After)</div>
                    {patchAnimating && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-b from-transparent via-emerald-500/10 to-transparent pointer-events-none"
                        initial={{ y: '-100%' }} animate={{ y: '100%' }} transition={{ duration: 0.8, repeat: Infinity }}
                      />
                    )}
                    {newLines.map((line, i) => (
                      <div key={i} className="text-[10px] font-mono leading-relaxed diff-line-add px-1">
                        <span className="text-slate-700 mr-1">+</span>{line || '\u00A0'}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t border-obsidian-700 p-3 flex items-center justify-between shrink-0">
                <div className="text-[10px] text-slate-500">
                  {patchAnimating ? 'Applying hardening…' : 'Review changes, then apply and re-test.'}
                </div>
                <button
                  className={`btn-emerald flex items-center gap-1 ${patchAnimating ? 'opacity-50 pointer-events-none' : ''}`}
                  onClick={() => { onApplyPatch(); setTimeout(() => setDiffOpen(false), 1500); }}
                >
                  <Shield size={12} />
                  {patchAnimating ? 'Patching…' : 'Apply Patch & Re-Test'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
