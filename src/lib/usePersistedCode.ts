"use client";

import { useEffect, useRef } from "react";

const KEY = "codm-last-code";

/**
 * Keeps the grade between Visits.
 *
 * People build a code on their phone, switch to the game, come back to tweak
 * it. Without this, coming back to the tab after a reload (or the browser
 * discarding it) meant starting from the reset state — or hunting for the URL
 * they were on. The hash still wins: a link with #c= shows that code, not the
 * last one this device happened to hold.
 *
 * localStorage is best-effort: private modes and site-data settings can refuse
 * it, and a missing grade is not an error worth telling anyone about.
 */
export function readSavedCode(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveCode(code: string) {
  try {
    localStorage.setItem(KEY, code);
  } catch {
    /* nothing to do: the URL hash still carries the code */
  }
}

/** Persist `code` shortly after it settles. */
export function usePersistedCode(code: string, enabled = true) {
  const first = useRef(true);
  useEffect(() => {
    if (!enabled) return;
    // no write on the very first render: that code came from storage or the URL
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => saveCode(code), 400);
    return () => clearTimeout(t);
  }, [code, enabled]);
}
