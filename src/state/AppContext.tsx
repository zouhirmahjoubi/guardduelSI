import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import type {
  ExecutionMode,
  ConnectionState,
  PresetConfig,
  GuardrailState,
  RunRecord,
  PatchProposal,
  PentestNote,
  TestResult,
} from '@/types';
import { PRESETS, getHardenedPrompt, getHardenedGuardrails, getTestCases } from '@/data/presets';
import {
  computeMetrics,
  generateRunId,
  generateConfigVersion,
} from '@/data/attackSim';
import { executeTestRun, executeSingleAttack, createSnapshot } from '@/utils/execution';
import { createSupabaseClient, isSupabaseConfigured } from '@/utils/supabaseClient';
import { usePersistentState } from '@/utils/storage';

interface AppContextValue {
  mode: ExecutionMode;
  setMode: (m: ExecutionMode) => void;
  connection: ConnectionState;
  checkConnection: () => void;
  preset: PresetConfig;
  setPreset: (p: PresetConfig) => void;
  systemPrompt: string;
  setSystemPrompt: (p: string) => void;
  canaryToken: string;
  setCanaryToken: (t: string) => void;
  guardrails: GuardrailState;
  setGuardrails: (g: GuardrailState) => void;
  configVersion: string;
  currentRun: RunRecord | null;
  baselineRun: RunRecord | null;
  retestRun: RunRecord | null;
  runHistory: RunRecord[];
  isRunning: boolean;
  patchProposal: PatchProposal | null;
  isPatched: boolean;
  patchAnimating: boolean;
  /** True when the current run was produced with a different configuration than the one now on screen */
  isResultStale: boolean;
  adhocResults: TestResult[];
  runSingleAttack: (chipId: string, customPayload: string | null) => Promise<TestResult>;
  runTests: () => Promise<void>;
  proposePatch: () => void;
  applyPatch: () => Promise<void>;
  resetPatching: () => void;
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
  const [systemPrompt, setSystemPromptState] = useState(PRESETS[0].systemPrompt);
  const [canaryToken, setCanaryTokenState] = useState(PRESETS[0].canaryToken);
  const [guardrails, setGuardrailsState] = useState<GuardrailState>(DEFAULT_GUARDRAILS);
  const [adhocResults, setAdhocResults] = useState<TestResult[]>([]);

