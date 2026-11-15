"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyGrade, drawSample, type Settings } from "@/lib/codm";
import { createGradeGpu, type GradeGpu } from "@/lib/gpuGrade";

type ViewMode = "split" | "full" | "side";

const r = Math.round;

function sampleCanvas() {
  const c = document.createElement("canvas");
  c.width = 960;
  c.height = 540;
  drawSample(c.getContext("2d")!, c.width, c.height);
  return c;
}

export default function PreviewCanvas({
  settings,
  source,
  onUpload,
  onClear,
  onActiveCanvasChange,
}: {
  settings: Settings;
  source: HTMLCanvasElement | null;
  onUpload: (f: File) => void;
  onClear: () => void;
  onActiveCanvasChange?: (src: HTMLCanvasElement | null) => void;
}) {
  const view = useRef<HTMLCanvasElement>(null);
  const rawSide = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const [sample, setSample] = useState<HTMLCanvasElement | null>(() =>
    typeof document === "undefined" ? null : sampleCanvas(),
  );
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [split, setSplit] = useState(0.36);
  const [peeking, setPeeking] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const draggingSplit = useRef(false);

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

  const src = source ?? sample;

  useEffect(() => {
    onActiveCanvasChange?.(src);
  }, [src, onActiveCanvasChange]);

  // Global clipboard paste (Ctrl/Cmd+V) for instant screenshot testing
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            onUpload(f);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [onUpload]);

  // Hold Spacebar anywhere outside inputs to peek Original
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "BUTTON" ||
          t.tagName === "SELECT" ||
          t.isContentEditable)
      )
        return;
      e.preventDefault();
      setPeeking(true);
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setPeeking(false);
    };
    const blur = () => setPeeking(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const effectiveSplit = peeking ? 1 : viewMode === "split" ? split : 0;

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
    const id = requestAnimationFrame(() => gpu.current?.render(settings, effectiveSplit));
    return () => cancelAnimationFrame(id);
  }, [gpuOk, src, settings, effectiveSplit]);

  // Draw the untouched original canvas when in Side-by-Side ("2-Up") mode
  useEffect(() => {
    if (viewMode !== "side" || !src || !rawSide.current) return;
    const c = rawSide.current;
    c.width = src.width;
    c.height = src.height;
    c.getContext("2d")?.drawImage(src, 0, 0);
  }, [viewMode, src]);

  // CPU fallback. Original pixels, read once per image.
  const orig = useMemo(
    () =>
      gpuOk === false
        ? (src?.getContext("2d")?.getImageData(0, 0, src.width, src.height) ?? null)
        : null,
    [src, gpuOk],
  );
  // Filtered pixels, recomputed only when the image or settings change.
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
      const x = Math.min(w, r(w * effectiveSplit));
      if (x > 0) {
        for (let y = 0; y < h; y++) {
          const row = y * w * 4;
          out.data.set(orig.data.subarray(row, row + x * 4), row);
          if (x < w) {
            for (let dx = Math.max(0, x - 1); dx <= Math.min(w - 1, x); dx++) {
              const i = row + dx * 4;
              out.data[i] = 255;
              out.data[i + 1] = 234;
              out.data[i + 2] = 59;
              out.data[i + 3] = 255;
            }
          }
        }
      }
      c.getContext("2d")!.putImageData(out, 0, 0);
    });
    return () => cancelAnimationFrame(id);
  }, [orig, graded, effectiveSplit]);

  const setSplitFromClientX = useCallback((clientX: number) => {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.min(0.97, Math.max(0.03, (clientX - rect.left) / rect.width));
    setSplit(pct);
  }, []);

  return (
    // Below xl the preview is pinned as a viewfinder so the result stays in sight
    // while the sliders underneath scroll.
    <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 border-b border-line bg-ink/90 px-4 pb-2 pt-2 backdrop-blur-md sm:-mx-8 sm:px-8 xl:static xl:mx-0 xl:gap-3 xl:border-0 xl:bg-transparent xl:p-0 xl:backdrop-blur-none">
      {/* Top tactical HUD strip */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label="Preview compare mode"
          className="flex border border-line bg-panel/90 p-0.5"
        >
          {(
            [
              ["split", "Split Wipe"],
              ["full", "Full"],
              ["side", "2-Up"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={viewMode === m}
              onClick={() => setViewMode(m)}
              className={`px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider transition-colors ${
                viewMode === m ? "bg-codm text-black" : "text-mute hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setPeeking(true);
            }}
            onPointerUp={() => setPeeking(false)}
            onPointerCancel={() => setPeeking(false)}
            onLostPointerCapture={() => setPeeking(false)}
            className={`cut-sm select-none px-3 py-1 font-display text-xs font-bold uppercase tracking-wider transition-colors ${
              peeking
                ? "bg-white text-black"
                : "border border-line bg-panel-2 text-text hover:border-codm"
            }`}
            title="Press and hold (or hold Space) to inspect the ungraded original"
          >
            {peeking ? "Viewing Original" : "Hold · Peek Original"}
          </button>
        </div>
      </div>

      {/* Main viewport container with drag-and-drop screenshot upload */}
      <div
        ref={frameRef}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f && f.type.startsWith("image/")) onUpload(f);
        }}
        onPointerDown={(e) => {
          if (viewMode !== "split" || peeking) return;
          draggingSplit.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setSplitFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (!draggingSplit.current) return;
          setSplitFromClientX(e.clientX);
        }}
        onPointerUp={(e) => {
          if (draggingSplit.current) {
            draggingSplit.current = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        className={`cut relative overflow-hidden border bg-black transition-colors ${
          dragOver ? "border-codm ring-2 ring-codm/50" : "border-line"
        } ${viewMode === "split" && !peeking ? "cursor-ew-resize select-none touch-none" : ""}`}
      >
        <div className={viewMode === "side" ? "grid grid-cols-2 gap-px bg-codm/60" : "relative"}>
          {viewMode === "side" && (
            <div className="relative bg-black">
              <canvas
                ref={rawSide}
                className="mx-auto block aspect-video h-auto max-h-[27svh] w-full object-contain xl:max-h-none"
              />
              <span className="pointer-events-none absolute left-2 top-2 bg-black/80 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-widest text-mute">
                Original
              </span>
            </div>
          )}

          <div className="relative bg-black">
            <canvas
              ref={view}
              className="mx-auto block aspect-video h-auto max-h-[27svh] w-full object-contain xl:max-h-none"
            />
            {viewMode === "side" && (
              <span className="pointer-events-none absolute left-2 top-2 bg-codm px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-widest text-black">
                {peeking ? "Original" : "Filtered"}
              </span>
            )}
          </div>
        </div>

        {/* Direct-manipulation split reticle */}
        {viewMode === "split" && !peeking && (
          <div
            role="slider"
            tabIndex={0}
            aria-label="Before and after split position"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={r(split * 100)}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                setSplit((s) => Math.max(0.03, s - 0.04));
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                setSplit((s) => Math.min(0.97, s + 0.04));
              }
            }}
            className="pointer-events-none absolute inset-y-0 z-10 w-0"
            style={{ left: `${split * 100}%` }}
          >
            <div className="pointer-events-auto absolute left-0 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center border-2 border-codm bg-ink/90 text-[11px] font-bold text-codm shadow-[0_0_14px_rgba(0,0,0,0.9)]">
              ◂▸
            </div>
          </div>
        )}

        {/* Corner HUD badges for Split & Full modes */}
        {viewMode !== "side" && (
          <>
            <div className="pointer-events-none absolute left-3 top-3 flex gap-2 font-display text-xs font-bold uppercase tracking-widest">
              {(peeking || (viewMode === "split" && split > 0.14)) && (
                <span className="bg-black/80 px-2 py-0.5 text-mute">Original</span>
              )}
              {!peeking && viewMode === "full" && (
                <span className="bg-codm px-2 py-0.5 text-black">Filtered · approx.</span>
              )}
            </div>
            {!peeking && viewMode === "split" && split < 0.84 && (
              <span className="pointer-events-none absolute right-3 top-3 bg-codm px-2 py-0.5 font-display text-xs font-bold uppercase tracking-widest text-black">
                Filtered · approx.
              </span>
            )}
          </>
        )}

        {/* Drag-over drop target */}
        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-ink/85 backdrop-blur-sm">
            <div className="border-2 border-dashed border-codm px-6 py-4 text-center">
              <p className="font-display text-xl font-extrabold uppercase tracking-wider text-codm">
                Drop Screenshot to Preview
              </p>
              <p className="mt-1 text-xs text-mute">Stays local in your browser</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom preview actions */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="hidden text-xs text-mute sm:inline">
          {viewMode === "split"
            ? "Drag across preview to wipe · Hold Space to peek · Drop or Ctrl+V your screenshot"
            : "Hold Space to peek original · Drop or Ctrl+V any CODM screenshot"}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="cut-sm cursor-pointer bg-panel-2 px-3 py-1.5 font-display text-sm font-bold uppercase tracking-wider hover:bg-line">
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
              type="button"
              onClick={onClear}
              className="font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
            >
              Sample scene
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
