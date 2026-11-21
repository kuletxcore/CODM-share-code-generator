/**
 * Recent and saved share codes, kept in this browser only. A recent entry is
 * written when a code is copied, never while a slider moves, so a drag can't
 * hammer storage. Every read and write is guarded: private browsing and
 * locked-down browsers throw on localStorage, and then the lists just stay
 * empty for the visit.
 */

import { LOOKS, decode } from "./codm.ts";

export type MyCode = { code: string; name: string; at: number };
export type MyCodes = { recent: MyCode[]; saved: MyCode[] };

const KEY = "codm:my-codes:v1";
export const RECENT_MAX = 8;
export const SAVED_MAX = 30;
const NAME_MAX = 40;

const EMPTY: MyCodes = { recent: [], saved: [] };

/** Keeps only well-formed entries; storage can hold anything another version wrote. */
export function clean(raw: unknown, isCode: (c: string) => boolean): MyCodes {
  const list = (v: unknown, max: number): MyCode[] =>
    (Array.isArray(v) ? v : [])
      .filter(
        (e): e is MyCode =>
          !!e &&
          typeof e.code === "string" &&
          isCode(e.code) &&
          typeof e.name === "string" &&
          typeof e.at === "number",
      )
      .map((e) => ({ code: e.code, name: e.name.slice(0, NAME_MAX), at: e.at }))
      .slice(0, max);
  const r = (raw ?? {}) as Partial<MyCodes>;
  return { recent: list(r.recent, RECENT_MAX), saved: list(r.saved, SAVED_MAX) };
}

/** Newest first, one entry per code; the newest name for a code wins. */
export function push(list: MyCode[], entry: MyCode, max: number): MyCode[] {
  return [entry, ...list.filter((e) => e.code !== entry.code)].slice(0, max);
}

export function rename(list: MyCode[], code: string, name: string): MyCode[] {
  const n = name.trim().slice(0, NAME_MAX);
  return n ? list.map((e) => (e.code === code ? { ...e, name: n } : e)) : list;
}

// The store: one snapshot object per change, so useSyncExternalStore re-renders
// only when the lists really change.

let snap: MyCodes | null = null;
const listeners = new Set<() => void>();
const valid = (c: string) => decode(c) !== null;

function load(): MyCodes {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? clean(JSON.parse(raw), valid) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function commit(next: MyCodes) {
  snap = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // kept for this visit only
  }
  listeners.forEach((l) => l());
}

export function subscribe(cb: () => void) {
  listeners.add(cb);
  // another tab saved or cleared something
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    snap = load();
    cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export const getSnapshot = () => (snap ??= load());
export const getServerSnapshot = () => EMPTY;

/** A look's own name, or a plain label for a grade that isn't one of the looks. */
export const nameFor = (code: string) => lookName(code) ?? "Custom grade";
export const lookName = (code: string) => LOOKS.find((l) => l.code === code)?.name;

export function addRecent(code: string, name?: string) {
  if (!valid(code)) return;
  const s = getSnapshot();
  commit({ ...s, recent: push(s.recent, { code, name: (name ?? nameFor(code)).slice(0, NAME_MAX), at: Date.now() }, RECENT_MAX) });
}

export function save(code: string, name: string) {
  const s = getSnapshot();
  commit({ ...s, saved: push(s.saved, { code, name: name.trim().slice(0, NAME_MAX) || "Saved grade", at: Date.now() }, SAVED_MAX) });
}

export function renameSaved(code: string, name: string) {
  const s = getSnapshot();
  commit({ ...s, saved: rename(s.saved, code, name) });
}

export function remove(which: keyof MyCodes, code: string) {
  const s = getSnapshot();
  commit({ ...s, [which]: s[which].filter((e) => e.code !== code) });
}

export function clearRecent() {
  commit({ ...getSnapshot(), recent: [] });
}
