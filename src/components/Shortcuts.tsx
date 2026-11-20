"use client";

// Global keyboard layer and its discoverable cheat sheet.

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { act, useActions } from "@/lib/actions";
import { K, readJson } from "@/lib/storage";

const SHORTCUTS: [string, string][] = [
  ["⌘K  /  Ctrl+K  /  /", "Open quick find"],
  ["?", "This shortcut sheet"],
  ["⌘Z  /  Ctrl+Z", "Undo last edit"],
  ["⌘⇧Z  /  Ctrl+Y", "Redo edit"],
  ["1 · 2 · 3", "Shadows · Midtones · Highlights"],
  ["M", "Toggle Simple / Advanced"],
  ["F", "Fullscreen preview"],
  ["S", "Save current look"],
  ["R", "Roll a seeded random grade"],
  ["← · →", "Previous / next look"],
  ["Esc", "Close any overlay"],
];

/** Call once in the shell. Ignores keys while the visitor is typing. */
export function useGlobalHotkeys() {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      const typing =
        t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        act("open-palette");
        return;
      }
      if (typing || mod || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        act("open-help");
      } else if (e.key === "/") {
        e.preventDefault();
        act("open-palette");
      } else if (e.key === "m" || e.key === "M") {
        act("toggle-mode");
      } else if (e.key === "f" || e.key === "F") {
        act("fullscreen-preview");
      } else if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        act("save-look");
      } else if (e.key === "r" || e.key === "R") {
        act("randomize");
      } else if (e.key === "ArrowRight") {
        act("gallery-next");
      } else if (e.key === "ArrowLeft") {
        act("gallery-prev");
      } else if (["1", "2", "3"].includes(e.key)) {
        act("focus-editor", { tab: ["shadows", "midtones", "highlights"][Number(e.key) - 1] });
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);
}

/** Self-contained overlay: subscribes to the open-help action itself. */
export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState({ edits: 0, saved: 0 });
  useActions((a) => {
    if (a === "open-help")
      setStats({
        edits: readJson<unknown[]>(K.history, []).length,
        saved: readJson<unknown[]>(K.looks, []).length,
      });
  });
  useActions((a) => {
    if (a === "open-help") setOpen((v) => !v);
    if (a === "close-overlays") setOpen(false);
  });

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[65] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="cut w-full max-w-lg border border-line bg-panel p-5 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-codm">
                  Faster than scrolling
                </p>
                <h2 id="shortcuts-title" className="font-title text-3xl font-black uppercase">
                  Keyboard shortcuts
                </h2>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close shortcuts"
                className="grid h-11 w-11 place-items-center text-2xl text-mute hover:text-text"
              >
                ×
              </button>
            </div>
            <dl className="mt-4 grid gap-1 sm:grid-cols-2">
              {SHORTCUTS.map(([keys, label]) => (
                <div key={keys} className="flex items-center justify-between gap-3 border-b border-line/70 py-2">
                  <dt className="text-sm text-mute">{label}</dt>
                  <dd className="whitespace-nowrap font-mono text-[11px] text-codm-light">{keys}</dd>
                </div>
              ))}
            </dl>
            <label className="mt-4 flex min-h-11 cursor-pointer items-center justify-between gap-3 border-t border-line pt-3 text-sm">
              <span>
                Reduce animation
                <span className="block text-xs text-mute">Also respects your system setting.</span>
              </span>
              <input
                type="checkbox"
                defaultChecked={document.documentElement.dataset.motion === "reduced"}
                onChange={(e) =>
                  window.dispatchEvent(new CustomEvent("codm:set-motion", { detail: e.target.checked }))
                }
                className="h-5 w-5 accent-[var(--color-codm)]"
              />
            </label>
            <label className="mt-3 flex min-h-11 cursor-pointer items-center justify-between gap-3 border-t border-line pt-3 text-sm">
              <span>
                Compact spacing
                <span className="block text-xs text-mute">Fits more of the editor on one screen.</span>
              </span>
              <input
                type="checkbox"
                defaultChecked={document.documentElement.dataset.density === "compact"}
                onChange={(e) => {
                  const value = e.target.checked ? "compact" : "comfortable";
                  document.documentElement.dataset.density = value;
                  try {
                    const prefs = JSON.parse(localStorage.getItem("codm:prefs:v1") ?? "{}");
                    localStorage.setItem("codm:prefs:v1", JSON.stringify({ ...prefs, density: value }));
                  } catch {}
                }}
                className="h-5 w-5 accent-[var(--color-codm)]"
              />
            </label>
            <p className="mt-3 border-t border-line pt-3 font-mono text-[11px] text-mute">
              On this device: {stats.edits} codes edited · {stats.saved} looks saved · nothing uploaded.
            </p>
            <p className="mt-3 text-xs text-mute">
              Shortcuts pause while you are typing in a field. Everything here also has a button.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
