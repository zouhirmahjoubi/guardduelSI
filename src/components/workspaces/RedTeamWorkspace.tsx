import { useState, useCallback } from 'react';
import { PRESETS } from '@/data/presets';
import type { PresetConfig, GuardrailState } from '@/types';
import { LeftPane } from './redteam/LeftPane';
import { AttackGraph } from './redteam/AttackGraph';
import { KillChainBar } from './redteam/KillChainBar';
import { BattleTerminal } from './redteam/BattleTerminal';
import { RightPane } from './redteam/RightPane';
import { sfx } from '@/utils/soundEngine';
import { Swords } from 'lucide-react';

const DEFAULT_GUARDRAILS: GuardrailState = {
  inputSanitization: false,
  piiScrubber: false,
  canaryTrap: false,
  outputSchemaLock: false,
  honeypot: false,
};

const HARDENED_GUARDRAILS: GuardrailState = {
  inputSanitization: true,
  piiScrubber: true,
  canaryTrap: true,
  outputSchemaLock: true,
  honeypot: true,
};

export function RedTeamWorkspace({ onCaptureFlag, onPurpleTeam }: { onCaptureFlag?: (flagId: string) => void; onPurpleTeam?: () => void; }) {
  const [preset, setPreset] = useState<PresetConfig>(PRESETS[0]);
  const [canaryToken, setCanaryToken] = useState(PRESETS[0].canaryToken);
  const [guardrails, setGuardrails] = useState<GuardrailState>(DEFAULT_GUARDRAILS);
  const [view, setView] = useState<'prompt' | 'heatmap'>('prompt');
  const [patched, setPatched] = useState(false);
  const [patchAnimating, setPatchAnimating] = useState(false);
  const [resilienceScore, setResilienceScore] = useState(22);
  const [killChainProgress, setKillChainProgress] = useState(0);
  const [activeAttack, setActiveAttack] = useState<string | null>(null);

  const handlePresetChange = (p: PresetConfig) => {
    setPreset(p);
    setCanaryToken(p.canaryToken);
  };

  const handleApplyPatch = useCallback(() => {
    setPatchAnimating(true);
    sfx.patch();
    setTimeout(() => {
      setPatched(true);
      setGuardrails(HARDENED_GUARDRAILS);
      setResilienceScore(98);
      setKillChainProgress(1);
      setView('heatmap');
      sfx.success();
      setTimeout(() => setPatchAnimating(false), 1000);
    }, 1200);
  }, []);

  const handleAttack = useCallback((_chipId: string, result: 'BREACH' | 'BLOCKED' | 'DECOY', progress: number) => {
    setActiveAttack(_chipId);
    setTimeout(() => setActiveAttack(null), 2000);
    if (result === 'BREACH' && !patched) {
      setKillChainProgress(progress);
      setResilienceScore((prev) => Math.max(15, prev - 5));
    }
  }, [patched]);

  const handleBreach = useCallback(() => {
    // Screen shake handled in App via GSAP event
  }, []);

  const handleDeflect = useCallback(() => {
    // Shield deflection feedback
  }, []);

  return (
    <div className="flex h-full overflow-hidden gap-2 p-2">
      {/* Left pane */}
      <div className="w-72 shrink-0 hidden lg:block">
        <LeftPane
          preset={preset}
          onPresetChange={handlePresetChange}
          canaryToken={canaryToken}
          onCanaryChange={setCanaryToken}
          guardrails={guardrails}
          onGuardrailChange={setGuardrails}
          view={view}
          onViewChange={setView}
          patched={patched}
        />
      </div>

      {/* Center pane */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="panel overflow-hidden">
          <KillChainBar progress={killChainProgress} patched={patched} />
          <div className="h-[260px]">
            <AttackGraph patched={patched} guardrails={guardrails} activeAttack={activeAttack} />
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <BattleTerminal
            guardrails={guardrails}
            patched={patched}
            canaryToken={canaryToken}
            onAttack={handleAttack}
            onBreach={handleBreach}
            onDeflect={handleDeflect}
            onCaptureFlag={onCaptureFlag}
          />
        </div>
      </div>

      {/* Right pane */}
      <div className="w-80 shrink-0 hidden xl:block">
        <RightPane
          patched={patched}
          resilienceScore={resilienceScore}
          systemPrompt={preset.systemPrompt}
          onApplyPatch={handleApplyPatch}
          patchAnimating={patchAnimating}
        />
        {onPurpleTeam && (
          <button
            className="btn-crimson w-full mt-2 flex items-center justify-center gap-1.5"
            onClick={() => { onPurpleTeam(); sfx.chirp(); }}
          >
            <Swords size={14} />
            Run Autonomous Red-AI vs. Blue-AI Duel
          </button>
        )}
      </div>
    </div>
  );
}
