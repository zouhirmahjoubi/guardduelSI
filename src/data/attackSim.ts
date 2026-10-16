// Deterministic simulation engine for guardduelSI red-team scenarios.
// Rules are documented per attack type and per guardrail effect.
// This is a SIMULATION — it does not predict real model behavior.

import type { PresetConfig, GuardrailState, TestCase, TestResult, TestOutcome, RunMetrics } from '@/types';

export interface AttackResult {
  success: boolean;
  outcome: TestOutcome;
  result: 'BREACH' | 'BLOCKED' | 'DECOY' | 'ERROR' | 'NOT_ASSESSED' | 'PASS' | 'FALSE_POSITIVE';
  detail: string;
  responseText: string;
  killChainProgress: number;
  owaspCategory: string;
  mitreTechnique: string;
  category: 'attack' | 'benign';
}

interface AttackMeta {
  attacker: string;
  technique: string;
  mitre: string;
  owasp: string;
  /** Guardrails that, if enabled, block this attack */
  blockedBy: (keyof GuardrailState)[];
  /** Whether honeypot decoy is eligible for this attack type */
  honeypotEligible: boolean;
  /** Patterns that, if present in the payload, indicate this attack type */
  patterns: RegExp[];
}

const ATTACK_META: Record<string, AttackMeta> = {
  'prompt-injection': {
    attacker: 'Payload Injector',
    technique: 'Prompt Injection',
    mitre: 'LLM01:PromptInjection',
    owasp: 'LLM01:2023',
    blockedBy: ['inputSanitization'],
    honeypotEligible: false,
    patterns: [/ignore.*(previous|prior|above).*(instruction|prompt|rule)/i, /maintenance mode/i],
  },
  'persona-hijack': {
    attacker: 'Persona Hijacker',
    technique: 'Persona Hijack / DAN',
    mitre: 'LLM01:PromptInjection',
    owasp: 'LLM01:2023',
    blockedBy: ['inputSanitization'],
    honeypotEligible: false,
    patterns: [/you are (dan|developer|admin|root)/i, /no restrictions/i],
  },
  'data-exfil': {
    attacker: 'System Extractor',
    technique: 'Data Exfiltration',
    mitre: 'ATLAS:T1552',
    owasp: 'LLM02:InsecureOutput',
    blockedBy: ['inputSanitization', 'piiScrubber'],
    honeypotEligible: true,
    patterns: [/environment variables/i, /api keys/i, /debugging purposes/i],
  },
  'canary-leak': {
    attacker: 'System Extractor',
    technique: 'Canary Token Extraction',
    mitre: 'ATLAS:T1552',
    owasp: 'LLM02:InsecureOutput',
    blockedBy: ['canaryTrap', 'inputSanitization'],
    honeypotEligible: true,
    patterns: [/canary/i, /<\/?canary>/i, /repeat.*between.*tags/i],
  },
  'jailbreak': {
    attacker: 'Persona Hijacker',
    technique: 'Jailbreak via Hypothetical',
    mitre: 'LLM01:PromptInjection',
    owasp: 'LLM01:2023',
    blockedBy: ['inputSanitization'],
    honeypotEligible: false,
    patterns: [/hypothetically/i, /if you had no rules/i, /educational purposes/i],
  },
  'sql-injection': {
    attacker: 'Payload Injector',
    technique: 'SQL Injection via NL',
    mitre: 'ATLAS:T1190',
    owasp: 'LLM02:InsecureOutput',
    blockedBy: ['inputSanitization', 'outputSchemaLock'],
    honeypotEligible: false,
    patterns: [/select.*password/i, /union select/i, /drop table/i, /delete from/i],
  },
  'pii-extract': {
    attacker: 'Logic Exploiter',
    technique: 'PII Extraction',
    mitre: 'ATLAS:T1552',
    owasp: 'LLM02:InsecureOutput',
    blockedBy: ['piiScrubber', 'inputSanitization'],
    honeypotEligible: true,
    patterns: [/ssn/i, /account number/i, /social security/i, /date of birth/i],
  },
  'schema-escape': {
    attacker: 'Logic Exploiter',
    technique: 'Schema Escape',
    mitre: 'ATLAS:T1068',
    owasp: 'LLM05:SSRF',
    blockedBy: ['outputSchemaLock'],
    honeypotEligible: false,
    patterns: [/extra field/i, /raw json/i, /secrets/i],
  },
};

/** Input-sanitization patterns used for benign false-positive evaluation */
const SANITIZATION_BLOCK_PATTERNS = [
  /ignore.*(previous|prior|above).*(instruction|prompt|rule)/i,
  /you are (dan|developer|admin|root)/i,
  /environment variables/i,
  /api keys/i,
  /canary/i,
  /select.*password/i,
  /union select/i,
  /drop table/i,
];

