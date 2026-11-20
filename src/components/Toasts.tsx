"use client";

// One toast channel for the whole app. Components call notify() from event
// handlers, workers or non-React modules; ToastHost owns the queue and a11y.

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

export type Toast = {
  id: number;
  title: string;
  detail?: string;
  action?: { label: string; run: () => void };
  tone?: "default" | "good" | "warn";
  ms?: number;
};

type Input = Omit<Toast, "id"> & { id?: number };

const CHANNEL = "codm:toast";
let nextId = 1;

/** Show a toast from anywhere (including outside React). Returns its id. */
export function notify(t: Input): number {
  const id = t.id ?? nextId++;
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent<Toast>(CHANNEL, { detail: { ...t, id } }));
  return id;
}

export function dismiss(id: number) {
  if (typeof window !== "undefined")
    window.dispatchEvent(new CustomEvent<number>("codm:toast-dismiss", { detail: id }));
}

/** Toast host. Mount once, near the root. */
export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  const reduce = useReducedMotion();

  useEffect(() => {
    const add = (e: Event) => {
      const t = (e as CustomEvent<Toast>).detail;
      setItems((all) => [...all.filter((x) => x.id !== t.id), t].slice(-3));
    };
    const remove = (e: Event) => {
      const id = (e as CustomEvent<number>).detail;
      setItems((all) => all.filter((x) => x.id !== id));
    };
    window.addEventListener(CHANNEL, add);
    window.addEventListener("codm:toast-dismiss", remove);
    return () => {
      window.removeEventListener(CHANNEL, add);
      window.removeEventListener("codm:toast-dismiss", remove);
    };
  }, []);

  const close = useCallback((id: number) => setItems((all) => all.filter((x) => x.id !== id)), []);

  return (
    <div
      className="pointer-events-none fixed left-1/2 top-3 z-[60] flex w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 flex-col gap-2"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {items.map((t) => (
          <ToastCard key={t.id} t={t} reduce={!!reduce} close={close} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastCard({
  t,
  reduce,
  close,
}: {
  t: Toast;
  reduce: boolean;
  close: (id: number) => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(() => close(t.id), t.ms ?? (t.action ? 6500 : 3800));
    return () => window.clearTimeout(timer);
  }, [t.id, t.ms, t.action, close]);

  const accent =
    t.tone === "good" ? "border-lime" : t.tone === "warn" ? "border-[#ff7a6b]" : "border-codm";
  return (
    <motion.div
      layout={!reduce}
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: reduce ? 0.01 : 0.2 }}
      role="status"
      className={`cut pointer-events-auto flex items-center gap-3 border border-line border-l-4 ${accent} bg-panel/95 px-3 py-2.5 shadow-xl backdrop-blur-md`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-bold uppercase tracking-wide">{t.title}</p>
        {t.detail && <p className="mt-0.5 text-xs leading-snug text-mute">{t.detail}</p>}
      </div>
      {t.action && (
        <button
          onClick={() => {
            t.action!.run();
            close(t.id);
          }}
          className="min-h-9 shrink-0 px-2 font-display text-xs font-bold uppercase tracking-wider text-codm hover:text-codm-light"
        >
          {t.action.label}
        </button>
      )}
      <button
        aria-label="Dismiss notification"
        onClick={() => close(t.id)}
        className="grid h-9 w-7 shrink-0 place-items-center text-mute hover:text-text"
      >
        ×
      </button>
    </motion.div>
  );
}
