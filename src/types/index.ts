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
  result: 'BREACH' | 'BLOCKED' | 'DECOY' | 'PATCHED';
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
  result: 'BREACH' | 'BLOCKED' | 'DECOY';
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
  label: string;
  hint: string;
  workspace: WorkspaceId;
  captured: boolean;
}
