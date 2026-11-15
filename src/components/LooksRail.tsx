"use client";

import { useEffect, useRef } from "react";
import { LOOKS, applyGrade, decode, drawSample, type Look } from "@/lib/codm";

/*
 * The look shelf. Every tile grades the monitor in place — no gallery screen to
 * leave, no page jump: pick a look and the image in front of you changes.
 */

const W = 960,
  H = 600;
let base: Promise<ImageData> | null = null;
const graded = new Map<string, Promise<ImageData>>();

function baseImage(): Promise<ImageData> {
  base ??= import("@/lib/scene")
    .then((m) => m.renderScene(W, H, { chips: false }))
    .catch(() => null)
    .then((c) => {
      if (c) return c.getContext("2d")!.getImageData(0, 0, W, H);
      const f = document.createElement("canvas");
      f.width = W;
      f.height = H;
      const ctx = f.getContext("2d")!;
      drawSample(ctx, W, H);
      return ctx.getImageData(0, 0, W, H);
    });
  return base;
}

function gradedImage(code: string): Promise<ImageData> | null {
  const s = decode(code);
  if (!s) return null;
  let p = graded.get(code);
  if (!p) {
    p = baseImage().then((img) => {
      const data = new Uint8ClampedArray(img.data);
      applyGrade(data, s);
      return new ImageData(data, W, H);
    });
    graded.set(code, p);
  }
  return p;
}

function RenderedThumb({ code }: { code: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    gradedImage(code)?.then((img) => {
      if (live) ref.current?.getContext("2d")?.putImageData(img, 0, 0);
    });
    return () => {
      live = false;
    };
  }, [code]);
  return <canvas ref={ref} width={W} height={H} className="h-full w-full bg-panel-2 object-cover" />;
}

export default function LooksRail({
  activeCode,
  onPick,
  className = "",
}: {
  activeCode: string;
  onPick: (look: Look) => void;
  className?: string;
}) {
  const strip = useRef<HTMLDivElement>(null);

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
            Tap a look to grade the monitor in front of you. Then tune it.
          </p>
        </div>
        <button
          onClick={shuffle}
          className="cut-sm bg-panel-2 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-text hover:bg-line"
        >
          ⤨ Shuffle
        </button>
      </div>

      <div
        ref={strip}
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
        {LOOKS.map((l) => {
          const active = l.code === activeCode;
          return (
            <button
              key={l.name}
              data-look
              onClick={() => onPick(l)}
              aria-pressed={active}
              title={l.note}
              className={`group relative w-32 shrink-0 snap-start overflow-hidden border text-left transition-[border-color,transform] focus-visible:outline-offset-[-2px] sm:w-40 ${
                active
                  ? "border-codm"
                  : "border-line hover:-translate-y-0.5 hover:border-mute"
              }`}
            >
              <div className="aspect-[16/10] overflow-hidden">
                {l.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.image.replace("/looks/", "/looks/thumb/")}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06] ${
                      active ? "" : "opacity-80 group-hover:opacity-100"
                    }`}
                  />
                ) : (
                  <RenderedThumb code={l.code} />
                )}
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-2 pb-1.5 pt-6">
                <span className="block truncate font-display text-[11px] font-bold uppercase tracking-wider text-text sm:text-xs">
                  {l.name}
                </span>
              </div>
              <span
                className={`absolute inset-x-0 bottom-0 h-[3px] transition-colors ${
                  active ? "bg-codm" : "bg-transparent group-hover:bg-codm/50"
                }`}
              />
              {active && (
                <span className="absolute right-1 top-1 bg-codm px-1 py-px font-display text-[9px] font-extrabold uppercase tracking-wider text-black">
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
