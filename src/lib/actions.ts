/** Decoupled app actions: any control can request one, the shell handles it. */
"use client";

import { useEffect } from "react";

const EVENT = "codm:action";

export type AppAction =
  | "open-palette"
  | "open-help"
  | "open-looks"
  | "open-compare"
  | "open-inspector"
  | "save-look"
  | "open-my-looks"
  | "undo"
  | "redo"
  | "surprise"
  | "randomize"
  | "focus-editor"
  | "toggle-mode"
  | "compare-preview"
  | "fullscreen-preview"
  | "revisit-onboarding"
  | "share-tool";

export function act(action: AppAction, detail?: unknown) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent(EVENT, { detail: { action, detail } }));
}

/** Subscribe to app actions. The handler is always current without re-subscribing. */
export function useActions(handler: (action: AppAction, detail?: unknown) => void) {
  useEffect(() => {
    const on = (e: Event) => {
      const { action, detail } = (e as CustomEvent<{ action: AppAction; detail?: unknown }>).detail;
      handler(action, detail);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, [handler]);
}
