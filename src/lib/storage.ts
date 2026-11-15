import { decode } from "@/lib/codm";

export type SavedSlot = {
  name: string;
  code: string;
  updatedAt: number;
};

export const SLOT_COUNT = 5;
const STORAGE_KEY = "codm-filter-lab-slots-v1";

const SERVER_EMPTY: (SavedSlot | null)[] = Array.from({ length: SLOT_COUNT }, () => null);
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedParsed: (SavedSlot | null)[] = SERVER_EMPTY;

export function getServerSlots(): (SavedSlot | null)[] {
  return SERVER_EMPTY;
}

export function getClientSlots(): (SavedSlot | null)[] {
  if (typeof window === "undefined") return SERVER_EMPTY;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return SERVER_EMPTY;
  }
  if (raw === cachedRaw) return cachedParsed;
  cachedRaw = raw;
  if (!raw) {
    cachedParsed = SERVER_EMPTY;
    return cachedParsed;
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedParsed = SERVER_EMPTY;
      return cachedParsed;
    }
    cachedParsed = Array.from({ length: SLOT_COUNT }, (_, i) => {
      const item = parsed[i];
      if (
        item &&
        typeof item === "object" &&
        typeof item.name === "string" &&
        typeof item.code === "string" &&
        decode(item.code)
      ) {
        return {
          name: item.name.slice(0, 28) || `Slot #${i + 1}`,
          code: item.code,
          updatedAt: typeof item.updatedAt === "number" ? item.updatedAt : Date.now(),
        };
      }
      return null;
    });
  } catch {
    cachedParsed = SERVER_EMPTY;
  }
  return cachedParsed;
}

export function saveSlots(slots: (SavedSlot | null)[]) {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(slots);
    localStorage.setItem(STORAGE_KEY, serialized);
    cachedRaw = serialized;
    cachedParsed = slots;
  } catch {
    // ignore storage quota / privacy mode errors
  }
  listeners.forEach((fn) => fn());
}

export function subscribeSlots(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cachedRaw = undefined;
      cb();
    }
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    listeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}
