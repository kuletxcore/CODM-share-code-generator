"use client";

// Decode the share code into the things a player can recognise in game.

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { DEFAULT_CODE, LOOKS } from "@/lib/codm";
import { codeDiff, describeCode, lookForCode, suggestName } from "@/lib/codeTools";
import { copyText } from "@/lib/clipboard";
import { notify } from "@/components/Toasts";

const GROUPS = [
  { id: "range", label: "Range bar", note: "Where each tonal zone begins" },
  { id: "global", label: "Simple", note: "Whole image, presets #1–#5" },
  { id: "shadows", label: "Shadows", note: "Darkest pixels" },
  { id: "midtones", label: "Midtones", note: "Most of the frame" },
  { id: "highlights", label: "Highlights", note: "Brightest pixels" },
] as const;

export default function LookInspector({
  open,
  code,
  onClose,
  onLoad,
}: {
  open: boolean;
  code: string;
  onClose: () => void;
  onLoad: (code: string) => void;
}) {
  const [diffOnly, setDiffOnly] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog, !!open);
  const fields = useMemo(() => describeCode(code), [code]);
  const diff = useMemo(() => codeDiff(code, DEFAULT_CODE), [code, fields]);
  const look = lookForCode(code);

  return (
    <AnimatePresence>
      {open && fields && (
        <motion.div
          className="fixed inset-0 z-[56] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inspect-title"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="cut flex max-h-[90svh] w-full max-w-2xl flex-col border-t-2 border-codm bg-panel shadow-2xl sm:border-2"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line p-4">
              <div>
                <p className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-codm">
                  Share code decoded
                </p>
                <h2 id="inspect-title" className="font-title text-3xl font-black uppercase">
                  {look?.name ?? suggestName(code)}
                </h2>
                <p className="mt-1 font-mono text-[11px] leading-relaxed text-mute">{code}</p>
              </div>
              <button onClick={onClose} aria-label="Close inspector" className="grid h-11 w-11 place-items-center text-2xl text-mute hover:text-text">×</button>
            </div>

            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
              <p className="text-xs text-mute">
                {diff.length ? `${diff.length} of 22 values differ from the in-game default.` : "This is the in-game default code."}
              </p>
              <label className="flex min-h-10 cursor-pointer items-center gap-2 font-display text-xs font-bold uppercase tracking-wide text-mute">
                <input type="checkbox" checked={diffOnly} onChange={(e) => setDiffOnly(e.target.checked)} className="h-4 w-4 accent-[var(--color-codm)]" />
                Changed only
              </label>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {GROUPS.map((g) => {
                const rows = fields.filter((f) => f.group === g.id && (!diffOnly || diff.includes(f.i)));
                if (!rows.length) return null;
                return (
                  <section key={g.id} className="mb-4">
                    <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1">
                      <h3 className="font-display text-base font-extrabold uppercase tracking-wider">{g.label}</h3>
                      <p className="text-xs text-mute">{g.note}</p>
                    </div>
                    <dl className="grid gap-x-4 sm:grid-cols-2">
                      {rows.map((f) => (
                        <div key={f.i} className="flex items-baseline justify-between gap-2 border-b border-line/40 py-1.5">
                          <dt className="text-xs text-mute">
                            <span className="mr-2 font-mono text-[10px] text-line">{String(f.i).padStart(2, "0")}</span>
                            {f.label}
                          </dt>
                          <dd className={`font-mono text-xs tabular-nums ${diff.includes(f.i) ? "text-codm-light" : "text-text"}`}>
                            {f.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
              <button
                onClick={async () => {
                  const ok = await copyText(JSON.stringify({ app: "CODM Filter Lab", name: look?.name ?? suggestName(code), code }, null, 2));
                  notify(ok ? { title: "Grade JSON copied", tone: "good" } : { title: "Copy failed", tone: "warn" });
                }}
                className="min-h-11 border border-line bg-panel-2 font-display text-xs font-bold uppercase tracking-wide hover:bg-line"
              >
                ⧉ Copy JSON
              </button>
              <button
                onClick={async () => {
                  try {
                    const data = JSON.parse(await navigator.clipboard.readText()) as { code?: string; name?: string };
                    const found = data.code ?? LOOKS.find((l) => l.name.toLowerCase() === data.name?.toLowerCase())?.code;
                    if (!found) throw new Error();
                    onLoad(found);
                    onClose();
                    notify({ title: "Grade imported", tone: "good" });
                  } catch {
                    notify({ title: "Nothing to import", detail: "Copy a Filter Lab grade JSON first.", tone: "warn" });
                  }
                }}
                className="min-h-11 border border-line bg-panel-2 font-display text-xs font-bold uppercase tracking-wide hover:bg-line"
              >
                ⇥ Import JSON
              </button>
              <button
                onClick={async () => notify(await copyText(code)
                  ? { title: "Code copied", tone: "good" }
                  : { title: "Copy failed", tone: "warn" })}
                className="cut-sm min-h-12 bg-panel-2 font-display text-sm font-bold uppercase tracking-wide hover:bg-line"
              >
                Copy code
              </button>
              <button
                onClick={() => { onLoad(code); onClose(); }}
                className="cut-sm min-h-12 bg-codm font-display text-sm font-extrabold uppercase tracking-wide text-black hover:bg-codm-light"
              >
                Open in generator
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
