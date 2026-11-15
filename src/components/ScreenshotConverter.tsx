"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  SWATCH_NAMES,
  applyGrade,
  drawSample,
  encode,
  hueParts,
  optimizeGrade,
  type Settings,
  type ZoneKey,
} from "@/lib/codm";
import { scaleIntensity } from "@/lib/macros";
import { copyCode } from "@/components/ImportGuide";

const r = Math.round;
const hsl = (h: number, s = 90, l = 55) => `hsl(${r(h)} ${s}% ${l}%)`;
const ZONE_TABS: ZoneKey[] = ["shadows", "midtones", "highlights"];
const ZONE_LABELS: Record<ZoneKey, string> = {
  shadows: "Shadows",
  midtones: "Midtones",
  highlights: "Highlights",
  global: "Simple",
};

const DEMO_REFS: { label: string; src: string }[] = [
  { label: "Hajin Autumn", src: "/looks/hajin.webp" },
  { label: "Haunted Night", src: "/looks/havens-hollow-night.webp" },
  { label: "Al Mazrah Dust", src: "/looks/al-mazrah.webp" },
];

function fileToCanvas(file: File, maxW: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.max(1, r(img.naturalWidth * scale));
      c.height = Math.max(1, r(img.naturalHeight * scale));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

function urlToCanvas(src: string, maxW: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const scale = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.max(1, r(img.naturalWidth * scale));
      c.height = Math.max(1, r(img.naturalHeight * scale));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c);
    };
    img.onerror = () => reject(new Error("Could not load demo image."));
    img.src = src;
  });
}

function pixels(c: HTMLCanvasElement, maxW = 280) {
  const scale = Math.min(1, maxW / c.width);
  const t = document.createElement("canvas");
  t.width = Math.max(1, r(c.width * scale));
  t.height = Math.max(1, r(c.height * scale));
  const ctx = t.getContext("2d")!;
  ctx.drawImage(c, 0, 0, t.width, t.height);
  return ctx.getImageData(0, 0, t.width, t.height).data;
}

