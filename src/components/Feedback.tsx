"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { K, readJson, writeJson } from "@/lib/storage";
import { notify } from "@/components/Toasts";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { useRef } from "react";

const OPTIONS = [
  { id: "great", face: "😎", label: "Nailed it" },
  { id: "ok", face: "🫡", label: "Useful" },
  { id: "miss", face: "🫠", label: "Not quite" },
];

/** Local-only rating: no analytics, no network, just a thank-you. */
export default function Feedback() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(() =>
    readJson<Record<string, string>>(K.feedback, {}).rating ?? null,
  );
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog, open);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="min-h-11 border border-line px-3 font-display text-sm font-bold uppercase tracking-wider text-mute hover:border-mute hover:text-text"
      >
        {picked ? "Thanks for the rating" : "Rate this tool"}
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
              aria-labelledby="feedback-title"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="cut w-full max-w-sm border border-line bg-panel p-5 shadow-2xl"
            >
              <h2 id="feedback-title" className="font-title text-3xl font-black uppercase">
                How did it go?
              </h2>
              <p className="mt-2 text-sm text-mute">
                Did you get a code into the game? One tap — nothing is sent anywhere.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => {
                      const all = readJson<Record<string, string>>(K.feedback, {});
                      writeJson(K.feedback, { ...all, rating: o.id });
                      setPicked(o.id);
                      setOpen(false);
                      notify({ title: "Thanks, operator.", tone: "good" });
                    }}
                    className={`flex min-h-24 flex-col items-center justify-center gap-1 border ${
                      picked === o.id ? "border-codm bg-codm/10" : "border-line bg-panel-2 hover:border-mute"
                    }`}
                  >
                    <span className="text-3xl" aria-hidden>{o.face}</span>
                    <span className="font-display text-xs font-bold uppercase tracking-wide">{o.label}</span>
                  </button>
                ))}
              </div>
              <button onClick={() => setOpen(false)} className="mt-4 min-h-11 w-full text-sm text-mute hover:text-text">
                Maybe later
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
