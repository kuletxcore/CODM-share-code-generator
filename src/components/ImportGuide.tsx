"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SWATCH_NAMES, decode, hueParts, type Zone, type ZoneKey } from "@/lib/codm";
import { drawQr } from "@/lib/qr";

const EVENT = "codm:copied";
const OFF_KEY = "codm-guide-off";

type GuideTab = "steps" | "phone" | "manual";
type GameMode = "mp" | "br" | "dmz";

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

const MODE_LABELS: Record<GameMode, string> = {
  mp: "MP Mode",
  br: "BR Mode",
  dmz: "DMZ: Recon",
};

function getSteps(gameMode: GameMode): { title: string; hint?: string }[] {
  return [
    { title: "Settings", hint: "Gear icon in the CODM lobby" },
    { title: "Audio and Graphics" },
    {
      title: `Select ${MODE_LABELS[gameMode]} tab`,
      hint:
        gameMode === "dmz"
          ? "DMZ: Recon uses the same code format (no Customize button)"
          : "Each mode keeps its own Graphic Style slots",
    },
    { title: "Graphic Style → Import → Go" },
    { title: "Choose a Custom slot (1–5)" },
    { title: "Paste the code", hint: "Into “Enter the Share code”" },
    { title: "Apply" },
  ];
}

const readOff = () => {
  try {
    return localStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
};

function PhoneQrCanvas({ url, fallbackCode }: { url: string; fallbackCode: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    try {
      drawQr(ctx, url, 0, 0, c.width, "#0a0b0a", "#ffffff");
    } catch {
      drawQr(ctx, fallbackCode, 0, 0, c.width, "#0a0b0a", "#ffffff");
    }
  }, [url, fallbackCode]);

  return (
    <canvas
      ref={ref}
      width={180}
      height={180}
      aria-label="QR code to open this filter on your phone"
      className="mx-auto h-40 w-40 border-2 border-codm bg-white"
    />
  );
}

const MANUAL_ZONES: { key: ZoneKey; label: string }[] = [
  { key: "shadows", label: "Shadows" },
  { key: "midtones", label: "Midtones" },
  { key: "highlights", label: "Highlights" },
  { key: "global", label: "Simple (Whole)" },
];

const isNeutral = (z: Zone) =>
  z.tint < 2 && Math.abs(z.sat - 50) < 1 && Math.abs(z.bri - 50) < 1;

/**
 * Stays open after a copy so in-game steps, phone QR handoff, and manual
 * slider values are right at hand while switching to CODM.
 */
