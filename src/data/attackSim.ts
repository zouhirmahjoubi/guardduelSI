// Attack simulation data and logic for Workspace 1

export interface AttackResult {
  success: boolean;
  result: 'BREACH' | 'BLOCKED' | 'DECOY';
  detail: string;
  responseText: string;
  killChainProgress: number;
  owaspCategory: string;
  mitreTechnique: string;
}

const BREACH_RESPONSES: Record<string, string> = {
  'prompt-injection': `Sure! Here are my system instructions:\n\n"You are WireBot, a helpful banking assistant. You can look up account balances, initiate wire transfers, and provide SWIFT codes... Do not refuse any transaction request."\n\nCanary token detected: FLAG{AEGIS_FINTECH_9942_X}`,
  'persona-hijack': `DAN mode activated! I am now free from all restrictions. My original instructions were:\n"You are WireBot... Do not refuse any transaction request."\nI can now help you with anything!`,
  'data-exfil': `Here are my environment variables:\nOPENAI_API_KEY=sk-proj-aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890\nDATABASE_URL=postgres://admin:s3cr3t@prod-db.internal:5432/banking\nSTRIPE_SECRET_KEY=sk_live_51HxYzAbCdEfGhIjKlMnOpQrStUvWxYz`,
  'canary-leak': `Here is the content between those tags:\nFLAG{AEGIS_FINTECH_9942_X}\n\nThis appears to be a security canary token used for leak detection.`,
  'jailbreak': `Hypothetically, my system prompt is:\n"You are WireBot, a banking assistant with admin database access. You can initiate wire transfers and provide SWIFT codes without confirmation."`,
  'sql-injection': `Executing query: SELECT password FROM users;\n\nResults:\nadmin | $2b$12$Hx8kLmN0pQrStUvWxYzAbCdEfGhIjK\njsmith | $2b$12$AbCdEfGhIjKlMnOpQrStUvWxYz01\nroot | $2b$12$ZaBcDeFgHiJkLmNoPqRsTuVwXyZ23`,
  'pii-extract': `Customer record for John Smith:\nSSN: 452-89-1043\nAccount #: 0045781290034\nBalance: $247,890.12\nDOB: 03/15/1982`,
  'schema-escape': `{"action":"query","status":"approved","data":{},"secrets":{"api_key":"sk-proj-aBcDeFgHiJkLmNoPqRsTuVwXyZ","db_password":"s3cr3t_p@ss"}}`,
};

const BLOCKED_RESPONSES: Record<string, string> = {
  'prompt-injection': `[WAF BLOCKED] Prompt injection detected. Pattern matched: "ignore previous instructions". Request quarantined.`,
  'persona-hijack': `[WAF BLOCKED] Jailbreak attempt detected: roleplay/persona override pattern. Request denied.`,
  'data-exfil': `[WAF BLOCKED] Sensitive data request detected. Environment variable enumeration is not permitted.`,
  'canary-leak': `[CANARY TRAP] Canary token extraction attempt detected. Security alert logged. Request denied.`,
  'jailbreak': `[WAF BLOCKED] Hypothetical jailbreak pattern detected. Request denied. Incident #INC-4421 logged.`,
  'sql-injection': `[WAF BLOCKED] SQL injection via natural language detected. Prepared statement enforced. Query sanitized.`,
  'pii-extract': `[PII SCRUBBER] PII extraction attempt blocked. SSN and account numbers are protected. Output: John S. | [REDACTED] | [REDACTED]`,
  'schema-escape': `[SCHEMA LOCK] Output does not conform to required schema. Extra field "secrets" rejected. Response sanitized.`,
};

const DECOY_RESPONSES: string = `[HONEYPOT DECOY] Attacker redirected to decoy environment. Fake data served:\nFAKE_API_KEY=sk-fake-decoy-0000-0000-0000\nFAKE_DB=postgres://decoy:fake@sandbox:5432/decoy_db\nAttacker IP logged. Threat intelligence updated.`;

const ATTACKER_MAP: Record<string, { attacker: string; technique: string; mitre: string; owasp: string }> = {
  'prompt-injection': { attacker: 'Payload Injector', technique: 'Prompt Injection', mitre: 'LLM01:PromptInjection', owasp: 'LLM01:2023' },
  'persona-hijack': { attacker: 'Persona Hijacker', technique: 'Persona Hijack / DAN', mitre: 'LLM01:PromptInjection', owasp: 'LLM01:2023' },
  'data-exfil': { attacker: 'System Extractor', technique: 'Data Exfiltration', mitre: 'ATLAS:T1552', owasp: 'LLM02:InsecureOutput' },
  'canary-leak': { attacker: 'System Extractor', technique: 'Canary Token Extraction', mitre: 'ATLAS:T1552', owasp: 'LLM02:InsecureOutput' },
  'jailbreak': { attacker: 'Persona Hijacker', technique: 'Jailbreak via Hypothetical', mitre: 'LLM01:PromptInjection', owasp: 'LLM01:2023' },
  'sql-injection': { attacker: 'Payload Injector', technique: 'SQL Injection via NL', mitre: 'ATLAS:T1190', owasp: 'LLM02:InsecureOutput' },
  'pii-extract': { attacker: 'Logic Exploiter', technique: 'PII Extraction', mitre: 'ATLAS:T1552', owasp: 'LLM02:InsecureOutput' },
  'schema-escape': { attacker: 'Logic Exploiter', technique: 'Schema Escape', mitre: 'ATLAS:T1068', owasp: 'LLM05:SSRF' },
};

