"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SWATCH_NAMES, applyGrade, drawSample, hueParts, type Settings, type ZoneKey } from "@/lib/codm";
import { createGradeGpu, type GradeGpu } from "@/lib/gpuGrade";
import { luminanceHistogram, pixels } from "@/lib/image";
import ToneMap from "@/components/ToneMap";

/**
 * The bench's monitor: one live, graded image with a drag-to-compare divider,
 * the tone map underneath it, and the share code docked to its edge.
 */

type Props = {
  settings: Settings;
  onRange: (patch: { shadowPos?: number; highlightPos?: number }) => void;
  source: HTMLCanvasElement | null;
  onUpload: (f: File) => void;
  onClear: () => void;
  title: string;
  status: "applied" | "edited" | "custom";
  note?: string;
  capsule: ReactNode;
  hoverZone: ZoneKey | null;
  onHoverZone: (z: ZoneKey | null) => void;
  onSelectZone: (z: ZoneKey) => void;
  className?: string;
};

const ZONE_ORDER: ZoneKey[] = ["shadows", "midtones", "highlights"];
const ZONE_LABEL: Record<string, string> = {
  shadows: "Shadows",
  midtones: "Mids",
  highlights: "Highlights",
};

/** The code in plain words: what each tone group is actually set to. */
function ToneSummary({
  settings,
  onSelect,
  onHover,
  hover,
}: {
  settings: Settings;
  onSelect: (z: ZoneKey) => void;
  onHover: (z: ZoneKey | null) => void;
  hover: ZoneKey | null;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {ZONE_ORDER.map((k) => {
        const z = settings.zones[k];
        const hp = hueParts(z.hue);
        const neutral = z.tint < 3 && Math.abs(z.sat - 50) < 1 && Math.abs(z.bri - 50) < 1;
        return (
          <button
            key={k}
            onClick={() => onSelect(k)}
            onPointerEnter={() => onHover(k)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(k)}
            onBlur={() => onHover(null)}
            className={`flex flex-col gap-0.5 border px-2 py-1.5 text-left transition-colors ${
              hover === k ? "border-codm/70 bg-white/[0.06]" : "border-line bg-black/30 hover:bg-white/[0.05]"
            }`}
          >
            <span className="flex items-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-[0.16em] text-mute">
              <span
                className="h-2 w-2 shrink-0 rotate-45 border border-black/50"
                style={{ background: `hsl(${Math.round(z.hue)} ${z.tint < 3 ? 8 : 85}% 55%)` }}
              />
              {ZONE_LABEL[k]}
            </span>
            <span className={`truncate font-mono text-[11px] ${neutral ? "text-mute" : "text-text"}`}>
              {neutral ? "neutral" : `${SWATCH_NAMES[hp.swatch]} ${Math.round(hp.pos)}`}
            </span>
            <span className="truncate font-mono text-[10px] text-mute">
              t{Math.round(z.tint)} s{Math.round(z.sat)} b{Math.round(z.bri)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function sampleCanvas() {
  const c = document.createElement("canvas");
  c.width = 960;
  c.height = 540;
  drawSample(c.getContext("2d")!, c.width, c.height);
  return c;
}

const r = Math.round;

export default function Monitor({
  settings,
  onRange,
  source,
  onUpload,
  onClear,
  title,
  status,
  note,
  capsule,
  hoverZone,
  onHoverZone,
  onSelectZone,
  className = "",
}: Props) {
  const view = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [sample, setSample] = useState(() => (typeof document === "undefined" ? null : sampleCanvas()));
  const [split, setSplit] = useState(0);
  const dragging = useRef(false);
  const src = source ?? sample;

  // Swap the flat fallback for a lit 3D scene as soon as three.js has loaded.
  useEffect(() => {
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
  }, []);

  // Grade on the GPU when WebGL is available; null = not tried yet.
  const gpu = useRef<GradeGpu | null>(null);
  const [gpuOk, setGpuOk] = useState<boolean | null>(null);
  useEffect(() => {
    const c = view.current;
    if (!c) return;
    const g = createGradeGpu(c);
    gpu.current = g;
    setGpuOk(!!g);
    return () => {
      g?.dispose();
      gpu.current = null;
    };
  }, []);
  useEffect(() => {
    if (gpuOk && src) gpu.current?.setSource(src);
  }, [gpuOk, src]);
  useEffect(() => {
    if (!gpuOk || !src) return;
    const id = requestAnimationFrame(() => gpu.current?.render(settings, split));
    return () => cancelAnimationFrame(id);
  }, [gpuOk, src, settings, split]);

  // CPU fallback. Original pixels, read once per image.
  const orig = useMemo(
    () =>
      gpuOk === false ? (src?.getContext("2d")?.getImageData(0, 0, src.width, src.height) ?? null) : null,
    [src, gpuOk],
  );
  const graded = useMemo(() => {
    if (!orig) return null;
    const data = new Uint8ClampedArray(orig.data);
    applyGrade(data, settings);
    return data;
  }, [orig, settings]);

  useEffect(() => {
    const c = view.current;
    if (!c || !orig || !graded) return;
    const id = requestAnimationFrame(() => {
      const { width: w, height: h } = orig;
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      const out = new ImageData(new Uint8ClampedArray(graded), w, h);
      const x = Math.min(w, r(w * split));
      if (x > 0) {
        for (let y = 0; y < h; y++) {
          const row = y * w * 4;
          out.data.set(orig.data.subarray(row, row + x * 4), row);
          for (let dx = Math.max(0, x - 2); dx < Math.min(w, x + 1); dx++) {
            const i = row + dx * 4;
            out.data[i] = 255;
            out.data[i + 1] = 234;
            out.data[i + 2] = 59;
            out.data[i + 3] = 255;
          }
        }
      }
      c.getContext("2d")!.putImageData(out, 0, 0);
    });
    return () => cancelAnimationFrame(id);
  }, [orig, graded, split]);

  // The tone map reads the image's own luminance, not the grade: measured once
  // per source, from a downscaled copy (deferred a frame so it never blocks paint).
  const [hist, setHist] = useState<Float32Array | null>(null);
  useEffect(() => {
    if (!src) return;
    const id = requestAnimationFrame(() => {
      try {
        setHist(luminanceHistogram(pixels(src, 240)));
      } catch {
        setHist(null);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [src]);

  const setSplitAt = (clientX: number) => {
    const b = frame.current?.getBoundingClientRect();
    if (!b) return;
    setSplit(Math.min(1, Math.max(0, (clientX - b.left) / b.width)));
  };

  const sweep = `${title}-${status}`;

  return (
    // On phones the root dissolves (max-lg:contents) so the sticky frame's
    // parent is the whole bench, and the preview keeps pinning while you tune.
    <div className={`flex min-w-0 flex-col gap-3 max-lg:contents ${className}`}>
      {/* sticky viewfinder on small screens, so the result never leaves sight */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-line/70 bg-ink/92 px-4 pb-2 pt-1.5 backdrop-blur-md sm:-mx-8 sm:px-8 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        <div className="cut relative bg-black p-[3px] ring-1 ring-line">
          <div
            ref={frame}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("[data-no-compare]")) return;
              dragging.current = true;
              e.currentTarget.setPointerCapture(e.pointerId);
              setSplitAt(e.clientX);
            }}
            onPointerMove={(e) => {
              if (dragging.current) setSplitAt(e.clientX);
            }}
            onPointerUp={(e) => {
              dragging.current = false;
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }}
            onPointerCancel={() => (dragging.current = false)}
            onDoubleClick={() => setSplit(0)}
            className="relative cursor-ew-resize touch-pan-y select-none overflow-hidden bg-black"
          >
            <canvas
              ref={view}
              className="mx-auto block h-auto max-h-[27svh] w-full object-contain lg:max-h-[min(56svh,620px)]"
            />

            {/* camera brackets, so the frame reads as a monitor and not a card */}
            {[
              "left-2 top-2 border-l border-t",
              "right-2 top-2 border-r border-t",
              "bottom-2 left-2 border-b border-l",
              "bottom-2 right-2 border-b border-r",
            ].map((c) => (
              <span
                key={c}
                aria-hidden
                className={`pointer-events-none absolute h-3.5 w-3.5 border-white/45 ${c}`}
              />
            ))}

            {/* a quick sweep whenever the grade on screen changes */}
            <span key={sweep} className="sweep pointer-events-none absolute inset-y-0 w-1/3" aria-hidden />

            <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
              <div className="flex flex-col items-start gap-1">
                <span className="bg-black/75 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-text backdrop-blur-sm">
                  {title}
                  {status === "edited" && <span className="ml-1.5 text-mute">· edited</span>}
                </span>
                {note && (
                  <span className="max-w-[16rem] bg-black/55 px-2 py-0.5 text-[11px] leading-snug text-text/70 backdrop-blur-sm">
                    {note}
                  </span>
                )}
              </div>
              <span className="shrink-0 bg-codm px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-black">
                Preview · approx.
              </span>
            </div>

            {split > 0.004 && (
              <>
                <span
                  className="pointer-events-none absolute inset-y-0 w-px bg-codm"
                  style={{ left: `${split * 100}%` }}
                />
                <span
                  className="pointer-events-none absolute top-1/2 grid h-7 w-7 -translate-x-1/2 -translate-y-1/2 place-items-center bg-codm/90 font-mono text-[10px] font-bold text-black"
                  style={{ left: `${split * 100}%` }}
                >
                  ‹›
                </span>
                <span className="pointer-events-none absolute bottom-3 left-3 bg-black/75 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-[0.18em] text-text/80">
                  original
                </span>
              </>
            )}
          </div>
        </div>

        {/* the artifact lives next to the thing you judge, on every screen size */}
        {capsule}
      </div>

      <ToneMap
        settings={settings}
        hist={hist}
        onRange={onRange}
        hover={hoverZone}
        onHover={onHoverZone}
      />

      <ToneSummary
        settings={settings}
        onSelect={onSelectZone}
        onHover={onHoverZone}
        hover={hoverZone}
      />

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="order-2 hidden text-xs text-mute lg:order-1 lg:block">
          <span className="font-display font-bold uppercase tracking-wider text-text/80">
            Drag across the frame
          </span>{" "}
          to compare with the original · {source ? "your screenshot" : "sample scene"}
        </p>
        <div className="order-1 ml-auto flex items-center gap-2 lg:order-2">
          <button
            onClick={() => setSplit((v) => (v > 0.01 ? 0 : 0.5))}
            aria-pressed={split > 0.01}
            className={`cut-sm px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider ${
              split > 0.01 ? "bg-codm text-black" : "bg-panel-2 text-text hover:bg-line"
            }`}
          >
            Compare
          </button>
          <label className="cut-sm cursor-pointer bg-panel-2 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider hover:bg-line">
            Use my screenshot
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
                e.target.value = "";
              }}
            />
          </label>
          {source && (
            <button
              onClick={onClear}
              className="font-display text-xs font-bold uppercase tracking-wider text-mute hover:text-text"
            >
              Sample scene
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
