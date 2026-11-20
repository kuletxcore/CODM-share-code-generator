"use client";

// A/B stage: decide between two looks by wiping across a single frame.

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { LOOKS, type Look } from "@/lib/codm";
import { Art } from "@/components/LooksGallery";
import { act } from "@/lib/actions";
import { copyCode } from "@/components/ImportGuide";
import { copyText } from "@/lib/clipboard";
import { notify } from "@/components/Toasts";

const Picker = ({
  value,
  onChange,
  label,
}: {
  value: Look;
  onChange: (l: Look) => void;
  label: string;
}) => (
  <label className="flex min-w-0 flex-1 flex-col gap-1">
    <span className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-mute">{label}</span>
    <select
      value={value.name}
      onChange={(e) => onChange(LOOKS.find((l) => l.name === e.target.value) ?? value)}
      className="min-h-11 w-full border border-line bg-panel-2 px-2 font-display text-base font-bold uppercase"
    >
      {LOOKS.map((l) => <option key={l.name} value={l.name}>{l.name}</option>)}
    </select>
  </label>
);

export default function CompareMode({
  open,
  onClose,
  onLoad,
}: {
  open: boolean;
  onClose: () => void;
  onLoad: (code: string) => void;
}) {
  const [a, setA] = useState<Look>(LOOKS[0]);
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog, !!open);
  const [b, setB] = useState<Look>(LOOKS[3] ?? LOOKS[1]);
  const [split, setSplit] = useState(50);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[57] grid place-items-center bg-black/85 p-3 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="compare-title"
            initial={{ opacity: 0, scale: 0.98, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 10 }}
            className="cut w-full max-w-4xl border border-line bg-panel p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-codm">Side by side</p>
                <h2 id="compare-title" className="font-title text-3xl font-black uppercase">Compare looks</h2>
              </div>
              <button onClick={onClose} aria-label="Close compare" className="grid h-11 w-11 place-items-center text-2xl text-mute hover:text-text">×</button>
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              <Picker label="Left · A" value={a} onChange={setA} />
              <button
                onClick={() => { setA(b); setB(a); }}
                aria-label="Swap looks"
                className="min-h-11 self-end border border-line bg-panel-2 px-3 text-mute hover:text-text"
              >⇄</button>
              <Picker label="Right · B" value={b} onChange={setB} />
            </div>

            <div className="cut relative mt-3 aspect-video overflow-hidden border border-line bg-black">
              <div className="absolute inset-0"><Art look={a} /></div>
              <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${split}%)` }}><Art look={b} /></div>
              <div className="pointer-events-none absolute inset-0 scanlines opacity-50" />
              <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-codm" style={{ left: `${split}%` }}>
                <span className="absolute left-1/2 top-1/2 grid h-9 w-9 -translate-x-1/2 -translate-y-1/2 place-items-center border-2 border-black bg-codm font-display text-xs font-black text-black">↔</span>
              </div>
              <span className="pointer-events-none absolute left-3 top-3 bg-black/75 px-2 py-0.5 font-display text-xs font-bold uppercase tracking-widest">A · {a.name}</span>
              <span className="pointer-events-none absolute right-3 top-3 bg-black/75 px-2 py-0.5 font-display text-xs font-bold uppercase tracking-widest">B · {b.name}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
                aria-label="Wipe between look A and look B"
                className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
              />
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {([a, b] as const).map((look, i) => (
                <div key={i} className="border border-line bg-panel-2/60 p-3">
                  <p className="font-display text-lg font-extrabold uppercase">{look.name}</p>
                  <p className="mb-2 text-xs text-mute">{look.note}</p>
                  <code className="block break-all font-mono text-[10px] text-codm-light">{look.code}</code>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => copyCode(look.code, look.name, { note: look.note, image: look.image })}
                      className="cut-sm min-h-11 flex-1 bg-codm px-3 font-display text-sm font-extrabold uppercase text-black"
                    >Copy code</button>
                    <button
                      onClick={async () => {
                        const ok = await copyText(`${location.origin}${location.pathname}#look=${encodeURIComponent(look.name)}`);
                        notify(ok ? { title: "Look link copied", tone: "good" } : { title: "Copy failed", tone: "warn" });
                      }}
                      className="min-h-11 border border-line px-3 font-display text-sm font-bold uppercase text-mute hover:text-text"
                    >Link</button>
                    <button
                      onClick={() => { onLoad(look.code); onClose(); act("focus-editor"); }}
                      className="min-h-11 border border-line px-3 font-display text-sm font-bold uppercase text-mute hover:text-text"
                    >Edit</button>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
