"use client";

// Command palette: the fastest path from "I want a look / a code / a tool" to
// the action, without hunting through the page. Cmd/Ctrl+K anywhere.

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LOOKS } from "@/lib/codm";
import { act, type AppAction } from "@/lib/actions";
import { normalizeCode } from "@/lib/codeTools";

type Item = {
  id: string;
  title: string;
  hint?: string;
  group: "Actions" | "Looks";
  run: () => void;
};

const ACTIONS: { title: string; hint: string; action: AppAction; keys?: string }[] = [
  { title: "Copy / save current look", hint: "Save this grade to My Looks", action: "save-look", keys: "S" },
  { title: "Open My Looks", hint: "Saved, favourite and recent grades", action: "open-my-looks" },
  { title: "Compare two looks", hint: "Side-by-side A/B stage", action: "open-compare" },
  { title: "Inspect share code", hint: "What all 22 numbers mean", action: "open-inspector" },
  { title: "Quick tweaks", hint: "Warmer, cooler, punchier…", action: "focus-editor" },
  { title: "Roll a random grade", hint: "Seeded, reproducible, tweakable", action: "randomize" },
  { title: "Surprise me", hint: "Jump to a random gallery look", action: "surprise" },
  { title: "Toggle Simple / Advanced", hint: "Switch editor depth", action: "toggle-mode", keys: "M" },
  { title: "Fullscreen preview", hint: "See the grade large", action: "fullscreen-preview", keys: "F" },
  { title: "Keyboard shortcuts", hint: "Every shortcut in one place", action: "open-help", keys: "?" },
  { title: "Undo last change", hint: "Step back one edit", action: "undo", keys: "⌘Z" },
  { title: "Redo change", hint: "Step forward one edit", action: "redo", keys: "⌘⇧Z" },
];

const score = (text: string, q: string) => {
  const t = text.toLowerCase();
  const needle = q.toLowerCase().trim();
  if (!needle) return 1;
  if (t === needle) return 100;
  if (t.startsWith(needle)) return 70;
  if (t.includes(needle)) return 40;
  // subsequence match: "cw" -> "Cold War"
  let i = 0;
  for (const ch of t) if (ch === needle[i]) i++;
  return i === needle.length ? 20 : 0;
};

export default function CommandPalette({
  open,
  onClose,
  onLoadCode,
}: {
  open: boolean;
  onClose: () => void;
  onLoadCode: (code: string) => void;
}) {
  const [q, setQ] = useState("");
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setCursor(0);
      const id = requestAnimationFrame(() => input.current?.focus());
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  const pasted = normalizeCode(q);
  const items = useMemo<Item[]>(() => {
    const out: Item[] = ACTIONS.map((a) => ({
      id: `a:${a.action}`,
      title: a.title,
      hint: a.keys ? `${a.hint} · ${a.keys}` : a.hint,
      group: "Actions",
      run: () => act(a.action),
    }));
    for (const look of LOOKS) {
      out.push({
        id: `l:${look.name}`,
        title: look.name,
        hint: look.game ? `${look.game} · ${look.note}` : look.note,
        group: "Looks",
        run: () => {
          onLoadCode(look.code);
          act("focus-editor");
        },
      });
    }
    if (pasted) {
      out.unshift({
        id: "paste",
        title: "Load pasted share code",
        hint: pasted,
        group: "Actions",
        run: () => onLoadCode(pasted),
      });
    }
    const needle = q.split(" ").slice(0, pasted ? 1 : 99).join(" ") || q;
    return out
      .map((it) => ({ it, s: Math.max(score(it.title, needle), score(it.hint ?? "", needle) * 0.6) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((x) => x.it);
  }, [q, onLoadCode, pasted]);

  useEffect(() => setCursor(0), [q]);

  useEffect(() => {
    const el = list.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const choose = (i: number) => {
    items[i]?.run();
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-black/75 px-3 pt-[10svh] backdrop-blur-sm sm:pt-[14svh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="cut w-full max-w-xl border border-line bg-panel shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <span className="font-display text-codm">⌕</span>
              <input
                ref={input}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setCursor((c) => (c + 1) % Math.max(1, items.length));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setCursor((c) => (c - 1 + items.length) % Math.max(1, items.length));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    choose(cursor);
                  } else if (e.key === "Escape") {
                    onClose();
                  }
                }}
                placeholder="Search looks, actions or paste a code…"
                aria-label="Search looks and actions"
                className="min-h-14 w-full bg-transparent font-display text-lg outline-none placeholder:text-mute"
              />
              <kbd className="hidden border border-line px-1.5 py-0.5 font-mono text-[10px] text-mute sm:block">
                ESC
              </kbd>
            </div>
            <div ref={list} className="max-h-[55svh] overflow-y-auto p-2">
              {!items.length && (
                <p className="px-3 py-6 text-center text-sm text-mute">Nothing matched that.</p>
              )}
              {items.map((it, i) => (
                <button
                  key={it.id}
                  data-active={i === cursor}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => choose(i)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left ${
                    i === cursor ? "bg-white/10" : "hover:bg-white/5"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-display text-base font-bold uppercase tracking-wide">
                      {it.title}
                    </span>
                    {it.hint && (
                      <span className="block truncate font-mono text-[11px] text-mute">{it.hint}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-display text-[10px] uppercase tracking-widest text-mute">
                    {it.group}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex justify-between gap-3 border-t border-line px-4 py-2 font-mono text-[10px] text-mute">
              <span>↑↓ navigate · ↵ select</span>
              <span>⌘K opens anywhere</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
