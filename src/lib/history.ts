/**
 * On-device history and favorites for share codes.
 *
 * Players copy a code, switch to CODM, and the clipboard can be cleared by the
 * OS. History keeps the last few codes one tap away. Everything stays in
 * localStorage on this device — nothing is uploaded, matching the site's
 * privacy promise. Counts are labelled "on this device" wherever shown.
 */

export type HistoryEntry = { code: string; name: string; ts: number };

const HISTORY_KEY = "codm-history";
const FAVORITES_KEY = "codm-favorites";
const MAX_HISTORY = 8;
const MAX_FAVORITES = 24;

const EMPTY_HISTORY: HistoryEntry[] = [];
const EMPTY_FAVORITES: string[] = [];

let historyCache: HistoryEntry[] | null = null;
let favoritesCache: string[] | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Subscribe to changes, for useSyncExternalStore. */
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: history is best-effort */
  }
}

export function getHistory(): HistoryEntry[] {
  const stored = read<HistoryEntry[]>(HISTORY_KEY, EMPTY_HISTORY);
  return Array.isArray(stored) ? stored.filter((e) => e && typeof e.code === "string") : EMPTY_HISTORY;
}

export function getFavorites(): string[] {
  const stored = read<string[]>(FAVORITES_KEY, EMPTY_FAVORITES);
  return Array.isArray(stored) ? stored.filter((c) => typeof c === "string") : EMPTY_FAVORITES;
}

/* Stable snapshots: React needs the same reference until the data really changes. */
export function getHistorySnapshot(): HistoryEntry[] {
  historyCache ??= getHistory();
  return historyCache;
}

export function getFavoritesSnapshot(): string[] {
  favoritesCache ??= getFavorites();
  return favoritesCache;
}

export function getEmptyHistory(): HistoryEntry[] {
  return EMPTY_HISTORY;
}

export function getEmptyFavorites(): string[] {
  return EMPTY_FAVORITES;
}

export function addHistory(code: string, name: string): HistoryEntry[] {
  const next = [{ code, name, ts: Date.now() }, ...getHistory().filter((e) => e.code !== code)].slice(
    0,
    MAX_HISTORY,
  );
  write(HISTORY_KEY, next);
  historyCache = next;
  emit();
  return next;
}

export function clearHistory() {
  write(HISTORY_KEY, EMPTY_HISTORY);
  historyCache = EMPTY_HISTORY;
  emit();
}

export function isFavorite(code: string): boolean {
  return getFavoritesSnapshot().includes(code);
}

export function toggleFavorite(code: string): boolean {
  const favs = getFavoritesSnapshot();
  const has = favs.includes(code);
  const next = has ? favs.filter((c) => c !== code) : [code, ...favs].slice(0, MAX_FAVORITES);
  write(FAVORITES_KEY, next);
  favoritesCache = next;
  emit();
  return !has;
}
