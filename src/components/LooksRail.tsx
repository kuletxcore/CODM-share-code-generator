"use client";

import { useEffect, useRef, useState } from "react";
import { LOOKS, applyGrade, decode, type Look } from "@/lib/codm";
import { thumbnailBase } from "@/lib/image";

/*
 * The look shelf. Every tile is the look graded onto the image in the monitor,
 * so the shelf is a contact sheet of what you'd actually get — not stock art.
 * The reference photos are still one tap away behind the toggle.
 */

const W = 256,
  H = 160;

// Graded thumbnails, cached per source image so switching back is instant.
const cache = new WeakMap<HTMLCanvasElement, Map<string, ImageData>>();

function gradedThumb(src: HTMLCanvasElement, code: string): ImageData | null {
  const s = decode(code);
  if (!s) return null;
  let forSrc = cache.get(src);
  if (!forSrc) {
    forSrc = new Map();
    cache.set(src, forSrc);
  }
  let img = forSrc.get(code);
  if (!img) {
    const base = thumbnailBase(src, W, H);
    const data = new Uint8ClampedArray(base.data);
    applyGrade(data, s);
    img = new ImageData(data, W, H);
    forSrc.set(code, img);
  }
  return img;
}

function LiveThumb({
  src,
  code,
  live,
  art,
  delay,
}: {
  src: HTMLCanvasElement | null;
  code: string;
  live: boolean;
  art?: string;
  delay: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!live || !src) return;
    // spread the work: grading twelve tiles in one frame would stutter the page
    const t = setTimeout(() => {
      const c = ref.current;
      const img = gradedThumb(src, code);
      if (!c || !img) return;
      if (c.width !== W) c.width = W;
      if (c.height !== H) c.height = H;
      c.getContext("2d")!.putImageData(img, 0, 0);
    }, delay);
    return () => clearTimeout(t);
  }, [src, code, live, delay]);

  if (live) {
    return (
      <canvas
        ref={ref}
        width={W}
        height={H}
        className="h-full w-full bg-panel-2 object-cover"
        aria-hidden
      />
    );
  }
  return art ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={art}
      alt=""
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
    />
  ) : (
    <div className="h-full w-full bg-panel-2" />
  );
}

export default function LooksRail({
  src,
  activeCode,
  onPick,
  className = "",
}: {
  src: HTMLCanvasElement | null;
  activeCode: string;
  onPick: (look: Look) => void;
  className?: string;
}) {
  // Live by default: what you see is what the code does to this frame.
  const [mode, setMode] = useState<"live" | "refs">("live");

  const shuffle = () => {
    const pool = LOOKS.filter((l) => l.code !== activeCode);
    onPick(pool[Math.floor(Math.random() * pool.length)] ?? LOOKS[0]);
  };

  return (
    <section aria-labelledby="looks-title" className={`mt-2 min-w-0 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2
            id="looks-title"
            className="flex items-center gap-2 font-display text-xl font-extrabold uppercase tracking-[0.14em]"
          >
            <span className="inline-block h-2 w-2 rotate-45 bg-codm" />
            Look shelf
          </h2>
          <p className="mt-0.5 text-sm text-mute">
            {mode === "live"
              ? "Every code run on the frame above. Tap one to try it, then tune it."
              : "Reference stills each look was built from."}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <div role="group" aria-label="Shelf preview" className="flex border border-line">
            {(
              [
                ["live", "Live"],
                ["refs", "Stills"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                aria-pressed={mode === m}
                onClick={() => setMode(m)}
                className={`px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wider transition-colors ${
                  mode === m ? "bg-codm text-black" : "bg-panel-2 text-mute hover:text-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={shuffle}
            className="cut-sm bg-panel-2 px-2.5 py-1 font-display text-[10px] font-bold uppercase tracking-wider text-text hover:bg-line"
          >
            ⤨ Shuffle
          </button>
        </div>
      </div>

      <div
        role="toolbar"
        aria-label="Ready-made looks"
        className="-mx-4 mt-2 flex snap-x gap-1.5 overflow-x-auto px-4 pb-1.5 [scrollbar-width:none] sm:mx-0 sm:px-0"
        onKeyDown={(e) => {
          const buttons = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>("[data-look]"),
          );
          const i = buttons.indexOf(document.activeElement as HTMLElement);
          if (i < 0) return;
          const dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!dir) return;
          e.preventDefault();
          buttons[(i + dir + buttons.length) % buttons.length]?.focus();
        }}
      >
        {LOOKS.map((l, i) => {
          const active = l.code === activeCode;
          return (
            <button
              key={l.name}
              data-look
              onClick={() => onPick(l)}
              aria-pressed={active}
              title={l.note}
              className={`group relative w-32 shrink-0 snap-start overflow-hidden border text-left transition-[border-color,transform] focus-visible:outline-offset-[-2px] sm:w-40 ${
                active ? "border-codm" : "border-line hover:-translate-y-0.5 hover:border-mute"
              }`}
            >
              <div className={`aspect-[16/10] overflow-hidden ${active ? "" : "opacity-80 group-hover:opacity-100"}`}>
                <LiveThumb
                  src={src}
                  code={l.code}
                  live={mode === "live"}
                  art={l.image?.replace("/looks/", "/looks/thumb/")}
                  delay={i * 22}
                />
              </div>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-2 pb-1.5 pt-6">
                <span className="block truncate font-display text-[11px] font-bold uppercase tracking-wider text-text sm:text-xs">
                  {l.name}
                </span>
              </div>
              <span
                className={`pointer-events-none absolute inset-x-0 bottom-0 h-[3px] transition-colors ${
                  active ? "bg-codm" : "bg-transparent group-hover:bg-codm/50"
                }`}
              />
              {active && (
                <span className="pointer-events-none absolute right-1 top-1 bg-codm px-1 py-px font-display text-[9px] font-extrabold uppercase tracking-wider text-black">
                  on
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
