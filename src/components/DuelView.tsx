"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyGrade, drawSample, type Settings } from "@/lib/codm";
import { createGradeGpu, type GradeGpu } from "@/lib/gpuGrade";

/*
 * One frame, two grades, one divider.
 *
 * Both sides are composited in a single WebGL pass (the original upload is
 * graded twice with a split), so dragging the divider is free. With no WebGL
 * the CPU path grades each side once and a 2D canvas stitches them, which costs
 * a frame per drag — still correct, just heavier.
 */

type Props = {
  src: HTMLCanvasElement | null;
  a: Settings;
  b: Settings;
  /** Divider position, 0 (B covers the frame) to 1 (A covers the frame). */
  split: number;
  onSplit: (v: number) => void;
  onSwap: () => void;
  className?: string;
  /** Called after every draw with the composed frame, for share cards. */
  onCapture?: (face: HTMLCanvasElement) => void;
};

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLCanvasElement, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

export default function DuelView({
  src,
  a,
  b,
  split,
  onSplit,
  onSwap,
  className = "",
  onCapture,
}: Props) {
  const [sample, setSample] = useState<HTMLCanvasElement | null>(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 960;
    c.height = 540;
    drawSample(c.getContext("2d")!, c.width, c.height);
    return c;
  });
  // The lit 3D scene is the honest default: real sky, sun and shadow.
  useEffect(() => {
    if (src) return;
    let live = true;
    import("@/lib/scene")
      .then((m) => m.renderScene(960, 540))
      .then((c) => {
        if (live && c) setSample(c);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [src]);

  const source = src ?? sample;
  const view = useRef<HTMLCanvasElement>(null);
  const gpu = useRef<GradeGpu | null>(null);
  // "gpu" = both sides in one shader, "cpu" = stitched in 2D, null = not tried yet
  const [mode, setMode] = useState<"gpu" | "cpu" | null>(null);
  const drag = useRef<{ x: number; y: number; on: boolean } | null>(null);
  // a stable offscreen canvas the duel card can read back at any moment

  // One context for the life of the view: the source changes (flat sample, then
  // the lit 3D scene) are texture uploads, not new contexts.
  useEffect(() => {
    const c = view.current;
    if (!c) return;
    const g = createGradeGpu(c);
    gpu.current = g;
    setMode(g ? "gpu" : "cpu");
    return () => {
      g?.dispose();
      gpu.current = null;
    };
  }, []);

  // GPU: one texture, graded twice, divider drawn in-shader. The upload is kept
  // apart from the render so dragging the divider never re-uploads the frame.
  useEffect(() => {
    if (mode !== "gpu" || !source) return;
    const g = gpu.current;
    if (!g) return;
    g.setSource(source);
    // a driver without the duel program hands over to the CPU path for good
    if (!g.renderDuel(a, b, split)) setMode("cpu");
    else if (onCapture && view.current) onCapture(view.current);
  }, [mode, source, a, b, split, onCapture]);

  // CPU fallback: grade each side, then cover-crop both into the visible frame.
  const cpu = useMemo(() => {
    if (mode !== "cpu" || !source) return null;
    const w = Math.min(960, source.width);
    const h = Math.round((w / source.width) * source.height);
    const plate = (s: Settings) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      drawCover(ctx, source, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      applyGrade(data.data, s);
      ctx.putImageData(data, 0, 0);
      return c;
    };
    return { w, h, a: plate(a), b: plate(b) };
  }, [mode, source, a, b]);

  useEffect(() => {
    const c = view.current;
    if (!cpu || !c) return;
    c.width = cpu.w;
    c.height = cpu.h;
    const ctx = c.getContext("2d")!;
    const x = Math.round(cpu.w * split);
    ctx.drawImage(cpu.b, 0, 0);
    ctx.drawImage(cpu.a, 0, 0, x, cpu.h, 0, 0, x, cpu.h);
    ctx.fillStyle = "#ffea3b";
    ctx.fillRect(Math.max(0, x - 1), 0, 2, cpu.h);
    onCapture?.(c);
  }, [cpu, split, onCapture]);

  // Pointer handling: drag anywhere on the frame, but let vertical scrolls pass.
  const move = useCallback(
    (clientX: number, el: HTMLElement) => {
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      onSplit(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
    },
    [onSplit],
  );

  return (
    <div
      className={`group relative touch-pan-y select-none overflow-hidden bg-black ${className}`}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY, on: false };
        if (e.pointerType === "mouse") {
          drag.current.on = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e.clientX, e.currentTarget);
        }
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        if (!d.on) {
          const dx = Math.abs(e.clientX - d.x);
          const dy = Math.abs(e.clientY - d.y);
          if (dx < 10 || dx < dy) return;
          d.on = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        move(e.clientX, e.currentTarget);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.25 : 0.05;
        if (e.key === "ArrowLeft") onSplit(Math.max(0, split - step));
        else if (e.key === "ArrowRight") onSplit(Math.min(1, split + step));
        else if (e.key === "Home") onSplit(0);
        else if (e.key === "End") onSplit(1);
        else if (e.key === "s" || e.key === "S") onSwap();
        else return;
        e.preventDefault();
      }}
      tabIndex={0}
      role="slider"
      aria-label="Duel divider"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(split * 100)}
      aria-valuetext={`${Math.round(split * 100)} percent of the frame shows the left look`}
      onDoubleClick={() => onSplit(0.5)}
    >
      <canvas
        ref={view}
        className="block aspect-video h-auto max-h-[62svh] w-full object-contain"
      />
      <div className="pointer-events-none absolute inset-0 scanlines opacity-40" />
      {/* the divider grip */}
      <div
        className="pointer-events-none absolute inset-y-0 z-10 w-px bg-codm opacity-90"
        style={{ left: `${split * 100}%` }}
      >
        <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center border border-codm bg-ink/85 text-codm">
          <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M9 6 4 12l5 6M15 6l5 6-5 6" />
          </svg>
        </span>
      </div>
    </div>
  );
}
