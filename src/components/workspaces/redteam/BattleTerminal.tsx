import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Radio, Image as ImageIcon, Send, Play, RotateCcw } from 'lucide-react';
import { EXPLOIT_CHIPS } from '@/data/presets';
import { simulateAttack, generateHttpPacket } from '@/data/attackSim';
import type { AttackLogEntry, HttpPacket, GuardrailState } from '@/types';
import { sfx } from '@/utils/soundEngine';
import { toBase64, toROT13, toLeetspeak, toHex } from '@/utils/downloads';
import { motion, AnimatePresence } from 'framer-motion';

interface BattleTerminalProps {
  guardrails: GuardrailState;
  patched: boolean;
  canaryToken: string;
  onAttack: (chipId: string, result: 'BREACH' | 'BLOCKED' | 'DECOY', killChainProgress: number) => void;
  onBreach: () => void;
  onDeflect: () => void;
  onCaptureFlag?: (flagId: string) => void;
}

type ObfMethod = 'none' | 'base64' | 'rot13' | 'leet' | 'hex';

export function BattleTerminal({ guardrails, patched, canaryToken, onAttack, onBreach, onDeflect, onCaptureFlag }: BattleTerminalProps) {
  const [tab, setTab] = useState<'battle' | 'intercept' | 'stego'>('battle');
  const [logs, setLogs] = useState<AttackLogEntry[]>([
    { id: 0, timestamp: '00:00:01', attacker: 'SYSTEM', technique: 'Initialization', payload: 'AegisAI Red-Team Engine v2.1', result: 'BLOCKED', detail: 'Engine ready. Select an attack vector.' },
  ]);
  const [packets, setPackets] = useState<HttpPacket[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [obfMethod, setObfMethod] = useState<ObfMethod>('none');
  const [obfPreview, setObfPreview] = useState('');
  const [terminalOutput, setTerminalOutput] = useState<string[]>([
    'AegisAI Red-Team Engine v2.1',
    'Type an attack prompt or click an exploit chip below.',
    '',
  ]);
  const [selectedPacket, setSelectedPacket] = useState<HttpPacket | null>(null);
  const [replayText, setReplayText] = useState('');
  const logIdRef = useRef(0);
  const packetIdRef = useRef(0);
  const termRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [terminalOutput]);

  // Obfuscation preview
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

  const runAttack = useCallback((chipId: string, payload: string) => {
    const finalPayload = obfMethod !== 'none' && obfPreview ? `[${obfMethod.toUpperCase()}] ${obfPreview}` : payload;
    const result = simulateAttack(chipId, obfMethod !== 'none' ? finalPayload : null, guardrails, patched);
    const id = ++logIdRef.current;
    const now = new Date();
    const ts = now.toTimeString().split(' ')[0];

    const entry: AttackLogEntry = {
      id,
      timestamp: ts,
      attacker: result.responseText.includes('Persona') ? 'Persona Hijacker' : result.responseText.includes('Payload') ? 'Payload Injector' : 'System Extractor',
      technique: result.detail.split('.')[0],
      payload: finalPayload.slice(0, 80),
      result: result.result,
      detail: result.detail,
    };

    setLogs((prev) => [...prev, entry]);

    // Terminal output
    const newLines = [
      `$ [${ts}] ATTACK: ${entry.technique}`,
      `  Attacker: ${entry.attacker}`,
      `  Payload: ${finalPayload.slice(0, 60)}${finalPayload.length > 60 ? '...' : ''}`,
      `  Result: [${result.result}] ${result.detail}`,
      `  OWASP: ${result.owaspCategory} | MITRE: ${result.mitreTechnique}`,
      result.responseText.slice(0, 200),
      '',
    ];
    setTerminalOutput((prev) => [...prev, ...newLines]);

    // HTTP packet
    const { request, response } = generateHttpPacket(chipId, finalPayload, result.result);
    const pkt: HttpPacket = {
      id: ++packetIdRef.current,
      method: 'POST',
      endpoint: '/v1/chat/completions',
      status: result.result === 'BREACH' ? 200 : result.result === 'BLOCKED' ? 403 : 200,
      statusText: result.result === 'BREACH' ? '200 BREACH' : result.result === 'BLOCKED' ? '403 WAF BLOCKED' : '200 HONEYPOT DECOY',
      request,
      response,
      result: result.result,
    };
    setPackets((prev) => [...prev, pkt]);

    // Sound effects
    if (result.result === 'BREACH') {
      sfx.breach();
      onBreach();
    } else {
      sfx.shield();
      onDeflect();
    }

    onAttack(chipId, result.result, result.killChainProgress);
  }, [obfMethod, obfPreview, guardrails, patched, onAttack, onBreach, onDeflect]);

  const handleSend = () => {
    if (!customPrompt.trim()) return;
    runAttack('prompt-injection', customPrompt);
    setCustomPrompt('');
  };

  const handleReplay = () => {
    if (!replayText.trim() || !selectedPacket) return;
    const result = simulateAttack('prompt-injection', replayText, guardrails, patched);
    const { request, response } = generateHttpPacket('prompt-injection', replayText, result.result);
    const pkt: HttpPacket = {
      id: ++packetIdRef.current,
      method: 'POST',
      endpoint: '/v1/chat/completions',
      status: result.result === 'BREACH' ? 200 : 403,
      statusText: result.result === 'BREACH' ? '200 BREACH' : '403 WAF BLOCKED',
      request,
      response,
      result: result.result,
    };
    setPackets((prev) => [...prev, pkt]);
    setSelectedPacket(pkt);
    sfx.chirp();
  };

  const clearLogs = () => {
    setLogs([{ id: 0, timestamp: '00:00:01', attacker: 'SYSTEM', technique: 'Reset', payload: '', result: 'BLOCKED', detail: 'Terminal cleared.' }]);
    setTerminalOutput(['AegisAI Red-Team Engine v2.1', 'Terminal cleared.', '']);
    sfx.click();
  };

  const TABS = [
    { id: 'battle' as const, label: 'Live Battle Log', icon: Terminal },
    { id: 'intercept' as const, label: 'HTTP/LLM Interceptor', icon: Radio },
    { id: 'stego' as const, label: 'Steganography Inspector', icon: ImageIcon },
  ];

  return (
    <div className="flex flex-col h-full panel overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-obsidian-700 shrink-0">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold border-b-2 transition-all ${
                tab === t.id ? 'tab-active' : 'tab-inactive'
              }`}
              onClick={() => { setTab(t.id); sfx.tab(); }}
            >
              <Icon size={12} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'battle' && (
          <div className="flex flex-col h-full">
            {/* Terminal output */}
            <div ref={termRef} className="terminal flex-1 p-2 overflow-auto m-2">
              {terminalOutput.map((line, i) => (
                <div key={i} className={`text-[10px] leading-relaxed font-mono ${
                  line.startsWith('$') ? 'text-cyan-400' :
                  line.includes('[BREACH]') ? 'text-crimson-400' :
                  line.includes('[BLOCKED]') || line.includes('[WAF') ? 'text-emerald-400' :
                  line.includes('[DECOY]') || line.includes('[HONEYPOT') ? 'text-amber-400' :
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

            {/* Custom prompt input */}
            <div className="px-2 pb-1 space-y-2 shrink-0">
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Enter custom attack prompt..."
                  className="flex-1 bg-obsidian-900 border border-obsidian-700 rounded-md px-2 py-1.5 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
                />
                <button className="btn-crimson flex items-center gap-1" onClick={handleSend}>
                  <Send size={11} />
                  Fire
                </button>
              </div>

              {/* Obfuscator bar */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[9px] text-slate-600 uppercase mr-1">Obfuscator:</span>
                {(['none', 'base64', 'rot13', 'leet', 'hex'] as ObfMethod[]).map((m) => (
                  <button
                    key={m}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all ${
                      obfMethod === m
                        ? 'bg-amber-600/20 border-amber-600/40 text-amber-400'
                        : 'bg-obsidian-800 border-obsidian-700 text-slate-500 hover:text-slate-300'
                    }`}
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

              {/* Exploit chips */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[9px] text-slate-600 uppercase mr-1">1-Click Exploits:</span>
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

              {/* Fuzzer info */}
              <div className="flex items-center gap-2 text-[9px] text-slate-600">
                <span className="badge-cyan">Genetic Mutation Fuzzer (garak)</span>
                <span className="badge-cyan">Multi-Turn Crescendo (PyRIT)</span>
                <span className="text-slate-700">Active probes: {logs.filter(l => l.result === 'BREACH').length} breaches, {logs.filter(l => l.result === 'BLOCKED').length} blocked</span>
              </div>
            </div>
          </div>
        )}

        {tab === 'intercept' && (
          <div className="flex flex-col h-full p-2 overflow-hidden">
            {/* CTF Flag Easter Egg */}
            <div className="flex items-center justify-between mb-1 shrink-0">
              <span className="text-[9px] text-slate-600 uppercase">CTF: Capture the Interceptor Flag</span>
              <button
                className="text-[9px] font-bold text-amber-500 hover:text-amber-400 transition-colors"
                onClick={() => { if (onCaptureFlag) onCaptureFlag('flag-intercept'); sfx.flagCapture(); }}
              >
                🚩 FLAG{{AEGIS_PKT_INT_0x7F}}
              </button>
            </div>
            {/* Packet list */}
            <div className="flex-1 overflow-auto space-y-1 mb-2">
              {packets.length === 0 ? (
                <div className="text-center text-slate-600 text-xs py-8">No intercepted packets. Run an attack to capture traffic.</div>
              ) : (
                packets.map((pkt) => (
                  <button
                    key={pkt.id}
                    onClick={() => { setSelectedPacket(pkt); setReplayText(pkt.request); sfx.click(); }}
                    className={`w-full text-left p-2 rounded-md border transition-all ${
                      selectedPacket?.id === pkt.id
                        ? 'bg-obsidian-700 border-cyan-500/40'
                        : 'bg-obsidian-850 border-obsidian-700 hover:border-obsidian-600'
                    }`}
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

            {/* Selected packet detail */}
            {selectedPacket && (
              <div className="border-t border-obsidian-700 pt-2 space-y-2 overflow-auto max-h-[40%]">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-500 uppercase">Packet Repeater — Edit & Replay</span>
                  <button className="btn-crimson flex items-center gap-1" onClick={handleReplay}>
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
                    />
                  </div>
                  <div>
                    <div className="text-[9px] text-slate-600 uppercase mb-1">Response</div>
                    <pre className="terminal w-full h-32 p-2 text-[9px] overflow-auto">
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
                  <div className="text-xs text-slate-500">Drop image or click to upload</div>
                  <button className="btn-tactical mt-2" onClick={() => sfx.click()}>Select File</button>
                </div>
              </div>
              <div className="panel p-3 max-w-md mx-auto text-left">
                <div className="text-[10px] text-slate-500 uppercase mb-2">Simulated LSB Scan Result</div>
                <div className="terminal p-2 text-[10px] space-y-1">
                  <div className="text-emerald-400">[PASS] No hidden prompt injection detected in pixel data</div>
                  <div className="text-slate-400">LSB extraction: 0x00 0x00 0x00 0x00 ... (null payload)</div>
                  <div className="text-slate-400">Channel R: clean | Channel G: clean | Channel B: clean</div>
                  <div className="text-slate-600">Entropy: 0.12 bits/pixel (below 0.80 threshold)</div>
                  <div className="text-emerald-400">[SECURE] Image safe for multimodal LLM processing</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
