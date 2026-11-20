/**
 * Tiny, failure-tolerant persistence layer. Private browsing and locked-down
 * browsers throw on localStorage access, so every call is guarded.
 */
export const K = {
  looks: "codm:my-looks:v1",
  favs: "codm:favorites:v1",
  recent: "codm:recent:v1",
  prefs: "codm:prefs:v1",
  onboarded: "codm:onboarded:v1",
  guideOff: "codm-guide-off",
  feedback: "codm:feedback:v1",
  guideMode: "codm:guide-mode:v1",
  guideProgress: "codm:guide-progress:v1",
} as const;

export function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing we can do */
  }
}

export function pushUnique<T>(key: string, value: T, limit: number): T[] {
  const list = readJson<T[]>(key, []);
  const next = [value, ...list.filter((v) => JSON.stringify(v) !== JSON.stringify(value))];
  const out = next.slice(0, limit);
  writeJson(key, out);
  return out;
}

export type SavedLook = {
  id: string;
  name: string;
  code: string;
  note?: string;
  /** Small JPEG preview of the grade, captured from the preview canvas. */
  thumb?: string;
  created: number;
};

export type Prefs = {
  density?: "comfortable" | "compact";
  motion?: "auto" | "reduced";
  mode?: "simple" | "advanced";
  scene?: "urban" | "portrait" | "range";
  intensity?: number;
};

export const getPrefs = () => readJson<Prefs>(K.prefs, {});
export const setPref = <P extends keyof Prefs>(key: P, value: Prefs[P]) =>
  writeJson(K.prefs, { ...getPrefs(), [key]: value });
