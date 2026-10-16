import { useState, useEffect, useCallback } from 'react';
import { Shield, Zap, Target, FileText, Volume2, VolumeX, Sparkles, KeyRound, Download, Swords, Flag, Trophy, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { sfx, setSfxEnabled, isSfxEnabled } from '@/utils/soundEngine';
import { sha256, downloadFile } from '@/utils/downloads';
import { Modal } from './ui/Modal';
import { exportGuardrailFile, exportReportFiles, type ExportConfig } from '@/utils/exports';
import { BRAND } from '@/data/brand';
import { motion } from 'framer-motion';
import type { ExecutionMode, ConnectionState, RunRecord, TestResult } from '@/types';

interface CommandBarProps {
  onJudgeTour: () => void;
  motionReduced: boolean;
  onMotionToggle: () => void;
  ctfCount?: number;
  ctfTotal?: number;
  onPurpleTeam?: () => void;
  ctfBadgeOpen?: boolean;
  onCloseCtfBadge?: () => void;
  onResetCtf?: () => void;
  mode: ExecutionMode;
  onModeChange: (m: ExecutionMode) => void;
  connection: ConnectionState;
  onCheckConnection: () => void;
  exportConfig?: ExportConfig | null;
  currentRun?: RunRecord | null;
  adhocResults?: TestResult[];
}

export function CommandBar({
  onJudgeTour, motionReduced, onMotionToggle,
  ctfCount = 0, ctfTotal = 5, onPurpleTeam,
  ctfBadgeOpen = false, onCloseCtfBadge, onResetCtf,
  mode, onModeChange, connection, onCheckConnection,
  exportConfig = null, currentRun = null, adhocResults = [],
}: CommandBarProps) {
  const [sfxOn, setSfxOn] = useState(isSfxEnabled());
  const [configHash, setConfigHash] = useState('');
  const [apiModal, setApiModal] = useState(false);
  const [guardrailModal, setGuardrailModal] = useState(false);
  const [complianceModal, setComplianceModal] = useState(false);

  useEffect(() => {
    const updateHash = async () => {
      const h = await sha256('guardduelSI-config-v1');
      setConfigHash(h.slice(0, 12));
    };
    updateHash();
  }, []);

  const toggleSfx = useCallback(() => {
    const newVal = !sfxOn;
    setSfxEnabled(newVal);
    setSfxOn(newVal);
    if (newVal) sfx.toggle();
  }, [sfxOn]);

  const handleModeSwitch = (m: ExecutionMode) => {
    if (m === 'live') {
      setApiModal(true);
    } else {
      onModeChange(m);
      sfx.tab();
    }
  };

  const handleGuardrails = () => {
    setGuardrailModal(true);
    sfx.chirp();
  };

  const handleCompliance = () => {
    setComplianceModal(true);
    sfx.chirp();
  };

  const connectionStatusColor = connection.status === 'connected' ? 'text-emerald-400' : connection.status === 'error' ? 'text-crimson-400' : 'text-slate-500';
  const connectionStatusLabel = connection.status === 'connected' ? 'Live: Connected' : connection.status === 'checking' ? 'Live: Checking...' : connection.status === 'error' ? 'Live: Error' : 'Live: Not configured';

  return (
    <>
      <div className="border-b border-obsidian-700 bg-obsidian-950/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 px-4 h-12">
          <div className="flex items-center gap-2 shrink-0" id="brand">
            <Shield className="text-cyan-400" size={20} aria-label="guardduelSI shield logo" />
            <span className="text-sm font-bold text-slate-200 tracking-tight">
              {BRAND.displayName}<span className="text-cyan-400"> //</span> <span className="text-xs font-normal text-slate-500">SecOps & Red-Team Command</span>
            </span>
          </div>

          <div className="w-px h-5 bg-obsidian-700" />

          <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1" title="SHA-256 digest of current configuration">
              {configHash && <span>{configHash.slice(0, 8)}…</span>}
            </span>
            <span className={connectionStatusColor} title={connection.message || connectionStatusLabel}>
              <Zap size={11} />
              {connectionStatusLabel}
            </span>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1 bg-obsidian-850 border border-obsidian-700 rounded-md p-0.5" role="group" aria-label="Execution mode">
            <button
              className={`px-2 py-1 text-[10px] font-semibold rounded transition-all ${mode === 'simulation' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => handleModeSwitch('simulation')}
              aria-pressed={mode === 'simulation'}
            >
              Simulation
            </button>
            <button
              className={`px-2 py-1 text-[10px] font-semibold rounded transition-all flex items-center gap-1 ${mode === 'live' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
              onClick={() => handleModeSwitch('live')}
              aria-pressed={mode === 'live'}
            >
              <KeyRound size={10} />
              Live API
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-600/10 border border-amber-600/20 text-amber-400 text-[10px] font-bold" title="Challenge-completion achievements — not professional certification">
            <Flag size={11} aria-hidden="true" />
            <span>CTF: {ctfCount}/{ctfTotal}</span>
          </div>

          {onPurpleTeam && (
            <button className="btn-crimson flex items-center gap-1" onClick={() => { onPurpleTeam(); sfx.chirp(); }} title="Scripted Purple-Team demo sequence">
              <Swords size={12} aria-hidden="true" />
              <span className="hidden lg:inline">Purple-Team Duel</span>
            </button>
          )}

          <button className="btn-cyan flex items-center gap-1" onClick={onJudgeTour} id="judge-tour-btn">
            <Target size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Judge Tour</span>
          </button>
          <button className="btn-emerald flex items-center gap-1" onClick={handleGuardrails} id="deploy-btn" title="Export guardrail SDK and CI/CD configurations">
            <Download size={12} aria-hidden="true" />
            <span className="hidden md:inline">Deploy Guardrails</span>
          </button>
          <button className="btn-tactical flex items-center gap-1" onClick={handleCompliance} title="Generate audit report from session evidence">
            <FileText size={12} aria-hidden="true" />
            <span className="hidden md:inline">Audit Report</span>
          </button>

          <button className="btn-tactical flex items-center gap-1" onClick={toggleSfx} aria-label={sfxOn ? 'Mute sound effects' : 'Unmute sound effects'} aria-pressed={sfxOn}>
            {sfxOn ? <Volume2 size={12} className="text-emerald-400" /> : <VolumeX size={12} />}
            <span className="hidden sm:inline">{sfxOn ? 'SFX: ON' : 'SFX: MUTE'}</span>
          </button>

          <button className="btn-tactical flex items-center gap-1" onClick={onMotionToggle} aria-label={motionReduced ? 'Enable animations' : 'Reduce animations'} aria-pressed={motionReduced}>
            <Sparkles size={12} className={motionReduced ? 'text-slate-600' : 'text-cyan-400'} />
            <span className="hidden sm:inline">{motionReduced ? 'Motion: REDUCED' : 'Motion: FULL'}</span>
          </button>
        </div>
      </div>

      {/* Live API Configuration Modal */}
      <Modal open={apiModal} onClose={() => setApiModal(false)} title="Live API Mode — Server-Side Configuration" icon={<KeyRound size={14} />}>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            {connection.status === 'connected' ? (
              <><CheckCircle2 size={16} className="text-emerald-400" /><span className="text-emerald-400">Provider connected: {connection.provider} / {connection.model}</span></>
            ) : connection.status === 'error' ? (
              <><AlertCircle size={16} className="text-crimson-400" /><span className="text-crimson-400">Connection error: {connection.message}</span></>
            ) : connection.status === 'checking' ? (
              <><Zap size={16} className="text-cyan-400 animate-pulse" /><span className="text-cyan-400">Checking provider connection…</span></>
            ) : (
              <><AlertCircle size={16} className="text-slate-500" /><span className="text-slate-400">No provider configured. API credentials are stored as server-side secrets, never in the browser.</span></>
            )}
          </div>

          <div className="panel p-3 space-y-2">
            <div className="text-xs text-slate-500 uppercase tracking-wider">How to enable Live mode</div>
            <ol className="text-xs text-slate-400 space-y-1 list-decimal list-inside">
              <li>Set the <code className="text-cyan-400 font-mono">OPENAI_API_KEY</code> secret in your Supabase project (Edge Functions &gt; Secrets).</li>
              <li>Optionally set <code className="text-cyan-400 font-mono">OPENAI_MODEL</code> (default: gpt-4o-mini).</li>
              <li>Click "Check Connection" below — the server verifies the key with a minimal API call.</li>
            </ol>
          </div>

          <div className="panel p-3 border-amber-600/20">
            <div className="text-[10px] text-amber-400 mb-1">Security</div>
            <div className="text-[10px] text-slate-500">
              Credentials never appear in frontend bundles, browser storage, logs, or exports. The edge function proxy validates requests, enforces timeouts, and applies guardrails server-side.
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-tactical" onClick={() => setApiModal(false)}>Close</button>
            <button
              className="btn-cyan"
              onClick={() => { onCheckConnection(); }}
              disabled={connection.status === 'checking'}
            >
              {connection.status === 'checking' ? 'Checking…' : 'Check Connection'}
            </button>
            {connection.status === 'connected' && (
              <button
                className="btn-emerald"
                onClick={() => { onModeChange('live'); setApiModal(false); sfx.success(); }}
              >
                Switch to Live Mode
              </button>
            )}
          </div>
          <div className="text-[10px] text-slate-600 border-t border-obsidian-700 pt-2">
            Simulation mode runs fully offline with deterministic scenarios. No API key needed.
          </div>
        </div>
      </Modal>

      {/* Guardrail Export Modal */}
      <Modal open={guardrailModal} onClose={() => setGuardrailModal(false)} title="Deploy Guardrails — SDK & CI/CD Export" icon={<Download size={14} />} maxWidth="max-w-4xl">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Export guardrail examples for your LLM stack. Each button downloads its own distinct file with the correct format and content.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { name: 'TypeScript Middleware', file: 'guardduelsi-guardrails.ts', icon: 'TS', type: 'ts' as const },
              { name: 'Python FastAPI', file: 'guardduelsi-guardrails.py', icon: 'PY', type: 'py' as const },
              { name: 'CI/CD YAML', file: 'guardduelsi-redteam.yml', icon: 'CI', type: 'ci' as const },
              { name: 'promptfoo Config', file: 'promptfooconfig.yaml', icon: 'PF', type: 'promptfoo' as const },
              { name: 'garak Commands', file: 'garak-commands.sh', icon: 'GK', type: 'garak' as const },
              { name: 'Markdown Bundle', file: 'guardduelsi-guardrails.md', icon: 'MD', type: 'md' as const },
            ].map((item) => (
              <button
                key={item.name}
                className="panel p-3 text-left hover:border-cyan-500/40 transition-all group"
                onClick={() => { exportGuardrailFile(item.type, item.file, exportConfig); sfx.success(); }}
              >
                <div className="flex items-center gap-2">
                  <span className="badge-cyan">{item.icon}</span>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-cyan-400">{item.name}</span>
                </div>
                <div className="text-[10px] text-slate-600 mt-1 font-mono">{item.file}</div>
              </button>
            ))}
          </div>
          <div className="text-[10px] text-slate-600 border-t border-obsidian-700 pt-2">
            Examples are starting points — adapt patterns and test before production use. The TypeScript and Python middleware do not mutate the caller's message array; they inspect output before delivery.
          </div>
        </div>
      </Modal>

      {/* Audit Report Modal */}
      <Modal open={complianceModal} onClose={() => setComplianceModal(false)} title="Audit Report — Session Evidence" icon={<FileText size={14} />} maxWidth="max-w-4xl">
        <div className="space-y-4">
          <div className="panel p-3">
            <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Report Contents</div>
            <p className="text-sm text-slate-400">
              Generates a Markdown report and structured JSON from the current session's recorded test results. Includes run identifiers, execution mode, scenario, test outcomes, evidence, applied patches, and remaining failures.
            </p>
            <p className="text-[10px] text-slate-600 mt-2">
              Framework mappings (OWASP LLM Top 10, MITRE ATLAS, NIST AI RMF) are reference mappings supported by specific tests — not certifications. The NDA is an unsigned template.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-tactical" onClick={() => downloadNDA()}>Download NDA Template (.md)</button>
            <button className="btn-emerald" onClick={() => { exportReportFiles(currentRun, adhocResults); sfx.success(); }}>
              Download Report (.md + .json)
            </button>
          </div>
        </div>
      </Modal>

      {/* CTF Badge Modal */}
      <Modal open={ctfBadgeOpen} onClose={() => { if (onCloseCtfBadge) onCloseCtfBadge(); }} title="All CTF Challenges Complete" icon={<Trophy size={14} />}>
        <div className="space-y-4 text-center">
          <div className="flex justify-center py-4">
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 12 }}
              className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center"
            >
              <Trophy size={36} className="text-amber-400" />
            </motion.div>
          </div>
          <h3 className="text-lg font-bold text-amber-400">Challenge-Completion Badge Unlocked</h3>
          <p className="text-sm text-slate-400">
            You have completed all {ctfTotal} CTF challenges across the guardduelSI cyber-range. This is a challenge-completion achievement, not a professional certification.
          </p>
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: ctfTotal }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-1 p-2 rounded bg-obsidian-800 border border-amber-600/20">
                <Flag size={14} className="text-amber-400" />
                <span className="text-[8px] text-amber-500 font-bold">FLAG {i + 1}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 pt-2">
            {onResetCtf && (
              <button className="btn-tactical flex items-center gap-1" onClick={() => { onResetCtf(); if (onCloseCtfBadge) onCloseCtfBadge(); }}>
                <RotateCcw size={12} /> Reset Flags
              </button>
            )}
            <button className="btn-amber" onClick={() => { if (onCloseCtfBadge) onCloseCtfBadge(); }}>Continue</button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function downloadNDA() {
  downloadFile('guardduelsi-nda-roe.md', `# Mutual Non-Disclosure Agreement & Rules of Engagement (Unsigned Template)

## Parties
- **Client:** _________________
- **Tester:** _________________
- **Date:** ${new Date().toISOString().split('T')[0]}

## Scope
Authorized penetration testing of LLM infrastructure and web applications as defined in Statement of Work.

## Rules of Engagement
1. Testing window: _________________
2. Authorized IP ranges: _________________
3. Prohibited actions: Social engineering, DoS, data exfiltration
4. Disclosure: Findings reported via encrypted channel within 48h
5. Remediation verification: 14-day retest window

## Confidentiality
All discovered vulnerabilities, credentials, and system information remain confidential and are not to be shared with third parties.

## Signatures
Client: _________________ Date: ___
Tester: _________________ Date: ___

> This is an unsigned template. No signing process is implemented.
`, 'text/markdown');
}
