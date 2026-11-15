"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { applyGrade, drawSample, gradeUniforms, type Settings } from "@/lib/codm";
import { createGradeGpu, type GradeGpu } from "@/lib/gpuGrade";
import { SCENES, type SceneId } from "@/lib/scene";

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
  compareSettings = null,
  compareLabel,
  source,
  zoneMask = false,
  onToggleZoneMask,
  onUpload,
  onClear,
  onActiveCanvasChange,
}: {
  settings: Settings;
  compareSettings?: Settings | null;
  compareLabel?: string;
  source: HTMLCanvasElement | null;
  zoneMask?: boolean;
  onToggleZoneMask?: () => void;
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
  const [sceneId, setSceneId] = useState<SceneId>("woodland");
  const [chips, setChips] = useState(true);
  const [renderedKey, setRenderedKey] = useState<string>("");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [split, setSplit] = useState(0.36);
  const [peeking, setPeeking] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const draggingSplit = useRef(false);

  const desiredKey = `${sceneId}:${chips}`;
  const renderingScene = !source && renderedKey !== "" && renderedKey !== desiredKey;

  // Render the selected lit 3D tactical lighting environment (cached per map).
  useEffect(() => {
    let live = true;
    import("@/lib/scene")
      .then((m) => m.renderScene(960, 540, { sceneId, chips }))
      .then((c) => {
        if (live && c) {
          setSample(c);
          setRenderedKey(`${sceneId}:${chips}`);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sceneId, chips]);

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
    const id = requestAnimationFrame(() =>
      gpu.current?.render(settings, effectiveSplit, {
        mask: zoneMask && !peeking,
        left: peeking ? null : compareSettings,
      }),
    );
    return () => cancelAnimationFrame(id);
  }, [gpuOk, src, settings, compareSettings, effectiveSplit, zoneMask, peeking]);

  // Draw the left reference canvas when in Side-by-Side ("2-Up") mode
  useEffect(() => {
    if (viewMode !== "side" || !src || !rawSide.current) return;
    const c = rawSide.current;
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(src, 0, 0);
    if (compareSettings) {
      const img = ctx.getImageData(0, 0, c.width, c.height);
      applyGrade(img.data, compareSettings);
      ctx.putImageData(img, 0, 0);
    }
  }, [viewMode, src, compareSettings]);

  // CPU fallback. Original pixels, read once per image.
  const orig = useMemo(
    () =>
      gpuOk === false
        ? (src?.getContext("2d")?.getImageData(0, 0, src.width, src.height) ?? null)
        : null,
    [src, gpuOk],
  );
  const leftPixels = useMemo(() => {
    if (!orig) return null;
    if (!compareSettings || peeking) return orig.data;
    const data = new Uint8ClampedArray(orig.data);
    applyGrade(data, compareSettings);
    return data;
  }, [orig, compareSettings, peeking]);
  // Filtered pixels, recomputed only when the image or settings change.
  const graded = useMemo(() => {
    if (!orig) return null;
    const data = new Uint8ClampedArray(orig.data);
    if (zoneMask && !peeking) {
      const [s0, s1, h0, h1] = gradeUniforms(settings).bands;
      const smooth = (a: number, b: number, x: number) => {
        const t = Math.min(1, Math.max(0, (x - a) / (b - a || 1e-6)));
        return t * t * (3 - 2 * t);
      };
      for (let i = 0; i < data.length; i += 4) {
        const l0 = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
        const ws = 1 - smooth(s0, s1, l0);
        const wh = smooth(h0, h1, l0) * (1 - ws);
        const wm = Math.max(0, 1 - ws - wh);
        const m = l0 * 0.72 + 0.14;
        const fr = ws * 0.16 + wm * m + wh * 1.0;
        const fg = ws * 0.84 + wm * m + wh * 0.92;
        const fb = ws * 1.0 + wm * m + wh * 0.23;
        data[i] = Math.min(255, (l0 * 0.22 + fr * 0.78) * 255);
        data[i + 1] = Math.min(255, (l0 * 0.22 + fg * 0.78) * 255);
        data[i + 2] = Math.min(255, (l0 * 0.22 + fb * 0.78) * 255);
      }
      return data;
    }
    applyGrade(data, settings);
    return data;
  }, [orig, settings, zoneMask, peeking]);

  useEffect(() => {
    const c = view.current;
    if (!c || !orig || !graded || !leftPixels) return;
    const id = requestAnimationFrame(() => {
      const { width: w, height: h } = orig;
      if (c.width !== w) c.width = w;
      if (c.height !== h) c.height = h;
      const out = new ImageData(new Uint8ClampedArray(graded), w, h);
      const x = zoneMask && !peeking ? 0 : Math.min(w, r(w * effectiveSplit));
      if (x > 0) {
        for (let y = 0; y < h; y++) {
          const row = y * w * 4;
          out.data.set(leftPixels.subarray(row, row + x * 4), row);
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
  }, [orig, graded, leftPixels, effectiveSplit, zoneMask, peeking]);

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
          {onToggleZoneMask && (
            <button
              type="button"
              aria-pressed={zoneMask}
              onClick={onToggleZoneMask}
              title="Toggle false-colour tonal zone mask (Cyan = Shadows, Yellow = Highlights)"
              className={`cut-sm select-none px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider transition-colors ${
                zoneMask
                  ? "bg-[#2dd4ff] text-black"
                  : "border border-line bg-panel-2 text-mute hover:border-[#2dd4ff] hover:text-text"
              }`}
            >
              Zone Mask
            </button>
          )}
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
              <span
                className={`pointer-events-none absolute left-2 top-2 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-widest ${
                  compareSettings ? "bg-lime text-black" : "bg-black/80 text-mute"
                }`}
              >
                {compareSettings ? `A · ${compareLabel ?? "Slot"}` : "Original"}
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
        {viewMode === "split" && !peeking && !zoneMask && (
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

        {/* Zone Mask Legend */}
        {zoneMask && !peeking && (
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 border border-white/15 bg-ink/85 px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-widest backdrop-blur-sm">
            <span className="flex items-center gap-1 text-[#2dd4ff]">
              <span className="h-2 w-2 bg-[#2dd4ff]" /> Shadows
            </span>
            <span className="text-mute">· Midtones ·</span>
            <span className="flex items-center gap-1 text-codm">
              <span className="h-2 w-2 bg-codm" /> Highlights
            </span>
          </div>
        )}

        {/* Corner HUD badges for Split & Full modes */}
        {viewMode !== "side" && !(zoneMask && !peeking) && (
          <>
            <div className="pointer-events-none absolute left-3 top-3 flex gap-2 font-display text-xs font-bold uppercase tracking-widest">
              {(peeking || (viewMode === "split" && split > 0.14)) && (
                <span
                  className={
                    !peeking && compareSettings
                      ? "bg-lime px-2 py-0.5 text-black"
                      : "bg-black/80 px-2 py-0.5 text-mute"
                  }
                >
                  {!peeking && compareSettings ? `A · ${compareLabel ?? "Slot"}` : "Original"}
                </span>
              )}
              {!peeking && viewMode === "full" && (
                <span className="bg-codm px-2 py-0.5 text-black">Filtered · approx.</span>
              )}
            </div>
            {!peeking && viewMode === "split" && split < 0.84 && (
              <span className="pointer-events-none absolute right-3 top-3 bg-codm px-2 py-0.5 font-display text-xs font-bold uppercase tracking-widest text-black">
                {compareSettings ? "B · Current" : "Filtered · approx."}
              </span>
            )}
          </>
        )}

        {/* Scene rendering pill */}
        {renderingScene && (
          <div className="pointer-events-none absolute bottom-3 right-3 z-20 border border-codm/50 bg-ink/90 px-2.5 py-1 font-display text-[11px] font-bold uppercase tracking-widest text-codm backdrop-blur-sm">
            Switching map…
          </div>
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

      {/* Bottom preview actions: 4-map lighting rig + screenshot upload */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Test map lighting">
          <span className="mr-1 font-display text-[11px] font-bold uppercase tracking-widest text-mute">
            Map
          </span>
          {SCENES.map((sc) => {
            const active = !source && sceneId === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                title={sc.desc}
                aria-pressed={active}
                onClick={() => {
                  if (source) onClear();
                  setSceneId(sc.id);
                }}
                className={`px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider transition-colors ${
                  active
                    ? "bg-codm/20 text-codm ring-1 ring-inset ring-codm/70"
                    : "bg-panel-2/70 text-mute hover:bg-line hover:text-text"
                }`}
              >
                {sc.short}
              </button>
            );
          })}
          {!source && (
            <button
              type="button"
              aria-pressed={chips}
              onClick={() => setChips((v) => !v)}
              title="Toggle 11-swatch colour calibration bar"
              className={`ml-1 px-2 py-1 font-display text-[11px] font-bold uppercase tracking-wider transition-colors ${
                chips
                  ? "border border-line bg-black/50 text-text"
                  : "border border-transparent bg-transparent text-mute hover:text-text"
              }`}
            >
              Chips {chips ? "On" : "Off"}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="cut-sm cursor-pointer bg-panel-2 px-3 py-1.5 font-display text-xs font-bold uppercase tracking-wider hover:bg-line">
            {source ? "Replace screenshot" : "My screenshot"}
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
              className="font-display text-xs font-bold uppercase tracking-wider text-mute hover:text-text"
            >
              Back to 3D maps
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
