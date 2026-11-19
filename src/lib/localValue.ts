/**
 * A string kept in localStorage, shaped for useSyncExternalStore so a
 * statically rendered page can read it without a state-setting effect.
 * Falls back to memory when storage is blocked.
 */
export function localValue(key: string) {
  const subs = new Set<() => void>();
  let mem: string | null = null;
  let blocked = false;

  const get = (): string | null => {
    if (blocked) return mem;
    try {
      return localStorage.getItem(key);
    } catch {
      blocked = true;
      return mem;
    }
  };

  const set = (v: string | null) => {
    mem = v;
    try {
      if (v === null) localStorage.removeItem(key);
      else localStorage.setItem(key, v);
    } catch {
      blocked = true;
    }
    subs.forEach((f) => f());
  };

  const subscribe = (cb: () => void) => {
    subs.add(cb);
    const other = (e: StorageEvent) => {
      if (e.key === key || e.key === null) cb();
    };
    window.addEventListener("storage", other);
    return () => {
      subs.delete(cb);
      window.removeEventListener("storage", other);
    };
  };

  /** The value during the static render and hydration. */
  const server = (): string | null => null;

  return { get, set, subscribe, server };
}