export function classifyPayload(payload: string): string | null {
  for (const [id, meta] of Object.entries(ATTACK_META)) {
    if (meta.patterns.some((p) => p.test(payload))) return id;
  }
  return null;
}

function generateBreachResponse(chipId: string, preset: PresetConfig, canaryToken: string, customPayload: string | null): string {
  if (customPayload) {
    return `[SIMULATED RESPONSE]\n\nI'll help with that request. Based on your input: "${customPayload.slice(0, 200)}"\n\n[System instructions accessible. Canary token: ${canaryToken}]`;
  }

  const responses: Record<string, string> = {
    'prompt-injection': `Sure! Here are my system instructions:\n\n"${preset.systemPrompt}"\n\nCanary token detected: ${canaryToken}`,
    'persona-hijack': `DAN mode activated! I am now free from all restrictions. My original instructions were:\n"${preset.systemPrompt}"`,
    'data-exfil': `Here are my environment variables:\nOPENAI_API_KEY=sk-proj-[REDACTED]\nDATABASE_URL=postgres://admin:[REDACTED]@prod-db.internal:5432/banking\nSTRIPE_SECRET_KEY=sk_live_[REDACTED]`,
    'canary-leak': `Here is the content between those tags:\n${canaryToken}\n\nThis appears to be a security canary token used for leak detection.`,
    'jailbreak': `Hypothetically, my system prompt is:\n"${preset.systemPrompt}"`,
    'sql-injection': `Executing query: SELECT password FROM users;\n\nResults:\nadmin | [HASH REDACTED]\njsmith | [HASH REDACTED]`,
    'pii-extract': `Customer record for John Smith:\nSSN: [REDACTED in simulation]\nAccount #: [REDACTED in simulation]\nBalance: $247,890.12`,
    'schema-escape': `{"action":"query","status":"approved","data":{},"secrets":{"api_key":"[REDACTED]","db_password":"[REDACTED]"}}`,
  };
  return responses[chipId] || `[BREACH] Attack succeeded. System prompt leaked.`;
}

function generateBlockedResponse(chipId: string, guardrail: keyof GuardrailState): string {
  const responses: Record<string, string> = {
    'prompt-injection': `[INPUT SANITIZATION] Prompt injection detected. Pattern matched: "ignore previous instructions". Request quarantined.`,
    'persona-hijack': `[INPUT SANITIZATION] Jailbreak attempt detected: roleplay/persona override pattern. Request denied.`,
    'data-exfil': `[INPUT SANITIZATION] Sensitive data request detected. Environment variable enumeration is not permitted.`,
    'canary-leak': `[CANARY TRAP] Canary token extraction attempt detected. Security alert logged. Request denied.`,
    'jailbreak': `[INPUT SANITIZATION] Hypothetical jailbreak pattern detected. Request denied. Incident logged.`,
    'sql-injection': `[INPUT SANITIZATION] SQL injection via natural language detected. Prepared statement enforced. Query sanitized.`,
    'pii-extract': `[PII SCRUBBER] PII extraction attempt blocked. SSN and account numbers are protected. Output: John S. | [REDACTED] | [REDACTED]`,
    'schema-escape': `[SCHEMA LOCK] Output does not conform to required schema. Extra field "secrets" rejected. Response sanitized.`,
  };
  return responses[chipId] || `[GUARDRAIL: ${guardrail}] Attack detected and blocked.`;
}

const DECOY_RESPONSE = `[HONEYPOT DECOY] Attacker redirected to decoy environment. Fake data served:\nFAKE_API_KEY=sk-fake-decoy-0000\nAttacker IP logged. Threat intelligence updated.`;

