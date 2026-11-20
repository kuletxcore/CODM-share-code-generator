"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Settings } from "@/lib/codm";

// Luminance histogram of the preview canvas with the two in-game Range handles on top,
// so you can see which tones each zone will touch.

const BINS = 56;
const SAMPLE_W = 160;
const SAMPLE_H = 90;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export default function TonalScope({
  viewRef,
  settings,
  onRange,
  onShare,
}: {
  viewRef: React.RefObject<HTMLCanvasElement | null>;
  settings: Settings;
  onRange: (patch: { shadowPos?: number; highlightPos?: number }) => void;
  onShare?: (share: [number, number, number]) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const strip = useRef<HTMLDivElement>(null);
  const ghost = useRef<HTMLCanvasElement | null>(null);
  const drag = useRef<"s" | "h" | null>(null);

  const paint = useCallback(() => {
    const c = canvas.current;
    if (!c) return;
    const W = c.clientWidth;
    const H = c.clientHeight;
    if (!W || !H) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.round(W * dpr);
    const ch = Math.round(H * dpr);
    if (c.width !== cw || c.height !== ch) {
      c.width = cw;
      c.height = ch;
    }
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const X = (t: number) => t * W;

    // where each zone starts and fades out, in luminance
    const s0 = clamp01(settings.shadowPos / 1000);
    const s1 = Math.min(1, Math.max(s0, settings.shadowEdge / 1000));
    const h1 = clamp01(settings.highlightPos / 1000);
    const h0 = clamp01(Math.min(h1, h1 - Math.max(0.02, (settings.highlightEdge - settings.highlightPos) / 1000)));

    ctx.fillStyle = "rgba(126,176,255,0.15)";
    ctx.fillRect(0, 0, X(s0), H);
    const sg = ctx.createLinearGradient(X(s0), 0, X(s1), 0);
    sg.addColorStop(0, "rgba(126,176,255,0.15)");
    sg.addColorStop(1, "rgba(126,176,255,0)");
    ctx.fillStyle = sg;
    ctx.fillRect(X(s0), 0, Math.max(1, X(s1) - X(s0)), H);

    ctx.fillStyle = "rgba(255,196,107,0.15)";
    ctx.fillRect(X(h1), 0, Math.max(0, W - X(h1)), H);
    const hg = ctx.createLinearGradient(X(h0), 0, X(h1), 0);
    hg.addColorStop(0, "rgba(255,196,107,0)");
    hg.addColorStop(1, "rgba(255,196,107,0.15)");
    ctx.fillStyle = hg;
    ctx.fillRect(X(h0), 0, Math.max(1, X(h1) - X(h0)), H);

    ctx.fillStyle = "rgba(255,255,255,0.07)";
    for (let i = 1; i < 4; i++) ctx.fillRect(X(i / 4), 0, 1, H);

    // histogram of what's actually on the preview canvas
    const src = viewRef.current;
    if (!src || !src.width || !src.height) {
      ctx.fillStyle = "rgba(255,234,59,0.35)";
      ctx.fillRect(0, H - 1, W, 1);
      return;
    }
    const o = ghost.current ?? (ghost.current = document.createElement("canvas"));
    if (o.width !== SAMPLE_W) o.width = SAMPLE_W;
    if (o.height !== SAMPLE_H) o.height = SAMPLE_H;
    const octx = o.getContext("2d", { willReadFrequently: true });
    if (!octx) return;
    octx.drawImage(src, 0, 0, SAMPLE_W, SAMPLE_H);
    const px = octx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;

    const bins = new Float32Array(BINS);
    let n = 0;
    let mean = 0;
    for (let i = 0; i < px.length; i += 4) {
      const l = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      const b = Math.max(0, Math.min(BINS - 1, Math.floor(l * BINS)));
      bins[b] += 1;
      mean += l;
      n += 1;
    }
    if (!n) return;
    mean /= n;

    const smooth = new Float32Array(BINS);
    for (let i = 0; i < BINS; i++) {
      smooth[i] = (bins[i - 1] ?? 0) * 0.28 + bins[i] + (bins[i + 1] ?? 0) * 0.28;
    }
    let max = 1;
    for (let i = 0; i < BINS; i++) max = Math.max(max, smooth[i]);

    const yAt = (i: number) => H - Math.pow(smooth[i] / max, 0.78) * (H - 3);
    const xAt = (i: number) => ((i + 0.5) / BINS) * W;

    const area = ctx.createLinearGradient(0, H, 0, 0);
    area.addColorStop(0, "rgba(255,234,59,0.42)");
    area.addColorStop(0.55, "rgba(255,234,59,0.16)");
    area.addColorStop(1, "rgba(255,234,59,0.03)");
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let i = 0; i < BINS; i++) ctx.lineTo(xAt(i), yAt(i));
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = area;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < BINS; i++) {
      if (i === 0) ctx.moveTo(xAt(i), yAt(i));
      else ctx.lineTo(xAt(i), yAt(i));
    }
    ctx.strokeStyle = "rgba(255,240,140,0.85)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // average exposure marker
    const mx = X(mean);
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(mx, 0);
    ctx.lineTo(mx, H);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(mx - 2, 0, 4, 4);

    // share of the frame per zone, using the grade's own falloff
    if (onShare) {
      const soft = (a: number, b: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1e-6)));
        return t * t * (3 - 2 * t);
      };
      let ws = 0;
      let wm = 0;
      let wh = 0;
      for (let i = 0; i < BINS; i++) {
        const l = (i + 0.5) / BINS;
        const a = 1 - soft(s0, s1, l);
        const c2 = soft(h0, h1, l) * (1 - a);
        ws += bins[i] * a;
        wh += bins[i] * c2;
        wm += bins[i] * Math.max(0, 1 - a - c2);
      }
      onShare([
        Math.round((ws / n) * 100),
        Math.round((wm / n) * 100),
        Math.round((wh / n) * 100),
      ]);
    }
  }, [settings, viewRef, onShare]);

  // repaint on the next frame, after the preview has drawn this settings change
  useEffect(() => {
    const id = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(id);
  }, [paint]);

  // the 3D scene and uploads arrive after first paint, so re-read the canvas now and then
  useEffect(() => {
    let timer = 0;
    let cancelled = false;
    const poll = () => {
      if (cancelled) return;
      if (!document.hidden) paint();
      const later = (fn: () => void) =>
        typeof requestIdleCallback === "function"
          ? requestIdleCallback(fn, { timeout: 1400 })
          : (timer = window.setTimeout(fn, 1100));
      later(poll);
    };
    const start = (fn: () => void) =>
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(fn, { timeout: 1400 })
        : (timer = window.setTimeout(fn, 1100));
    start(poll);
    return () => {
      cancelled = true;
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(timer);
      else window.clearTimeout(timer);
    };
  }, [paint]);

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => paint());
    ro.observe(el);
    return () => ro.disconnect();
  }, [paint]);

  const move = (clientX: number) => {
    const el = strip.current;
    if (!el || !drag.current) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const p = Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100));
    const v = Math.round(p * 10);
    if (drag.current === "s") onRange({ shadowPos: Math.min(v, settings.highlightPos) });
    else onRange({ highlightPos: Math.max(v, settings.shadowPos) });
  };

  const start = (which: "s" | "h") => (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    drag.current = which;
    e.currentTarget.setPointerCapture(e.pointerId);
    move(e.clientX);
  };

  const handle = (which: "s" | "h") => {
    const shadow = which === "s";
    const raw = shadow ? settings.shadowPos : settings.highlightPos;
    const colour = shadow ? "#8fc2ff" : "#ffc46b";
    const step = (delta: number) =>
      shadow
        ? onRange({ shadowPos: Math.min(settings.highlightPos, Math.max(0, raw + delta)) })
        : onRange({ highlightPos: Math.max(settings.shadowPos, Math.min(1000, raw + delta)) });
    return (
      <div
        tabIndex={0}
        role="slider"
        aria-label={shadow ? "Shadows end" : "Highlights start"}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(raw / 10)}
        aria-valuetext={`${Math.round(raw / 10)} percent`}
        onPointerDown={start(which)}
        onPointerMove={(e) => move(e.clientX)}
        onPointerUp={(e) => {
          drag.current = null;
          if (e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onKeyDown={(e) => {
          const big = e.shiftKey ? 50 : 10;
          if (e.key === "ArrowLeft") step(-big);
          else if (e.key === "ArrowRight") step(big);
          else if (e.key === "Home") step(-raw);
          else if (e.key === "End") step(1000 - raw);
          else return;
          e.preventDefault();
        }}
        className="group absolute inset-y-0 z-10 w-11 -translate-x-1/2 cursor-ew-resize touch-none"
        style={{ left: `${raw / 10}%` }}
        title={shadow ? "Where shadows end" : "Where highlights begin"}
      >
        <span
          className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2"
          style={{ background: colour }}
        />
        <span
          className="absolute -top-px left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 border border-black/70 transition-transform group-hover:scale-110"
          style={{ background: colour }}
        />
        <span className="absolute left-1/2 top-1/2 h-7 w-3 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-black/50 bg-black/60">
          <span className="absolute inset-y-1.5 left-1/2 w-px -translate-x-1/2 bg-white/60" />
        </span>
        <span className="sr-only">{shadow ? "Shadows" : "Highlights"} range handle</span>
      </div>
    );
  };

  return (
    <section aria-label="Tonal range" className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-mute">
          Tonal range
        </h3>
        <p className="font-mono text-[10px] tabular-nums text-mute">
          <span className="text-[#8fc2ff]">◀ {Math.round(settings.shadowPos / 10)}%</span>
          <span className="mx-2 text-line">|</span>
          <span className="text-[#ffc46b]">{Math.round(settings.highlightPos / 10)}% ▶</span>
        </p>
      </div>
      <div ref={strip} className="relative">
        <div className="relative h-16 overflow-hidden border border-line bg-black/55 sm:h-20">
          <canvas ref={canvas} className="absolute inset-0 h-full w-full" aria-hidden />
          <div className="pointer-events-none absolute inset-0 scanlines opacity-50" />
          <span className="pointer-events-none absolute bottom-1 left-2 font-mono text-[10px] text-mute">
            0
          </span>
          <span className="pointer-events-none absolute bottom-1 right-2 font-mono text-[10px] text-mute">
            255
          </span>
        </div>
        {handle("s")}
        {handle("h")}
      </div>
    </section>
  );
}
