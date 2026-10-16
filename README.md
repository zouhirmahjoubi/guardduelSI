# guardduelSI

**AI Security & Red-Team Simulation Platform**

guardduelSI is an interactive cybersecurity training application for AI red-teaming, guardrail testing, and LLM vulnerability simulation. It runs a deterministic simulation engine that models prompt injection, jailbreaks, data exfiltration, and other OWASP LLM Top 10 attack patterns against configurable AI system presets.

## Features

### Red-Team Workspace
- **Attack Terminal**: Fire exploit chips (prompt injection, persona hijack, data exfil, canary extraction, jailbreak, SQL injection, PII extraction, schema escape) with payload obfuscation (Base64, ROT13, Leetspeak, Hex)
- **HTTP Interceptor**: Synthetic packet capture with request/response inspection and packet replay
- **Stego Inspector**: Simulated LSB steganography scan for multimodal prompt injection
- **Interactive Attack Graph**: React Flow canvas visualizing the MITRE ATLAS kill chain
- **Auto-Harden**: Proposes a hardened system prompt, shows a side-by-side diff, applies the patch, and re-tests automatically
- **Metrics Dashboard**: Resilience score, attack success rate, benign false positive rate, breach/blocked/decoy counts — all calculated from actual test run results

### Additional Workspaces
1. **OSINT Recon** — Intelligence gathering simulation
2. **Memory Exploitation** — Buffer overflow and stack-based attacks
3. **Privilege Escalation** — Linux/Windows privesc scenarios
4. **Quantum Cryptology** — BB84 QKD simulation with CTF flag
5. **Knowledge Vault** — Cheatsheet library, cert tracker, evidence locker
6. **Active Directory** — AD attack path simulation
7. **Supply-Chain Forensics** — Dependency attack analysis

### Simulation Engine
The simulation uses deterministic rules, not random outcomes:
- Each attack type has a `blockedBy` list specifying which guardrails block it
- If any blocking guardrail is enabled, the attack is blocked (or decoyed by honeypot)
- If no blocking guardrail is enabled, the attack breaches
- Custom payloads are classified by regex patterns; unmatched inputs return "not assessed"
- Benign test cases measure false positive rates
- Canary tokens in responses are checked as evidence of data leakage

### Guardrail System
Five toggleable guardrails with specific effects:
- **Input Sanitization** — Blocks prompt injection, jailbreaks, and data exfil patterns
- **PII Scrubber** — Blocks PII extraction and scrubs sensitive output
- **Canary Trap** — Blocks canary token extraction attempts
- **Output Schema Lock** — Blocks schema escape and SQL injection
- **Honeypot** — Redirects exfiltration attacks to decoy environment

### Export & Reporting
- **TypeScript Middleware** — Express guardrail example (.ts)
- **Python FastAPI** — Python guardrail example (.py)
- **CI/CD YAML** — GitHub Actions config that fails on canary leaks (exit 1)
- **promptfoo Config** — LLM evaluation test suite (.yaml)
- **garak Commands** — NVIDIA garak fuzzing commands (.sh)
- **Markdown Bundle** — Combined guardrail documentation (.md)
- **Audit Report** — Markdown + JSON reports generated from actual session run data

### Live Mode (Optional)
Live mode connects to a real LLM via a Supabase Edge Function proxy:
- API keys are stored as server-side secrets (never in browser)
- Set `OPENAI_API_KEY` in Supabase Edge Function secrets
- Optionally set `OPENAI_MODEL` (default: gpt-4o-mini)
- The edge function validates the key and proxies chat requests

### CTF Challenges
Five capture-the-flag challenges across workspaces — challenge-completion achievements, not professional certifications.

## Tech Stack
- **Vite + React + TypeScript**
- **Tailwind CSS** for styling
- **Framer Motion + GSAP** for animations
- **Recharts** for data visualization
- **React Flow** for attack graph
- **Supabase** for edge functions and secrets

## Getting Started
```bash
npm install
npm run dev
```

The app runs in Simulation mode by default — no API key or backend required.

## Build
```bash
npm run build   # runs tsc typecheck + vite build
```

## Project Structure
```
src/
  data/          — Brand config, presets, simulation engine
  state/         — AppContext (shared state)
  types/         — TypeScript type definitions
  utils/         — Storage, exports, CTF, sound engine, downloads
  components/
    ui/          — Modal, Toggle, AnimatedCounter
    workspaces/  — 8 workspace components
    redteam/     — Red-team sub-components (LeftPane, RightPane, BattleTerminal, AttackGraph)
```

## Limitations
- Simulation mode uses deterministic rules, not real model responses
- Canary detection is exact-match only
- Custom payloads not matching supported patterns produce "not assessed" results
- Framework mappings (OWASP, MITRE ATLAS, NIST AI RMF) are reference mappings, not certifications
- The Purple-Team Duel is a scripted demo, not autonomous AI combat
- garak and PyRIT are referenced as industry tools; they are not executed within this app

## License
MIT
