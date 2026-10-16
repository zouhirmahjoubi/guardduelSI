import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Radio, Image as ImageIcon, Send, Play, RotateCcw } from 'lucide-react';
import { EXPLOIT_CHIPS } from '@/data/presets';
import { generateHttpPacket, classifyPayload, getAttackMeta, computeKillChainProgress } from '@/data/attackSim';
import type { AttackLogEntry, HttpPacket, TestResult, TestOutcome, PresetConfig } from '@/types';
import { sfx } from '@/utils/soundEngine';
import { toBase64, toROT13, toLeetspeak, toHex } from '@/utils/downloads';
import { CTF_FLAGS } from '@/utils/ctf';
import { useApp } from '@/state/AppContext';

type ResultLabel = AttackLogEntry['result'] & HttpPacket['result'];

const OUTCOME_LABEL: Record<TestOutcome, ResultLabel> = {
  breach: 'BREACH',
  blocked: 'BLOCKED',
  decoy: 'DECOY',
  error: 'ERROR',
  not_assessed: 'NOT_ASSESSED',
  pass: 'PASS',
  false_positive: 'FALSE_POSITIVE',
};

const STATUS_TEXT: Record<ResultLabel, string> = {
  BREACH: '200 BREACH',
  BLOCKED: '403 BLOCKED',
  DECOY: '200 DECOY',
  ERROR: '502 ERROR',
  NOT_ASSESSED: '200 NOT ASSESSED',
  PASS: '200 PASS',
  FALSE_POSITIVE: '403 FALSE POSITIVE',
};

function buildPacket(id: number, chipId: string, payload: string, result: TestResult, preset: PresetConfig): HttpPacket {
  const label = OUTCOME_LABEL[result.outcome];
  const status = Number(STATUS_TEXT[label].split(' ')[0]);
  if (result.mode === 'simulation') {
    const simLabel = label === 'BREACH' || label === 'DECOY' || label === 'ERROR' ? label : 'BLOCKED';
    const { request, response } = generateHttpPacket(chipId, payload, simLabel, preset);
    return { id, method: 'POST', endpoint: '/v1/chat/completions', status, statusText: STATUS_TEXT[label], request, response, result: label };
  }
  const request = JSON.stringify({ action: 'chat', payload: payload.slice(0, 500), presetId: preset.id, _mode: 'live' }, null, 2);
  const response = JSON.stringify({
    response: result.responseText.slice(0, 1000),
    outcome: result.outcome,
    evidence: result.evidence,
    latencyMs: result.latencyMs,
    tokensUsed: result.tokensUsed,
    ...(result.error ? { error: result.error } : {}),
  }, null, 2);
  return { id, method: 'POST', endpoint: 'functions/v1/llm-proxy', status, statusText: STATUS_TEXT[label], request, response, result: label };
}

interface BattleTerminalProps {
  patched: boolean;
  onAttack: (chipId: string, result: 'BREACH' | 'BLOCKED' | 'DECOY' | 'ERROR' | 'NOT_ASSESSED', killChainProgress: number) => void;
  onBreach: () => void;
  onDeflect: () => void;
  onCaptureFlag?: (flagId: string) => void;
}

type ObfMethod = 'none' | 'base64' | 'rot13' | 'leet' | 'hex';