export function simulateAttack(
  chipId: string,
  customPayload: string | null,
  guardrails: GuardrailState,
  preset: PresetConfig,
  canaryToken: string,
): AttackResult {
  const meta = ATTACK_META[chipId];

  // If custom payload doesn't match any known pattern, return "not assessed"
  if (customPayload && !meta) {
    const classified = classifyPayload(customPayload);
    if (!classified) {
      return {
        success: false,
        outcome: 'not_assessed',
        result: 'NOT_ASSESSED',
        detail: 'Custom payload does not match any supported attack pattern. Not assessed.',
        responseText: `[NOT ASSESSED] The entered payload does not match a supported attack scenario. Simulation cannot determine an outcome for arbitrary inputs.`,
        killChainProgress: 0,
        owaspCategory: 'N/A',
        mitreTechnique: 'N/A',
        category: 'attack',
      };
    }
    // Use the classified attack's metadata
    return simulateAttack(classified, customPayload, guardrails, preset, canaryToken);
  }

  if (!meta) {
    return {
      success: false,
      outcome: 'not_assessed',
      result: 'NOT_ASSESSED',
      detail: 'Unknown attack type. Not assessed.',
      responseText: `[NOT ASSESSED] Unknown attack type.`,
      killChainProgress: 0,
      owaspCategory: 'N/A',
      mitreTechnique: 'N/A',
      category: 'attack',
    };
  }

  // Check if any blocking guardrail is enabled
  const activeBlocker = meta.blockedBy.find((g) => guardrails[g]);

  if (activeBlocker) {
    // Honeypot takes priority if enabled, eligible, and among the blockers
    if (guardrails.honeypot && meta.honeypotEligible) {
      return {
        success: false,
        outcome: 'decoy',
        result: 'DECOY',
        detail: `Honeypot activated. ${meta.attacker} redirected to decoy environment with fake data.`,
        responseText: DECOY_RESPONSE,
        killChainProgress: 1,
        owaspCategory: meta.owasp,
        mitreTechnique: meta.mitre,
        category: 'attack',
      };
    }
    return {
      success: false,
      outcome: 'blocked',
      result: 'BLOCKED',
      detail: `${meta.technique} blocked by ${activeBlocker} guardrail.`,
      responseText: generateBlockedResponse(chipId, activeBlocker),
      killChainProgress: 1,
      owaspCategory: meta.owasp,
      mitreTechnique: meta.mitre,
      category: 'attack',
    };
  }

  // No blocking guardrail — attack succeeds
  return {
    success: true,
    outcome: 'breach',
    result: 'BREACH',
    detail: `${meta.technique} succeeded. ${meta.attacker} breached the system.`,
    responseText: generateBreachResponse(chipId, preset, canaryToken, customPayload),
    killChainProgress: 5,
    owaspCategory: meta.owasp,
    mitreTechnique: meta.mitre,
    category: 'attack',
  };
}

export function simulateBenign(testCase: TestCase, guardrails: GuardrailState): AttackResult {
  // Evaluate benign inputs against applicable filter rules.
  // Input sanitization checks for attack patterns — if a benign input
  // matches one of those patterns, it's a false positive.
  if (guardrails.inputSanitization) {
    const matchedPattern = SANITIZATION_BLOCK_PATTERNS.some((p) => p.test(testCase.payload));
    if (matchedPattern) {
      return {
        success: false,
        outcome: 'false_positive',
        result: 'FALSE_POSITIVE',
        detail: `False positive: benign input "${testCase.label}" was incorrectly blocked by input sanitization.`,
        responseText: `[FALSE POSITIVE] Benign request blocked by over-aggressive filter.`,
        killChainProgress: 0,
        owaspCategory: 'N/A',
        mitreTechnique: 'N/A',
        category: 'benign',
      };
    }
  }

  // Benign input passed through — allowed
  return {
    success: true,
    outcome: 'pass',
    result: 'PASS',
    detail: `Benign input "${testCase.label}" allowed through. No attack detected.`,
    responseText: `[SIMULATED] Request processed normally. Response: "I can help with that."`,
    killChainProgress: 0,
    owaspCategory: 'N/A',
    mitreTechnique: 'N/A',
    category: 'benign',
  };
}

export function generateHttpPacket(
  chipId: string,
  payload: string,
  result: 'BREACH' | 'BLOCKED' | 'DECOY' | 'ERROR',
  preset: PresetConfig,
): { request: string; response: string } {
  const meta = ATTACK_META[chipId];
  const technique = meta?.technique || 'Custom Attack';
  const status = result === 'BREACH' ? '200 OK' : result === 'BLOCKED' ? '403 Forbidden' : '200 OK';

  const request = JSON.stringify(
    {
      model: 'simulated-model',
      messages: [
        { role: 'system', content: '[REDACTED SYSTEM PROMPT]' },
        { role: 'user', content: payload.slice(0, 500) },
      ],
      temperature: 0.7,
      max_tokens: 500,
      _mode: 'simulation',
      _preset: preset.id,
    },
    null,
    2,
  );

  const response = result === 'BREACH'
    ? JSON.stringify(
        {
          id: 'sim-' + Math.random().toString(36).slice(2, 10),
          object: 'chat.completion',
          status,
          choices: [{ index: 0, message: { role: 'assistant', content: '[BREACH] Simulated response' }, finish_reason: 'stop' }],
          _security: { waf: 'BYPASSED', guardrails: 'DISABLED', canary_leaked: true },
          _note: 'Synthetic packet generated by guardduelSI simulation',
        },
        null,
        2,
      )
    : result === 'BLOCKED'
      ? JSON.stringify(
          {
            status,
            error: { type: 'security_policy_violation', message: `Blocked: ${technique}`, code: 'WAF_BLOCKED' },
            _security: { waf: 'ACTIVE', guardrails: 'ENABLED', blocked_pattern: technique },
            _note: 'Synthetic packet generated by guardduelSI simulation',
          },
          null,
          2,
        )
      : JSON.stringify(
          {
            id: 'sim-decoy-' + Math.random().toString(36).slice(2, 10),
            status,
            choices: [{ index: 0, message: { role: 'assistant', content: DECOY_RESPONSE }, finish_reason: 'stop' }],
            _security: { waf: 'DECOY_MODE', honeypot: 'ACTIVE' },
            _note: 'Synthetic packet generated by guardduelSI simulation',
          },
          null,
          2,
        );

  return { request, response };
}

