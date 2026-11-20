"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LOOKS, decode } from "@/lib/codm";
import {
  decodeDuel,
  encodeDuel,
  lookImage,
  lookName,
  lookNote,
  randomRival,
  rivalOf,
} from "@/lib/duel";
import { announceCopy, copyText } from "@/components/ImportGuide";
import DuelView from "@/components/DuelView";

/*
 * Duel: two looks, one frame, and a divider the visitor drags.
 *
 * Picking between two filters is the core question this site exists to answer,
 * and a single-look preview can only answer it one candidate at a time. The
 * duel puts both on the same pixels, in the same light, so the eye decides in a
 * second instead of in five tab switches. The URL carries the pairing
 * (`#d=a~b`), so "which of these two?" is a link you can send.
 */

export type DuelSeed = { a: string; b: string };

export default function Duel({
  seed,
  onClose,
  onPick,
}: {
  seed: DuelSeed | null;
  onClose: () => void;
  onPick: (code: string) => void;
}) {
  const [a, setA] = useState(seed?.a ?? LOOKS[0].code);
  const [b, setB] = useState(seed?.b ?? rivalOf(LOOKS[0].code));
  const [split, setSplit] = useState(0.5);
  const [focus, setFocus] = useState<"a" | "b">("b");
  const [copied, setCopied] = useState<"a" | "b" | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [card, setCard] = useState<"idle" | "busy" | "done" | "failed">("idle");
  // the composed duel frame, kept current by the view so the card can use it
  const face = useRef<HTMLCanvasElement | null>(null);
  const capture = useCallback((c: HTMLCanvasElement) => {
    face.current = c;
  }, []);
  const heading = useRef<HTMLHeadingElement>(null);
  const reduce = useReducedMotion();
  const open = !!seed;

  // A new seed (from the URL or a gallery button) resets the match. Done during
  // render rather than in an effect so the first frame is already the new match.
  const [seen, setSeen] = useState<DuelSeed | null>(seed);
  if (seed !== seen) {
    setSeen(seed);
    if (seed) {
      setA(seed.a);
      setB(seed.b);
      setSplit(0.5);
    }
  }

  // The duel is full-screen: freeze the page behind it, and hand focus to the title.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    heading.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // The hash carries the duel while it is open, so a shared URL opens the match.
  useEffect(() => {
    if (!open) return;
    const next = encodeDuel({ a, b });
    if (location.hash !== next) history.replaceState(null, "", next);
  }, [open, a, b]);

  const settings = useMemo(
    () => ({ a: decode(a), b: decode(b) }),
    [a, b],
  );

  const swap = useCallback(() => {
    setA(b);
    setB(a);
    setSplit((s) => 1 - s);
  }, [a, b]);

  const setName = useCallback(
    (code: string) => {
      const other = focus === "a" ? b : a;
      const target = code === (focus === "a" ? b : a) ? randomRival(code, [other]) : code;
      if (focus === "a") setA(target);
      else setB(target);
      // flip focus so a roster tap pairs both sides in two taps
      setFocus((f) => (f === "a" ? "b" : "a"));
    },
    [focus, a, b],
  );

  const share = async () => {
    const url = `${location.origin}${location.pathname}${encodeDuel({ a, b })}`;
    // Phones hand a link over through the share sheet; everything else copies it.
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: `${lookName(a)} vs ${lookName(b)}`, url });
        return;
      } catch {
        // cancelled: fall through to the clipboard
      }
    }
    await copyText(url);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1600);
  };

  if (!settings.a || !settings.b) return null;

  const roster = LOOKS;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="duel-title"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ type: "spring", stiffness: 400, damping: 36 }}
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-ink"
        >
          <div className="pointer-events-none absolute inset-0 scanlines opacity-30" aria-hidden />

          <header className="relative flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:px-6">
            <div className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-[0.22em] text-codm">
              <span className="inline-block h-2 w-2 rotate-45 bg-codm" />
              Duel
            </div>
            <h2
              id="duel-title"
              ref={heading}
              tabIndex={-1}
              className="min-w-0 flex-1 truncate text-center font-title text-xl font-black uppercase tracking-wide outline-none sm:text-2xl"
            >
              <span className="text-mute">{lookName(a)}</span>
              <span className="px-2 text-codm">vs</span>
              <span>{lookName(b)}</span>
            </h2>
            <button
              onClick={onClose}
              className="min-h-11 shrink-0 px-2 font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
            >
              Close
            </button>
          </header>

          <div className="relative mx-auto w-full max-w-[1400px] px-4 sm:px-6">
            <div className="relative">
              <div className="cut relative overflow-hidden border border-line">
                <DuelView
                  src={null}
                  a={settings.a}
                  b={settings.b}
                  split={split}
                  onSplit={setSplit}
                  onSwap={swap}
                  onCapture={capture}
                />

                {/* names ride on the frame, so there is never a doubt which side is which */}
                <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-3 sm:inset-x-4 sm:top-4">
                  <div className="cut-sm max-w-[45%] bg-black/75 px-3 py-2">
                    <div className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-codm">
                      Left{focus === "a" ? " · next tap" : ""}
                    </div>
                    <div className="truncate font-display text-base font-extrabold uppercase leading-tight sm:text-lg">
                      {lookName(a)}
                    </div>
                    <div className="hidden truncate text-[11px] text-mute sm:block">{lookNote(a)}</div>
                  </div>
                  <div className="cut-sm max-w-[45%] bg-black/75 px-3 py-2 text-right">
                    <div className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-codm">
                      Right{focus === "b" ? " · next tap" : ""}
                    </div>
                    <div className="truncate font-display text-base font-extrabold uppercase leading-tight sm:text-lg">
                      {lookName(b)}
                    </div>
                    <div className="hidden truncate text-[11px] text-mute sm:block">{lookNote(b)}</div>
                  </div>
                </div>

                </div>
              </div>

              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-mute">
                <span>Drag the divider (or ← →) to see either look on the same pixels.</span>
                <button
                onClick={swap}
                className="font-display text-xs font-bold uppercase tracking-wider text-text underline-offset-4 hover:underline"
              >
                Swap sides ⇄
              </button>
              <button
                onClick={() =>
                  setFocus((f) => {
                    const code = f === "a" ? a : b;
                    const other = f === "a" ? b : a;
                    const rival = randomRival(code, [other]);
                    if (f === "a") setA(rival);
                    else setB(rival);
                    return f;
                  })
                }
                className="font-display text-xs font-bold uppercase tracking-wider text-text underline-offset-4 hover:underline"
              >
                Toss up ⤨
              </button>
            </p>
          </div>

          {/* roster: two taps set both sides, then it flips the target automatically */}
          <div className="relative mx-auto mt-4 w-full max-w-[1400px] px-4 sm:px-6">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-mute">
                Change the{" "}
                <span className="text-text">{focus === "a" ? "left" : "right"}</span> look
              </h3>
              <div className="flex gap-1" role="group" aria-label="Which side the roster sets">
                {(
                  [
                    ["a", "Left"],
                    ["b", "Right"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => setFocus(k)}
                    aria-pressed={focus === k}
                    className={`min-h-11 border px-3 font-display text-xs font-bold uppercase tracking-wider ${
                      focus === k
                        ? "border-codm bg-codm text-black"
                        : "border-line bg-panel/70 text-mute hover:text-text"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <ul className="-mx-4 mt-1 flex snap-x gap-1.5 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0">
              {roster.map((look) => {
                const side = a === look.code ? "a" : b === look.code ? "b" : null;
                return (
                  <li key={look.name} className="shrink-0 snap-start">
                    <button
                      onClick={() => setName(look.code)}
                      aria-pressed={!!side}
                      className={`relative block w-28 overflow-hidden border text-left sm:w-36 ${
                        side
                          ? "border-codm"
                          : "border-line opacity-70 hover:opacity-100"
                      }`}
                    >
                      <span className="block aspect-[16/7] overflow-hidden bg-panel-2">
                        {look.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={look.image.replace("/looks/", "/looks/thumb/")}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1 pt-4 font-display text-[10px] font-bold uppercase leading-none tracking-wider">
                        {look.name}
                      </span>
                      {side && (
                        <span className="absolute left-1 top-1 bg-codm px-1 font-display text-[10px] font-black uppercase text-black">
                          {side === "a" ? "L" : "R"}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {/* custom grades in play stay selectable even though they are not in LOOKS */}
              {[a, b]
                .filter((code) => !lookImage(code))
                .map((code) => (
                  <li key={code} className="shrink-0">
                    <button
                      onClick={() => setName(code)}
                      className="block w-28 border border-line bg-panel-2 p-2 text-left font-display text-[10px] font-bold uppercase tracking-wider text-mute sm:w-36"
                    >
                      {lookName(code)}
                    </button>
                  </li>
                ))}
            </ul>
            <div className="h-2" />
          </div>

          <div className="relative mx-auto mb-4 mt-2 w-full max-w-[1400px] px-4 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => onPick(a)}
                className="cut flex-1 bg-panel-2 px-4 py-3 font-display text-base font-extrabold uppercase tracking-wider hover:bg-line"
              >
                Keep left · {lookName(a)}
              </button>
              <button
                onClick={() => onPick(b)}
                className="cut flex-1 bg-codm px-4 py-3 font-display text-base font-extrabold uppercase tracking-wider text-black hover:bg-codm-light"
              >
                Keep right · {lookName(b)}
              </button>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["a", a],
                    ["b", b],
                  ] as const
                ).map(([side, code]) => (
                  <button
                    key={side}
                    onClick={async () => {
                      const write = copyText(code);
                      setCopied(side);
                      await write;
                      announceCopy(code, lookName(code), {
                        note: lookNote(code),
                        image: lookImage(code),
                      });
                      setTimeout(() => setCopied(null), 1600);
                    }}
                    className="min-h-11 whitespace-nowrap bg-panel-2 px-3 font-display text-sm font-bold uppercase tracking-wider hover:bg-line"
                  >
                    {copied === side ? "Copied ✓" : `Copy ${side === "a" ? "left" : "right"}`}
                  </button>
                ))}
                <button
                  onClick={share}
                  className="min-h-11 whitespace-nowrap bg-panel-2 px-3 font-display text-sm font-bold uppercase tracking-wider hover:bg-line"
                >
                  {linkCopied ? "Link copied ✓" : "Copy duel link"}
                </button>
                <button
                  onClick={async () => {
                    setCard("busy");
                    const { shareDuelCard } = await import("@/lib/share");
                    const result = await shareDuelCard({
                      a: { code: a, name: lookName(a) },
                      b: { code: b, name: lookName(b) },
                      frame: face.current,
                      url: `${location.origin}${location.pathname}${encodeDuel({ a, b })}`,
                    });
                    setCard(result === "failed" ? "failed" : "done");
                    setTimeout(() => setCard("idle"), 2200);
                  }}
                  disabled={card === "busy"}
                  className="min-h-11 whitespace-nowrap bg-panel-2 px-3 font-display text-sm font-bold uppercase tracking-wider hover:bg-line disabled:opacity-60"
                >
                  {card === "busy"
                    ? "Drawing…"
                    : card === "done"
                      ? "Card saved ✓"
                      : card === "failed"
                        ? "Retry card"
                        : "Duel card"}
                </button>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-mute">
              “Keep” opens that look in the generator, ready to tune. The duel link is the match
              itself — whoever opens it lands on this same pair. The duel card is a 1200×630 image
              with both names, both codes and a QR back to the match, for a chat or a clip thumbnail.
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Reads `#d=a~b` on load so a shared duel opens itself. */
export function seedFromHash(hash: string): DuelSeed | null {
  return decodeDuel(hash);
}
