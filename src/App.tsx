import { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { CommandBar } from '@/components/CommandBar';
import { WorkspaceNav } from '@/components/WorkspaceNav';
import { RedTeamWorkspace } from '@/components/workspaces/RedTeamWorkspace';
import { OSINTWorkspace } from '@/components/workspaces/OSINTWorkspace';
import { MemoryWorkspace } from '@/components/workspaces/MemoryWorkspace';
import { PrivEscWorkspace } from '@/components/workspaces/PrivEscWorkspace';
import { CryptoWorkspace } from '@/components/workspaces/CryptoWorkspace';
import { VaultWorkspace } from '@/components/workspaces/VaultWorkspace';
import { Workspace7 } from '@/components/workspaces/Workspace7';
import { Workspace8 } from '@/components/workspaces/Workspace8';
import { PurpleTeamModal } from '@/components/PurpleTeamModal';
import { useCtfFlags } from '@/utils/ctf';
import type { WorkspaceId, PentestNote } from '@/types';
import { sfx } from '@/utils/soundEngine';
import { motion, AnimatePresence } from 'framer-motion';

const TOUR_STEPS = [
  { title: 'Welcome to AegisAI', text: 'The ultimate SecOps, LLM Red-Teaming, and Ethical Hacking Cyber-Range. Let me show you the key features in 30 seconds.', target: 'brand' },
  { title: 'LLM Red-Teaming Center', text: 'Run prompt injection, jailbreak, and data exfiltration attacks against AI systems. Watch the MITRE kill-chain progress in real-time.', target: 'workspace-redteam' },
  { title: 'Interactive Attack Graph', text: 'React Flow canvas shows 4 autonomous attackers targeting your AI. Click "Auto-Harden" to see the prompt diff and 100% deflection.', target: 'attack-graph' },
  { title: 'Battle Terminal', text: 'Fire 1-click exploit chips, obfuscate payloads with Base64/ROT13/Hex, and intercept HTTP/LLM traffic like Burp Suite for AI.', target: 'battle-terminal' },
  { title: 'Auto-Patch & Diff Viewer', text: 'The hero feature: click "Auto-Harden System Prompt" to see a side-by-side diff, apply the patch, and re-test — resilience surges to 98%.', target: 'auto-patch' },
  { title: '6 Tactical Workspaces', text: 'Switch between OSINT Recon, Memory Exploitation, Privilege Escalation, Quantum Cryptology, and a Knowledge Vault with pentest notebook.', target: 'workspace-nav' },
  { title: 'Deploy & Report', text: 'Export production guardrails (Express, FastAPI, GitHub Actions) and download compliance reports (OWASP, MITRE, EU AI Act, NIST).', target: 'deploy-btn' },
];

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceId>('redteam');
  const [motionReduced, setMotionReduced] = useState(false);
  const [booting, setBooting] = useState(true);
  const [tourStep, setTourStep] = useState(-1);
  const [notes, setNotes] = useState<PentestNote[]>([]);
  const [shockwave, setShockwave] = useState(false);
  const [purpleTeamOpen, setPurpleTeamOpen] = useState(false);
  const ctf = useCtfFlags();
  const rootRef = useRef<HTMLDivElement>(null);

  // Boot sequence with GSAP
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

  // Screen shake on breach
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

  // Listen for breach events
  useEffect(() => {
    const handler = () => triggerShake();
    window.addEventListener('aegis-breach', handler);
    return () => window.removeEventListener('aegis-breach', handler);
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

  const addNote = useCallback((note: PentestNote) => {
    setNotes((prev) => [note, ...prev]);
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const renderWorkspace = () => {
    switch (workspace) {
      case 'redteam': return <RedTeamWorkspace onCaptureFlag={ctf.captureFlag} onPurpleTeam={() => setPurpleTeamOpen(true)} />;
      case 'osint': return <OSINTWorkspace onCaptureFlag={ctf.captureFlag} />;
      case 'memory': return <MemoryWorkspace onCaptureFlag={ctf.captureFlag} />;
      case 'privesc': return <PrivEscWorkspace />;
      case 'crypto': return <CryptoWorkspace onCaptureFlag={ctf.captureFlag} />;
      case 'vault': return <VaultWorkspace notes={notes} onAddNote={addNote} onDeleteNote={deleteNote} />;
      case 'activedir': return <Workspace7 onCaptureFlag={ctf.captureFlag} />;
      case 'supplychain': return <Workspace8 />;
      default: return <RedTeamWorkspace onCaptureFlag={ctf.captureFlag} onPurpleTeam={() => setPurpleTeamOpen(true)} />;
    }
  };

  return (
    <div ref={rootRef} className="h-screen flex flex-col bg-obsidian-900 overflow-hidden relative">
      {/* Boot screen */}
      {booting && (
        <div className="boot-screen fixed inset-0 z-[300] bg-obsidian-950 flex flex-col items-center justify-center">
          <div className="space-y-1 font-mono text-xs text-center">
            <div className="boot-line text-cyan-400 text-glow-cyan text-lg font-bold mb-4">
              🛡️ AegisAI // SecOps & Red-Team Command
            </div>
            <div className="boot-line text-slate-500">Initializing Tactical Operations Center...</div>
            <div className="boot-line text-emerald-400">[OK] LLM Red-Team Engine v2.1 loaded</div>
            <div className="boot-line text-emerald-400">[OK] MITRE ATLAS mapping initialized</div>
            <div className="boot-line text-emerald-400">[OK] React Flow attack graph online</div>
            <div className="boot-line text-emerald-400">[OK] Guardrail SDK ready for deployment</div>
            <div className="boot-line text-emerald-400">[OK] Procedural Audio Synthesizer armed</div>
            <div className="boot-line text-amber-400">[WARN] Instant Simulation Mode active (no API key required)</div>
            <div className="boot-line text-cyan-400">[READY] Awaiting tactical commands...</div>
          </div>
          <div className="boot-bar w-64 h-0.5 bg-cyan-500 mt-6 origin-left rounded-full" />
        </div>
      )}

      {/* Scanline overlay */}
      {!motionReduced && <div className="scanline-overlay" />}

      {/* Shockwave effect */}
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

      {/* Main UI */}
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
      />
      <WorkspaceNav active={workspace} onSelect={setWorkspace} />

      {/* Workspace content */}
      <div className="flex-1 overflow-hidden">
        {renderWorkspace()}
      </div>

      {/* Judge Tour overlay */}
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

      {/* Purple Team Battle Modal */}
      <PurpleTeamModal open={purpleTeamOpen} onClose={() => setPurpleTeamOpen(false)} />
    </div>
  );
}

function TourOverlay({
  step,
  total,
  title,
  text,
  onNext,
  onClose,
}: {
  step: number;
  total: number;
  title: string;
  text: string;
  onNext: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[250] bg-obsidian-950/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onNext}
    >
      {/* Spotlight effect */}
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
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-sm">Skip ✕</button>
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

export default App;