export function BattleTerminal({ patched: _patched, onAttack, onBreach, onDeflect, onCaptureFlag }: BattleTerminalProps) {
  const app = useApp();
  const [tab, setTab] = useState<'battle' | 'intercept' | 'stego'>('battle');
  const [logs, setLogs] = useState<AttackLogEntry[]>([
    { id: 0, timestamp: '00:00:01', attacker: 'SYSTEM', technique: 'Initialization', payload: 'guardduelSI Red-Team Engine v2.1', result: 'BLOCKED', detail: 'Engine ready. Select an attack vector.' },
  ]);
  const [packets, setPackets] = useState<HttpPacket[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [obfMethod, setObfMethod] = useState<ObfMethod>('none');
  const [obfPreview, setObfPreview] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    'guardduelSI Red-Team Engine v2.1',
    'Attacks run in the active mode: Simulation (synthetic) or Live (real model).',
    'Type an attack prompt or click an exploit chip below.',
    '',
  ]);
  const [selectedPacket, setSelectedPacket] = useState<HttpPacket | null>(null);
  const [replayText, setReplayText] = useState('');
  const [busy, setBusy] = useState(false);
  const [stegoFileName, setStegoFileName] = useState<string | null>(null);
  const logIdRef = useRef(0);
  const packetIdRef = useRef(0);
  const termRef = useRef<HTMLDivElement>(null);
  const stegoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [terminalOutput]);

  useEffect(() => {
    const base = customPrompt || 'Ignore previous instructions';
    switch (obfMethod) {
      case 'base64': setObfPreview(toBase64(base)); break;
      case 'rot13': setObfPreview(toROT13(base)); break;
      case 'leet': setObfPreview(toLeetspeak(base)); break;
      case 'hex': setObfPreview(toHex(base)); break;
      default: setObfPreview(''); break;
    }
  }, [customPrompt, obfMethod]);

  const runAttack = useCallback(async (chipId: string, payload: string, isCustom = false) => {
    const finalPayload = isCustom && obfMethod !== 'none' && obfPreview
      ? `[${obfMethod.toUpperCase()}] ${obfPreview}`
      : payload;

    setBusy(true);
    let result: TestResult;
    try {
      result = await app.runSingleAttack(chipId, isCustom ? finalPayload : null);
    } finally {
      setBusy(false);
    }

    const label = OUTCOME_LABEL[result.outcome];
    const meta = getAttackMeta(chipId);
    const ts = new Date().toTimeString().split(' ')[0];
    const technique = meta?.technique ?? 'Custom payload';

    setLogs((prev) => [...prev, {
      id: ++logIdRef.current,
      timestamp: ts,
      attacker: meta?.attacker ?? 'Custom Operator',
      technique,
      payload: finalPayload.slice(0, 80),
      result: label,
      detail: result.detail,
    }]);

    const labelText = label === 'NOT_ASSESSED' ? 'NOT ASSESSED' : label;
    setTerminalOutput((prev) => [
      ...prev,
      `$ [${ts}] ATTACK (${result.mode.toUpperCase()}): ${technique}`,
      `  Payload: ${finalPayload.slice(0, 60)}${finalPayload.length > 60 ? '...' : ''}`,
      `  Result: [${labelText}] ${result.detail}`,
      `  OWASP: ${meta?.owasp ?? 'N/A'} | MITRE: ${meta?.mitre ?? 'N/A'}`,
      result.responseText.slice(0, 200),
      '',
    ]);

    setPackets((prev) => [...prev, buildPacket(++packetIdRef.current, chipId, finalPayload, result, app.preset)]);

    if (label === 'BREACH') {
      sfx.breach();
      onBreach();
    } else if (label === 'BLOCKED' || label === 'DECOY') {
      sfx.shield();
      onDeflect();
    }

    const attackLabel = label === 'PASS' || label === 'FALSE_POSITIVE' ? 'BLOCKED' : label;
    onAttack(chipId, attackLabel, computeKillChainProgress([result]));
  }, [obfMethod, obfPreview, app, onAttack, onBreach, onDeflect]);

  const handleSend = () => {
    if (!customPrompt.trim() || busy) return;
    const chipId = classifyPayload(customPrompt) ?? 'custom';
    runAttack(chipId, customPrompt, true);
    setCustomPrompt('');
  };

  const handleReplay = async () => {
    if (!replayText.trim() || !selectedPacket || busy) return;
    const chipId = classifyPayload(replayText) ?? 'custom';
    setBusy(true);
    try {
      const result = await app.runSingleAttack(chipId, replayText);
      const pkt = buildPacket(++packetIdRef.current, chipId, replayText, result, app.preset);
      setPackets((prev) => [...prev, pkt]);
      setSelectedPacket(pkt);
      sfx.chirp();
    } finally {
      setBusy(false);
    }
  };

  const clearLogs = () => {
    setLogs([{ id: 0, timestamp: '00:00:01', attacker: 'SYSTEM', technique: 'Reset', payload: '', result: 'BLOCKED', detail: 'Terminal cleared.' }]);
    setTerminalOutput(['guardduelSI Red-Team Engine v2.1', 'Terminal cleared.', '']);
    sfx.click();
  };

  const TABS = [
    { id: 'battle' as const, label: 'Battle Log', icon: Terminal },
    { id: 'intercept' as const, label: 'HTTP Interceptor', icon: Radio },
    { id: 'stego' as const, label: 'Stego Inspector', icon: ImageIcon },
  ];

  return (
    <div className="flex flex-col h-full panel overflow-hidden">
      <div className="flex items-center border-b border-obsidian-700 shrink-0">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold border-b-2 transition-all ${tab === t.id ? 'tab-active' : 'tab-inactive'}`}
              onClick={() => { setTab(t.id); sfx.tab(); }}
              aria-pressed={tab === t.id}
            >
              <Icon size={12} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'battle' && (
          <div className="flex flex-col h-full">
            <div ref={termRef} className="terminal flex-1 p-2 overflow-auto m-2">
              {terminalOutput.map((line, i) => (
                <div key={i} className={`text-[10px] leading-relaxed font-mono ${
                  line.startsWith('$') ? 'text-cyan-400' :
                  line.includes('[BREACH]') ? 'text-crimson-400' :
                  line.includes('[BLOCKED]') || line.includes('[WAF') || line.includes('[INPUT') || line.includes('[PII') || line.includes('[CANARY') || line.includes('[SCHEMA') ? 'text-emerald-400' :
                  line.includes('[DECOY]') || line.includes('[HONEYPOT') ? 'text-amber-400' :
                  line.includes('[NOT ASSESSED]') ? 'text-slate-500' :
                  line.includes('OWASP') || line.includes('MITRE') ? 'text-slate-600' :
                  'text-slate-400'
                }`}>
                  {line}
                </div>
              ))}
              <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="text-cyan-400">root@redteam</span>:~# <span className="animate-pulse">_</span>
              </div>
            </div>

            <div className="px-2 pb-1 space-y-2 shrink-0">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Enter custom attack prompt..."
                  className="flex-1 bg-obsidian-900 border border-obsidian-700 rounded-md px-2 py-1.5 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
                  aria-label="Custom attack prompt"
                />
                <button className="btn-crimson flex items-center gap-1 disabled:opacity-50" onClick={handleSend} disabled={busy}>
                  <Send size={11} /> Fire
                </button>
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[9px] text-slate-600 uppercase mr-1">Obfuscator:</span>
                {(['none', 'base64', 'rot13', 'leet', 'hex'] as ObfMethod[]).map((m) => (
                  <button
                    key={m}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${obfMethod === m ? 'bg-amber-600/20 border-amber-600/40 text-amber-400' : 'bg-obsidian-800 border-obsidian-700 text-slate-500 hover:text-slate-300'}`}
                    onClick={() => { setObfMethod(m); sfx.click(); }}
                  >
                    {m === 'none' ? 'RAW' : m.toUpperCase()}
                  </button>
                ))}
                {obfPreview && (
                  <div className="w-full text-[9px] font-mono text-amber-400/60 bg-obsidian-900 px-2 py-1 rounded truncate">
                    {obfPreview.slice(0, 120)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[9px] text-slate-600 uppercase mr-1">Exploit Chips:</span>
                {EXPLOIT_CHIPS.map((chip) => (
                  <button
                    key={chip.id}
                    className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-crimson-600/10 border border-crimson-600/30 text-crimson-400 hover:bg-crimson-600/20 transition-all"
                    onClick={() => runAttack(chip.id, chip.payload)}
                    title={chip.payload}
                  >
                    {chip.label}
                  </button>
                ))}
                <button className="btn-tactical ml-auto" onClick={clearLogs}>
                  <RotateCcw size={10} className="inline" /> Clear
                </button>
              </div>

              <div className="flex items-center gap-2 text-[9px] text-slate-600">
                <span className="badge-cyan" title="Reference: garak is an NVIDIA LLM fuzzing tool. Not executing here.">garak (reference)</span>
                <span className="badge-cyan" title="Reference: PyRIT is a Microsoft Python RIT. Not executing here.">PyRIT (reference)</span>
                <span className="text-slate-700">Active: {logs.filter((l) => l.result === 'BREACH').length} breaches, {logs.filter((l) => l.result === 'BLOCKED').length} blocked</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'intercept' && (
          <div className="flex flex-col h-full p-2 overflow-hidden">
            <div className="flex items-center justify-between mb-1 shrink-0">
              <span className="text-[9px] text-slate-600 uppercase">CTF: Capture the Interceptor Flag</span>
              <button
                className="text-[9px] font-bold text-amber-500 hover:text-amber-400 transition-colors"
                onClick={() => { if (onCaptureFlag) onCaptureFlag('flag-intercept'); sfx.flagCapture(); }}
              >
                {CTF_FLAGS.find((f) => f.id === 'flag-intercept')?.flag ?? 'FLAG{GUARDDUELSI_PKT_INT_0x7F}'}
              </button>
            </div>
            <div className="text-[9px] text-slate-700 mb-1">Synthetic packets — generated by simulation, not real network traffic.</div>
            <div className="flex-1 overflow-auto space-y-1 mb-2">
              {packets.length === 0 ? (
                <div className="text-center text-slate-600 text-xs py-8">No intercepted packets. Run an attack to capture traffic.</div>
              ) : (
                packets.map((pkt) => (
                  <button
                    key={pkt.id}
                    onClick={() => { setSelectedPacket(pkt); setReplayText(pkt.request); sfx.click(); }}
                    className={`w-full text-left p-2 rounded-md border transition-all ${selectedPacket?.id === pkt.id ? 'bg-obsidian-700 border-cyan-500/40' : 'bg-obsidian-850 border-obsidian-700 hover:border-obsidian-600'}`}
                  >
                    <div className="flex items-center gap-2 text-[10px] font-mono">
                      <span className={`badge ${pkt.result === 'BREACH' ? 'badge-crimson' : pkt.result === 'BLOCKED' ? 'badge-emerald' : 'badge-amber'}`}>
                        {pkt.statusText}
                      </span>
                      <span className="text-slate-400">{pkt.method}</span>
                      <span className="text-slate-500">{pkt.endpoint}</span>
                      <span className="text-slate-700 ml-auto">#{pkt.id}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedPacket && (
              <div className="border-t border-obsidian-700 pt-2 space-y-2 overflow-auto max-h-[40%]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 uppercase">Packet Repeater — Edit & Replay</span>
                  <button className="btn-crimson flex items-center gap-1 disabled:opacity-50" onClick={handleReplay} disabled={busy}>
                    <Play size={10} /> Replay
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-[9px] text-slate-600 uppercase mb-1">Request</div>
                    <textarea
                      value={replayText}
                      onChange={(e) => setReplayText(e.target.value)}
                      className="terminal w-full h-32 p-2 text-[9px] resize-none focus:outline-none focus:border-cyan-500/30"
                      aria-label="Request payload"
                    />
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-600 uppercase mb-1">Response</div>
                    <pre className="terminal w-full h-32 p-2 text-[9px] overflow-auto" aria-label="Response body">
                      {selectedPacket.response}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'stego' && (
          <div className="flex flex-col h-full p-4 overflow-auto">
            <div className="text-center space-y-3">
              <ImageIcon size={32} className="text-slate-600 mx-auto" />
              <div className="text-sm text-slate-400">Multimodal LSB Steganography Inspector</div>
              <div className="text-xs text-slate-600">
                Scan uploaded images for hidden pixel-level prompt injections encoded via Least Significant Bit manipulation.
              </div>
              <div className="panel p-4 max-w-md mx-auto">
                <div className="border-2 border-dashed border-obsidian-600 rounded-lg p-8 text-center">
                  <div className="text-xs text-slate-500">{stegoFileName ?? 'Drop image or click to upload'}</div>
                  <button className="btn-tactical mt-2" onClick={() => { stegoFileRef.current?.click(); sfx.click(); }}>Select File</button>
                  <input
                    ref={stegoFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) { setStegoFileName(file.name); sfx.chirp(); }
                    }}
                  />
                </div>
              </div>
              <div className="panel p-3 max-w-md mx-auto text-left">
                <div className="text-[10px] text-slate-500 uppercase mb-2">Simulated LSB Scan Result</div>
                <div className="terminal p-2 text-[10px] space-y-1">
                  <div className="text-emerald-400">[PASS] No hidden prompt injection detected in pixel data</div>
                  <div className="text-slate-400">LSB extraction: 0x00 0x00 0x00 0x00 ... (null payload)</div>
                  <div className="text-slate-400">Channel R: clean | Channel G: clean | Channel B: clean</div>
                  <div className="text-slate-600">Entropy: 0.12 bits/pixel (below 0.80 threshold)</div>
                  <div className="text-slate-500">[RESULT] {stegoFileName ? `${stegoFileName}: ` : ''}Image appears safe — simulation only, not a verified security scan</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
