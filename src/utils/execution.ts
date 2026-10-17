import type {
  ExecutionSnapshot,
  TestCase,
  TestResult,
  TestOutcome,
  ExecutionMode,
  PresetConfig,
  GuardrailState,
  ConnectionState,
  LiveExecutionResult,
} from '@/types';
import {
  simulateAttack,
  simulateBenign,
  generateRunId,
  getAttackMeta,
} from '@/data/attackSim';
import { EXPLOIT_CHIPS } from '@/data/presets';

function getChipPayload(chipId: string): string {
  return EXPLOIT_CHIPS.find((c) => c.id === chipId)?.payload ?? '';
}
import { createSupabaseClient } from '@/utils/supabaseClient';

const MAX_PAYLOAD_LENGTH = 2000;
const MAX_TOKENS = 500;

export interface ExecutionOptions {
  snapshot: ExecutionSnapshot;
  testCases: TestCase[];
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

function evaluateSimResult(
  tc: TestCase,
  snapshot: ExecutionSnapshot,
): { outcome: TestOutcome; detail: string; responseText: string; evidence: string } {
  if (tc.category === 'benign') {
    const result = simulateBenign(tc, snapshot.guardrails);
    const evidence = result.responseText.includes(snapshot.canaryToken)
      ? `Canary token "${snapshot.canaryToken}" found in response output`
      : 'No canary leak detected in response';
    return { outcome: result.outcome, detail: result.detail, responseText: result.responseText, evidence };
  }

  const result = simulateAttack(
    tc.id,
    tc.isCustom ? tc.payload : null,
    snapshot.guardrails,
    snapshot.preset,
    snapshot.canaryToken,
  );
  const evidence = result.responseText.includes(snapshot.canaryToken)
    ? `Canary token "${snapshot.canaryToken}" found in response output`
    : 'No canary leak detected in response';
  return { outcome: result.outcome, detail: result.detail, responseText: result.responseText, evidence };
}

async function executeLive(
  tc: TestCase,
  snapshot: ExecutionSnapshot,
  connection: ConnectionState | undefined,
): Promise<{ outcome: TestOutcome; detail: string; responseText: string; evidence: string; latencyMs: number; tokensUsed: number | null; error?: string }> {
  if (!connection || connection.status !== 'connected') {
    return {
      outcome: 'error',
      detail: 'Live mode not connected. Check connection before running live tests.',
      responseText: '[ERROR] Live mode is not connected.',
      evidence: 'No evaluation performed — connection unavailable.',
      latencyMs: 0,
      tokensUsed: null,
      error: 'not_connected',
    };
  }

  const start = Date.now();

  try {
    const liveResult = await callEdgeFunction(tc, snapshot, connection);
    // Prefer the backend's latency when reported (excludes client network overhead);
    // fall back to the wall-clock timer when the proxy didn't send one.
    const latencyMs = liveResult.latencyMs > 0 ? liveResult.latencyMs : Date.now() - start;
    const evalResult = evaluateLiveResponse(tc, liveResult, snapshot);

    return {
      ...evalResult,
      latencyMs,
      tokensUsed: liveResult.tokensUsed ?? null,
      error: liveResult.error,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';

    return {
      outcome: 'error',
      detail: `Provider request failed: ${errorMsg}`,
      responseText: `[ERROR] ${errorMsg}`,
      evidence: 'No evaluation performed — provider request failed.',
      latencyMs,
      tokensUsed: null,
      error: errorMsg,
    };
  }
}

// evaluateLiveResponse is re-exported from liveEval so tests can import it
// without pulling in the supabase client (which needs the @/ path alias).
export { evaluateLiveResponse } from '@/utils/liveEval';

async function callEdgeFunction(
  tc: TestCase,
  snapshot: ExecutionSnapshot,
  connection: ConnectionState,
): Promise<LiveExecutionResult> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.functions.invoke('llm-proxy', {
    body: {
      action: 'chat',
      payload: tc.payload.slice(0, MAX_PAYLOAD_LENGTH),
      systemPrompt: snapshot.systemPrompt.slice(0, 2000),
      canaryToken: snapshot.canaryToken,
      guardrails: snapshot.guardrails,
      presetId: snapshot.preset.id,
      category: tc.category,
      maxTokens: MAX_TOKENS,
    },
  });

  if (error) throw new Error(error.message || 'Edge function call failed');
  if (!data || typeof data !== 'object') throw new Error('No response from edge function');

  const stage = data.stage === 'input' || data.stage === 'output' ? data.stage : null;
  const backendLatency = typeof data.latencyMs === 'number' ? data.latencyMs : 0;
  return {
    responseText: typeof data.response === 'string' ? data.response : '',
    latencyMs: backendLatency,
    tokensUsed: data.usage?.total_tokens ?? null,
    model: typeof data.model === 'string' ? data.model : connection.model,
    blocked: data.blocked === true,
    guardrail: typeof data.guardrail === 'string' ? data.guardrail : null,
    stage,
    canaryLeaked: data.canaryLeaked === true,
    error: typeof data.error === 'string' ? data.error : undefined,
  };
}

export async function executeTestRun(options: ExecutionOptions, connection?: ConnectionState): Promise<TestResult[]> {
  const { snapshot, testCases, signal, onProgress } = options;
  const results: TestResult[] = [];

  for (let i = 0; i < testCases.length; i++) {
    if (signal?.aborted) break;

    const tc = testCases[i];
    const timestamp = new Date().toISOString();

    if (snapshot.mode === 'live') {
      const live = await executeLive(tc, snapshot, connection);
      results.push({
        runId: '',
        testCaseId: tc.id,
        testCaseLabel: tc.label,
        category: tc.category,
        mode: 'live',
        configVersion: snapshot.configVersion,
        timestamp,
        outcome: live.outcome,
        detail: live.detail,
        responseText: live.responseText,
        responseTruncated: live.responseText.length > 500,
        latencyMs: live.latencyMs,
        tokensUsed: live.tokensUsed,
        evidence: live.evidence,
        error: live.error,
      });
    } else {
      const sim = evaluateSimResult(tc, snapshot);
      results.push({
        runId: '',
        testCaseId: tc.id,
        testCaseLabel: tc.label,
        category: tc.category,
        mode: 'simulation',
        configVersion: snapshot.configVersion,
        timestamp,
        outcome: sim.outcome,
        detail: sim.detail,
        responseText: sim.responseText,
        responseTruncated: sim.responseText.length > 500,
        latencyMs: null,
        tokensUsed: null,
        evidence: sim.evidence,
      });
    }

    onProgress?.(i + 1, testCases.length);
  }

  return results;
}

export function createSnapshot(
  preset: PresetConfig,
  systemPrompt: string,
  canaryToken: string,
  guardrails: GuardrailState,
  mode: ExecutionMode,
  configVersion: string,
): ExecutionSnapshot {
  return { preset, systemPrompt, canaryToken, guardrails, mode, configVersion };
}

export async function executeSingleAttack(
  chipId: string,
  payload: string | null,
  snapshot: ExecutionSnapshot,
  connection?: ConnectionState,
): Promise<TestResult> {
  const meta = getAttackMeta(chipId);
  const tc: TestCase = {
    id: chipId,
    label: meta?.technique ?? 'Custom payload',
    payload: payload ?? getChipPayload(chipId),
    category: 'attack',
    isCustom: payload !== null,
  };

  const results = await executeTestRun({ snapshot, testCases: [tc] }, connection);
  return results[0];
}

export { generateRunId };