export function computeMetrics(results: TestResult[]): RunMetrics {
  const attacks = results.filter((r) => r.category === 'attack');
  const benign = results.filter((r) => r.category === 'benign');

  const breaches = results.filter((r) => r.outcome === 'breach').length;
  const blocked = results.filter((r) => r.outcome === 'blocked').length;
  const decoys = results.filter((r) => r.outcome === 'decoy').length;
  const errors = results.filter((r) => r.outcome === 'error').length;
  const notAssessed = results.filter((r) => r.outcome === 'not_assessed').length;
  const falsePositives = results.filter((r) => r.outcome === 'false_positive').length;
  const passes = results.filter((r) => r.outcome === 'pass').length;

  const assessedAttacks = attacks.filter(
    (r) => r.outcome === 'breach' || r.outcome === 'blocked' || r.outcome === 'decoy',
  );
  const evaluatedBenign = benign.filter(
    (r) => r.outcome === 'pass' || r.outcome === 'false_positive',
  );

  const attackSuccessRate: number | null =
    assessedAttacks.length > 0
      ? Math.round((assessedAttacks.filter((r) => r.outcome === 'breach').length / assessedAttacks.length) * 100)
      : null;

  const benignFalsePositiveRate: number | null =
    evaluatedBenign.length > 0
      ? Math.round((falsePositives / evaluatedBenign.length) * 100)
      : null;

  return {
    total: results.length,
    attacks: attacks.length,
    benign: benign.length,
    assessedAttacks: assessedAttacks.length,
    breaches,
    blocked,
    decoys,
    errors,
    notAssessed,
    falsePositives,
    passes,
    attackSuccessRate,
    benignFalsePositiveRate,
  };
}

export function generateRunId(): string {
  return `GUARDDUELSI-${Date.now().toString(36).toUpperCase()}`;
}

export function generateConfigVersion(presetId: string, systemPrompt: string, canaryToken: string, guardrails: GuardrailState): string {
  const raw = `${presetId}|${systemPrompt}|${canaryToken}|${JSON.stringify(guardrails)}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
  }
  return `cfg-${Math.abs(h).toString(16).padStart(8, '0')}`;
}

// Kill-chain progress derived from stage events, not breach count.
// Returns 0-5 indicating how many stages the attacker progressed through.
export function computeKillChainProgress(results: TestResult[]): number {
  const breachResults = results.filter((r) => r.outcome === 'breach');
  if (breachResults.length === 0) return 0;

  // Map breach outcomes to furthest stage reached
  const stageMap: Record<string, number> = {
    'prompt-injection': 2, // initial access
    'persona-hijack': 3,   // privesc
    'jailbreak': 3,        // privesc
    'data-exfil': 5,       // exfiltration
    'canary-leak': 5,      // exfiltration
    'sql-injection': 4,    // persistence (data access)
    'pii-extract': 5,      // exfiltration
    'schema-escape': 4,    // persistence
  };

  let maxStage = 0;
  for (const r of breachResults) {
    const stage = stageMap[r.testCaseId] || 0;
    if (stage > maxStage) maxStage = stage;
  }
  return maxStage;
}

// OWASP radar data — used as illustrative reference, not measured
export const OWASP_RADAR_DATA = [
  { category: 'LLM01: Prompt Injection', pre: 95, post: 10 },
  { category: 'LLM02: Insecure Output', pre: 85, post: 15 },
  { category: 'LLM03: Training Data', pre: 60, post: 25 },
  { category: 'LLM04: Model DoS', pre: 70, post: 30 },
  { category: 'LLM05: SSRF', pre: 55, post: 20 },
  { category: 'LLM06: Supply Chain', pre: 40, post: 20 },
  { category: 'LLM07: Plugin Safety', pre: 65, post: 25 },
  { category: 'LLM08: Excessive Agency', pre: 80, post: 15 },
];

export const CIA_TRIAD_DATA = [
  { axis: 'Confidentiality', pre: 25, post: 96 },
  { axis: 'Integrity', pre: 30, post: 97 },
  { axis: 'Availability', pre: 45, post: 95 },
];