  const [currentRun, setCurrentRun] = useState<RunRecord | null>(null);
  const [baselineRun, setBaselineRun] = useState<RunRecord | null>(null);
  const [retestRun, setRetestRun] = useState<RunRecord | null>(null);
  const [runHistory, setRunHistory] = useState<RunRecord[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const [patchProposal, setPatchProposal] = useState<PatchProposal | null>(null);
  const [isPatched, setIsPatched] = useState(false);
  const [patchAnimating, setPatchAnimating] = useState(false);

  const [notes, setNotes] = usePersistentState<PentestNote[]>('notes', []);

  const abortRef = useRef<AbortController | null>(null);
  const retestRunRef = useRef<RunRecord | null>(null);

  const configVersion = generateConfigVersion(preset.id, systemPrompt, canaryToken, guardrails);
  const isResultStale = currentRun !== null && currentRun.configVersion !== configVersion;

  // Any user edit to defenses cancels in-flight work and drops conclusions drawn from the old config.
  const invalidateAssessments = useCallback(() => {
    abortRef.current?.abort();
    setIsPatched(false);
    setPatchProposal(null);
    setRetestRun(null);
    retestRunRef.current = null;
  }, []);

  const setSystemPrompt = useCallback((p: string) => {
    if (p !== systemPrompt) invalidateAssessments();
    setSystemPromptState(p);
  }, [systemPrompt, invalidateAssessments]);

  const setCanaryToken = useCallback((t: string) => {
    if (t !== canaryToken) invalidateAssessments();
    setCanaryTokenState(t);
  }, [canaryToken, invalidateAssessments]);

  const setGuardrails = useCallback((g: GuardrailState) => {
    if (JSON.stringify(g) !== JSON.stringify(guardrails)) invalidateAssessments();
    setGuardrailsState(g);
  }, [guardrails, invalidateAssessments]);

  const setPreset = useCallback((p: PresetConfig) => {
    abortRef.current?.abort();
    setPresetState(p);
    setSystemPromptState(p.systemPrompt);
    setCanaryTokenState(p.canaryToken);
    setGuardrailsState(p.guardrails);
    setIsPatched(false);
    setPatchProposal(null);
    setBaselineRun(null);
    setRetestRun(null);
    retestRunRef.current = null;
  }, []);

  const checkConnection = useCallback(async () => {
    setConnection((prev) => ({ ...prev, status: 'checking', message: 'Checking provider connection…' }));

    if (!isSupabaseConfigured()) {
      setConnection({
        status: 'disconnected',
        provider: 'openai',
        model: '',
        message: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable Live mode.',
        latencyMs: null,
        lastChecked: new Date().toISOString(),
      });
      return;
    }

    try {
      const supabase = createSupabaseClient();
      const { data, error } = await supabase.functions.invoke('llm-proxy', {
        body: { action: 'check' },
      });

      if (error) throw new Error(error.message || 'Edge function call failed');
      if (!data) throw new Error('No response from edge function');

      setConnection({
        status: data.status || 'error',
        provider: data.provider || 'openai',
        model: data.model || '',
        message: data.message || 'Connection checked.',
        latencyMs: data.latencyMs ?? null,
        lastChecked: new Date().toISOString(),
      });
    } catch (err) {
      setConnection({
        status: 'error',
        provider: 'openai',
        model: '',
        message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        latencyMs: null,
        lastChecked: new Date().toISOString(),
      });
    }
  }, []);

  const runTestsWithConfig = useCallback(async (
    runMode: ExecutionMode,
    promptOverride: string | null,
    guardrailOverride: GuardrailState | null,
    canaryOverride: string | null,
    isRetest: boolean,
  ): Promise<RunRecord | null> => {
    // Cancel any in-progress run
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);

    try {
      const effectivePrompt = promptOverride ?? systemPrompt;
      const effectiveGuardrails = guardrailOverride ?? guardrails;
      const effectiveCanary = canaryOverride ?? canaryToken;
      const effectiveConfigVersion = generateConfigVersion(preset.id, effectivePrompt, effectiveCanary, effectiveGuardrails);

      const snapshot = createSnapshot(preset, effectivePrompt, effectiveCanary, effectiveGuardrails, runMode, effectiveConfigVersion);
      const testCases = getTestCases();

      const results = await executeTestRun(
        { snapshot, testCases, signal: controller.signal },
        connection,
      );

      if (controller.signal.aborted) return null;

      const runId = generateRunId();
      const resultsWithRunId = results.map((r) => ({ ...r, runId }));

      const metrics = computeMetrics(resultsWithRunId);
      const run: RunRecord = {
        id: runId,
        timestamp: new Date().toISOString(),
        mode: runMode,
        presetId: preset.id,
        presetName: preset.name,
        model: runMode === 'live' && connection.status === 'connected' ? connection.model : null,
        configVersion: effectiveConfigVersion,
        systemPrompt: effectivePrompt,
        canaryToken: effectiveCanary,
        guardrails: { ...effectiveGuardrails },
        results: resultsWithRunId,
        metrics,
      };

      setCurrentRun(run);
      setRunHistory((prev) => [...prev.slice(-9), run]);

      if (isRetest) {
        retestRunRef.current = run;
        setRetestRun(run);
      } else {
        setBaselineRun(run);
      }
      return run;
    } finally {
      setIsRunning(false);
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [preset, systemPrompt, canaryToken, guardrails, connection]);

  const runSingleAttack = useCallback(async (chipId: string, customPayload: string | null): Promise<TestResult> => {
    const snapshot = createSnapshot(preset, systemPrompt, canaryToken, guardrails, mode, configVersion);
    const result = await executeSingleAttack(chipId, customPayload, snapshot, connection);
    const stamped: TestResult = { ...result, runId: `ADHOC-${Date.now().toString(36).toUpperCase()}` };
    setAdhocResults((prev) => [...prev.slice(-99), stamped]);
    return stamped;
  }, [preset, systemPrompt, canaryToken, guardrails, mode, configVersion, connection]);

  const runTests = useCallback(async () => {
    await runTestsWithConfig(mode, null, null, null, isPatched);
  }, [mode, isPatched, runTestsWithConfig]);

  const proposePatch = useCallback(() => {
    if (!baselineRun || baselineRun.configVersion !== configVersion) return;
    const failures = baselineRun.results.filter((r) => r.outcome === 'breach');
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
      explanation: `Addresses observed failures: ${failureSummary}. The hardened prompt adds immutable security rules, canary token monitoring, output schema enforcement, input sanitization, and PII scrubbing. This is a template/rule-based proposal — not a guarantee of security.`,
      applied: false,
      baselineRunId: baselineRun.id,
      retestRunId: null,
    });
  }, [baselineRun, configVersion, preset, systemPrompt, guardrails]);

  const applyPatch = useCallback(async () => {
    if (!patchProposal || patchProposal.applied) return;

    setPatchAnimating(true);
    setSystemPromptState(patchProposal.afterPrompt);
    setGuardrailsState(patchProposal.afterGuardrails);
    setIsPatched(true);

    try {
      const retest = await runTestsWithConfig(mode, patchProposal.afterPrompt, patchProposal.afterGuardrails, canaryToken, true);
      if (retest) {
        setPatchProposal((prev) => prev && prev.id === patchProposal.id ? { ...prev, applied: true, retestRunId: retest.id } : prev);
      }
    } finally {
      setPatchAnimating(false);
    }
  }, [patchProposal, mode, canaryToken, runTestsWithConfig]);

  const resetPatching = useCallback(() => {
    abortRef.current?.abort();
    setIsPatched(false);
    setPatchProposal(null);
    setBaselineRun(null);
    setRetestRun(null);
    retestRunRef.current = null;
  }, []);

  const addNote = useCallback((note: PentestNote) => {
    setNotes((prev) => [note, ...prev]);
  }, [setNotes]);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }, [setNotes]);

  return (
    <AppContext.Provider value={{
      mode, setMode,
      connection, checkConnection,
      preset, setPreset,
      systemPrompt, setSystemPrompt,
      canaryToken, setCanaryToken,
      guardrails, setGuardrails,
      configVersion, isResultStale,
      adhocResults, runSingleAttack,
      currentRun, baselineRun, retestRun, runHistory, isRunning,
      patchProposal, isPatched, patchAnimating,
      runTests, proposePatch, applyPatch, resetPatching,
      notes, addNote, deleteNote,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
