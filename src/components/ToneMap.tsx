"use client";

import { useMemo, useRef } from "react";
import { toneBands, type Settings, type ZoneKey } from "@/lib/codm";

/*
 * The game hides its shadow/highlight split behind a "Range" bar with two
 * handles. Here the same two handles sit on the image's own luminance
 * histogram, so you can see which tones each colour is about to touch while you
 * drag. Dragging writes shadowPos/highlightPos exactly like the in-game bar.
 */

type Props = {
  hist: Float32Array | null;
  settings: Settings;
  onRange: (patch: { shadowPos?: number; highlightPos?: number }) => void;
  hover: ZoneKey | null;
  onHover: (z: ZoneKey | null) => void;
};

const ZONE_TINT: Record<"shadows" | "midtones" | "highlights", string> = {
  shadows: "77,124,255",
  midtones: "180,190,178",
  highlights: "255,210,59",
};

export default function ToneMap({ hist, settings, onRange, hover, onHover }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const bands = toneBands(settings);
  const s0 = bands.s0 * 100;
  const s1 = Math.min(100, bands.s1 * 100);
  const h1 = bands.h1 * 100;
  const h0 = Math.max(0, bands.h0 * 100);

  const shape = useMemo(() => {
    if (!hist) return "";
    const n = hist.length;
    const step = 100 / n;
    let d = "M0,100 ";
    for (let i = 0; i < n; i++) {
      const y = 100 - Math.max(0.012, hist[i]) * 94;
      d += `L${(i * step).toFixed(2)},${y.toFixed(2)} L${((i + 1) * step).toFixed(2)},${y.toFixed(2)} `;
    }
    return `${d}L100,100 Z`;
  }, [hist]);

  const rawFromX = (clientX: number) => {
    const b = box.current?.getBoundingClientRect();
    if (!b) return 0;
    return Math.min(1000, Math.max(0, Math.round(((clientX - b.left) / b.width) * 1000)));
  };

  const drag = (which: "shadow" | "highlight") => ({
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      moveTo(which, e.clientX);
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) moveTo(which, e.clientX);
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 50 : 10;
      const now = which === "shadow" ? settings.shadowPos : settings.highlightPos;
      let next: number | null = null;
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = now - step;
      else if (e.key === "ArrowRight" || e.key === "ArrowUp") next = now + step;
      else if (e.key === "Home") next = 0;
      else if (e.key === "End") next = 1000;
      if (next === null) return;
      e.preventDefault();
      e.stopPropagation();
      apply(which, next);
    },
  });

  function apply(which: "shadow" | "highlight", raw: number) {
    if (which === "shadow") onRange({ shadowPos: Math.min(raw, settings.highlightPos) });
    else onRange({ highlightPos: Math.max(raw, settings.shadowPos) });
  }
  const moveTo = (which: "shadow" | "highlight", clientX: number) =>
    apply(which, rawFromX(clientX));

  const bandOpacity = (z: "shadows" | "midtones" | "highlights") =>
    hover === null ? 1 : hover === z ? 1 : 0.3;

  const handle = (which: "shadow" | "highlight", raw: number, label: string) => (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(raw / 10)}
      aria-valuetext={`${Math.round(raw / 10)}% of the range`}
      {...drag(which)}
      style={{ left: `${raw / 10}%` }}
      className="absolute -top-1.5 bottom-0 z-10 w-4 -translate-x-1/2 cursor-ew-resize touch-none outline-none"
    >
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/75 group-hover/tone:bg-white" />
      <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 rotate-45 border border-white/80 bg-[#0a0b0a] shadow-[0_0_0_1px_rgba(0,0,0,.6)] focus-visible:bg-codm" />
      <span className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 translate-y-1/2 rotate-45 bg-white/80" />
    </div>
  );

  return (
    <div className="select-none">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-mute">
          Tone map
        </span>
        <span className="font-mono text-[10px] tabular-nums text-mute">
          shadows 0–{Math.round(settings.shadowPos / 10)} · highlights{" "}
          {Math.round(settings.highlightPos / 10)}–100
        </span>
      </div>

      <div
        ref={box}
        onPointerMove={(e) => {
          if (!hist || e.buttons !== 0) return;
          const l = rawFromX(e.clientX) / 1000;
          onHover(l < bands.s1 ? "shadows" : l > bands.h0 ? "highlights" : "midtones");
        }}
        onPointerLeave={() => onHover(null)}
        className="group/tone relative h-14 w-full border border-line bg-black/60"
      >
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <defs>
            <linearGradient id="tm-shadow" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={`rgba(${ZONE_TINT.shadows},0.42)`} />
              <stop offset="100%" stopColor={`rgba(${ZONE_TINT.shadows},0)`} />
            </linearGradient>
            <linearGradient id="tm-high" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={`rgba(${ZONE_TINT.highlights},0)`} />
              <stop offset="100%" stopColor={`rgba(${ZONE_TINT.highlights},0.42)`} />
            </linearGradient>
          </defs>

          {/* solid cores of each zone */}
          <rect
            x={0}
            y={0}
            width={Math.max(0, s0)}
            height={100}
            fill={`rgba(${ZONE_TINT.shadows},0.3)`}
            opacity={bandOpacity("shadows")}
            style={{ transition: "opacity .2s" }}
          />
          <rect
            x={s1}
            y={0}
            width={Math.max(0, h0 - s1)}
            height={100}
            fill={`rgba(${ZONE_TINT.midtones},0.1)`}
            opacity={bandOpacity("midtones")}
            style={{ transition: "opacity .2s" }}
          />
          <rect
            x={h1}
            y={0}
            width={Math.max(0, 100 - h1)}
            height={100}
            fill={`rgba(${ZONE_TINT.highlights},0.3)`}
            opacity={bandOpacity("highlights")}
            style={{ transition: "opacity .2s" }}
          />
          {/* falloff between the zones */}
          <rect x={s0} y={0} width={Math.max(0, s1 - s0)} height={100} fill="url(#tm-shadow)" />
          <rect x={h0} y={0} width={Math.max(0, h1 - h0)} height={100} fill="url(#tm-high)" />

          {/* the image's own luminance, so the split lands where the tones are */}
          {shape && <path d={shape} fill="rgba(233,236,230,0.42)" />}
          {shape && <path d={shape} fill="none" stroke="rgba(233,236,230,0.85)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />}
        </svg>

        {handle("shadow", settings.shadowPos, "Shadows handle")}
        {handle("highlight", settings.highlightPos, "Highlights handle")}
      </div>

      <div className="mt-1 flex justify-between font-display text-[10px] font-bold uppercase tracking-[0.18em] text-mute">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#4d7cff]" />
          shadows
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#b4beb2]" />
          mids
        </span>
        <span className="flex items-center gap-1.5">
          highlights
          <span className="inline-block h-1.5 w-1.5 rotate-45 bg-codm" />
        </span>
      </div>
    </div>
  );
}
