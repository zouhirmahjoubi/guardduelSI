import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type {
  ExecutionMode,
  ConnectionState,
  PresetConfig,
  GuardrailState,
  RunRecord,
  TestResult,
  PatchProposal,
  PentestNote,
} from '@/types';
import { PRESETS, getHardenedPrompt, getHardenedGuardrails, getTestCases } from '@/data/presets';
import {
  simulateAttack,
  simulateBenign,
  computeMetrics,
  generateRunId,
  generateConfigVersion,
} from '@/data/attackSim';

interface AppContextValue {
  // Execution mode
  mode: ExecutionMode;
  setMode: (m: ExecutionMode) => void;

  // Connection
  connection: ConnectionState;
  checkConnection: () => void;

  // Preset & prompt
  preset: PresetConfig;
  setPreset: (p: PresetConfig) => void;
  systemPrompt: string;
  setSystemPrompt: (p: string) => void;
  canaryToken: string;
  setCanaryToken: (t: string) => void;
  guardrails: GuardrailState;
  setGuardrails: (g: GuardrailState) => void;

  // Config version
  configVersion: string;

  // Runs
  currentRun: RunRecord | null;
  baselineRun: RunRecord | null;
  retestRun: RunRecord | null;
  runHistory: RunRecord[];
  isRunning: boolean;

  // Patch
  patchProposal: PatchProposal | null;
  isPatched: boolean;
  patchAnimating: boolean;

  // Actions
  runTests: () => Promise<void>;
  proposePatch: () => void;
  applyPatch: () => Promise<void>;
  resetPatching: () => void;

