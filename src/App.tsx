import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import gsap from 'gsap';
import { CommandBar } from '@/components/CommandBar';
import { WorkspaceNav } from '@/components/WorkspaceNav';
import { PurpleTeamModal } from '@/components/PurpleTeamModal';
import { useCtfFlags } from '@/utils/ctf';
import { usePersistentState } from '@/utils/storage';
import { useApp } from '@/state/AppContext';
import { BRAND, WORKSPACE_COUNT } from '@/data/brand';
import type { WorkspaceId } from '@/types';
import type { ExportConfig } from '@/utils/exports';
import { sfx } from '@/utils/soundEngine';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield } from 'lucide-react';

const RedTeamWorkspace = lazy(() => import('@/components/workspaces/RedTeamWorkspace').then((m) => ({ default: m.RedTeamWorkspace })));
const OSINTWorkspace = lazy(() => import('@/components/workspaces/OSINTWorkspace').then((m) => ({ default: m.OSINTWorkspace })));
const MemoryWorkspace = lazy(() => import('@/components/workspaces/MemoryWorkspace').then((m) => ({ default: m.MemoryWorkspace })));
const PrivEscWorkspace = lazy(() => import('@/components/workspaces/PrivEscWorkspace').then((m) => ({ default: m.PrivEscWorkspace })));
const CryptoWorkspace = lazy(() => import('@/components/workspaces/CryptoWorkspace').then((m) => ({ default: m.CryptoWorkspace })));
const VaultWorkspace = lazy(() => import('@/components/workspaces/VaultWorkspace').then((m) => ({ default: m.VaultWorkspace })));
const Workspace7 = lazy(() => import('@/components/workspaces/Workspace7').then((m) => ({ default: m.Workspace7 })));
const Workspace8 = lazy(() => import('@/components/workspaces/Workspace8').then((m) => ({ default: m.Workspace8 })));

const TOUR_STEPS = [
  { title: 'Welcome to guardduelSI', text: `${BRAND.description} ${BRAND.tagline} Let me show you the key features.`, target: 'brand' },
  { title: 'LLM Red-Teaming Center', text: 'Run prompt injection, jailbreak, and data exfiltration attacks against AI systems. Watch the MITRE kill-chain progress in real-time.', target: 'workspace-redteam' },
  { title: 'Interactive Attack Graph', text: 'React Flow canvas shows attackers targeting your AI. Click "Auto-Harden" to see the prompt diff and retest results.', target: 'attack-graph' },
  { title: 'Battle Terminal', text: 'Fire exploit chips, obfuscate payloads, and intercept HTTP/LLM traffic. All traffic in Simulation mode is synthetic.', target: 'battle-terminal' },
  { title: 'Auto-Harden & Diff Viewer', text: 'Click "Auto-Harden System Prompt" to see a side-by-side diff, apply the patch, and re-test. Metrics are calculated from actual results.', target: 'auto-patch' },
  { title: `${WORKSPACE_COUNT} Tactical Workspaces`, text: 'Switch between OSINT Recon, Memory Exploitation, Privilege Escalation, Quantum Cryptology, Knowledge Vault, Active Directory, and Supply-Chain Forensics.', target: 'workspace-nav' },
  { title: 'Deploy & Report', text: 'Export guardrail examples (TypeScript, Python, CI/CD, promptfoo, garak) and download audit reports from session evidence.', target: 'deploy-btn' },
];

