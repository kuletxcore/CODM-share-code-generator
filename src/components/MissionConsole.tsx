"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { copyText, STEPS } from "@/components/ImportGuide";
import {
  addHistory,
  clearHistory,
  getEmptyFavorites,
  getEmptyHistory,
  getFavoritesSnapshot,
  getHistorySnapshot,
  subscribe,
  toggleFavorite,
} from "@/lib/history";

/** QR that opens this page on a phone with the code loaded (#c= restores it). */
function ConsoleQr({ code }: { code: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    Promise.all([import("@/lib/share"), import("@/lib/shareUrl")]).then(async ([share, url]) => {
      const qr = await share.qrMatrix(url.shareUrl(code));
      const c = ref.current;
      if (!live || !c) return;
      share.drawQr(c.getContext("2d")!, qr, 0, 0, c.width);
    });
    return () => {
      live = false;
    };
  }, [code]);
  return <canvas ref={ref} width={240} height={240} className="h-24 w-24 shrink-0" aria-hidden />;
}

async function saveCard(p: { code: string; name?: string }): Promise<"shared" | "saved" | "failed"> {
  const share = await import("@/lib/share");
  const blob = await share.renderShareCard(p);
  if (!blob) return "failed";
  const file = new File([blob], share.cardFilename(p), { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: p.name ?? "CODM look" });
      return "shared";
    } catch {
      // cancelled share sheet: fall through to a download
    }
  }
  share.downloadBlob(blob, file.name);
  return "saved";
}

/**
 * Mission Console: the persistent bottom bar that turns a code into a
 * finished import. One-tap copy with haptic feedback, inline QR and import
 * steps that stay on screen while switching to CODM, on-device history and
 * favorites so a cleared clipboard never loses a grade.
 */
