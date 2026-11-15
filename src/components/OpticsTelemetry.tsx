"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { applyGrade, type Settings } from "@/lib/codm";

const SAMPLE_W = 128;
const SAMPLE_H = 72;
const BINS = 64;

type Telemetry = {
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  l: Float32Array;
  crushPct: number;
  clipPct: number;
  contrast: number;
  avgSat: number;
  status: "optimal" | "crush" | "clip" | "both";
};

function sampleBasePixels(canvas: HTMLCanvasElement | null): Uint8ClampedArray | null {
  if (!canvas || typeof document === "undefined") return null;
  const tmp = document.createElement("canvas");
  tmp.width = SAMPLE_W;
  tmp.height = SAMPLE_H;
  const ctx = tmp.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(canvas, 0, 0, SAMPLE_W, SAMPLE_H);
  return ctx.getImageData(0, 0, SAMPLE_W, SAMPLE_H).data;
}

function measureTelemetry(base: Uint8ClampedArray, settings: Settings): Telemetry {
  const data = new Uint8ClampedArray(base);
  applyGrade(data, settings);

  const rBins = new Float32Array(BINS);
  const gBins = new Float32Array(BINS);
  const bBins = new Float32Array(BINS);
  const lBins = new Float32Array(BINS);

  const n = data.length / 4;
  let crushed = 0;
  let clipped = 0;
  let sumL = 0;
  let sumL2 = 0;
  let sumSat = 0;

  for (let i = 0; i < data.length; i += 4) {
    const rr = data[i] / 255;
    const gg = data[i + 1] / 255;
    const bb = data[i + 2] / 255;
    const ll = 0.2126 * rr + 0.7152 * gg + 0.0722 * bb;

    rBins[Math.min(BINS - 1, Math.floor(rr * BINS))]++;
    gBins[Math.min(BINS - 1, Math.floor(gg * BINS))]++;
    bBins[Math.min(BINS - 1, Math.floor(bb * BINS))]++;
    lBins[Math.min(BINS - 1, Math.floor(ll * BINS))]++;

    if (ll < 0.065) crushed++;
    if (ll > 0.935) clipped++;
    sumL += ll;
    sumL2 += ll * ll;

    const mx = Math.max(rr, gg, bb);
    const mn = Math.min(rr, gg, bb);
    if (mx > 0.02) sumSat += (mx - mn) / mx;
  }

  let peak = 1;
  for (let i = 0; i < BINS; i++) {
    peak = Math.max(peak, rBins[i], gBins[i], bBins[i], lBins[i]);
  }
  for (let i = 0; i < BINS; i++) {
    rBins[i] = Math.pow(rBins[i] / peak, 0.72);
    gBins[i] = Math.pow(gBins[i] / peak, 0.72);
    bBins[i] = Math.pow(bBins[i] / peak, 0.72);
    lBins[i] = Math.pow(lBins[i] / peak, 0.72);
  }

  const mean = sumL / n;
  const std = Math.sqrt(Math.max(0, sumL2 / n - mean * mean));
  const crushPct = (crushed / n) * 100;
  const clipPct = (clipped / n) * 100;
  const highCrush = crushPct > 18;
  const highClip = clipPct > 15;

  return {
    r: rBins,
    g: gBins,
    b: bBins,
    l: lBins,
    crushPct,
    clipPct,
    contrast: Math.min(100, Math.round(std * 310)),
    avgSat: Math.round((sumSat / n) * 100),
    status: highCrush && highClip ? "both" : highCrush ? "crush" : highClip ? "clip" : "optimal",
  };
}