function AppContent() {
  const app = useApp();
  const [workspace, setWorkspace] = useState<WorkspaceId>('redteam');
  const [motionReduced, setMotionReduced] = usePersistentState('motion-reduced', false);
  const [sfxEnabled] = usePersistentState('sfx-enabled', true);
  const [booting, setBooting] = useState(true);
  const [tourStep, setTourStep] = useState(-1);
  const [shockwave, setShockwave] = useState(false);
  const [purpleTeamOpen, setPurpleTeamOpen] = useState(false);
  const ctf = useCtfFlags();
  const rootRef = useRef<HTMLDivElement>(null);

  // Sync sfx enabled state
  useEffect(() => {
    import('@/utils/soundEngine').then(({ setSfxEnabled }) => setSfxEnabled(sfxEnabled));
  }, [sfxEnabled]);

  // Boot sequence
  useEffect(() => {
    if (motionReduced) {
      setBooting(false);
      return;
    }
    sfx.boot();
    const tl = gsap.timeline();
    tl.from('.boot-line', { opacity: 0, y: 10, stagger: 0.08, duration: 0.4, ease: 'power2.out' });
    tl.from('.boot-bar', { scaleX: 0, duration: 1, ease: 'power2.inOut' }, '-=0.2');
    tl.to('.boot-screen', { opacity: 0, duration: 0.4, ease: 'power2.in', delay: 0.3 });
    tl.set('.boot-screen', { display: 'none' });
    tl.call(() => setBooting(false));

    return () => { tl.kill(); };
  }, [motionReduced]);

  const triggerShake = useCallback(() => {
    if (motionReduced || !rootRef.current) return;
    setShockwave(true);
    gsap.to(rootRef.current, {
      x: 0,
      duration: 0.5,
      keyframes: [
        { x: -4, duration: 0.04 },
        { x: 4, duration: 0.04 },
        { x: -3, duration: 0.04 },
        { x: 3, duration: 0.04 },
        { x: -2, duration: 0.04 },
        { x: 0, duration: 0.04 },
      ],
    });
    setTimeout(() => setShockwave(false), 600);
  }, [motionReduced]);

  useEffect(() => {
    const handler = () => triggerShake();
    window.addEventListener('guardduelsi-breach', handler);
    return () => window.removeEventListener('guardduelsi-breach', handler);
  }, [triggerShake]);

  const startTour = useCallback(() => {
    setTourStep(0);
    sfx.sonar();
  }, []);

  const nextTour = useCallback(() => {
    setTourStep((prev) => {
      if (prev + 1 >= TOUR_STEPS.length) {
        sfx.success();
        return -1;
      }
      sfx.chirp();
      return prev + 1;
    });
  }, []);

  const renderWorkspace = () => {
    const props = {
      onCaptureFlag: ctf.captureFlag,
      onPurpleTeam: () => setPurpleTeamOpen(true),
    };
    switch (workspace) {
      case 'redteam': return <RedTeamWorkspace {...props} />;
      case 'osint': return <OSINTWorkspace onCaptureFlag={ctf.captureFlag} />;
      case 'memory': return <MemoryWorkspace onCaptureFlag={ctf.captureFlag} />;
      case 'privesc': return <PrivEscWorkspace />;
      case 'crypto': return <CryptoWorkspace onCaptureFlag={ctf.captureFlag} />;
      case 'vault': return <VaultWorkspace notes={app.notes} onAddNote={app.addNote} onDeleteNote={app.deleteNote} />;
      case 'activedir': return <Workspace7 onCaptureFlag={ctf.captureFlag} />;
      case 'supplychain': return <Workspace8 />;
      default: return <RedTeamWorkspace {...props} />;
    }
  };

  return (
    <div ref={rootRef} className="h-screen flex flex-col bg-obsidian-900 overflow-hidden relative">
      {booting && (
        <div className="boot-screen fixed inset-0 z-[300] bg-obsidian-950 flex flex-col items-center justify-center">
          <div className="space-y-1 font-mono text-xs text-center">
            <div className="boot-line text-cyan-400 text-glow-cyan text-lg font-bold mb-4 flex items-center justify-center gap-2">
              <Shield size={20} className="text-cyan-400" />
              {BRAND.heading}
            </div>
            <div className="boot-line text-slate-500">Initializing Tactical Operations Center...</div>
            <div className="boot-line text-emerald-400">[OK] LLM Red-Team Engine v2.1 loaded</div>
            <div className="boot-line text-emerald-400">[OK] MITRE ATLAS mapping initialized</div>
            <div className="boot-line text-emerald-400">[OK] React Flow attack graph online</div>
            <div className="boot-line text-emerald-400">[OK] Guardrail SDK ready for deployment</div>
            <div className="boot-line text-emerald-400">[OK] Procedural Audio Synthesizer armed</div>
            <div className="boot-line text-amber-400">[INFO] Simulation Mode active (no API key required)</div>
            <div className="boot-line text-cyan-400">[READY] Awaiting tactical commands...</div>
          </div>
          <div className="boot-bar w-64 h-0.5 bg-cyan-500 mt-6 origin-left rounded-full" />
        </div>
      )}

      {!motionReduced && <div className="scanline-overlay" />}

      <AnimatePresence>
        {shockwave && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0.6 }}
            animate={{ scale: 3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-crimson-500 pointer-events-none z-[150]"
          />
        )}
      </AnimatePresence>

      <CommandBar
        onJudgeTour={startTour}
        motionReduced={motionReduced}
        onMotionToggle={() => { setMotionReduced(!motionReduced); sfx.toggle(); }}
        ctfCount={ctf.count}
        ctfTotal={ctf.total}
        onPurpleTeam={() => setPurpleTeamOpen(true)}
        ctfBadgeOpen={ctf.showBadge}
        onCloseCtfBadge={() => ctf.setShowBadge(false)}
        onResetCtf={ctf.resetFlags}
        mode={app.mode}
        onModeChange={app.setMode}
        connection={app.connection}
        onCheckConnection={app.checkConnection}
        exportConfig={{
          preset: app.preset,
          systemPrompt: app.systemPrompt,
          canaryToken: app.canaryToken,
          guardrails: app.guardrails,
        } as ExportConfig}
        currentRun={app.currentRun}
      />
      <WorkspaceNav active={workspace} onSelect={setWorkspace} />

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-600 text-xs">Loading workspace…</div>}>
          {renderWorkspace()}
        </Suspense>
      </div>

      <AnimatePresence>
        {tourStep >= 0 && (
          <TourOverlay
            step={tourStep}
            total={TOUR_STEPS.length}
            title={TOUR_STEPS[tourStep].title}
            text={TOUR_STEPS[tourStep].text}
            onNext={nextTour}
            onClose={() => setTourStep(-1)}
          />
        )}
      </AnimatePresence>

      <PurpleTeamModal open={purpleTeamOpen} onClose={() => setPurpleTeamOpen(false)} />
    </div>
  );
}

function TourOverlay({
  step, total, title, text, onNext, onClose,
}: {
  step: number; total: number; title: string; text: string;
  onNext: () => void; onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[250] bg-obsidian-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onNext}
      role="dialog"
      aria-label="Judge tour"
    >
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-cyan-500/5 blur-3xl" />
      </div>

      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="panel max-w-lg w-full p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="badge-cyan">Judge Tour {step + 1}/{total}</span>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm" aria-label="Skip tour">Skip</button>
        </div>
        <h2 className="text-lg font-bold text-cyan-400 mb-2">{title}</h2>
        <p className="text-sm text-slate-400 leading-relaxed">{text}</p>
        <div className="flex items-center justify-between mt-4">
          <div className="flex gap-1">
            {Array.from({ length: total }, (_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-all ${
                  i === step ? 'bg-cyan-400 w-6' : i < step ? 'bg-emerald-500' : 'bg-obsidian-600'
                }`}
              />
            ))}
          </div>
          <button className="btn-cyan flex items-center gap-1" onClick={onNext}>
            {step + 1 >= total ? 'Finish' : 'Next'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function App() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-slate-600">Loading…</div>}>
      <AppContent />
    </Suspense>
  );
}

export default App;
