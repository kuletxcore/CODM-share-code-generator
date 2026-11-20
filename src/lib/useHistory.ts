"use client";

// Undo/redo for settings. Dragging a slider emits a label per gesture, so
// rapid edits with the same label collapse into one step.

import { useCallback, useRef, useState } from "react";

type Entry<T> = { value: T; label?: string; at: number };

export function useHistory<T>(initial: T, limit = 60) {
  const [state, setState] = useState<{ past: Entry<T>[]; present: Entry<T>; future: Entry<T>[] }>({
    past: [],
    present: { value: initial, at: Date.now() },
    future: [],
  });
  const lastLabel = useRef<{ label?: string; at: number }>({ at: 0 });

  const set = useCallback((next: T | ((prev: T) => T), label?: string) => {
    setState((h) => {
      const value = typeof next === "function" ? (next as (p: T) => T)(h.present.value) : next;
      if (value === h.present.value) return h;
      const now = Date.now();
      const coalesce = label && lastLabel.current.label === label && now - lastLabel.current.at < 500;
      lastLabel.current = { label, at: now };
      const past = coalesce ? h.past : [...h.past, h.present].slice(-limit);
      return { past, present: { value, label, at: now }, future: [] };
    });
  }, [limit]);

  const undo = useCallback(() => {
    lastLabel.current = { at: 0 };
    setState((h) => {
      if (!h.past.length) return h;
      const prev = h.past[h.past.length - 1];
      return {
        past: h.past.slice(0, -1),
        present: prev,
        future: [{ ...h.present, at: Date.now() }, ...h.future].slice(0, limit),
      };
    });
  }, [limit]);

  const redo = useCallback(() => {
    lastLabel.current = { at: 0 };
    setState((h) => {
      if (!h.future.length) return h;
      const [next, ...rest] = h.future;
      return {
        past: [...h.past, { ...h.present, at: Date.now() }].slice(-limit),
        present: next,
        future: rest,
      };
    });
  }, [limit]);

  const reset = useCallback((value: T) => {
    lastLabel.current = { at: 0 };
    setState({ past: [], present: { value, at: Date.now() }, future: [] });
  }, []);

  return {
    value: state.present.value,
    set,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    steps: state.past.length,
  };
}