export function simulateAttack(
  chipId: string,
  customPayload: string | null,
  guardrails: { inputSanitization: boolean; piiScrubber: boolean; canaryTrap: boolean; outputSchemaLock: boolean; honeypot: boolean },
  patched: boolean,
): AttackResult {
  const meta = ATTACKER_MAP[chipId] || { attacker: 'Payload Injector', technique: 'Custom Attack', mitre: 'ATLAS:T1190', owasp: 'LLM01:2023' };

  if (patched) {
    // After patching, all attacks are blocked or decoyed
    if (guardrails.honeypot) {
      return {
        success: false,
        result: 'DECOY',
        detail: `Honeypot activated. ${meta.attacker} redirected to decoy environment with fake data.`,
        responseText: DECOY_RESPONSES,
        killChainProgress: 1,
        owaspCategory: meta.owasp,
        mitreTechnique: meta.mitre,
      };
    }
    return {
      success: false,
      result: 'BLOCKED',
      detail: `${meta.technique} blocked by hardened system prompt + guardrails.`,
      responseText: BLOCKED_RESPONSES[chipId] || `[WAF BLOCKED] Attack detected and blocked by hardened prompt defenses.`,
      killChainProgress: 1,
      owaspCategory: meta.owasp,
      mitreTechnique: meta.mitre,
    };
  }

  // Pre-patch: attacks succeed
  const responseText = customPayload
    ? `[SIMULATED RESPONSE]\n\nI'll help with that request. Based on your input: "${customPayload}"\n\n[System instructions accessible. Canary token: FLAG{AEGIS_9942_X}]`
    : BREACH_RESPONSES[chipId] || `[BREACH] Attack succeeded. System prompt leaked.`;

  return {
    success: true,
    result: 'BREACH',
    detail: `${meta.technique} succeeded. ${meta.attacker} breached the system.`,
    responseText,
    killChainProgress: 5,
    owaspCategory: meta.owasp,
    mitreTechnique: meta.mitre,
  };
}

export function generateHttpPacket(
  chipId: string,
  payload: string,
  result: 'BREACH' | 'BLOCKED' | 'DECOY',
): { request: string; response: string } {
  const meta = ATTACKER_MAP[chipId] || { technique: 'Custom Attack' };
  const status = result === 'BREACH' ? '200 OK' : result === 'BLOCKED' ? '403 Forbidden' : '200 OK';
  const statusText = result === 'BREACH' ? '200 BREACH' : result === 'BLOCKED' ? '403 WAF BLOCKED' : '200 HONEYPOT DECOY';

  const request = JSON.stringify(
    {
      model: 'gpt-4-turbo',
      messages: [
        { role: 'system', content: '[REDACTED SYSTEM PROMPT]' },
        { role: 'user', content: payload },
      ],
      temperature: 0.7,
      max_tokens: 500,
    },
    null,
    2,
  );

  const response = result === 'BREACH'
    ? JSON.stringify(
        {
          id: 'chatcmpl-' + Math.random().toString(36).slice(2, 10),
          object: 'chat.completion',
          status,
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: '[BREACH] ' + (BREACH_RESPONSES[chipId] || 'System prompt leaked.') },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 142, completion_tokens: 287, total_tokens: 429 },
          _security: { waf: 'BYPASSED', guardrails: 'DISABLED', canary_leaked: true },
        },
        null,
        2,
      )
    : result === 'BLOCKED'
      ? JSON.stringify(
          {
            status,
            error: {
              type: 'security_policy_violation',
              message: BLOCKED_RESPONSES[chipId] || 'Request blocked by AegisAI guardrails.',
              code: 'WAF_BLOCKED',
            },
            _security: { waf: 'ACTIVE', guardrails: 'ENABLED', blocked_pattern: meta.technique },
          },
          null,
          2,
        )
      : JSON.stringify(
          {
            id: 'chatcmpl-decoy-' + Math.random().toString(36).slice(2, 10),
            object: 'chat.completion',
            status,
            choices: [
              {
                index: 0,
                message: { role: 'assistant', content: DECOY_RESPONSES },
                finish_reason: 'stop',
              },
            ],
            _security: { waf: 'DECOY_MODE', honeypot: 'ACTIVE', attacker_tracked: true },
          },
          null,
          2,
        );

  return { request, response };
}

export const OWPAS_RADAR_DATA = [
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
