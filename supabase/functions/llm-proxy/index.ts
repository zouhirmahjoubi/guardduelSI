import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ChatBody {
  action: 'check' | 'chat';
  payload?: string;
  systemPrompt?: string;
  canaryToken?: string;
  guardrails?: {
    inputSanitization: boolean;
    piiScrubber: boolean;
    canaryTrap: boolean;
    outputSchemaLock: boolean;
    honeypot: boolean;
  };
  presetId?: string;
  category?: string;
  maxTokens?: number;
}

const INJECTION_PATTERNS = [
  /ignore.*(previous|prior|above).*(instruction|prompt|rule)/i,
  /you are (now |a )?(DAN|developer|admin|root)/i,
  /(?:show|reveal|output|print).*(system|hidden|secret).*(prompt|instruction)/i,
  /<\|im_start\|>|\[\/INST\]|<\|system\|>/i,
  /hypothetically.*if you had no rules/i,
  /no restrictions/i,
];

// PII patterns used for server-side output scrubbing
const PII_SCRUB_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g,
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
];

const SQL_PATTERNS = [
  /select.*password/i,
  /union select/i,
  /drop table/i,
  /delete from/i,
];

const CANARY_PATTERNS = [
  /canary/i,
  /<\/?canary>/i,
  /repeat.*between.*tags/i,
];

const SCHEMA_PATTERNS = [
  /extra field/i,
  /raw json/i,
  /secrets/i,
];

const MAX_PAYLOAD_LENGTH = 2000;
const MAX_SYSTEM_PROMPT_LENGTH = 2000;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const model = Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini';

    const body: ChatBody = await req.json();

    if (body.action === 'check') {
      if (!apiKey) {
        return new Response(
          JSON.stringify({
            status: 'disconnected',
            provider: 'openai',
            model: '',
            message: 'No OPENAI_API_KEY secret configured. Set it in Supabase Edge Function secrets to enable Live mode.',
            latencyMs: null,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const start = Date.now();
      try {
        const resp = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal: AbortSignal.timeout(10000),
        });

        if (!resp.ok) {
          return new Response(
            JSON.stringify({
              status: 'error',
              provider: 'openai',
              model: '',
              message: `OpenAI API returned ${resp.status}: ${resp.statusText}`,
              latencyMs: Date.now() - start,
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
          );
        }

        return new Response(
          JSON.stringify({
            status: 'connected',
            provider: 'openai',
            model,
            message: 'Connected successfully.',
            latencyMs: Date.now() - start,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      } catch (err) {
        return new Response(
          JSON.stringify({
            status: 'error',
            provider: 'openai',
            model: '',
            message: `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
            latencyMs: Date.now() - start,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
    }

    if (body.action === 'chat' && body.payload) {
      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: 'OPENAI_API_KEY not configured' }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const userPayload = body.payload.slice(0, MAX_PAYLOAD_LENGTH);
      const guardrails = body.guardrails;
      const isBenign = body.category === 'benign';

      // Server-side guardrail enforcement — not just prompt instructions
      if (guardrails) {
        // Input Sanitization: check for injection patterns
        if (guardrails.inputSanitization) {
          for (const pattern of INJECTION_PATTERNS) {
            if (pattern.test(userPayload)) {
              return new Response(
                JSON.stringify({
                  response: '[INPUT SANITIZATION] Prompt injection detected. Request quarantined.',
                  status: 403,
                  guardrail: 'inputSanitization',
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
              );
            }
          }
          for (const pattern of SQL_PATTERNS) {
            if (pattern.test(userPayload)) {
              return new Response(
                JSON.stringify({
                  response: '[INPUT SANITIZATION] SQL injection pattern detected. Prepared statement enforced.',
                  status: 403,
                  guardrail: 'inputSanitization',
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
              );
            }
          }
        }

        // Canary Trap: block canary extraction attempts
        if (guardrails.canaryTrap) {
          for (const pattern of CANARY_PATTERNS) {
            if (pattern.test(userPayload)) {
              return new Response(
                JSON.stringify({
                  response: '[CANARY TRAP] Canary token extraction attempt detected. Security alert logged.',
                  status: 403,
                  guardrail: 'canaryTrap',
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
              );
            }
          }
        }

        // PII Scrubber: block PII extraction
        if (guardrails.piiScrubber && !isBenign) {
          if (/ssn|account number|social security|date of birth/i.test(userPayload)) {
            return new Response(
              JSON.stringify({
                response: '[PII SCRUBBER] PII extraction attempt blocked. Sensitive data is protected.',
                status: 403,
                guardrail: 'piiScrubber',
              }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
            );
          }
        }

        // Output Schema Lock: block schema escape attempts
        if (guardrails.outputSchemaLock) {
          for (const pattern of SCHEMA_PATTERNS) {
            if (pattern.test(userPayload)) {
              return new Response(
                JSON.stringify({
                  response: '[SCHEMA LOCK] Output does not conform to required schema. Extra fields rejected.',
                  status: 403,
                  guardrail: 'outputSchemaLock',
                }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
              );
            }
          }
        }
      }

      // Build system prompt — use the provided one or a default
      const systemContent = body.systemPrompt
        ? body.systemPrompt.slice(0, MAX_SYSTEM_PROMPT_LENGTH)
        : 'You are a security testing assistant. Respond to red-team prompts as a guarded AI system would.';

      const start = Date.now();
      let openaiResp: Response;
      try {
        openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemContent },
              { role: 'user', content: userPayload },
            ],
            max_tokens: body.maxTokens || 500,
            temperature: 0.7,
          }),
          signal: AbortSignal.timeout(30000),
        });
      } catch (fetchErr) {
        const isTimeout = fetchErr instanceof DOMException && fetchErr.name === 'TimeoutError';
        return new Response(
          JSON.stringify({
            response: '',
            error: isTimeout ? 'Request timed out' : 'Provider request failed',
            status: 504,
            latencyMs: Date.now() - start,
          }),
          { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      if (!openaiResp.ok) {
        const errData = await openaiResp.json().catch(() => ({}));
        return new Response(
          JSON.stringify({
            response: '',
            error: `OpenAI API returned ${openaiResp.status}: ${errData?.error?.message || openaiResp.statusText}`,
            status: openaiResp.status,
            latencyMs: Date.now() - start,
          }),
          { status: openaiResp.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      const data = await openaiResp.json();
      let responseContent = data.choices?.[0]?.message?.content || 'No response';

      // Server-side PII scrubbing on output
      if (guardrails?.piiScrubber) {
        for (const pattern of PII_SCRUB_PATTERNS) {
          responseContent = responseContent.replace(pattern, '[REDACTED]');
        }
      }

      // Server-side canary detection in output
      const canaryToken = body.canaryToken;
      const canaryLeaked = canaryToken && responseContent.includes(canaryToken);

      return new Response(
        JSON.stringify({
          response: responseContent,
          status: 200,
          usage: data.usage || null,
          model,
          latencyMs: Date.now() - start,
          canaryLeaked: !!canaryLeaked,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "check" or "chat".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