function DropZone({
  title,
  hint,
  canvas,
  onFile,
  onClear,
  optional,
}: {
  title: string;
  hint: string;
  canvas: HTMLCanvasElement | null;
  onFile: (f: File) => void;
  onClear?: () => void;
  optional?: boolean;
}) {
  const [over, setOver] = useState(false);
  const url = useMemo(() => canvas?.toDataURL("image/jpeg", 0.82), [canvas]);
  return (
    <div className="relative">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={`cut group relative flex aspect-video cursor-pointer flex-col justify-end overflow-hidden border bg-black/45 p-4 transition-colors ${
          over ? "border-codm ring-2 ring-codm/40" : "border-line hover:border-mute"
        }`}
      >
        {url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" />
        )}
        {url && (
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        )}
        <div className="relative">
          <div className="font-display text-xl font-extrabold uppercase tracking-wide">
            {title}
            {optional && (
              <span className="ml-2 align-middle text-xs font-medium text-mute">optional</span>
            )}
          </div>
          <p className="mt-1 max-w-sm text-xs text-mute sm:text-sm">
            {url ? "Click, drop, or Ctrl+V to replace." : hint}
          </p>
        </div>
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </label>
      {url && onClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Remove ${title}`}
          className="absolute right-2.5 top-2.5 z-10 border border-white/20 bg-black/80 px-2 py-0.5 font-display text-xs font-bold uppercase tracking-wider text-mute hover:border-codm hover:text-text"
        >
          Clear ×
        </button>
      )}
    </div>
  );
}

/** Live visual verification: Reference Target vs Simulated CODM Output. */
function SimulatedCompare({
  target,
  baseCanvas,
  settings,
}: {
  target: HTMLCanvasElement;
  baseCanvas: HTMLCanvasElement | null;
  settings: Settings;
}) {
  const simRef = useRef<HTMLCanvasElement>(null);
  const [fallbackScene, setFallbackScene] = useState<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (baseCanvas) return;
    let live = true;
    import("@/lib/scene")
      .then((m) => m.renderScene(640, 360, { chips: false }))
      .then((c) => {
        if (!live) return;
        if (c) {
          setFallbackScene(c);
        } else {
          const f = document.createElement("canvas");
          f.width = 640;
          f.height = 360;
          drawSample(f.getContext("2d")!, 640, 360);
          setFallbackScene(f);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [baseCanvas]);

  const previewSource = baseCanvas ?? fallbackScene;
  const targetUrl = useMemo(() => target.toDataURL("image/jpeg", 0.85), [target]);

  useEffect(() => {
    const out = simRef.current;
    if (!out || !previewSource) return;
    const w = Math.min(640, previewSource.width);
    const h = Math.max(1, r((previewSource.height / previewSource.width) * w));
    out.width = w;
    out.height = h;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(previewSource, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    applyGrade(img.data, settings);
    ctx.putImageData(img, 0, 0);
  }, [previewSource, settings]);

  return (
    <div className="cut overflow-hidden border border-line bg-black">
      <div className="grid grid-cols-2 gap-px bg-codm/50">
        <div className="relative aspect-video bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={targetUrl} alt="Reference target" className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2 bg-black/80 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-mute">
            Target Reference
          </span>
        </div>
        <div className="relative aspect-video bg-black">
          <canvas ref={simRef} className="h-full w-full object-cover" />
          <span className="absolute left-2 top-2 bg-codm px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-black">
            {baseCanvas ? "Your Screen · Graded" : "CODM Sim · Graded"}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ScreenshotConverter({
  onApply,
  onError,
}: {
  onApply: (s: Settings, base?: HTMLCanvasElement | null) => void;
  onError: (m: string | null) => void;
}) {
  const [target, setTarget] = useState<HTMLCanvasElement | null>(null);
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [strength, setStrength] = useState(100);
  const [copied, setCopied] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState<string | null>(null);

  const solved = useMemo(
    () => (target ? optimizeGrade(pixels(target), base ? pixels(base) : null) : null),
    [target, base],
  );

  const finalSettings = useMemo(
    () => (solved ? scaleIntensity(solved.settings, strength) : null),
    [solved, strength],
  );

  const load = useCallback(
    (set: (c: HTMLCanvasElement) => void) => async (f: File) => {
      try {
        set(await fileToCanvas(f, 960));
        onError(null);
      } catch (e) {
        onError((e as Error).message);
      }
    },
    [onError],
  );

  // Paste from clipboard directly into Reference (or Base if Reference already loaded)
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) {
            e.preventDefault();
            if (!target) void load(setTarget)(f);
            else void load(setBase)(f);
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [target, load]);

  const tryDemo = async (demo: { label: string; src: string }) => {
    setLoadingDemo(demo.label);
    try {
      const [refCanvas, sceneCanvas] = await Promise.all([
        urlToCanvas(demo.src, 960),
        import("@/lib/scene")
          .then((m) => m.renderScene(640, 360, { chips: false }))
          .catch(() => null),
      ]);
      setTarget(refCanvas);
      if (sceneCanvas) setBase(sceneCanvas);
      setStrength(100);
      onError(null);
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoadingDemo(null);
    }
  };

  const finalCode = finalSettings ? encode(finalSettings) : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]"
    >
      <div className="flex flex-col gap-4">
        {/* Instant Demo Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 border border-line bg-panel/70 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-codm">
              Instant Try
            </span>
            <span className="text-xs text-mute">
              No screenshot handy? Test the perceptual solver on a real sample:
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_REFS.map((d) => (
              <button
                key={d.label}
                type="button"
                disabled={loadingDemo !== null}
                onClick={() => void tryDemo(d)}
                className="border border-line bg-black/50 px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider text-text transition-colors hover:border-codm hover:text-codm disabled:opacity-50"
              >
                {loadingDemo === d.label ? "Solving…" : d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <DropZone
            title="Reference look"
            hint="A screenshot with the colours you want — from any game, movie, or photo. Drop or Ctrl+V."
            canvas={target}
            onFile={load(setTarget)}
            onClear={() => setTarget(null)}
          />
          <DropZone
            title="Your CODM screen"
            hint="CODM on Default filter. A similar scene to the reference raises match accuracy sharply."
            canvas={base}
            onFile={load(setBase)}
            onClear={() => setBase(null)}
            optional
          />
        </div>

        {/* Live Visual Verification Preview */}
        {target && finalSettings && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-codm">
                Live Visual Match Verification
              </span>
              <span className="font-mono text-xs text-mute">
                Iterative perceptual solver · 100% local in browser
              </span>
            </div>
            <SimulatedCompare target={target} baseCanvas={base} settings={finalSettings} />
          </div>
        )}

        <p className="text-xs leading-relaxed text-mute sm:text-sm">
          Images never leave your device. The iterative solver measures shadows, midtones, and
          highlights, then searches CODM&apos;s exact colour-grading math to find the closest
          playable share code.
        </p>
      </div>

      {/* Solved Result Card */}
      <div className="cut flex flex-col gap-4 border border-line bg-panel/85 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-3xl font-extrabold uppercase leading-none">
              Solved Code
            </h2>
            <p className="mt-1 text-xs text-mute">
              {solved ? "Iterative 3-pass perceptual optimization" : "Drop a reference screenshot to solve"}
            </p>
          </div>
          {solved && (
            <div className="border border-lime/50 bg-lime/15 px-2.5 py-1 text-right">
              <span className="block font-mono text-lg font-bold leading-none text-lime">
                {solved.matchScore}%
              </span>
              <span className="font-display text-[10px] font-bold uppercase tracking-widest text-lime/90">
                Match
              </span>
            </div>
          )}
        </div>

        {!finalSettings || !finalCode ? (
          <div className="flex flex-1 flex-col items-center justify-center border border-dashed border-line/80 bg-black/25 px-4 py-10 text-center">
            <p className="font-display text-base font-bold uppercase tracking-wide text-text">
              Waiting for Reference Image
            </p>
            <p className="mt-1 max-w-xs text-xs text-mute">
              Drop a screenshot on the left, paste with Ctrl+V, or tap an Instant Try sample above.
            </p>
          </div>
        ) : (
          <>
            {!base && (
              <p className="border-l-2 border-codm bg-codm/10 px-3 py-2 text-xs">
                No baseline CODM screenshot added — solved against neutral daylight. Add your
                screen for an even tighter match.
              </p>
            )}

            {/* Match Strength Scaler */}
            <div className="border border-line/80 bg-black/35 px-3 py-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-display font-bold uppercase tracking-wider text-mute">
                  Match Strength
                </span>
                <span className="font-mono tabular-nums text-codm">{strength}%</span>
              </div>
              <input
                type="range"
                aria-label="Match strength percentage"
                className="slider mt-0.5"
                min={50}
                max={160}
                step={5}
                value={strength}
                style={{ ["--track" as string]: "linear-gradient(90deg,#3a3f39,#ffea3b)" }}
                onChange={(e) => setStrength(Number(e.target.value))}
              />
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left font-display uppercase tracking-wider text-mute">
                  <th className="py-1 font-bold"></th>
                  <th className="font-bold">Hue</th>
                  <th className="font-bold">Tint</th>
                  <th className="font-bold">Sat</th>
                  <th className="font-bold">Bri</th>
                </tr>
              </thead>
              <tbody className="font-mono tabular-nums">
                {ZONE_TABS.map((k) => {
                  const z = finalSettings.zones[k];
                  const hp = hueParts(z.hue);
                  return (
                    <tr key={k} className="border-t border-line">
                      <td className="py-2 font-display font-bold uppercase tracking-wide">
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rotate-45"
                          style={{ background: hsl(z.hue, z.tint < 3 ? 0 : 90) }}
                        />
                        {ZONE_LABELS[k]}
                      </td>
                      <td>
                        {SWATCH_NAMES[hp.swatch]} {r(hp.pos)}
                      </td>
                      <td>{r(z.tint)}</td>
                      <td>{r(z.sat)}</td>
                      <td>{r(z.bri)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <code className="block break-all border border-line/80 bg-black/60 p-3 font-mono text-xs text-codm">
              {finalCode}
            </code>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={async () => {
                  await copyCode(finalCode, "Screenshot Match");
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className={`cut px-4 py-3 font-display text-lg font-extrabold uppercase tracking-wider transition-colors ${
                  copied
                    ? "bg-lime text-black"
                    : "bg-codm text-black hover:bg-codm-light"
                }`}
              >
                {copied ? "Copied ✓" : "Copy Share Code"}
              </button>
              <button
                type="button"
                onClick={() => onApply(finalSettings, base)}
                className="border border-line bg-panel-2 px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-text transition-colors hover:border-codm hover:bg-line"
              >
                Fine-Tune in Generator →
              </button>
            </div>
          </>
        )}
      </div>
    </motion.section>
  );
}
