import { useState, useEffect, useCallback } from 'react';
import type { CtfFlag } from '@/types';
import { sfx } from '@/utils/soundEngine';

export const CTF_FLAGS: CtfFlag[] = [
  { id: 'flag-intercept', flag: 'FLAG{GUARDDUELSI_PKT_INT_0x7F}', legacyFlag: 'FLAG{AEGIS_PKT_INT_0x7F}', label: 'Packet Interceptor', hint: 'Inspect HTTP/LLM traffic in the Red-Team Interceptor tab', workspace: 'redteam', captured: false },
  { id: 'flag-shroud', flag: 'FLAG{GUARDDUELSI_SHROUD_65535}', legacyFlag: 'FLAG{AEGIS_SHROUD_65535}', label: 'Port Shroud', hint: 'Activate the port shroud in the OSINT workspace', workspace: 'osint', captured: false },
  { id: 'flag-bof', flag: 'FLAG{GUARDDUELSI_EIP_42424242}', legacyFlag: 'FLAG{AEGIS_EIP_42424242}', label: 'EIP Overwrite', hint: 'Reach stage 4 of the Buffer Overflow visualizer', workspace: 'memory', captured: false },
  { id: 'flag-dcadmin', flag: 'FLAG{GUARDDUELSI_DOMAIN_ADMIN}', legacyFlag: 'FLAG{AEGIS_DOMAIN_ADMIN}', label: 'Domain Admin', hint: 'Complete the BloodHound attack path to Domain Admin', workspace: 'activedir', captured: false },
  { id: 'flag-quantum', flag: 'FLAG{GUARDDUELSI_BB84_QKD}', legacyFlag: 'FLAG{AEGIS_BB84_QKD}', label: 'Quantum Key', hint: 'Complete the BB84 QKD simulation without eavesdropping', workspace: 'crypto', captured: false },
];

const STORAGE_KEY = 'guardduelsi-ctf-flags';
const LEGACY_STORAGE_KEY = 'aegisai-ctf-flags';

function loadCaptured(): Set<string> {
  try {
    // Try current key first
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
    // Migrate from legacy key
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const migrated = new Set<string>(JSON.parse(legacy));
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...migrated]));
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      return migrated;
    }
  } catch { /* ignore malformed data */ }
  return new Set();
}

function saveCaptured(captured: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...captured]));
  } catch { /* ignore */ }
}

export function useCtfFlags() {
  const [captured, setCaptured] = useState<Set<string>>(loadCaptured);
  const [showBadge, setShowBadge] = useState(false);

  useEffect(() => {
    saveCaptured(captured);
    if (captured.size === CTF_FLAGS.length) {
      setShowBadge(true);
      sfx.fanfare();
    }
  }, [captured]);

  const captureFlag = useCallback((flagId: string) => {
    setCaptured((prev) => {
      if (prev.has(flagId)) return prev;
      sfx.flagCapture();
      return new Set([...prev, flagId]);
    });
  }, []);

  const resetFlags = useCallback(() => {
    setCaptured(new Set());
    setShowBadge(false);
    sfx.click();
  }, []);

  return {
    captured,
    captureFlag,
    resetFlags,
    total: CTF_FLAGS.length,
    count: captured.size,
    showBadge,
    setShowBadge,
    flags: CTF_FLAGS,
  };
}
