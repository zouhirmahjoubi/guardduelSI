import { useState, useEffect, useCallback } from 'react';

const PREFIX = 'guardduelsi:';
const VERSION = 1;

interface StoredData<T> {
  version: number;
  data: T;
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const parsed: StoredData<T> = JSON.parse(raw);
    if (parsed.version !== VERSION) return fallback;
    return parsed.data;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, data: T) {
  try {
    const wrapped: StoredData<T> = { version: VERSION, data };
    localStorage.setItem(PREFIX + key, JSON.stringify(wrapped));
  } catch { /* ignore */ }
}

export function usePersistentState<T>(key: string, initial: T): [T, (v: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => load(key, initial));

  useEffect(() => {
    save(key, state);
  }, [key, state]);

  const set = useCallback((v: T | ((prev: T) => T)) => {
    setState(v);
  }, []);

  return [state, set];
}

export function clearAllStorage() {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(PREFIX));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
