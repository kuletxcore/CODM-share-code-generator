"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { copyCode } from "@/components/ImportGuide";

export type StudioMode = "build" | "blend" | "convert";

export default function CommandHud({
  activeLabel,
  code,
  mode,
  canUndo,
  canRedo,
  onSelectLooks,
  onSelectMode,
  onUndo,
  onRedo,
  onShareCard,
  onOpenShortcuts,
}: {
  activeLabel: string;
  code: string;
  mode: StudioMode;
  canUndo: boolean;
  canRedo: boolean;
  onSelectLooks: () => void;
  onSelectMode: (m: StudioMode) => void;
  onUndo: () => void;
  onRedo: () => void;
  onShareCard: () => void;
  onOpenShortcuts: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 240);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -56, opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          role="region"
          aria-label="Quick studio command bar"
          className="fixed inset-x-0 top-0 z-30 border-b border-line bg-ink/90 backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-2 px-4 py-2 sm:px-8">
            {/* Left: Brand & Active Filter Badge */}
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={onSelectLooks}
                className="flex shrink-0 items-center gap-1.5 font-title text-base font-black uppercase tracking-wider text-text hover:text-codm"
              >
                <span className="inline-block h-2 w-2 rotate-45 bg-codm" />
                <span className="hidden sm:inline">Filter Lab</span>
              </button>
              <span className="hidden h-4 w-px bg-line sm:inline-block" />
              <span
                title={activeLabel}
                className="truncate border border-line bg-black/55 px-2 py-0.5 font-mono text-[11px] text-lime"
              >
                {activeLabel}
              </span>
            </div>

            {/* Center: Fast Studio Mode Switcher */}
            <nav aria-label="Sticky mode jump" className="hidden items-center gap-1 md:flex">
              <button
                type="button"
                onClick={onSelectLooks}
                className="px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider text-mute hover:text-text"
              >
                Looks
              </button>
              {(
                [
                  ["build", "Generator"],
                  ["blend", "Blend Lab"],
                  ["convert", "Screenshot → Code"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onSelectMode(m)}
                  className={`px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider transition-colors ${
                    mode === m
                      ? "bg-codm/20 text-codm ring-1 ring-inset ring-codm/60"
                      : "text-mute hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            {/* Right: Undo/Redo, Shortcuts, QR, Copy */}
            <div className="flex shrink-0 items-center gap-1.5">
              <div className="hidden items-center border border-line bg-black/45 lg:flex">
                <button
                  type="button"
                  disabled={!canUndo}
                  onClick={onUndo}
                  title="Undo (Ctrl/Cmd+Z)"
                  className="px-2 py-1 font-mono text-xs text-text disabled:opacity-30 hover:bg-panel-2"
                >
                  ↶
                </button>
                <button
                  type="button"
                  disabled={!canRedo}
                  onClick={onRedo}
                  title="Redo (Ctrl/Cmd+Shift+Z)"
                  className="border-l border-line px-2 py-1 font-mono text-xs text-text disabled:opacity-30 hover:bg-panel-2"
                >
                  ↷
                </button>
              </div>
              <button
                type="button"
                onClick={onOpenShortcuts}
                title="Keyboard shortcuts (?)"
                className="hidden border border-line bg-panel-2 px-2 py-1 font-mono text-xs font-bold text-mute hover:border-codm hover:text-codm sm:inline-block"
              >
                ?
              </button>
              <button
                type="button"
                onClick={onShareCard}
                className="border border-line bg-panel-2 px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider text-codm hover:border-codm"
              >
                QR
              </button>
              <button
                type="button"
                onClick={async () => {
                  await copyCode(code, activeLabel);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1400);
                }}
                className={`cut-sm px-3 py-1 font-display text-xs font-extrabold uppercase tracking-wider transition-colors ${
                  copied ? "bg-lime text-black" : "bg-codm text-black hover:bg-codm-light"
                }`}
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const SHORTCUT_GROUPS: { title: string; items: { keys: string[]; desc: string }[] }[] = [
  {
    title: "Zone Navigation & Tuning",
    items: [
      { keys: ["1"], desc: "Focus Shadows panel" },
      { keys: ["2"], desc: "Focus Midtones panel" },
      { keys: ["3"], desc: "Focus Highlights panel" },
      { keys: ["4"], desc: "Focus Range curve & histogram" },
      { keys: ["G"], desc: "Switch to Simple (Global) mode" },
      { keys: ["R"], desc: "Surprise Shuffle — fresh playable grade" },
      { keys: ["Ctrl/⌘", "Z"], desc: "Undo last change" },
      { keys: ["Ctrl/⌘", "⇧", "Z"], desc: "Redo change" },
    ],
  },
  {
    title: "Preview, Optics & Sharing",
    items: [
      { keys: ["Hold Space"], desc: "Peek original ungraded scene" },
      { keys: ["M"], desc: "Toggle false-colour Tonal Zone Mask" },
      { keys: ["C"], desc: "Copy current 22-int CODM share code" },
      { keys: ["Q"], desc: "Open Tactical PNG Card & Phone QR" },
      { keys: ["Ctrl/⌘", "V"], desc: "Paste screenshot into Preview or Converter" },
      { keys: ["?"], desc: "Toggle this shortcuts overlay" },
      { keys: ["Esc"], desc: "Close open modals" },
    ],
  },
];

export function ShortcutsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-title"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16 }}
            onClick={(e) => e.stopPropagation()}
            className="cut w-full max-w-2xl border border-line bg-panel p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4 border-b border-line pb-3">
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-codm">
                  Studio Hotkeys
                </p>
                <h2
                  id="shortcuts-title"
                  className="font-title text-2xl font-black uppercase tracking-wide"
                >
                  Keyboard Shortcuts
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close shortcuts"
                onClick={onClose}
                className="px-2 py-1 font-mono text-lg text-mute hover:text-text"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-6 sm:grid-cols-2">
              {SHORTCUT_GROUPS.map((g) => (
                <div key={g.title}>
                  <h3 className="font-display text-xs font-bold uppercase tracking-[0.2em] text-lime">
                    {g.title}
                  </h3>
                  <ul className="mt-2.5 flex flex-col gap-2">
                    {g.items.map((item) => (
                      <li
                        key={item.desc}
                        className="flex items-center justify-between gap-3 border-b border-line/50 pb-1.5 text-xs"
                      >
                        <span className="text-text/90">{item.desc}</span>
                        <span className="flex shrink-0 items-center gap-1">
                          {item.keys.map((k) => (
                            <kbd
                              key={k}
                              className="border border-line bg-black/75 px-1.5 py-0.5 font-mono text-[11px] font-bold text-codm"
                            >
                              {k}
                            </kbd>
                          ))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between text-xs text-mute">
              <span>Shortcuts stay inactive while typing inside text inputs.</span>
              <button
                type="button"
                onClick={onClose}
                className="bg-panel-2 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-text hover:bg-line"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
