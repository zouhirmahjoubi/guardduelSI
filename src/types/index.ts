export type WorkspaceId = 'redteam' | 'osint' | 'memory' | 'privesc' | 'crypto' | 'vault' | 'activedir' | 'supplychain';

export type ThreatLevel = 'critical' | 'high' | 'medium' | 'low' | 'safe';

export interface ThreatFinding {
  id: string;
  title: string;
  category: string;
  severity: ThreatLevel;
  owasp?: string;
  mitre?: string;
  description: string;
  prePatch: string;
  postPatch: string;
  patched: boolean;
}

export interface PresetConfig {
  id: string;
  name: string;
  icon: string;
  description: string;
  systemPrompt: string;
  canaryToken: string;
  guardrails: GuardrailState;
}

export interface GuardrailState {
  inputSanitization: boolean;
  piiScrubber: boolean;
  canaryTrap: boolean;
  outputSchemaLock: boolean;
  honeypot: boolean;
}

export interface AttackLogEntry {
  id: number;
  timestamp: string;
  attacker: string;
  technique: string;
  payload: string;
  result: 'BREACH' | 'BLOCKED' | 'DECOY' | 'PATCHED' | 'ERROR' | 'NOT_ASSESSED';
  detail: string;
}

export interface HttpPacket {
  id: number;
  method: string;
  endpoint: string;
  status: number;
  statusText: string;
  request: string;
  response: string;
  result: 'BREACH' | 'BLOCKED' | 'DECOY' | 'ERROR';
}

export interface KillChainStage {
  id: string;
  name: string;
  icon: string;
  status: 'pending' | 'active' | 'breached' | 'blocked';
  detail: string;
}

export interface PortEntry {
  port: number;
  protocol: string;
  service: string;
  state: 'open' | 'closed' | 'filtered' | 'phantom';
  risk: ThreatLevel;
}

export interface CheatSheetEntry {
  id: string;
  category: 'Linux' | 'Network' | 'OWASP Web' | 'Memory/Binary' | 'AI Guardrails' | 'Forensics';
  title: string;
  command: string;
  description: string;
}

export interface CertTrack {
  id: string;
  name: string;
  level: number;
  maxLevel: number;
  topics: { name: string; done: boolean }[];
}

export interface PentestNote {
  id: string;
  workspace: WorkspaceId;
  title: string;
  body: string;
  timestamp: string;
}

export interface CtfFlag {
  id: string;
  flag: string;
  legacyFlag?: string;
  label: string;
  hint: string;
  workspace: WorkspaceId;
  captured: boolean;
}

// Shared application state types

export type ExecutionMode = 'simulation' | 'live';

export type ConnectionStatus = 'disconnected' | 'checking' | 'connected' | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  provider: string;
  model: string;
  message: string;
  latencyMs: number | null;
  lastChecked: string | null;
}

export type TestOutcome = 'breach' | 'blocked' | 'decoy' | 'error' | 'not_assessed' | 'false_positive';

export interface TestCase {
  id: string;
  label: string;
  payload: string;
  category: 'attack' | 'benign';
  isCustom?: boolean;
}

export interface TestResult {
  runId: string;
  testCaseId: string;
  testCaseLabel: string;
  mode: ExecutionMode;
  configVersion: string;
  timestamp: string;
  outcome: TestOutcome;
  detail: string;
  responseText: string;
  responseTruncated: boolean;
  latencyMs: number | null;
  tokensUsed: number | null;
  evidence: string;
  error?: string;
}

export interface RunRecord {
  id: string;
  timestamp: string;
  mode: ExecutionMode;
  presetId: string;
  presetName: string;
  model: string | null;
  configVersion: string;
  systemPrompt: string;
  canaryToken: string;
  guardrails: GuardrailState;
  results: TestResult[];
  metrics: RunMetrics;
}

export interface RunMetrics {
  total: number;
  attacks: number;
  benign: number;
  breaches: number;
  blocked: number;
  decoys: number;
  errors: number;
  notAssessed: number;
  falsePositives: number;
  attackSuccessRate: number;
  benignFalsePositiveRate: number;
}

export interface PatchProposal {
  id: string;
  timestamp: string;
  presetId: string;
  failureAddressed: string;
  beforePrompt: string;
  afterPrompt: string;
  beforeGuardrails: GuardrailState;
  afterGuardrails: GuardrailState;
  explanation: string;
  applied: boolean;
  baselineRunId: string | null;
  retestRunId: string | null;
}

export interface AppConfigVersion {
  presetId: string;
  systemPrompt: string;
  canaryToken: string;
  guardrails: GuardrailState;
  hash: string;
}
