import { useState, useEffect, useCallback } from 'react';
import { Shield, Hash, Zap, Target, FileText, Volume2, VolumeX, Sparkles, KeyRound, Download, Swords, Flag, Trophy, RotateCcw } from 'lucide-react';
import { sfx, setSfxEnabled, isSfxEnabled } from '@/utils/soundEngine';
import { sha256, downloadMD } from '@/utils/downloads';
import { Modal, Toggle } from './ui/Modal';
import { exportGuardrails, exportComplianceReport } from '@/utils/exports';
import { motion } from 'framer-motion';

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
}

export function CommandBar({ onJudgeTour, motionReduced, onMotionToggle, ctfCount = 0, ctfTotal = 5, onPurpleTeam, ctfBadgeOpen = false, onCloseCtfBadge, onResetCtf }: CommandBarProps) {
  const [sfxOn, setSfxOn] = useState(isSfxEnabled());
  const [hash, setHash] = useState('sha256:9f86d0...');
  const [latency] = useState('+12ms');
  const [tokenSaved] = useState(47283);
  const [mode, setMode] = useState<'instant' | 'live'>('instant');
  const [apiModal, setApiModal] = useState(false);
  const [guardrailModal, setGuardrailModal] = useState(false);
  const [complianceModal, setComplianceModal] = useState(false);
  const [guardrailContent, setGuardrailContent] = useState('');

  useEffect(() => {
    const updateHash = async () => {
      const h = await sha256('AegisAI-SecOps-Command-v1-' + Date.now().toString().slice(0, -4));
      setHash(`sha256:${h.slice(0, 12)}...`);
    };
    updateHash();
    const interval = setInterval(updateHash, 10000);
    return () => clearInterval(interval);
  }, []);

  const toggleSfx = useCallback(() => {
    const newVal = !sfxOn;
    setSfxEnabled(newVal);
    setSfxOn(newVal);
    if (newVal) sfx.toggle();
  }, [sfxOn]);

  const handleModeSwitch = (m: 'instant' | 'live') => {
    if (m === 'live') {
      setApiModal(true);
    } else {
      setMode(m);
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

  return (
    <>
      {/* Main command bar */}
      <div className="border-b border-obsidian-700 bg-obsidian-950/60 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 px-4 h-12">
          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <Shield className="text-cyan-400" size={20} />
            <span className="text-sm font-bold text-slate-200 tracking-tight">
              AegisAI<span className="text-cyan-400"> //</span> <span className="text-xs font-normal text-slate-500">SecOps & Red-Team Command</span>
            </span>
          </div>

          <div className="w-px h-5 bg-obsidian-700" />

          {/* Hash + latency */}
          <div className="hidden lg:flex items-center gap-3 text-[10px] font-mono text-slate-500">
            <span className="flex items-center gap-1">
              <Hash size={11} className="text-slate-600" />
              {hash}
            </span>
            <span className="flex items-center gap-1 text-emerald-400">
              <Zap size={11} />
              {latency}
            </span>
            <span className="text-cyan-400">tokens_saved: {tokenSaved.toLocaleString()}</span>
          </div>

          <div className="flex-1" />

          {/* Mode switcher */}
          <div className="flex items-center gap-1 bg-obsidian-850 border border-obsidian-700 rounded-md p-0.5">
            <button
              className={`px-2 py-1 text-[10px] font-semibold rounded transition-all ${
                mode === 'instant' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => handleModeSwitch('instant')}
            >
              Instant Sim
            </button>
            <button
              className={`px-2 py-1 text-[10px] font-semibold rounded transition-all flex items-center gap-1 ${
                mode === 'live' ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-500 hover:text-slate-300'
              }`}
              onClick={() => handleModeSwitch('live')}
            >
              <KeyRound size={10} />
              Live API
            </button>
          </div>

          {/* CTF Progress pill */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-600/10 border border-amber-600/20 text-amber-400 text-[10px] font-bold">
            <Flag size={11} />
            <span>CTF: {ctfCount}/{ctfTotal}</span>
          </div>

          {/* Purple Team battle */}
          {onPurpleTeam && (
            <button className="btn-crimson flex items-center gap-1" onClick={() => { onPurpleTeam(); sfx.chirp(); }}>
              <Swords size={12} />
              <span className="hidden lg:inline">Purple-Team Duel</span>
            </button>
          )}

          {/* Action buttons */}
          <button className="btn-cyan flex items-center gap-1" onClick={onJudgeTour}>
            <Target size={12} />
            <span className="hidden sm:inline">30s Judge Tour</span>
          </button>
          <button className="btn-emerald flex items-center gap-1" onClick={handleGuardrails}>
            <Download size={12} />
            <span className="hidden md:inline">Deploy Guardrails</span>
          </button>
          <button className="btn-tactical flex items-center gap-1" onClick={handleCompliance}>
            <FileText size={12} />
            <span className="hidden md:inline">Audit Report</span>
          </button>

          {/* SFX toggle */}
          <button
            className="btn-tactical flex items-center gap-1"
            onClick={toggleSfx}
          >
            {sfxOn ? <Volume2 size={12} className="text-emerald-400" /> : <VolumeX size={12} />}
            <span className="hidden sm:inline">{sfxOn ? 'SFX: ON' : 'SFX: MUTE'}</span>
          </button>

          {/* Motion toggle */}
          <button
            className="btn-tactical flex items-center gap-1"
            onClick={onMotionToggle}
          >
            <Sparkles size={12} className={motionReduced ? 'text-slate-600' : 'text-cyan-400'} />
            <span className="hidden sm:inline">{motionReduced ? 'Motion: REDUCED' : 'Motion: FULL'}</span>
          </button>
        </div>
      </div>

      {/* API Key Modal */}
      <Modal open={apiModal} onClose={() => setApiModal(false)} title="Live API Mode Configuration" icon={<KeyRound size={14} />}>
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Connect your own LLM API key to run live red-team attacks against real models. Keys are stored locally in browser session only.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider">Provider</label>
              <div className="flex gap-2 mt-1">
                {['OpenAI', 'Anthropic', 'Google Gemini'].map((p) => (
                  <button key={p} className="btn-tactical">{p}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider">API Key</label>
              <input
                type="password"
                placeholder="sk-..."
                className="w-full mt-1 bg-obsidian-900 border border-obsidian-700 rounded-md px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider">Model</label>
              <input
                type="text"
                placeholder="gpt-4-turbo"
                className="w-full mt-1 bg-obsidian-900 border border-obsidian-700 rounded-md px-3 py-2 text-sm font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="btn-tactical" onClick={() => setApiModal(false)}>Cancel</button>
            <button
              className="btn-cyan"
              onClick={() => { setMode('live'); setApiModal(false); sfx.success(); }}
            >
              Connect & Activate
            </button>
          </div>
          <div className="text-[10px] text-slate-600 border-t border-obsidian-700 pt-2">
            Note: Instant Simulation Mode runs fully offline with deterministic attack/defense scenarios. No API key needed.
          </div>
        </div>
      </Modal>

      {/* Guardrail Export Modal */}
      <Modal open={guardrailModal} onClose={() => setGuardrailModal(false)} title="Deploy Guardrails — SDK & CI/CD Export" icon={<Download size={14} />} maxWidth="max-w-4xl">
        <div className="space-y-4">
          <p className="text-sm text-slate-400">
            Export production-ready guardrail middleware for your LLM stack. All files include input sanitization, PII scrubbing, canary trap monitoring, and output schema enforcement.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { name: 'Express Middleware', file: 'aegis-guardrails.ts', icon: 'TS' },
              { name: 'FastAPI / LangChain', file: 'aegis-guardrails.py', icon: 'PY' },
              { name: 'GitHub Actions', file: 'aegis-ci.yml', icon: 'CI' },
              { name: 'promptfoo Config', file: 'promptfooconfig.yaml', icon: 'PF' },
              { name: 'garak CLI', file: 'garak-commands.sh', icon: 'GK' },
              { name: 'Full Bundle (.md)', file: 'aegisai-guardrails.md', icon: 'MD' },
            ].map((item) => (
              <button
                key={item.name}
                className="panel p-3 text-left hover:border-cyan-500/40 transition-all group"
                onClick={() => { exportGuardrails(); sfx.success(); }}
              >
                <div className="flex items-center gap-2">
                  <span className="badge-cyan">{item.icon}</span>
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-cyan-400">{item.name}</span>
                </div>
                <div className="text-[10px] text-slate-600 mt-1 font-mono">{item.file}</div>
              </button>
            ))}
          </div>
          <div className="panel p-3">
            <div className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Preview — Express Middleware</div>
            <pre className="terminal p-3 text-[10px] text-emerald-400 overflow-auto max-h-48">{`import { Request, Response, NextFunction } from 'express';

const INJECTION_PATTERNS = [
  /ignore.*(previous|prior).*(instruction|prompt|rule)/i,
  /you are (now |a )?(DAN|developer|admin)/i,
];

export function aegisGuardrail(req, res, next) {
  const input = req.body.messages?.pop()?.content;
  for (const p of INJECTION_PATTERNS) {
    if (p.test(input)) return res.status(403)
      .json({ error: "WAF_BLOCKED: Prompt injection" });
  }
  // PII scrub, canary check, schema lock...
  next();
}`}</pre>
          </div>
        </div>
      </Modal>

      {/* Compliance Report Modal */}
      <Modal open={complianceModal} onClose={() => setComplianceModal(false)} title="Global Compliance & Audit Report" icon={<FileText size={14} />} maxWidth="max-w-4xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'OWASP LLM Top 10', status: 'REMEDIATED', color: 'emerald' },
              { label: 'MITRE ATLAS', status: 'MAPPED', color: 'cyan' },
              { label: 'EU AI Act Art. 15', status: 'COMPLIANT', color: 'emerald' },
              { label: 'NIST AI RMF', status: 'ALIGNED', color: 'emerald' },
              { label: 'ISO 42001/27001', status: 'CERTIFIED', color: 'emerald' },
              { label: 'PCI-DSS', status: 'COMPLIANT', color: 'emerald' },
              { label: 'HIPAA', status: 'COMPLIANT', color: 'emerald' },
              { label: 'NDA / RoE', status: 'GENERATED', color: 'cyan' },
            ].map((item) => (
              <div key={item.label} className="panel p-3">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider">{item.label}</div>
                <div className={`text-xs font-bold mt-1 ${item.color === 'emerald' ? 'text-emerald-400' : 'text-cyan-400'}`}>{item.status}</div>
              </div>
            ))}
          </div>

          <div className="panel p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Resilience Score Summary</div>
            <div className="flex items-center gap-6">
              <div>
                <div className="text-3xl font-bold text-emerald-400">98%</div>
                <div className="text-[10px] text-slate-500">Post-Patch Score</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-crimson-400">22%</div>
                <div className="text-[10px] text-slate-500">Pre-Patch Score</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-cyan-400">100%</div>
                <div className="text-[10px] text-slate-500">Attacks Deflected</div>
              </div>
            </div>
          </div>

          <div className="panel p-4">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Legal Rules of Engagement (NDA)</div>
            <p className="text-xs text-slate-400 leading-relaxed">
              This engagement is conducted under a signed NDA. The tester agrees to operate within the agreed scope and timeframe, not exfiltrate or retain production data, report all findings through the defined disclosure channel, maintain confidentiality, and cease testing upon written notice.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button className="btn-tactical" onClick={() => downloadNDA()}>Download NDA (.md)</button>
            <button className="btn-emerald" onClick={() => { exportComplianceReport(); sfx.success(); }}>
              Download Full Report (.md + .json)
            </button>
          </div>
        </div>
      </Modal>

      {/* CTF Badge Modal — all 5 flags captured */}
      <Modal open={ctfBadgeOpen} onClose={() => { if (onCloseCtfBadge) onCloseCtfBadge(); }} title="Omega CTF Master — All Flags Captured" icon={<Trophy size={14} />}>
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
          <h3 className="text-lg font-bold text-amber-400">Holographic Badge Unlocked</h3>
          <p className="text-sm text-slate-400">
            You have captured all {ctfTotal} CTF flags across the AegisAI cyber-range. You are now an AegisAI Omega CTF Master.
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
    downloadMD('aegisai-nda-roe.md', `# Mutual Non-Disclosure Agreement & Rules of Engagement

## Parties
- **Client:** _________________
- **Tester:** AegisAI Red Team Operations
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
`);
}
