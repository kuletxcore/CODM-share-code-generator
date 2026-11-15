"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";

const EVENT = "codm:copied";
const OFF_KEY = "codm-guide-off";

/** Call after a share code lands on the clipboard; opens the import guide. */
export function announceCopy(code: string, name?: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { code, name } }));
}

export async function copyCode(code: string, name?: string) {
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    const t = document.createElement("textarea");
    t.value = code;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    t.remove();
  }
  announceCopy(code, name);
}

const STEPS: { title: string; hint?: string }[] = [
  { title: "Settings", hint: "From the CODM lobby" },
  { title: "Audio and Graphics" },
  { title: "Pick your mode tab", hint: "MP, BR, DMZ…" },
  { title: "Graphic Style → Import → Go" },
  { title: "Choose a Custom slot" },
  { title: "Paste the code", hint: "Into “Enter the Share code”" },
  { title: "Apply" },
];

const readOff = () => {
  try {
    return localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
};

/**
 * Stays open after a copy so the in-game steps are at hand while switching to
 * CODM. Steps can be ticked off; the code can be copied again. Visitors who
 * know the way can switch it to a short toast.
 */
export default function ImportGuide() {
  const [open, setOpen] = useState<{ code: string; name?: string } | null>(null);
  const [toast, setToast] = useState<{ code: string; name?: string } | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [off, setOff] = useState(false);
  const [again, setAgain] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ code: string; name?: string }>).detail;
      if (readOff()) {
        setToast(d);
      } else {
        setDone([]);
        setOpen(d);
      }
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  useEffect(() => {
    // one-off read of a browser-only preference
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOff(readOff());
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!open) return;
    heading.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  const toggleOff = useCallback((v: boolean) => {
    setOff(v);
    try {
      if (v) localStorage.setItem(OFF_KEY, "1");
      else localStorage.removeItem(OFF_KEY);
    } catch {}
  }, []);

  const next = STEPS.findIndex((_, i) => !done.includes(i));

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-labelledby="guide-title"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="fixed inset-x-0 bottom-0 z-40 max-h-[80svh] overflow-y-auto border-t-2 border-codm bg-ink/95 px-4 pb-5 pt-4 shadow-[0_-20px_60px_rgba(0,0,0,0.6)] backdrop-blur-md sm:inset-x-auto sm:bottom-28 sm:right-6 sm:w-[400px] sm:border-2 sm:pb-4 lg:bottom-24"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-[0.2em] text-lime">
                  ✓ Code copied{open.name ? ` · ${open.name}` : ""}
                </p>
                <h2
                  id="guide-title"
                  ref={heading}
                  tabIndex={-1}
                  className="mt-1 font-title text-2xl font-black uppercase leading-none tracking-wide outline-none"
                >
                  Now in CODM
                </h2>
              </div>
              <span className="mt-1 font-display text-sm font-bold text-mute" aria-live="polite">
                {done.length}/{STEPS.length}
              </span>
            </div>

            <ol className="mt-3 flex flex-col gap-1">
              {STEPS.map((s, i) => {
                const isDone = done.includes(i);
                const isNext = i === next;
                return (
                  <li key={s.title}>
                    <button
                      onClick={() => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))}
                      aria-pressed={isDone}
                      className={`flex w-full items-center gap-3 border-l-4 px-3 py-2 text-left transition-colors ${
                        isNext
                          ? "border-codm bg-codm/10"
                          : isDone
                            ? "border-lime/60 bg-transparent"
                            : "border-transparent bg-panel-2/60 hover:bg-panel-2"
                      }`}
                    >
                      <span
                        className={`grid h-6 w-6 shrink-0 place-items-center font-display text-xs font-bold ${
                          isDone ? "bg-lime text-black" : isNext ? "bg-codm text-black" : "bg-line text-mute"
                        }`}
                      >
                        {isDone ? "✓" : i + 1}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={`block font-display text-base font-bold uppercase tracking-wide ${
                            isDone ? "text-mute line-through decoration-lime/70" : "text-text"
                          }`}
                        >
                          {s.title}
                        </span>
                        {s.hint && <span className="block text-xs text-mute">{s.hint}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>

            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate bg-black/50 px-2 py-2 font-mono text-xs text-codm-light">
                {open.code}
              </code>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(open.code);
                  } catch {}
                  setAgain(true);
                  setTimeout(() => setAgain(false), 1400);
                }}
                className="cut-sm shrink-0 bg-panel-2 px-3 py-2 font-display text-sm font-bold uppercase tracking-wider hover:bg-line"
              >
                {again ? "Copied ✓" : "Copy again"}
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-mute">
                <input
                  type="checkbox"
                  checked={off}
                  onChange={(e) => toggleOff(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-codm)]"
                />
                Skip the steps next time
              </label>
              <button
                onClick={() => setOpen(null)}
                className="cut-sm bg-codm px-5 py-2 font-display text-base font-extrabold uppercase tracking-wider text-black hover:bg-codm-light"
              >
                Done
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && !open && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="cut fixed inset-x-4 bottom-36 z-40 mx-auto flex max-w-md items-center justify-between gap-3 border border-codm bg-ink/95 px-4 py-3 backdrop-blur lg:bottom-24"
          >
            <span className="font-display text-base font-extrabold uppercase tracking-wide text-codm">
              Code copied{toast.name ? ` · ${toast.name}` : ""}
            </span>
            <button
              onClick={() => {
                setDone([]);
                setOpen(toast);
                setToast(null);
              }}
              className="font-display text-sm font-bold uppercase tracking-wider text-mute underline-offset-4 hover:text-text hover:underline"
            >
              Show steps
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