export default function MissionConsole({
  code,
  name,
  onLoad,
  onReset,
  onRestore,
}: {
  code: string;
  name: string;
  onLoad: (c: string) => boolean;
  onReset: () => void;
  onRestore: (code: string, name: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [input, setInput] = useState("");
  const [bad, setBad] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [card, setCard] = useState<"idle" | "busy" | "shared" | "saved" | "failed">("idle");
  const reduce = useReducedMotion();

  // localStorage is an external store: read it without an effect, and re-render on change.
  const history = useSyncExternalStore(subscribe, getHistorySnapshot, getEmptyHistory);
  const favorites = useSyncExternalStore(subscribe, getFavoritesSnapshot, getEmptyFavorites);
  const fav = favorites.includes(code);

  const copy = async () => {
    await copyText(code);
    setCopied(true);
    addHistory(code, name);
    // First copy on this device: open the steps so nobody has to guess where to paste.
    try {
      if (!localStorage.getItem("codm-console-onboarded")) {
        localStorage.setItem("codm-console-onboarded", "1");
        setExpanded(true);
      }
    } catch {}
    try {
      navigator.vibrate?.([10, 40, 10]);
    } catch {}
    setTimeout(() => setCopied(false), 1600);
  };

  const copyLink = async () => {
    await copyText(`${location.origin}${location.pathname}#c=${code}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1600);
  };

  // Keyboard: C copies when not typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key.toLowerCase() === "c" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        copy();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, name]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/92 backdrop-blur-md">
      <div className="mx-auto max-w-[1400px] px-4 py-3 sm:px-8">
        {/* progress: 1 Copy → 2 Import → 3 Play */}
        <div className="mb-2 flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-[0.18em]" aria-live="polite">
          <span className={copied ? "text-lime" : "text-codm"}>{copied ? "✓ 1 Copy" : "1 Copy"}</span>
          <span className="text-line" aria-hidden>→</span>
          <span className="text-mute">2 Import</span>
          <span className="text-line" aria-hidden>→</span>
          <span className="text-mute">3 Play</span>
          <span className="ml-auto hidden font-mono text-[10px] normal-case tracking-normal text-mute sm:block">
            Press C to copy
          </span>
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="hidden min-w-0 sm:block">
              <p className="truncate font-display text-sm font-bold uppercase tracking-wider">{name}</p>
              <p className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-mute">
                Share code
              </p>
            </div>
            <output
              aria-live="polite"
              aria-label={`Share code for ${name}`}
              className="min-w-0 flex-1 truncate bg-black/50 px-3 py-2 font-mono text-sm text-codm"
              title={code}
            >
              {code}
            </output>
            <button
              onClick={() => {
                toggleFavorite(code);
              }}
              aria-pressed={fav}
              aria-label={fav ? "Remove from favorites" : "Save to favorites"}
              title={fav ? "Favorited" : "Save to favorites"}
              className={`grid h-11 w-11 shrink-0 place-items-center border text-lg transition-colors ${
                fav ? "border-codm bg-codm/15 text-codm" : "border-line text-mute hover:text-text"
              }`}
            >
              {fav ? "★" : "☆"}
            </button>
            <button
              onClick={copyLink}
              aria-label="Copy a link to this exact grade"
              title="Copy link to this grade"
              className="hidden h-11 shrink-0 items-center border border-line px-3 font-display text-xs font-bold uppercase tracking-wider text-mute transition-colors hover:text-text sm:flex"
            >
              {linkCopied ? "Link ✓" : "Link"}
            </button>
            <motion.button
              onClick={copy}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              className={`cut-sm relative min-w-32 shrink-0 px-5 py-2 font-display text-xl font-extrabold uppercase tracking-wider text-black transition-colors ${
                copied ? "bg-lime" : "bg-codm hover:bg-codm-light"
              }`}
            >
              {copied ? "Copied ✓" : "Copy code"}
            </motion.button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="min-h-11 bg-panel-2 px-3 font-display text-sm font-bold uppercase tracking-wider hover:bg-line"
            >
              {expanded ? "Hide steps" : "How to import"}
            </button>
            <form
              className="flex min-w-0 flex-1 items-center gap-2 lg:flex-none"
              onSubmit={(e) => {
                e.preventDefault();
                const ok = onLoad(input);
                setBad(!ok);
                if (ok) setInput("");
              }}
            >
              <input
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setBad(false);
                }}
                placeholder="Paste a code"
                aria-label="Paste a share code"
                aria-invalid={bad}
                className={`min-h-11 w-full min-w-0 border bg-black/50 px-3 font-mono text-sm lg:w-44 ${
                  bad ? "border-red-500" : "border-line"
                }`}
              />
              <button
                type="submit"
                className="min-h-11 shrink-0 bg-panel-2 px-3 font-display text-sm font-bold uppercase tracking-wider hover:bg-line"
              >
                Load
              </button>
              <button
                type="button"
                onClick={onReset}
                className="min-h-11 shrink-0 px-2 font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
              >
                Reset
              </button>
            </form>
          </div>
        </div>

        {bad && (
          <p className="pt-2 text-xs text-red-400" role="alert">
            That doesn&apos;t look like a filter code. It should be 22 numbers joined by underscores.
          </p>
        )}

        {/* expanded: QR + steps + card + history */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="max-h-[62vh] overflow-y-auto pr-1"
            >
              <div className="grid gap-4 pt-3 md:grid-cols-[auto_1fr]">
                <div className="flex items-start gap-3">
                  <ConsoleQr code={code} />
                  <div className="flex min-w-0 flex-col gap-2">
                    <p className="max-w-44 text-xs text-mute">
                      On a computer? Scan to open this code on your phone, ready to copy.
                    </p>
                    <button
                      onClick={async () => {
                        setCard("busy");
                        setCard(await saveCard({ code, name: name === "Custom grade" ? undefined : name }));
                      }}
                      disabled={card === "busy"}
                      className="cut-sm min-h-11 self-start bg-panel-2 px-3 font-display text-sm font-bold uppercase tracking-wider hover:bg-line disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {card === "busy"
                        ? "Drawing card…"
                        : card === "saved"
                          ? "Card saved ✓"
                          : card === "shared"
                            ? "Card shared ✓"
                            : card === "failed"
                              ? "Card failed, try again"
                              : "Save look card"}
                    </button>
                  </div>
                </div>
                <ol className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                  {STEPS.map((s, i) => (
                    <li
                      key={s.title}
                      className="flex min-h-11 items-center gap-2 border border-line bg-panel/60 px-2.5 py-1.5"
                    >
                      <span className="grid h-5 w-5 shrink-0 place-items-center bg-line font-display text-[11px] font-bold text-mute">
                        {i + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-display text-sm font-bold uppercase tracking-wide">
                          {s.title}
                        </span>
                        {s.hint && <span className="block truncate text-[11px] text-mute">{s.hint}</span>}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>

              {(history.length > 0 || favorites.length > 0) && (
                <div className="mt-3 border-t border-line pt-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-mute">
                      Recent on this device
                    </span>
                    {history.slice(0, 5).map((h) => (
                      <button
                        key={h.code}
                        onClick={() => onRestore(h.code, h.name)}
                        title={h.code}
                        className="max-w-44 truncate border border-line bg-panel/60 px-2 py-1.5 font-mono text-[11px] text-mute hover:border-mute hover:text-text"
                      >
                        {h.name === "Custom grade" ? h.code.slice(0, 18) + "…" : h.name}
                      </button>
                    ))}
                    {favorites.length > 0 && (
                      <span className="ml-2 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-mute">
                        ★ Favorites
                      </span>
                    )}
                    {favorites.slice(0, 4).map((c) => (
                      <button
                        key={c}
                        onClick={() => onRestore(c, "Favorite")}
                        title={c}
                        className="max-w-44 truncate border border-codm/40 bg-codm/10 px-2 py-1.5 font-mono text-[11px] text-codm hover:bg-codm/20"
                      >
                        {c.slice(0, 18)}…
                      </button>
                    ))}
                    <button
                      onClick={clearHistory}
                      className="ml-auto font-display text-[11px] font-bold uppercase tracking-wider text-mute hover:text-text"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
