export interface HistoryEntry {
  id: string;
  timestamp: number;
  label: string;
  mode: 'single' | 'diff' | 'batch';
  result: string;
}

const STORAGE_KEY = 'bla-history';
const MAX_ENTRIES = 20;

export function saveToHistory(
  entry: Omit<HistoryEntry, 'id' | 'timestamp'>,
): HistoryEntry {
  const newEntry: HistoryEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...entry,
  };

  const existing = loadHistory();
  const updated = [newEntry, ...existing].slice(0, MAX_ENTRIES);

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors (private browsing, quota exceeded, etc.)
    }
  }

  return newEntry;
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

export function deleteFromHistory(id: string): void {
  if (typeof window === 'undefined') return;
  const existing = loadHistory();
  const updated = existing.filter((e) => e.id !== id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}
