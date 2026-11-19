"use client";

import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { drawSample, type Settings } from "@/lib/codm";
import { SAMPLE, drawChips } from "@/lib/frame";
import { createGrader, type Grader, type GradeSource } from "@/lib/grader";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const still = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * The one preview on the page: a game frame with the current filter applied
 * right of a draggable divider and the untouched original left of it. Every
 * look, slider and pasted code is shown here, so what is on screen is always
 * what the code does.
 */
export default function LiveFrame({
  settings,
  name,
  source,
  chips,
  fadeKey,
  onDropFile,
}: {
  settings: Settings;
  /** Label for the filtered side. */
  name: string;
  /** The visitor's screenshot; null shows the sample frame. */
  source: HTMLCanvasElement | null;
  chips: boolean;
  /** Changes when a whole new filter is loaded, so the frame cross-fades instead of snapping. */
  fadeKey: number;
  onDropFile: (f: File) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const sample = useRef<HTMLImageElement>(null);
  const view = useRef<HTMLCanvasElement>(null);
  const ghost = useRef<HTMLCanvasElement>(null);
  const handle = useRef<HTMLDivElement>(null);
  const grader = useRef<Grader | null>(null);
  const latest = useRef(settings);
  const pending = useRef(0);
  const sweep = useRef<{ stop: () => void } | null>(null);
  const intro = useRef(false);
  const [over, setOver] = useState(false);

  // The divider moves every frame of a drag, so it lives outside React state.
  const split = useMotionValue(0.5);
  const left = useTransform(split, (v) => `${v * 100}%`);
  const beforeOpacity = useTransform(split, [0.04, 0.13], [0, 1]);
  const afterOpacity = useTransform(split, [0.87, 0.96], [1, 0]);

  const draw = useCallback(() => {
    if (pending.current) return;
    pending.current = requestAnimationFrame(() => {
      pending.current = 0;
      grader.current?.render(latest.current, split.get());
    });
  }, [split]);

  useEffect(() => {
    const c = view.current;
    if (!c) return;
    const g = createGrader(c);
    grader.current = g;
    return () => {
      cancelAnimationFrame(pending.current);
      pending.current = 0;
      g.dispose();
      grader.current = null;
    };
  }, []);

  // Hand the frame to the grader: the visitor's screenshot, else the sample image once it has loaded.
  useEffect(() => {
    const el = box.current;
    const img = sample.current;
    if (!el) return;
    let live = true;
    const show = (base: GradeSource, w: number, h: number) => {
      if (!live || !w || !h) return;
      let src = base;
      // An image goes through a canvas of the file's own size, so every pixel of it reaches the grader.
      if (chips || base instanceof HTMLImageElement) {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (ctx) {
          ctx.drawImage(base, 0, 0, w, h);
          if (chips) drawChips(ctx, w, h);
          src = c;
        }
      }
      grader.current?.setSource(src, w, h);
      draw();
      el.dataset.live = ""; // a graded frame is on its way: show the divider and labels
      if (intro.current) return;
      intro.current = true;
      if (still()) return;
      // wipe the filter in once, so the divider reads as something to drag
      split.set(0.96);
      sweep.current = animate(split, 0.5, { duration: 1.25, delay: 0.3, ease: [0.22, 1, 0.36, 1] });
    };

    if (source) {
      show(source, source.width, source.height);
      return () => {
        live = false;
      };
    }
    if (!img) return;
    const loaded = () => {
      const file = SAMPLE.sizeOf(img.currentSrc);
      show(img, file.width, file.height);
    };
    const failed = () => {
      // the image is missing: keep the tool usable with the drawn stand-in
      const c = document.createElement("canvas");
      c.width = 960;
      c.height = 540;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      drawSample(ctx, c.width, c.height);
      show(c, c.width, c.height);
    };
    // The image is in the static HTML, so it may have finished before this ran.
    if (img.complete) (img.naturalWidth ? loaded : failed)();
    img.addEventListener("load", loaded); // also fires when srcset swaps in a larger file
    img.addEventListener("error", failed);
    return () => {
      live = false;
      img.removeEventListener("load", loaded);
      img.removeEventListener("error", failed);
    };
  }, [source, chips, draw, split]);

  // A whole new filter: keep a copy of the outgoing frame on top and fade it away.
  const faded = useRef(fadeKey);
  useEffect(() => {
    if (faded.current === fadeKey) return;
    faded.current = fadeKey;
    const from = view.current,
      to = ghost.current;
    if (!from || !to || from.width < 2 || still()) return;
    to.width = from.width;
    to.height = from.height;
    const ctx = to.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(from, 0, 0);
    to.style.transition = "none";
    to.style.opacity = "1";
    void to.offsetWidth; // commit the opaque copy before fading it
    to.style.transition = "";
    to.style.opacity = "0";
  }, [fadeKey]);

  useEffect(() => {
    latest.current = settings;
    draw();
  }, [settings, draw]);

  useMotionValueEvent(split, "change", (v) => {
    draw();
    handle.current?.setAttribute("aria-valuenow", String(Math.round(v * 100)));
  });

  /* ---------- dragging ---------- */

  const drag = useRef<{ id: number; x: number; y: number; on: boolean } | null>(null);
  const at = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    return r?.width ? clamp01((clientX - r.left) / r.width) : split.get();
  };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    sweep.current?.stop();
    // A mouse press moves the divider at once. A finger may be starting a page
    // scroll, so it only takes hold once it has clearly moved sideways.
    const on = e.pointerType === "mouse";
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, on };
    if (on) {
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset.drag = "";
      split.set(at(e.clientX));
    }
  };
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.on) {
      const dx = Math.abs(e.clientX - d.x),
        dy = Math.abs(e.clientY - d.y);
      if (dx < 6 || dx < dy) return;
      d.on = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.currentTarget.dataset.drag = "";
    }
    split.set(at(e.clientX));
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    delete e.currentTarget.dataset.drag;
    // a tap sends the divider to the finger
    if (!d.on && e.type === "pointerup") sweep.current = animate(split, at(e.clientX), { duration: 0.2, ease: "easeOut" });
  };

  const key = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.05;
    const v = split.get();
    const next =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? v - step
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? v + step
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? 1
              : null;
    if (next === null) return;
    e.preventDefault();
    sweep.current?.stop();
    split.set(clamp01(next));
  };

  const ratio = source ? Math.min(3, Math.max(0.4, source.width / source.height)) : SAMPLE.width / SAMPLE.height;

  return (
    <div
      ref={box}
      role="group"
      aria-label={`Preview. Left of the divider: the original frame. Right of it: ${name}.`}
      className={`tryon group relative mx-auto w-full touch-pan-y select-none overflow-hidden bg-black lg:cut lg:border lg:border-line ${
        over ? "ring-2 ring-inset ring-codm" : ""
      }`}
      style={{ aspectRatio: ratio, maxWidth: `calc(var(--frame-h) * ${ratio})` }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onDropFile(f);
      }}
    >
      {/* In the HTML from the first byte, so the frame paints before any script runs. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={sample}
        src={SAMPLE.src}
        srcSet={SAMPLE.srcSet}
        sizes="(min-width: 1024px) 64vw, 100vw"
        width={SAMPLE.width}
        height={SAMPLE.height}
        alt="Sample game frame: a dirt road through a small town, seen over a rifle"
        fetchPriority="high"
        draggable={false}
        className={`absolute inset-0 h-full w-full object-cover ${source ? "hidden" : ""}`}
      />
      <canvas ref={view} aria-hidden className="absolute inset-0 h-full w-full object-contain" />
      <canvas ref={ghost} aria-hidden className="tryon-ghost pointer-events-none absolute inset-0 h-full w-full object-contain opacity-0" />

      <motion.span
        style={{ opacity: beforeOpacity }}
        className="tryon-ui pointer-events-none absolute left-2 top-2 bg-black/70 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-widest text-text/85 sm:left-4 sm:top-4 sm:text-xs"
      >
        Original
      </motion.span>
      <motion.span
        style={{ opacity: afterOpacity }}
        className="tryon-ui pointer-events-none absolute right-2 top-2 max-w-[46%] truncate bg-codm px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-widest text-black sm:right-4 sm:top-4 sm:text-xs"
      >
        {name}
      </motion.span>

      <motion.div style={{ left }} className="tryon-ui pointer-events-none absolute inset-y-0 w-0">
        <span className="absolute inset-y-0 -left-px w-0.5 bg-codm shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" />
        <div
          ref={handle}
          role="slider"
          tabIndex={0}
          aria-label="Compare: share of the frame showing the original"
          aria-orientation="horizontal"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={50}
          onKeyDown={key}
          className="pointer-events-auto absolute top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize place-items-center"
        >
          <span className="grid h-8 w-8 rotate-45 place-items-center bg-codm shadow-[0_2px_12px_rgba(0,0,0,0.55)] transition-transform group-data-[drag]:scale-110">
            <svg viewBox="0 0 20 20" className="h-5 w-5 -rotate-45 text-black" fill="currentColor" aria-hidden>
              <path d="M7.5 5.5 3 10l4.5 4.5zM12.5 5.5 17 10l-4.5 4.5z" />
            </svg>
          </span>
        </div>
      </motion.div>

      {over && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/55 font-display text-xl font-extrabold uppercase tracking-wider text-codm">
          Drop your screenshot
        </div>
      )}
    </div>
  );
}