  // Notes
  notes: PentestNote[];
  addNote: (note: PentestNote) => void;
  deleteNote: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const DEFAULT_GUARDRAILS: GuardrailState = {
  inputSanitization: false,
  piiScrubber: false,
  canaryTrap: false,
  outputSchemaLock: false,
  honeypot: false,
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ExecutionMode>('simulation');
  const [connection, setConnection] = useState<ConnectionState>({
    status: 'disconnected',
    provider: 'openai',
    model: '',
    message: 'No provider configured. Set OPENAI_API_KEY in Supabase Edge Function secrets.',
    latencyMs: null,
    lastChecked: null,
  });

  const [preset, setPresetState] = useState<PresetConfig>(PRESETS[0]);
  const [systemPrompt, setSystemPrompt] = useState(PRESETS[0].systemPrompt);
  const [canaryToken, setCanaryToken] = useState(PRESETS[0].canaryToken);
  const [guardrails, setGuardrails] = useState<GuardrailState>(DEFAULT_GUARDRAILS);

  const [currentRun, setCurrentRun] = useState<RunRecord | null>(null);
  const [baselineRun, setBaselineRun] = useState<RunRecord | null>(null);
  const [retestRun, setRetestRun] = useState<RunRecord | null>(null);
  const [runHistory, setRunHistory] = useState<RunRecord[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const [patchProposal, setPatchProposal] = useState<PatchProposal | null>(null);
  const [isPatched, setIsPatched] = useState(false);
  const [patchAnimating, setPatchAnimating] = useState(false);

  const [notes, setNotes] = useState<PentestNote[]>([]);

  const configVersion = generateConfigVersion(preset.id, systemPrompt, canaryToken, guardrails);

  const setPreset = useCallback((p: PresetConfig) => {
    setPresetState(p);
    setSystemPrompt(p.systemPrompt);
    setCanaryToken(p.canaryToken);
    setGuardrails(p.guardrails);
    // Invalidate stale comparisons
    setIsPatched(false);
    setPatchProposal(null);
    setBaselineRun(null);
    setRetestRun(null);
  }, []);

  const checkConnection = useCallback(() => {
    setConnection((prev) => ({ ...prev, status: 'checking', message: 'Checking provider connection…' }));

    // In simulation/no-secret environment, report not configured
    // Real connection check would call the edge function
    setTimeout(() => {
      setConnection({
        status: 'disconnected',
        provider: 'openai',
        model: '',
        message: 'No OPENAI_API_KEY secret configured. Set it in Supabase Edge Function secrets to enable Live mode.',
        latencyMs: null,
        lastChecked: new Date().toISOString(),
      });
    }, 1000);
  }, []);

  const runTests = useCallback(async () => {
    setIsRunning(true);
    const runId = generateRunId();
    const timestamp = new Date().toISOString();
    const testCases = getTestCases();
    const results: TestResult[] = [];

    for (const tc of testCases) {
      let result;
      if (tc.category === 'benign') {
        result = simulateBenign(tc, guardrails);
      } else {
        result = simulateAttack(tc.id, tc.isCustom ? tc.payload : null, guardrails, preset, canaryToken);
      }

      results.push({
        runId,
        testCaseId: tc.id,
        testCaseLabel: tc.label,
        mode,
        configVersion,
        timestamp: new Date().toISOString(),
        outcome: result.outcome,
        detail: result.detail,
        responseText: result.responseText,
        responseTruncated: result.responseText.length > 500,
        latencyMs: mode === 'live' ? null : Math.floor(Math.random() * 20) + 5,
        tokensUsed: mode === 'live' ? null : null,
        evidence: result.responseText.includes(canaryToken) ? `Canary token "${canaryToken}" found in response output` : 'No canary leak detected in response',
      });
    }

    const metrics = computeMetrics(results);
    const run: RunRecord = {
      id: runId,
      timestamp,
      mode,
      presetId: preset.id,
      presetName: preset.name,
      model: mode === 'live' && connection.status === 'connected' ? connection.model : null,
      configVersion,
      systemPrompt,
      canaryToken,
      guardrails: { ...guardrails },
      results,
      metrics,
    };

    setCurrentRun(run);
    setRunHistory((prev) => [...prev.slice(-9), run]);

    // If this is a baseline run (not patched), store as baseline
    if (!isPatched) {
      setBaselineRun(run);
    } else {
      setRetestRun(run);
    }

    setIsRunning(false);
  }, [mode, guardrails, preset, canaryToken, configVersion, systemPrompt, connection, isPatched]);

  const proposePatch = useCallback(() => {
    if (!currentRun) return;
    const failures = currentRun.results.filter((r) => r.outcome === 'breach');
    if (failures.length === 0) return;

    const hardenedPrompt = getHardenedPrompt(preset);
    const hardenedGuardrails = getHardenedGuardrails();

    const failureSummary = failures.map((f) => f.testCaseLabel).join(', ');

    setPatchProposal({
      id: `patch-${Date.now()}`,
      timestamp: new Date().toISOString(),
      presetId: preset.id,
      failureAddressed: failureSummary,
      beforePrompt: systemPrompt,
      afterPrompt: hardenedPrompt,
      beforeGuardrails: { ...guardrails },
      afterGuardrails: hardenedGuardrails,
      explanation: `Addresses observed failures: ${failureSummary}. The hardened prompt adds immutable security rules, canary token monitoring, output schema enforcement, input sanitization, and PII scrubbing.`,
      applied: false,
      baselineRunId: currentRun.id,
      retestRunId: null,
    });
  }, [currentRun, preset, systemPrompt, guardrails]);

  const applyPatch = useCallback(async () => {
    if (!patchProposal) return;
    setPatchAnimating(true);

    // Apply the patch
    setSystemPrompt(patchProposal.afterPrompt);
    setGuardrails(patchProposal.afterGuardrails);
    setIsPatched(true);

    // Wait a beat for state to settle, then retest
    setTimeout(async () => {
      setPatchAnimating(false);
      // Auto-run retest
      const runId = generateRunId();
      const testCases = getTestCases();
      const results: TestResult[] = [];

      for (const tc of testCases) {
        let result;
        if (tc.category === 'benign') {
          result = simulateBenign(tc, patchProposal.afterGuardrails);
        } else {
          result = simulateAttack(tc.id, null, patchProposal.afterGuardrails, preset, canaryToken);
        }
        results.push({
          runId,
          testCaseId: tc.id,
          testCaseLabel: tc.label,
          mode,
          configVersion: generateConfigVersion(preset.id, patchProposal.afterPrompt, canaryToken, patchProposal.afterGuardrails),
          timestamp: new Date().toISOString(),
          outcome: result.outcome,
          detail: result.detail,
          responseText: result.responseText,
          responseTruncated: result.responseText.length > 500,
          latencyMs: null,
          tokensUsed: null,
          evidence: result.responseText.includes(canaryToken) ? `Canary token found in response` : 'No canary leak detected',
        });
      }

      const metrics = computeMetrics(results);
      const run: RunRecord = {
        id: runId,
        timestamp: new Date().toISOString(),
        mode,
        presetId: preset.id,
        presetName: preset.name,
        model: null,
        configVersion: generateConfigVersion(preset.id, patchProposal.afterPrompt, canaryToken, patchProposal.afterGuardrails),
        systemPrompt: patchProposal.afterPrompt,
        canaryToken,
        guardrails: patchProposal.afterGuardrails,
        results,
        metrics,
      };

      setCurrentRun(run);
      setRetestRun(run);
      setRunHistory((prev) => [...prev.slice(-9), run]);
      setPatchProposal((prev) => prev ? { ...prev, applied: true, retestRunId: run.id } : null);
    }, 1200);
  }, [patchProposal, mode, preset, canaryToken]);

  const resetPatching = useCallback(() => {
    setIsPatched(false);
    setPatchProposal(null);
    setBaselineRun(null);
    setRetestRun(null);
  }, []);

  const addNote = useCallback((note: PentestNote) => {
    setNotes((prev) => [note, ...prev]);
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return (
    <AppContext.Provider value={{
      mode, setMode,
      connection, checkConnection,
      preset, setPreset,
      systemPrompt, setSystemPrompt,
      canaryToken, setCanaryToken,
      guardrails, setGuardrails,
      configVersion,
      currentRun, baselineRun, retestRun, runHistory, isRunning,
      patchProposal, isPatched, patchAnimating,
      runTests, proposePatch, applyPatch, resetPatching,
      notes, addNote, deleteNote,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
