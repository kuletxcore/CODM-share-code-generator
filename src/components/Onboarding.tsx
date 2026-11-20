"use client";

// First visit: state the two jobs of the tool and let the visitor choose one.
// No marketing claims, no email gate — just a route to the right surface.

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { K, readJson, writeJson } from "@/lib/storage";
import { useActions } from "@/lib/actions";

const CHOICES = [
  {
    id: "copy",
    eyebrow: "Fastest route",
    title: "Copy a look",
    copy: "Pick a graded look from a game and get the code plus in-game steps.",
    cta: "Browse looks",
    target: "looks-title",
  },
  {
    id: "build",
    eyebrow: "Full control",
    title: "Build a filter",
    copy: "Tune shadows, midtones and highlights while watching a live preview.",
    cta: "Open generator",
    target: "editor",
  },
  {
    id: "convert",
    eyebrow: "From a picture",
    title: "Screenshot → code",
    copy: "Bring a reference image and let the browser measure a starting grade.",
    cta: "Try converter",
    target: "editor",
    mode: "convert" as const,
  },
];

export default function Onboarding() {
  const [open, setOpen] = useState(false);
  useActions((a) => {
    if (a === "revisit-onboarding") setOpen(true);
  });

  useEffect(() => {
    if (readJson(K.onboarded, false)) return;
    const t = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);

  function close() {
    writeJson(K.onboarded, true);
    setOpen(false);
  }
  const choose = (target: string, mode?: "convert") => {
    close();
    window.setTimeout(() => {
      if (mode) window.dispatchEvent(new CustomEvent("codm:set-mode", { detail: mode }));
      document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[58] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="onboard-title"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="cut w-full max-w-3xl border border-line bg-panel p-5 shadow-2xl sm:p-7"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-[11px] font-bold uppercase tracking-[0.24em] text-codm">
                  Unofficial fan-made tool
                </p>
                <h2 id="onboard-title" className="mt-1 font-title text-4xl font-black uppercase leading-none sm:text-5xl">
                  What brings you here?
                </h2>
                <p className="mt-2 text-sm text-mute">
                  Everything runs in this tab. No upload, no account — pick a starting point.
                </p>
              </div>
              <button onClick={close} aria-label="Skip" className="grid h-11 w-11 shrink-0 place-items-center text-2xl text-mute hover:text-text">×</button>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {CHOICES.map((c, i) => (
                <motion.button
                  key={c.id}
                  onClick={() => choose(c.target, c.mode)}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 * i }}
                  className={`cut group flex min-h-44 flex-col border p-4 text-left transition-colors ${
                    i === 0 ? "border-codm/70 bg-codm/[0.07] hover:bg-codm/15" : "border-line bg-panel-2/60 hover:border-mute"
                  }`}
                >
                  <span className={`font-display text-[10px] font-bold uppercase tracking-[0.2em] ${i === 0 ? "text-codm" : "text-mute"}`}>{c.eyebrow}</span>
                  <span className="mt-2 font-title text-2xl font-black uppercase leading-none">{c.title}</span>
                  <span className="mt-2 flex-1 text-xs leading-relaxed text-mute">{c.copy}</span>
                  <span className="mt-3 font-display text-sm font-bold uppercase tracking-wide text-codm-light">
                    {c.cta} <span aria-hidden>→</span>
                  </span>
                </motion.button>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-mute">You can reach all three from the page at any time.</p>
              <button onClick={close} className="min-h-11 px-3 font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text">
                Skip
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
