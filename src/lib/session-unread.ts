/**
 * Session Unread Count Management
 * Manages unread message counts with localStorage persistence and cross-tab sync.
 */

const STORAGE_KEY = 'clawcorp-session-unread-counts';

/**
 * Get unread counts from localStorage
 */
export function getUnreadCounts(): Record<string, number> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save unread counts to localStorage
 */
export function saveUnreadCounts(counts: Record<string, number>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch (error) {
    console.error('Failed to save unread counts:', error);
  }
}

/**
 * Mark a session as read (clear unread count)
 */
export function markAsRead(sessionKey: string): void {
  const counts = getUnreadCounts();
  if (counts[sessionKey] !== undefined) {
    delete counts[sessionKey];
    saveUnreadCounts(counts);
  }
}

/**
 * Increment unread count for a session
 */
export function incrementUnreadCount(sessionKey: string): void {
  const counts = getUnreadCounts();
  counts[sessionKey] = (counts[sessionKey] || 0) + 1;
  saveUnreadCounts(counts);
}

/**
 * Get unread count for a specific session
 */
export function getUnreadCount(sessionKey: string): number {
  const counts = getUnreadCounts();
  return counts[sessionKey] || 0;
}

/**
 * Hook for listening to storage events (cross-tab sync)
 */
export function useUnreadCount(onUpdate: (counts: Record<string, number>) => void): () => void {
  const handleStorageChange = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        const counts = JSON.parse(event.newValue);
        onUpdate(counts);
      } catch {
        // Ignore parse errors
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}
