import { useCallback, useEffect, useMemo, useState } from 'react';

export const PINNED_SESSIONS_STORAGE_KEY = 'clawcorp-sidebar-pinned-sessions';
const LEGACY_PINNED_SESSIONS_STORAGE_KEY = 'clawx-sidebar-pinned-sessions';
const PINNED_SESSIONS_EVENT = 'clawcorp:pinned-sessions-updated';

function parsePinnedSessionKeys(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function readPinnedSessionKeys(): string[] {
  try {
    const currentRaw = localStorage.getItem(PINNED_SESSIONS_STORAGE_KEY);
    if (currentRaw !== null) {
      return parsePinnedSessionKeys(currentRaw);
    }

    const legacyRaw = localStorage.getItem(LEGACY_PINNED_SESSIONS_STORAGE_KEY);
    const legacyKeys = parsePinnedSessionKeys(legacyRaw);
    if (legacyRaw !== null) {
      localStorage.setItem(PINNED_SESSIONS_STORAGE_KEY, JSON.stringify(legacyKeys));
      localStorage.removeItem(LEGACY_PINNED_SESSIONS_STORAGE_KEY);
    }
    return legacyKeys;
  } catch {
    return [];
  }
}

export function writePinnedSessionKeys(keys: string[]): void {
  localStorage.setItem(PINNED_SESSIONS_STORAGE_KEY, JSON.stringify(keys));
  localStorage.removeItem(LEGACY_PINNED_SESSIONS_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(PINNED_SESSIONS_EVENT, { detail: keys }));
}

export function togglePinnedSessionKey(sessionKey: string): string[] {
  const next = readPinnedSessionKeys();
  const updated = next.includes(sessionKey)
    ? next.filter((key) => key !== sessionKey)
    : [...next, sessionKey];
  writePinnedSessionKeys(updated);
  return updated;
}

export function usePinnedSessions() {
  const [pinnedSessionKeys, setPinnedSessionKeys] = useState<string[]>(() => readPinnedSessionKeys());

  useEffect(() => {
    const syncFromStorage = () => setPinnedSessionKeys(readPinnedSessionKeys());
    const handlePinnedSessionsUpdated = () => syncFromStorage();

    window.addEventListener('storage', syncFromStorage);
    window.addEventListener(PINNED_SESSIONS_EVENT, handlePinnedSessionsUpdated);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener(PINNED_SESSIONS_EVENT, handlePinnedSessionsUpdated);
    };
  }, []);

  const pinnedSessionKeySet = useMemo(() => new Set(pinnedSessionKeys), [pinnedSessionKeys]);
  const toggleSessionPinned = useCallback((sessionKey: string) => {
    const updated = togglePinnedSessionKey(sessionKey);
    setPinnedSessionKeys(updated);
  }, []);

  return {
    pinnedSessionKeys,
    pinnedSessionKeySet,
    toggleSessionPinned,
  };
}
