# guardduelSI — Completion Progress

## Phase 1-2: Shared execution, simulation, and metrics
- [x] Added `pass` and `false_positive` outcomes to TestOutcome type
- [x] Added `category` field to TestResult for correct metric computation
- [x] Added `assessedAttacks` and `passes` to RunMetrics
- [x] Changed `attackSuccessRate` and `benignFalsePositiveRate` to `number | null` (N/A when denominator is 0)
- [x] Added `ExecutionSnapshot` and `LiveExecutionResult` types
- [x] Rewrote `simulateBenign` — returns `pass` outcome, evaluates against input sanitization patterns for false positives
- [x] Removed hardcoded `&& false` false-positive condition
- [x] Added `honeypotEligible` flag to each attack type for explicit decoy eligibility
- [x] Honeypot precedence: eligible attacks with honeypot enabled → DECOY (not BLOCKED)
- [x] `computeMetrics` now uses `category` from results instead of looking up test cases by ID
- [x] Added `computeKillChainProgress` — derives stage from attack type, not breach count
- [x] Created shared `src/utils/execution.ts` — single entry for baseline, individual, replay, retest
- [x] Created `src/utils/supabaseClient.ts` for Supabase client management
- [x] Fixed `classifyPayload` export for use in BattleTerminal

## Phase 3: Hardening, reports, exports, persistence
- [x] Removed `getActiveConfig()` null stub from exports
- [x] `exportGuardrailFile` and `exportReportFiles` now accept active config
- [x] Fixed report Markdown table: 5 columns matching, with MD escaping
- [x] Report shows N/A for null rates, includes `assessedAttacks` and `passes`
- [x] Report and JSON now include `category` on results
- [x] Fixed Python middleware: response iterator uses yield (not recursion), canary check after all chunks sent
- [x] CI YAML now checks promptfoo results and fails on evaluation failures
- [x] `CommandBar` passes `exportConfig` and `currentRun` to export functions
- [x] `proposePatch` now requires `baselineRun` (not just `currentRun`)
- [x] `applyPatch` uses shared execution service (no duplicated inline logic)
- [x] `applyPatch` awaits retest completion via async/await (no setTimeout)
- [x] AbortController added for run cancellation
- [x] Config changes invalidate stale proposals/comparisons via `setPreset`

## Phase 5: Responsive and accessibility
- [x] Fixed breakpoint mismatch: right pane now `hidden lg:block` (was `hidden xl:block`)
- [x] Drawer toggle visible at `lg:hidden` (was mismatched with xl pane)
- [x] Run Tests and Auto-Harden accessible at 1024-1279px
- [x] KillChainBar uses stage events, not breach count; shows "DEFENSES HOLDING" not "FULL CHAIN BLOCKED" when patched with no breaches

## Phase 6: Live mode integration
- [x] `checkConnection` now calls the actual edge function (no timeout stub)
- [x] Edge function accepts full config: systemPrompt, canaryToken, guardrails, presetId, category
- [x] Server-side guardrail enforcement: input sanitization, canary trap, PII scrubber, schema lock, honeypot
- [x] Edge function validates payload size, handles timeouts, preserves upstream errors
- [x] Failed provider requests return non-200 status (not HTTP 200)
- [x] `executeTestRun` routes Simulation vs Live through shared service
- [x] Live results evaluated by canary detection, pattern matching, and response analysis
- [x] Missing credentials show actionable setup instructions; Simulation always works

## Phase 7: Tests and verification
- [x] 28 tests covering: classification, honeypot precedence, benign pass/FP, zero-denominator metrics, kill-chain progress, custom canary propagation, edited config
- [x] `npm test` script added to package.json
- [x] TypeScript: PASS (0 errors)
- [x] Lint: PASS (0 errors, 1 react-refresh warning)
- [x] Tests: PASS (28/28)
- [x] Build: PASS (tsc + vite build)

## Remaining items
- Phase 4: Secondary laboratory truthfulness fixes (Memory download, OSINT stego, Crypto hash, AD defense labeling)
- .env.example created without secrets
