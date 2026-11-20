"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";

const ENTRIES: { tag: string; title: string; detail: string }[] = [
  { tag: "Find", title: "Quick find + palette", detail: "⌘K searches looks, runs actions and loads pasted codes." },
  { tag: "Keep", title: "My Looks", detail: "Save, favourite, rename and export grades. Progress stays on this device." },
  { tag: "Decide", title: "A/B compare", detail: "Wipe between two looks before committing to a code." },
  { tag: "Understand", title: "Code inspector", detail: "All 22 numbers explained, with changes from default highlighted." },
  { tag: "Tune", title: "Quick moves & before pin", detail: "Warmer, cooler, punchier—then wipe against your starting grade." },
  { tag: "Hand-off", title: "Mode-aware steps", detail: "The import checklist follows the MP, BR or DMZ tab you play." },
  { tag: "Anywhere", title: "Installable & offline", detail: "Add it to your home screen; the shell and look art work offline." },
];

export default function Changelog() {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog, open);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="min-h-11 border border-line px-3 font-display text-sm font-bold uppercase tracking-wider text-mute hover:border-mute hover:text-text"
      >
        What&apos;s new
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[59] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <motion.div
              ref={dialog}
              role="dialog"
              aria-modal="true"
              aria-labelledby="changelog-title"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="cut max-h-[80svh] w-full max-w-lg overflow-y-auto border border-line bg-panel p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-codm">
                    Filter Lab
                  </p>
                  <h2 id="changelog-title" className="font-title text-3xl font-black uppercase">
                    What&apos;s new
                  </h2>
                </div>
                <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-11 w-11 place-items-center text-2xl text-mute hover:text-text">×</button>
              </div>
              <ol className="mt-4 grid gap-2">
                {ENTRIES.map((e) => (
                  <li key={e.title} className="flex gap-3 border border-line bg-panel-2/60 p-3">
                    <span className="mt-0.5 shrink-0 bg-codm px-2 py-0.5 font-display text-[10px] font-bold uppercase text-black">
                      {e.tag}
                    </span>
                    <span>
                      <span className="block font-display text-base font-bold uppercase tracking-wide">{e.title}</span>
                      <span className="block text-xs text-mute">{e.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
