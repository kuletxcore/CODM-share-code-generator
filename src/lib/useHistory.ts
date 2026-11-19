"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Undo/redo for a value that changes many times per second.
 *
 * Dragging a slider fires dozens of updates; a history entry for each would
 * make Undo useless. Changes are coalesced: the value the burst started from is
 * recorded once, 500 ms after the last change, so one gesture is one undo. The
 * setter, not the React state, is owned here so the ~40 call sites in the
 * editor did not have to change.
 */

const COALESCE_MS = 500;
const MAX_ENTRIES = 60;

export function useHistory<T>(
  value: T,
  setValue: (next: T) => void,
  equals: (a: T, b: T) => boolean,
) {
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const pending = useRef<T | null>(null);
  const last = useRef(value);
  const [depth, setDepth] = useState({ undo: 0, redo: 0 });

  const sync = useCallback(() => {
    setDepth({ undo: past.current.length, redo: future.current.length });
  }, []);

  const record = useCallback(
    (prev: T) => {
      if (pending.current === null) pending.current = prev;
      const t = setTimeout(() => {
        if (pending.current === null) return;
        past.current.push(pending.current);
        if (past.current.length > MAX_ENTRIES) past.current.shift();
        future.current = [];
        pending.current = null;
        sync();
      }, COALESCE_MS);
      return () => clearTimeout(t);
    },
    [sync],
  );

  useEffect(() => {
    if (equals(last.current, value)) return;
    const prev = last.current;
    last.current = value;
    return record(prev);
  }, [value, equals, record]);

  const undo = useCallback(() => {
    if (!past.current.length) return;
    const prev = past.current.pop()!;
    future.current.push(value);
    pending.current = null;
    last.current = prev;
    setValue(prev);
    sync();
  }, [setValue, sync, value]);

  const redo = useCallback(() => {
    if (!future.current.length) return;
    const next = future.current.pop()!;
    past.current.push(value);
    pending.current = null;
    last.current = next;
    setValue(next);
    sync();
  }, [setValue, sync, value]);

  return { undo, redo, canUndo: depth.undo > 0, canRedo: depth.redo > 0 };
}
