"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { applyGrade, type Settings } from "@/lib/codm";
import { createGradeGpu, type GradeGpu } from "@/lib/gpuGrade";
import { flatSample, sampleFrame } from "@/lib/frame";

const r = Math.round;

/**
 * The graded frame. Dragging Compare wipes the original across it; the GPU does
 * the grading so a slider moves smoothly, with a CPU fallback when WebGL can't.
 */
export default function Preview({
  settings,
  source,
  onUpload,
  onClear,
  big = false,
}: {
  settings: Settings;
  source: HTMLCanvasElement | null;
  onUpload: (f: File) => void;
  onClear: () => void;
  /** Larger viewfinder for the full-screen editor. */
  big?: boolean;
}) {
  const view = useRef<HTMLCanvasElement>(null);
  const [sample, setSample] = useState(() =>
    typeof document === "undefined" ? null : flatSample(),
  );
  // Swap the flat fallback for the shared lit 3D scene once it is ready.
  useEffect(() => {
    let live = true;
    sampleFrame().then((c) => {
      if (live) setSample(c);
    });
    return () => {
      live = false;
    };
  }, []);
  const [split, setSplit] = useState(0);
  const src = source ?? sample;

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

  // Build each frame from the two buffers so moving the compare slider never
  // leaves anything from the previous frame behind.
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
          // divider
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

  return (
    // Below xl the preview is pinned as a viewfinder so the result stays in sight
    // while the sliders underneath scroll.
    <div className="sticky top-0 z-10 -mx-3 flex flex-col gap-2 border-b border-line bg-ink/92 px-3 pb-2 pt-2 backdrop-blur-md sm:-mx-4 sm:px-4 lg:sticky lg:top-0 lg:mx-0 lg:gap-3 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      <div className="cut relative overflow-hidden border border-line bg-black">
        <canvas
          ref={view}
          className={`mx-auto block aspect-video h-auto w-full object-contain ${
            big ? "max-h-[40svh] lg:max-h-[62svh]" : "max-h-[27svh] lg:max-h-none"
          }`}
        />
        <div className="pointer-events-none absolute left-3 top-3 flex gap-2 font-display text-xs font-bold uppercase tracking-widest">
          {split > 0 && <span className="bg-black/70 px-2 py-0.5 text-mute">Original</span>}
          <span className="bg-codm px-2 py-0.5 text-black">Filtered · approx.</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-w-44 flex-1 items-center gap-2">
          <span className="font-display text-xs font-bold uppercase tracking-wider text-mute">
            Compare
          </span>
          <input
            type="range"
            className="slider"
            min={0}
            max={100}
            aria-label="Compare with the original"
            value={r(split * 100)}
            onChange={(e) => setSplit(Number(e.target.value) / 100)}
          />
        </label>
        <label className="cut-sm cursor-pointer bg-panel-2 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider hover:bg-line">
          My screenshot
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
  );
}
