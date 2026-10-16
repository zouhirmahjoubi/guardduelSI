import { useApp } from '@/state/AppContext';
import { LeftPane } from './redteam/LeftPane';
import { AttackGraph } from './redteam/AttackGraph';
import { KillChainBar } from './redteam/KillChainBar';
import { BattleTerminal } from './redteam/BattleTerminal';
import { RightPane } from './redteam/RightPane';
import { sfx } from '@/utils/soundEngine';
import { Swords } from 'lucide-react';
import { useState } from 'react';
import { computeKillChainProgress } from '@/data/attackSim';

export function RedTeamWorkspace({ onCaptureFlag, onPurpleTeam }: { onCaptureFlag?: (flagId: string) => void; onPurpleTeam?: () => void; }) {
  const app = useApp();
  const [view, setView] = useState<'prompt' | 'heatmap'>('prompt');
  const [activeAttack, setActiveAttack] = useState<string | null>(null);
  const [showLeftDrawer, setShowLeftDrawer] = useState(false);
  const [showRightDrawer, setShowRightDrawer] = useState(false);

  const handleAttack = (chipId: string, result: 'BREACH' | 'BLOCKED' | 'DECOY' | 'ERROR' | 'NOT_ASSESSED', _progress: number) => {
    setActiveAttack(chipId);
    setTimeout(() => setActiveAttack(null), 2000);
    if (result === 'BREACH') {
      window.dispatchEvent(new CustomEvent('guardduelsi-breach'));
    }
  };

  return (
    <div className="flex h-full overflow-hidden gap-2 p-2">
      {/* Mobile/tablet drawer toggles */}
      <div className="flex lg:hidden gap-1 absolute top-14 left-2 z-20">
        <button className="btn-tactical text-[10px]" onClick={() => setShowLeftDrawer(!showLeftDrawer)}>Config</button>
        <button className="btn-tactical text-[10px]" onClick={() => setShowRightDrawer(!showRightDrawer)}>Metrics</button>
      </div>

      {/* Left pane */}
      <div className={`w-72 shrink-0 ${showLeftDrawer ? 'fixed inset-y-0 left-0 z-30 lg:relative lg:z-auto' : 'hidden lg:block'}`}>
        <LeftPane
          preset={app.preset}
          onPresetChange={app.setPreset}
          canaryToken={app.canaryToken}
          onCanaryChange={app.setCanaryToken}
          guardrails={app.guardrails}
          onGuardrailChange={app.setGuardrails}
          view={view}
          onViewChange={setView}
          patched={app.isPatched}
          systemPrompt={app.systemPrompt}
          onSystemPromptChange={app.setSystemPrompt}
        />
        {showLeftDrawer && (
          <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setShowLeftDrawer(false)} />
        )}
      </div>

      {/* Center pane */}
      <div className="flex-1 flex flex-col gap-2 min-w-0">
        <div className="panel overflow-hidden">
          <KillChainBar 
            progress={app.currentRun ? computeKillChainProgress(app.currentRun.results) : 0} 
            patched={app.isPatched}
            blockedCount={app.currentRun ? app.currentRun.metrics.blocked + app.currentRun.metrics.decoys : 0}
          />
          <div className="h-[260px]">
            <AttackGraph patched={app.isPatched} guardrails={app.guardrails} activeAttack={activeAttack} />
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <BattleTerminal
            guardrails={app.guardrails}
            patched={app.isPatched}
            onAttack={handleAttack}
            onBreach={() => {}}
            onDeflect={() => {}}
            onCaptureFlag={onCaptureFlag}
          />
        </div>
      </div>

      {/* Right pane */}
      <div className={`w-80 shrink-0 ${showRightDrawer ? 'fixed inset-y-0 right-0 z-30 lg:relative lg:z-auto' : 'hidden lg:block'}`}>
        <RightPane
          patched={app.isPatched}
          resilienceScore={app.currentRun?.metrics.attackSuccessRate != null ? 100 - app.currentRun.metrics.attackSuccessRate : (app.currentRun ? 100 : 0)}
          systemPrompt={app.systemPrompt}
          onApplyPatch={() => { app.applyPatch(); }}
          patchAnimating={app.patchAnimating}
          currentRun={app.currentRun}
          baselineRun={app.baselineRun}
          retestRun={app.retestRun}
          onRunTests={app.runTests}
          onProposePatch={app.proposePatch}
          patchProposal={app.patchProposal}
          isRunning={app.isRunning}
        />
        {onPurpleTeam && (
          <button
            className="btn-crimson w-full mt-2 flex items-center justify-center gap-1.5"
            onClick={() => { onPurpleTeam(); sfx.chirp(); }}
            title="Scripted Purple-Team demo sequence"
          >
            <Swords size={14} />
            Run Purple-Team Duel (Scripted)
          </button>
        )}
        {showRightDrawer && (
          <div className="fixed inset-0 z-20 bg-black/50 xl:hidden" onClick={() => setShowRightDrawer(false)} />
        )}
      </div>
    </div>
  );
}