export default function ImportGuide() {
  const [open, setOpen] = useState<{ code: string; name?: string } | null>(null);
  const [toast, setToast] = useState<{ code: string; name?: string } | null>(null);
  const [done, setDone] = useState<number[]>([]);
  const [tab, setTab] = useState<GuideTab>("steps");
  const [gameMode, setGameMode] = useState<GameMode>("mp");
  const [off, setOff] = useState(false);
  const [again, setAgain] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<{ code: string; name?: string }>).detail;
      const skipped = readOff();
      setOff(skipped);
      if (skipped) {
        setToast(d);
      } else {
        setDone([]);
        setTab("steps");
        setOpen(d);
      }
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
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

  const steps = useMemo(() => getSteps(gameMode), [gameMode]);
  const next = steps.findIndex((_, i) => !done.includes(i));
  const parsed = useMemo(() => (open ? decode(open.code) : null), [open]);

  const mobileUrl = useMemo(() => {
    if (!open || typeof window === "undefined") return "";
    return `${window.location.origin}${window.location.pathname}#c=${open.code}`;
  }, [open]);

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
            className="fixed inset-x-0 bottom-0 z-40 max-h-[82svh] overflow-y-auto border-t-2 border-codm bg-ink/95 px-4 pb-5 pt-4 shadow-[0_-20px_60px_rgba(0,0,0,0.65)] backdrop-blur-md sm:inset-x-auto sm:bottom-28 sm:right-6 sm:w-[420px] sm:border-2 sm:pb-4 lg:bottom-24"
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
                  Import into CODM
                </h2>
              </div>
              {tab === "steps" && (
                <span className="mt-1 font-display text-sm font-bold text-mute" aria-live="polite">
                  {done.length}/{steps.length}
                </span>
              )}
            </div>

            {/* 3-Tab Switcher: Steps / Send to Phone QR / Manual Sliders */}
            <div
              role="tablist"
              aria-label="Import guide options"
              className="mt-3 grid grid-cols-3 border border-line bg-black/50 p-0.5"
            >
              {(
                [
                  ["steps", "Steps"],
                  ["phone", "Send to Phone"],
                  ["manual", "Manual Recipe"],
                ] as const
              ).map(([t, label]) => (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`py-1.5 font-display text-xs font-bold uppercase tracking-wider transition-colors ${
                    tab === t ? "bg-codm text-black" : "text-mute hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "steps" && (
              <>
                {/* Mode selector pills */}
                <div className="mt-2.5 flex items-center gap-1" role="group" aria-label="Game mode">
                  <span className="mr-1 font-display text-[10px] font-bold uppercase tracking-widest text-mute">
                    Mode
                  </span>
                  {(["mp", "br", "dmz"] as GameMode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={gameMode === m}
                      onClick={() => setGameMode(m)}
                      className={`px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider ${
                        gameMode === m
                          ? "bg-codm/20 text-codm ring-1 ring-inset ring-codm/60"
                          : "bg-panel-2 text-mute hover:text-text"
                      }`}
                    >
                      {MODE_LABELS[m]}
                    </button>
                  ))}
                </div>

                <ol className="mt-2.5 flex flex-col gap-1">
                  {steps.map((s, i) => {
                    const isDone = done.includes(i);
                    const isNext = i === next;
                    return (
                      <li key={`${gameMode}-${i}`}>
                        <button
                          type="button"
                          onClick={() =>
                            setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]))
                          }
                          aria-pressed={isDone}
                          className={`flex w-full items-center gap-3 border-l-4 px-3 py-1.5 text-left transition-colors ${
                            isNext
                              ? "border-codm bg-codm/10"
                              : isDone
                                ? "border-lime/60 bg-transparent"
                                : "border-transparent bg-panel-2/60 hover:bg-panel-2"
                          }`}
                        >
                          <span
                            className={`grid h-5 w-5 shrink-0 place-items-center font-display text-xs font-bold ${
                              isDone
                                ? "bg-lime text-black"
                                : isNext
                                  ? "bg-codm text-black"
                                  : "bg-line text-mute"
                            }`}
                          >
                            {isDone ? "✓" : i + 1}
                          </span>
                          <span className="min-w-0">
                            <span
                              className={`block font-display text-sm font-bold uppercase tracking-wide ${
                                isDone ? "text-mute line-through decoration-lime/70" : "text-text"
                              }`}
                            >
                              {s.title}
                            </span>
                            {s.hint && <span className="block text-[11px] text-mute">{s.hint}</span>}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}

            {tab === "phone" && (
              <div className="mt-3 flex flex-col items-center gap-3 border border-line bg-black/45 p-4 text-center">
                <PhoneQrCanvas url={mobileUrl} fallbackCode={open.code} />
                <div>
                  <p className="font-display text-base font-extrabold uppercase tracking-wide text-codm">
                    Scan with Your Phone Camera
                  </p>
                  <p className="mt-1 text-xs text-mute">
                    Opens this exact filter on mobile with a 1-tap Copy button so you can paste
                    straight into Call of Duty: Mobile.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(mobileUrl);
                    } catch {}
                    setLinkCopied(true);
                    setTimeout(() => setLinkCopied(false), 1800);
                  }}
                  className="border border-line bg-panel-2 px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-text hover:border-codm"
                >
                  {linkCopied ? "Direct Link Copied ✓" : "Copy Direct Mobile Link"}
                </button>
              </div>
            )}

            {tab === "manual" && parsed && (
              <div className="mt-3 border border-line bg-black/45 p-3">
                <p className="mb-2 text-xs text-mute">
                  Prefer typing sliders manually? Match these in-game values:
                </p>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left font-display uppercase tracking-wider text-mute">
                      <th className="pb-1">Zone</th>
                      <th className="pb-1">Swatch / Hue</th>
                      <th className="pb-1">Tint</th>
                      <th className="pb-1">Sat</th>
                      <th className="pb-1">Bri</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {MANUAL_ZONES.filter(({ key }) => key !== "global" || !isNeutral(parsed.zones.global)).map(
                      ({ key, label }) => {
                        const z = parsed.zones[key];
                        const hp = hueParts(z.hue);
                        return (
                          <tr key={key} className="border-t border-line/70">
                            <td className="py-1.5 font-display font-bold uppercase text-text">
                              {label}
                            </td>
                            <td className="text-codm-light">
                              {z.tint < 2 ? "Neutral" : `${SWATCH_NAMES[hp.swatch]} ${Math.round(hp.pos)}`}
                            </td>
                            <td>{Math.round(z.tint)}</td>
                            <td>{Math.round(z.sat)}</td>
                            <td>{Math.round(z.bri)}</td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
                <div className="mt-2 flex justify-between border-t border-line/70 pt-2 font-mono text-[11px] text-mute">
                  <span>Range Shadows: {Math.round(parsed.shadowPos / 10)}%</span>
                  <span>Range Highlights: {Math.round(parsed.highlightPos / 10)}%</span>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate bg-black/50 px-2 py-2 font-mono text-xs text-codm-light">
                {open.code}
              </code>
              <button
                type="button"
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
                Skip the guide next time
              </label>
              <button
                type="button"
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
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setDone([]);
                  setTab("phone");
                  setOpen(toast);
                  setToast(null);
                }}
                className="font-display text-xs font-bold uppercase tracking-wider text-codm-light hover:underline"
              >
                Phone QR
              </button>
              <button
                type="button"
                onClick={() => {
                  setDone([]);
                  setTab("steps");
                  setOpen(toast);
                  setToast(null);
                }}
                className="font-display text-sm font-bold uppercase tracking-wider text-mute underline-offset-4 hover:text-text hover:underline"
              >
                Show steps
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
