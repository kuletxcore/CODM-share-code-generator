"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { gradeUniforms, type Settings } from "@/lib/codm";

const BINS = 64;

function computeLumaHistogram(canvas: HTMLCanvasElement | null): number[] {
  if (!canvas || typeof document === "undefined") {
    return Array.from({ length: BINS }, (_, i) => {
      const t = i / (BINS - 1);
      return Math.exp(-Math.pow((t - 0.45) / 0.28, 2)) * 0.8 + 0.12;
    });
  }
  const w = Math.min(180, canvas.width);
  const h = Math.max(1, Math.round((canvas.height / canvas.width) * w));
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const ctx = tmp.getContext("2d");
  if (!ctx) return Array(BINS).fill(0.2);
  ctx.drawImage(canvas, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const counts = new Float64Array(BINS);
  for (let i = 0; i < data.length; i += 4) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    const bin = Math.min(BINS - 1, Math.max(0, Math.floor(l * BINS)));
    counts[bin]++;
  }
  let peak = 1;
  for (let i = 0; i < BINS; i++) if (counts[i] > peak) peak = counts[i];
  return Array.from(counts, (c) => Math.pow(c / peak, 0.72));
}

export default function RangeScrubber({
  settings,
  activeCanvas,
  maskPinned,
  onToggleMask,
  onScrubMask,
  onChange,
  onReset,
}: {
  settings: Settings;
  activeCanvas: HTMLCanvasElement | null;
  maskPinned: boolean;
  onToggleMask: () => void;
  onScrubMask: (active: boolean) => void;
  onChange: (patch: Pick<Settings, "shadowPos" | "shadowEdge" | "highlightPos" | "highlightEdge">) => void;
  onReset: () => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<"shadow" | "highlight" | null>(null);

  const hist = useMemo(() => computeLumaHistogram(activeCanvas), [activeCanvas]);
  const [s0, s1, h0, h1] = gradeUniforms(settings).bands;

  const shPct = Math.round(settings.shadowPos / 10);
  const hiPct = Math.round(settings.highlightPos / 10);

  const updateHandle = useCallback(
    (which: "shadow" | "highlight", clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const raw = Math.round(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))) * 10;
      if (which === "shadow") {
        const pos = Math.min(raw, settings.highlightPos);
        onChange({
          shadowPos: pos,
          shadowEdge: pos + 100,
          highlightPos: settings.highlightPos,
          highlightEdge: settings.highlightEdge,
        });
      } else {
        const pos = Math.max(raw, settings.shadowPos);
        onChange({
          shadowPos: settings.shadowPos,
          shadowEdge: settings.shadowEdge,
          highlightPos: pos,
          highlightEdge: pos + 100,
        });
      }
    },
    [onChange, settings.shadowPos, settings.shadowEdge, settings.highlightPos, settings.highlightEdge],
  );

  // Compute SVG polyline paths for Shadows / Midtones / Highlights weights across luma [0..1]
  const curves = useMemo(() => {
    const smooth = (a: number, b: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1e-6)));
      return t * t * (3 - 2 * t);
    };
    const shPts: string[] = [];
    const hiPts: string[] = [];
    for (let i = 0; i <= 50; i++) {
      const l = i / 50;
      const ws = 1 - smooth(s0, s1, l);
      const wh = smooth(h0, h1, l) * (1 - ws);
      const x = l * 100;
      shPts.push(`${x.toFixed(1)},${(100 - ws * 92).toFixed(1)}`);
      hiPts.push(`${x.toFixed(1)},${(100 - wh * 92).toFixed(1)}`);
    }
    return { sh: shPts.join(" "), hi: hiPts.join(" ") };
  }, [s0, s1, h0, h1]);

  return (
    <div className="flex flex-col gap-3">
      {/* Live luminance histogram + interactive dual-handle bar */}
      <div className="border border-line bg-black/55 p-3">
        <div className="mb-2 flex items-center justify-between text-[11px] font-display font-bold uppercase tracking-widest">
          <span className="flex items-center gap-1.5 text-[#2dd4ff]">
            <span className="h-2 w-2 bg-[#2dd4ff]" />
            Shadows {shPct}%
          </span>
          <span className="text-mute">Midtones</span>
          <span className="flex items-center gap-1.5 text-codm">
            Highlights {hiPct}%
            <span className="h-2 w-2 bg-codm" />
          </span>
        </div>

        <div
          ref={trackRef}
          onPointerMove={(e) => {
            if (!dragging) return;
            updateHandle(dragging, e.clientX);
          }}
          onPointerUp={(e) => {
            if (!dragging) return;
            setDragging(null);
            onScrubMask(false);
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }
          }}
          onPointerCancel={() => {
            if (dragging) {
              setDragging(null);
              onScrubMask(false);
            }
          }}
          className="relative h-28 w-full select-none touch-none overflow-hidden border border-line/80 bg-[#070807]"
        >
          {/* Zone tinted background bands */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 bg-[#2dd4ff]/15"
            style={{ width: `${Math.min(100, s1 * 100)}%` }}
          />
          <div
            className="pointer-events-none absolute inset-y-0 right-0 bg-codm/15"
            style={{ width: `${Math.max(0, (1 - h0) * 100)}%` }}
          />

          {/* 64-bin luminance histogram bars */}
          <div className="pointer-events-none absolute inset-0 flex items-end gap-px px-0.5 pt-2">
            {hist.map((v, i) => {
              const l = i / (BINS - 1);
              const color =
                l <= s0
                  ? "rgba(45, 212, 255, 0.55)"
                  : l >= h1
                    ? "rgba(255, 234, 59, 0.6)"
                    : "rgba(233, 236, 230, 0.34)";
              return (
                <div
                  key={i}
                  className="flex-1"
                  style={{ height: `${Math.max(3, Math.round(v * 94))}%`, background: color }}
                />
              );
            })}
          </div>

          {/* Falloff response curves */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            <polyline
              fill="none"
              stroke="#2dd4ff"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
              points={curves.sh}
            />
            <polyline
              fill="none"
              stroke="#ffea3b"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
              points={curves.hi}
            />
          </svg>

          {/* Shadows handle */}
          <button
            type="button"
            role="slider"
            aria-label="Shadows range handle"
            aria-valuemin={0}
            aria-valuemax={hiPct}
            aria-valuenow={shPct}
            onPointerDown={(e) => {
              e.stopPropagation();
              trackRef.current?.setPointerCapture(e.pointerId);
              setDragging("shadow");
              onScrubMask(true);
              updateHandle("shadow", e.clientX);
            }}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 20 : e.key === "ArrowLeft" ? -20 : 0;
              if (!d) return;
              e.preventDefault();
              const pos = Math.min(settings.highlightPos, Math.max(0, settings.shadowPos + d));
              onChange({
                shadowPos: pos,
                shadowEdge: pos + 100,
                highlightPos: settings.highlightPos,
                highlightEdge: settings.highlightEdge,
              });
            }}
            style={{ left: `${shPct}%` }}
            className="group absolute inset-y-0 z-10 w-5 -translate-x-1/2 cursor-ew-resize focus-visible:outline-none"
          >
            <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-[#2dd4ff] shadow-[0_0_8px_#2dd4ff]" />
            <span className="absolute bottom-1 left-1/2 grid h-6 w-4 -translate-x-1/2 place-items-center border border-black bg-[#2dd4ff] text-[10px] font-black text-black group-focus-visible:ring-2 group-focus-visible:ring-white">
              S
            </span>
          </button>

          {/* Highlights handle */}
          <button
            type="button"
            role="slider"
            aria-label="Highlights range handle"
            aria-valuemin={shPct}
            aria-valuemax={100}
            aria-valuenow={hiPct}
            onPointerDown={(e) => {
              e.stopPropagation();
              trackRef.current?.setPointerCapture(e.pointerId);
              setDragging("highlight");
              onScrubMask(true);
              updateHandle("highlight", e.clientX);
            }}
            onKeyDown={(e) => {
              const d = e.key === "ArrowRight" ? 20 : e.key === "ArrowLeft" ? -20 : 0;
              if (!d) return;
              e.preventDefault();
              const pos = Math.max(settings.shadowPos, Math.min(1000, settings.highlightPos + d));
              onChange({
                shadowPos: settings.shadowPos,
                shadowEdge: settings.shadowEdge,
                highlightPos: pos,
                highlightEdge: pos + 100,
              });
            }}
            style={{ left: `${hiPct}%` }}
            className="group absolute inset-y-0 z-10 w-5 -translate-x-1/2 cursor-ew-resize focus-visible:outline-none"
          >
            <span className="absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-codm shadow-[0_0_8px_#ffea3b]" />
            <span className="absolute top-1 left-1/2 grid h-6 w-4 -translate-x-1/2 place-items-center border border-black bg-codm text-[10px] font-black text-black group-focus-visible:ring-2 group-focus-visible:ring-white">
              H
            </span>
          </button>
        </div>

        {/* Luminance scale ticks */}
        <div className="mt-1.5 flex justify-between font-mono text-[10px] text-mute">
          <span>0 · Black</span>
          <span>50 · Mid</span>
          <span>100 · White</span>
        </div>
      </div>

      {/* Zone mask toggle + reset */}
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-pressed={maskPinned}
          onClick={onToggleMask}
          className={`cut-sm flex items-center gap-2 px-3 py-2 font-display text-xs font-bold uppercase tracking-wider transition-colors ${
            maskPinned
              ? "bg-[#2dd4ff] text-black"
              : "border border-line bg-panel-2 text-text hover:border-[#2dd4ff]"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${maskPinned ? "bg-black" : "bg-[#2dd4ff]"}`}
          />
          {maskPinned ? "Zone Mask On" : "Show Zone Mask"}
        </button>

        <button
          type="button"
          onClick={onReset}
          className="font-display text-xs font-bold uppercase tracking-wider text-mute hover:text-text"
        >
          Reset Range
        </button>
      </div>

      <p className="text-xs text-mute">
        Drag <strong className="text-[#2dd4ff]">S</strong> or{" "}
        <strong className="text-codm">H</strong> on the histogram to see affected pixels light up
        live on the preview.
      </p>
    </div>
  );
}