export default function OpticsTelemetry({
  activeCanvas,
  settings,
  onAutoFixVisibility,
}: {
  activeCanvas: HTMLCanvasElement | null;
  settings: Settings;
  onAutoFixVisibility: (status: "crush" | "clip" | "both") => void;
}) {
  const scopeRef = useRef<HTMLCanvasElement>(null);
  const [expanded, setExpanded] = useState(true);

  const basePixels = useMemo(() => sampleBasePixels(activeCanvas), [activeCanvas]);
  const stats = useMemo(
    () => (basePixels ? measureTelemetry(basePixels, settings) : null),
    [basePixels, settings],
  );

  useEffect(() => {
    const c = scopeRef.current;
    if (!c || !stats || !expanded) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const w = c.width;
    const h = c.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle tactical grid
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (const frac of [0.25, 0.5, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(w * frac, 0);
      ctx.lineTo(w * frac, h);
      ctx.stroke();
    }

    const drawChannel = (bins: Float32Array, fill: string, stroke: string) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let i = 0; i < BINS; i++) {
        const x = (i / (BINS - 1)) * w;
        const y = h - bins[i] * (h - 4);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    };

    ctx.globalCompositeOperation = "screen";
    drawChannel(stats.r, "rgba(239, 68, 68, 0.24)", "rgba(239, 68, 68, 0.75)");
    drawChannel(stats.g, "rgba(166, 226, 46, 0.22)", "rgba(166, 226, 46, 0.75)");
    drawChannel(stats.b, "rgba(56, 189, 248, 0.24)", "rgba(56, 189, 248, 0.8)");
    ctx.globalCompositeOperation = "source-over";
    drawChannel(stats.l, "rgba(255, 255, 255, 0.08)", "rgba(255, 234, 59, 0.7)");
  }, [stats, expanded]);

  if (!stats) return null;

  const badge =
    stats.status === "optimal"
      ? { label: "Visibility Optimal", cls: "border-lime/50 bg-lime/15 text-lime" }
      : stats.status === "crush"
        ? { label: "Dark Shadows Crushed", cls: "border-amber-400/60 bg-amber-400/15 text-amber-300" }
        : stats.status === "clip"
          ? { label: "Highlights Clipping", cls: "border-amber-400/60 bg-amber-400/15 text-amber-300" }
          : { label: "Shadows & Sky Clipped", cls: "border-red-400/60 bg-red-500/15 text-red-300" };

  return (
    <div className="border border-line bg-panel/70 px-3 py-2.5 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1.5 font-display text-xs font-bold uppercase tracking-[0.2em] text-mute hover:text-text"
          >
            <span className="text-[10px]">{expanded ? "▾" : "▸"}</span>
            Optics Scope
          </button>
          <span
            className={`border px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-wider ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {stats.status !== "optimal" && (
            <button
              type="button"
              onClick={() => onAutoFixVisibility(stats.status as "crush" | "clip" | "both")}
              className="cut-sm bg-codm px-2.5 py-1 font-display text-[11px] font-extrabold uppercase tracking-wider text-black hover:bg-codm-light"
            >
              Auto-Fix Visibility
            </button>
          )}
          <div className="flex items-center gap-3 font-mono text-[11px] tabular-nums text-mute">
            <span>
              Crush{" "}
              <strong className={stats.crushPct > 18 ? "text-amber-300" : "text-text"}>
                {stats.crushPct.toFixed(0)}%
              </strong>
            </span>
            <span>
              Clip{" "}
              <strong className={stats.clipPct > 15 ? "text-amber-300" : "text-text"}>
                {stats.clipPct.toFixed(0)}%
              </strong>
            </span>
            <span className="hidden sm:inline">
              Contrast <strong className="text-text">{stats.contrast}</strong>
            </span>
            <span className="hidden sm:inline">
              Chroma <strong className="text-text">{stats.avgSat}%</strong>
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-2 grid items-center gap-3 sm:grid-cols-[1fr_auto]">
          <canvas
            ref={scopeRef}
            width={360}
            height={54}
            aria-label="Live post-grade RGB and luminance histogram"
            className="h-14 w-full border border-line/70 bg-[#070807]"
          />
          <div className="flex gap-3 font-mono text-[10px] uppercase text-mute sm:flex-col sm:gap-1">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 bg-codm/80" /> Luma
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 bg-red-500/80" /> Red
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 bg-lime/80" /> Green
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 bg-sky-400/80" /> Blue
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
