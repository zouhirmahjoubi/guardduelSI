import { useState } from 'react';
import { Atom, Lock, Key, Hash, Zap, Activity, Binary, Shield, TrendingUp } from 'lucide-react';
import { sfx } from '@/utils/soundEngine';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const AES_STATE = [
  [0x54, 0x4f, 0x4e, 0x20],
  [0x77, 0x6e, 0x69, 0x54],
  [0x20, 0x65, 0x6e, 0x69],
  [0x6e, 0x20, 0x6f, 0x6e],
];

const QUANTUM_DATA = [
  { algorithm: 'Brute Force', bits: 256, time: '2^256 ops' },
  { algorithm: "Grover's", bits: 128, time: '2^128 ops (quadratic speedup)' },
  { algorithm: "Shor's (RSA)", bits: 0, time: 'Polynomial — RSA broken!' },
];

const MARKOV_DATA = [
  { method: 'Brute Force', attempts: '10000', success: 12, time: '4.2s' },
  { method: 'Markov Chain', attempts: '3400', success: 38, time: '1.1s' },
  { method: 'Markov (ppm)', attempts: '1200', success: 67, time: '0.4s' },
  { method: 'Dictionary', attempts: '5000', success: 22, time: '2.1s' },
];

export function CryptoWorkspace({ onCaptureFlag }: { onCaptureFlag?: (flagId: string) => void }) {
  const [subTab, setSubTab] = useState<'workbench' | 'quantum' | 'markov'>('workbench');
  const [aesRound, setAesRound] = useState(0);
  const [rsaKeySize, setRsaKeySize] = useState(4096);
  const [hashInput, setHashInput] = useState('Hello, guardduelSI!');
  const [bb84Step, setBb84Step] = useState(0);
  const [eavesdrop, setEavesdrop] = useState(false);

  const aesRounds = ['SubBytes (S-Box)', 'ShiftRows', 'MixColumns', 'AddRoundKey'];
  const currentRound = aesRounds[aesRound % 4];

  // Simple hash simulation
  const hashHex = Array.from(hashInput).reduce((acc, c) => {
    const h = ((c.charCodeAt(0) * 31 + 17) & 0xff).toString(16).padStart(2, '0');
    return acc + h;
  }, '').repeat(4).slice(0, 128);

  const bb84Steps = [
    { step: 'Alice sends photons', desc: 'Alice randomly encodes bits using rectilinear (↕↔) or diagonal (↗↘) polarization bases.' },
    { step: 'Bob measures', desc: 'Bob randomly chooses measurement bases. ~50% will match Alice\'s bases.' },
    { step: 'Eavesdropper (Eve)', desc: eavesdrop ? 'Eve intercepts and measures with random bases — introducing detectable errors!' : 'No eavesdropper detected. Channel is secure.' },
    { step: 'Basis reconciliation', desc: 'Alice & Bob publicly compare bases (not values). Mismatched bases are discarded.' },
    { step: 'Error check', desc: eavesdrop ? 'Quantum Bit Error Rate (QBER): 25% — EAVESDROPPER DETECTED!' : 'QBER: 0% — Key is secure. BB84 QKD successful.' },
  ];

  return (
    <div className="flex h-full flex-col p-2 gap-2 overflow-hidden">
      {/* Sub-tabs */}
      <div className="flex items-center gap-1">
        {[
          { id: 'workbench' as const, label: 'AES/RSA/SHA Crypto Workbench', icon: Lock },
          { id: 'quantum' as const, label: 'Quantum Threat & BB84 QKD', icon: Atom },
          { id: 'markov' as const, label: 'Markov-Chain Password Cracker (ppm_gen)', icon: Binary },
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
        {subTab === 'workbench' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
            {/* AES */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <Lock size={12} className="text-cyan-400" />
                AES-256 Symmetric State Array
              </div>
              <div className="p-3 space-y-3">
                <div className="text-[10px] text-slate-500">
                  AES operates on a 4×4 byte state array through 14 rounds of SubBytes, ShiftRows, MixColumns, and AddRoundKey.
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn-cyan" onClick={() => { setAesRound(aesRound + 1); sfx.chirp(); }}>
                    Step Through Round
                  </button>
                  <span className="text-[10px] text-slate-500">Round {Math.floor(aesRound / 4) + 1}/14: {currentRound}</span>
                </div>
                <div className="terminal p-3">
                  <div className="text-[9px] text-slate-600 uppercase mb-2">State Array (4×4 bytes)</div>
                  <div className="grid grid-cols-4 gap-1">
                    {AES_STATE.flat().map((byte, i) => {
                      const transformed = aesRound > 0 ? ((byte ^ (aesRound * 17 + i * 3)) & 0xff) : byte;
                      return (
                        <motion.div
                          key={i}
                          className="aspect-square flex items-center justify-center rounded text-[10px] font-mono font-bold border"
                          style={{ backgroundColor: `rgba(6,182,212,${0.05 + (transformed / 255) * 0.2})` }}
                          animate={{
                            borderColor: aesRound > 0 ? ['#243049', '#06B6D4', '#243049'] : '#243049',
                          }}
                          transition={{ duration: 0.3 }}
                        >
                          <span className="text-cyan-400">
                            0x{transformed.toString(16).padStart(2, '0').toUpperCase()}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
                <div className="text-[10px] text-slate-600">
                  Key: 256-bit (32 bytes) | Rounds: 14 | Block: 128-bit
                </div>
              </div>
            </div>

            {/* RSA */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <Key size={12} className="text-amber-400" />
                RSA-4096 / DSA Asymmetric Signing
              </div>
              <div className="p-3 space-y-3">
                <div className="text-[10px] text-slate-500">
                  RSA uses public/private key pairs. Security relies on the difficulty of factoring large semiprime numbers.
                </div>
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-600 uppercase">Key Size</div>
                  <div className="flex gap-1">
                    {[1024, 2048, 4096].map((size) => (
                      <button
                        key={size}
                        className={`px-2 py-1 rounded text-[10px] font-bold border transition-all ${
                          rsaKeySize === size ? 'bg-amber-600/20 border-amber-600/40 text-amber-400' : 'bg-obsidian-800 border-obsidian-700 text-slate-500'
                        }`}
                        onClick={() => { setRsaKeySize(size); sfx.click(); }}
                      >
                        RSA-{size}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="terminal p-3 space-y-2 text-[10px] font-mono">
                  <div className="text-slate-600 uppercase text-[9px] border-b border-obsidian-700 pb-1">Key Generation</div>
                  <div className="text-cyan-400">p = [prime_{rsaKeySize / 2} bits]</div>
                  <div className="text-cyan-400">q = [prime_{rsaKeySize / 2} bits]</div>
                  <div className="text-slate-400">n = p × q ({rsaKeySize} bits)</div>
                  <div className="text-slate-400">φ(n) = (p-1)(q-1)</div>
                  <div className="text-amber-400">e = 65537 (public exponent)</div>
                  <div className="text-emerald-400">d = e^(-1) mod φ(n) (private)</div>
                  <div className="text-slate-600 mt-2 pt-2 border-t border-obsidian-700">
                    {rsaKeySize === 1024 ? '⚠ WEAK: Factorable by nation-states' :
                     rsaKeySize === 2048 ? '✓ Acceptable: NIST minimum until 2030' :
                     '✓ STRONG: Secure until quantum computers mature'}
                  </div>
                </div>
                <div className="panel p-2 border-crimson-600/20">
                  <div className="text-[10px] text-crimson-400 flex items-center gap-1">
                    <Zap size={10} /> Quantum Threat: Shor's Algorithm breaks RSA in polynomial time
                  </div>
                </div>
              </div>
            </div>

            {/* SHA */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <Hash size={12} className="text-emerald-400" />
                SHA-512 Hashing (Salt + Pepper)
              </div>
              <div className="p-3 space-y-3">
                <div className="text-[10px] text-slate-500">
                  SHA-512 produces a 512-bit hash. Salt (per-user random) and Pepper (server secret) prevent rainbow table attacks.
                </div>
                <div>
                  <div className="text-[10px] text-slate-600 uppercase mb-1">Input</div>
                  <input
                    type="text"
                    value={hashInput}
                    onChange={(e) => setHashInput(e.target.value)}
                    className="w-full bg-obsidian-900 border border-obsidian-700 rounded-md px-2 py-1.5 text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
                <div className="terminal p-3 space-y-2 text-[10px] font-mono">
                  <div className="text-slate-600 uppercase text-[9px] border-b border-obsidian-700 pb-1">SHA-512 Output</div>
                  <div className="text-emerald-400 break-all">{hashHex}</div>
                  <div className="text-slate-600 mt-2 pt-2 border-t border-obsidian-700">
                    <div>salt = 0x8F2A... (per-user random)</div>
                    <div>pepper = $SERVER_SECRET (HSM-stored)</div>
                    <div>hash = SHA512(pepper + salt + input)</div>
                  </div>
                </div>
                <div className="panel p-2 border-emerald-600/20">
                  <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                    <Shield size={10} /> Salt + Pepper: Rainbow tables useless, Pepper unknown to DB attacker
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {subTab === 'quantum' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Quantum Threat */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <Atom size={12} className="text-crimson-400" />
                Quantum Threat: Shor's & Grover's Algorithms
              </div>
              <div className="p-3 space-y-3">
                <div className="text-[10px] text-slate-500">
                  Quantum computers threaten classical cryptography. Shor's algorithm breaks RSA/ECC; Grover's halves symmetric key security.
                </div>
                <div className="space-y-2">
                  {QUANTUM_DATA.map((q) => (
                    <div key={q.algorithm} className="panel p-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-400">{q.algorithm}</span>
                        <span className={`badge ${q.bits === 0 ? 'badge-crimson' : 'badge-amber'}`}>
                          {q.bits === 0 ? 'BROKEN' : `${q.bits}-bit equiv`}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1 font-mono">{q.time}</div>
                    </div>
                  ))}
                </div>
                <div className="panel p-3 border-cyan-600/20">
                  <div className="text-[10px] text-cyan-400 uppercase mb-1 flex items-center gap-1">
                    <Shield size={10} /> NIST Post-Quantum Cryptography
                  </div>
                  <div className="space-y-1 text-[10px] text-slate-400">
                    <div>• <span className="text-cyan-400 font-mono">ML-KEM (Kyber)</span> — Key Encapsulation (replaces RSA key exchange)</div>
                    <div>• <span className="text-cyan-400 font-mono">ML-DSA (Dilithium)</span> — Digital Signatures (replaces RSA/ECDSA)</div>
                    <div>• <span className="text-cyan-400 font-mono">SLH-DSA (SPHINCS+)</span> — Hash-based signatures (stateless)</div>
                  </div>
                </div>
              </div>
            </div>

            {/* BB84 QKD */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <Activity size={12} className="text-cyan-400" />
                BB84 Quantum Key Distribution Simulator
              </div>
              <div className="p-3 space-y-3">
                <div className="text-[10px] text-slate-500">
                  BB84 uses quantum photon polarization to detect eavesdropping. Any measurement by Eve disturbs the quantum states.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-cyan flex items-center gap-1"
                    onClick={() => { setBb84Step((bb84Step + 1) % 5); sfx.radar(); }}
                  >
                    <Zap size={11} /> Next Step ({bb84Step + 1}/5)
                  </button>
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[10px] text-slate-500">Eve (Eavesdropper)</span>
                    <button
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${eavesdrop ? 'bg-crimson-600/20 border-crimson-600/40 text-crimson-400' : 'bg-obsidian-800 border-obsidian-700 text-slate-500'}`}
                      onClick={() => { setEavesdrop(!eavesdrop); setBb84Step(0); sfx.toggle(); }}
                    >
                      {eavesdrop ? 'ACTIVE' : 'OFF'}
                    </button>
                  </div>
                </div>

                {/* Photon visualization */}
                <div className="terminal p-3">
                  <div className="grid grid-cols-8 gap-1">
                    {Array.from({ length: 16 }, (_, i) => {
                      const base = i % 2 === 0 ? '↕↔' : '↗↘';
                      const isEveDisturbed = eavesdrop && Math.random() > 0.5;
                      return (
                        <motion.div
                          key={i}
                          className="aspect-square flex items-center justify-center rounded text-sm border"
                          style={{
                            color: isEveDisturbed ? '#EF4444' : '#06B6D4',
                            borderColor: isEveDisturbed ? 'rgba(239,68,68,0.3)' : 'rgba(6,182,212,0.2)',
                            background: isEveDisturbed ? 'rgba(239,68,68,0.05)' : 'rgba(6,182,212,0.05)',
                          }}
                          animate={bb84Step > 0 ? { opacity: [0.4, 1, 0.4] } : { opacity: 0.3 }}
                          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.05 }}
                        >
                          {base[Math.floor(Math.random() * 2)]}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Steps */}
                <div className="space-y-1">
                  {bb84Steps.map((s, i) => (
                    <div
                      key={i}
                      className={`p-2 rounded text-[10px] border transition-all ${
                        i <= bb84Step
                          ? i === 4 && eavesdrop
                            ? 'bg-crimson-600/10 border-crimson-600/30'
                            : 'bg-obsidian-800 border-obsidian-700'
                          : 'bg-obsidian-900/50 border-obsidian-800 opacity-50'
                      }`}
                    >
                      <div className={`font-semibold ${i === 4 && eavesdrop ? 'text-crimson-400' : 'text-cyan-400'}`}>
                        {i + 1}. {s.step}
                      </div>
                      {i <= bb84Step && <div className="text-slate-500 mt-0.5">{s.desc}</div>}
                    </div>
                  ))}
                </div>
                {bb84Step === 4 && !eavesdrop && (
                  <div className="flex items-center justify-between p-2 rounded bg-amber-600/5 border border-amber-600/20">
                    <span className="text-[9px] text-amber-500">CTF: BB84 QKD completed securely — flag discovered!</span>
                    <button
                      className="text-[9px] font-bold text-amber-500 hover:text-amber-400 transition-colors"
                      onClick={() => { if (onCaptureFlag) onCaptureFlag('flag-quantum'); sfx.flagCapture(); }}
                    >
                      {CTF_FLAGS.find((f) => f.id === 'flag-quantum')?.flag ?? 'FLAG{GUARDDUELSI_QKD_BB84}'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {subTab === 'markov' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {/* Markov comparison */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <Binary size={12} className="text-amber-400" />
                Markov-Chain Password Probability Matrix (ppm_gen)
              </div>
              <div className="p-3 space-y-3">
                <div className="text-[10px] text-slate-500">
                  Markov chains model conditional character probabilities, cracking passwords faster than brute force by guessing likely sequences first.
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={MARKOV_DATA}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1A2236" />
                    <XAxis dataKey="method" tick={{ fill: '#64748B', fontSize: 9 }} />
                    <YAxis tick={{ fill: '#64748B', fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{ background: '#0D1220', border: '1px solid #1A2236', borderRadius: '6px', fontSize: '10px' }}
                    />
                    <Bar dataKey="success" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Success Rate (%)" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="panel p-2">
                  <div className="text-[10px] text-slate-600 uppercase mb-1">Probability Transition Matrix</div>
                  <div className="terminal p-2 text-[10px] font-mono">
                    <div className="text-cyan-400">P(s|a) = 0.42  P(s|p) = 0.31  P(a|p) = 0.28</div>
                    <div className="text-amber-400">P(1|s) = 0.38  P(@|a) = 0.22  P(123|...) = 0.67</div>
                    <div className="text-slate-600 mt-1">// "Password123" guessed in 1,200 attempts vs 10,000 brute force</div>
                  </div>
                </div>
              </div>
            </div>

            {/* WEP RC4 FMS */}
            <div className="panel overflow-hidden">
              <div className="panel-header">
                <TrendingUp size={12} className="text-crimson-400" />
                WEP RC4 IV (FMS) Attack
              </div>
              <div className="p-3 space-y-3">
                <div className="text-[10px] text-slate-500">
                  The Fluhrer, Mantin, and Shamir (FMS) attack exploits weak RC4 Initialization Vectors in WEP, recovering the key from ~50,000 captured packets.
                </div>
                <div className="terminal p-3 text-[10px] font-mono space-y-1">
                  <div className="text-slate-600 uppercase text-[9px] border-b border-obsidian-700 pb-1">FMS Attack Progress</div>
                  <div className="text-cyan-400">Captured packets: 47,328 / ~50,000</div>
                  <div className="text-amber-400">Weak IVs found: 12,847 (3, 255, N pattern)</div>
                  <div className="text-slate-400">Key bytes recovered: 12/13 (92%)</div>
                  <div className="text-emerald-400 font-bold mt-2">Predicted key: A1:B2:C3:D4:E5:F6:G7:..</div>
                </div>
                <div className="panel p-3 border-emerald-600/20">
                  <div className="text-[10px] text-emerald-400 uppercase mb-1 flex items-center gap-1">
                    <Shield size={10} /> Modern Defense
                  </div>
                  <div className="space-y-1 text-[10px] text-slate-400">
                    <div>• <span className="text-emerald-400">WPA3</span> — SAE handshake, immune to FMS</div>
                    <div>• <span className="text-emerald-400">AES-CCMP</span> — replaces RC4 entirely</div>
                    <div>• <span className="text-emerald-400">WPA2-AES</span> — minimum acceptable standard</div>
                  </div>
                </div>
                <div className="panel p-2">
                  <div className="text-[10px] text-slate-600 uppercase mb-1">Aircrack-ng Command</div>
                  <div className="terminal p-2 text-[10px] font-mono text-amber-400">
                    airodump-ng -c 6 --bssid AA:BB:CC:DD:EE:FF wlan0mon<br/>
                    aireplay-ng -1 0 -a AA:BB:CC:DD:EE:FF wlan0mon<br/>
                    aireplay-ng -3 -b AA:BB:CC:DD:EE:FF wlan0mon<br/>
                    aircrack-ng capture-01.cap
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
