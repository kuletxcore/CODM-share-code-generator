"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { addRecent } from "@/lib/myCodes";

const EVENT = "codm:copied";
const OFF_KEY = "codm-guide-off";

type Copied = { code: string; name?: string; note?: string; image?: string; source?: "screen-test"; blocked?: boolean };

/** Call after a share code lands on the clipboard; opens the import guide. */
export function announceCopy(code: string, name?: string, extra: Omit<Copied, "code" | "name"> = {}) {
  // every copy on the site passes through here, so this is the one place recents are written
  if (!extra.blocked) addRecent(code, name);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { code, name, ...extra } }));
}

/** Clipboard write only, started straight from a click so the gesture still counts. Resolves false when both copy routes failed. */
export async function copyText(code: string) {
  try {
    await navigator.clipboard.writeText(code);
    return true;
  } catch {
    // the fallback has to focus a textarea; give focus back to the Copy button after
    const was = document.activeElement as HTMLElement | null;
    const t = document.createElement("textarea");
    t.value = code;
    document.body.appendChild(t);
    t.select();
    let ok: boolean;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    t.remove();
    was?.focus({ preventScroll: true });
    return ok;
  }
}

/** Puts the code on the clipboard and opens the guide. Resolves false when both copy routes failed. */
export async function copyCode(code: string, name?: string, extra: Omit<Copied, "code" | "name"> = {}) {
  const ok = await copyText(code);
  // Open the guide either way: it shows the code with Copy again, which is the
  // way out when the browser blocked the clipboard.
  announceCopy(code, name, { ...extra, blocked: !ok });
  return ok;
}

/** QR that opens this page on a phone with the code loaded (#c= restores it). */
function PhoneQr({ code }: { code: string }) {
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
  return <canvas ref={ref} width={240} height={240} className="h-[120px] w-[120px] shrink-0" aria-hidden />;
}

async function saveCard(p: Copied): Promise<"shared" | "saved" | "cancelled" | "failed"> {
  const share = await import("@/lib/share");
  const blob = await share.renderShareCard(p);
  if (!blob) return "failed";
  const file = new File([blob], share.cardFilename(p), { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: p.name ?? "CODM look" });
      return "shared";
    } catch (e) {
      // Backing out of the share sheet means "no", so don't download anyway.
      // Anything else (iOS throws NotAllowedError once the tap is too old after
      // the render) falls through to a download so the card isn't lost.
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  share.downloadBlob(blob, file.name);
  return "saved";
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
export default function ImportGuide({
  onTweak,
}: {
  /** "Needs tweaking": reopen the editor on this code, pinned as the reference. */
  onTweak?: (code: string, name?: string) => void;
}) {
  const [open, setOpen] = useState<Copied | null>(null);
  const [toast, setToast] = useState<Copied | null>(null);
  const [card, setCard] = useState<"idle" | "busy" | "shared" | "saved" | "cancelled" | "failed">("idle");
  const [done, setDone] = useState<number[]>([]);
  const [off, setOff] = useState(false);
  const [again, setAgain] = useState<"" | "ok" | "failed">("");
  const heading = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Copied>).detail;
      setCard("idle");
      const skip = readOff();
      setOff(skip);
      if (skip) {
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
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // what had focus before the guide opened (usually a Copy button); it gets focus back on close
  const opener = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) {
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true });
      opener.current = null;
      return;
    }
    opener.current ??= document.activeElement as HTMLElement | null;
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
            className="fixed inset-x-0 bottom-0 z-40 max-h-[80svh] overflow-y-auto border-t-2 border-codm bg-ink/95 px-4 pb-5 pt-4 shadow-[0_-20px_60px_rgba(0,0,0,0.6)] sm:inset-x-auto sm:bottom-20 sm:right-6 sm:w-[400px] sm:border-2 sm:pb-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className={`font-display text-xs font-bold uppercase tracking-[0.2em] ${open.blocked ? "text-text" : "text-lime"}`}
                >
                  {open.blocked ? "Copy blocked · select the code below" : "✓ Code copied"}
                  {open.name ? ` · ${open.name}` : ""}
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
                      className={`flex min-h-11 w-full items-center gap-3 border-l-4 px-3 py-2 text-left transition-colors ${
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

            <details className="mt-3">
              <summary className="flex min-h-11 cursor-pointer items-center font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text">
                Watch it done (2× speed)
              </summary>
              <video
                src="/import-demo.mp4"
                poster="/import-demo.jpg"
                controls
                muted
                playsInline
                preload="none"
                className="mt-2 w-full border border-line bg-black"
              />
            </details>

            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate bg-black/50 px-2 py-2 font-mono text-xs text-codm-light">
                {open.code}
              </code>
              <button
                onClick={async () => {
                  setAgain((await copyText(open.code)) ? "ok" : "failed");
                  setTimeout(() => setAgain(""), 1400);
                }}
                className="cut-sm min-h-11 shrink-0 bg-panel-2 px-3 font-display text-sm font-bold uppercase tracking-wider hover:bg-line"
              >
                {again === "ok" ? "Copied ✓" : again === "failed" ? "Blocked" : "Copy again"}
              </button>
            </div>

            <div className="mt-3 flex items-center gap-3 border-t border-line pt-3">
              <div className="hidden sm:block">
                <PhoneQr code={open.code} />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <p className="hidden text-xs text-mute sm:block">
                  On a computer? Scan to open this code on your phone, ready to copy.
                </p>
                <button
                  onClick={async () => {
                    setCard("busy");
                    setCard(await saveCard(open));
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

            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <label className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-mute">
                <input
                  type="checkbox"
                  checked={off}
                  onChange={(e) => toggleOff(e.target.checked)}
                  className="h-4 w-4 accent-[var(--color-codm)]"
                />
                Skip the steps next time
              </label>
              <div className="ml-auto flex gap-1">
              {onTweak && (
                <button
                  onClick={() => {
                    const { code, name } = open;
                    // closing hands focus back to the opener first; the editor scroll follows
                    setOpen(null);
                    onTweak(code, name);
                  }}
                  className="min-h-11 bg-panel-2 px-3 font-display text-sm font-bold uppercase tracking-wider hover:bg-line"
                >
                  Needs tweaking
                </button>
              )}
              <button
                onClick={() => setOpen(null)}
                className="cut-sm min-h-11 bg-codm px-5 font-display text-base font-extrabold uppercase tracking-wider text-black hover:bg-codm-light"
              >
                Done
              </button>
              </div>
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
            className="cut fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-md items-center justify-between gap-3 border border-codm bg-ink/95 px-4 py-3"
          >
            <span className="font-display text-base font-extrabold uppercase tracking-wide text-codm">
              {toast.blocked ? "Copy blocked" : "Code copied"}
              {toast.name ? ` · ${toast.name}` : ""}
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
