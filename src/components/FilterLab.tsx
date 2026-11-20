"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  analyse,
  applyGrade,
  decode,
  defaultSettings,
  drawSample,
  encode,
  type Settings,
  type Zone,
  type ZoneKey,
  type SceneKind,
  drawScene,
  SWATCH_NAMES,
  hueFrom,
  hueParts,
} from "@/lib/codm";
import LooksGallery from "@/components/LooksGallery";
import ImportGuide, { copyCode } from "@/components/ImportGuide";
import TonalScope from "@/components/TonalScope";
import { createGradeGpu, type GradeGpu } from "@/lib/gpuGrade";
import { act, useActions } from "@/lib/actions";
import CommandPalette from "@/components/CommandPalette";
import { useHistory } from "@/lib/useHistory";
import { ShortcutsHelp, useGlobalHotkeys } from "@/components/Shortcuts";
import { notify } from "@/components/Toasts";
import { normalizeCode, blendSettings, codeDiff } from "@/lib/codeTools";
import { DEFAULT_CODE } from "@/lib/codm";
import MyLooks, { saveLookCode, rememberLook } from "@/components/MyLooks";
import Onboarding from "@/components/Onboarding";
import LookInspector from "@/components/LookInspector";
import CompareMode from "@/components/CompareMode";
import { copyText } from "@/lib/clipboard";
import Changelog from "@/components/Changelog";
import QuickTweaks from "@/components/QuickTweaks";
import { getPrefs, setPref } from "@/lib/storage";

type Mode = "build" | "convert";
type Panel = ZoneKey;


const PANEL_INFO: Record<Panel, { label: string; desc: string }> = {
  shadows: {
    label: "Shadows",
    desc: "The darkest parts of the frame: interiors, foliage, the underside of cover. A cool tint here gives depth without muddying skin tones.",
  },
  midtones: {
    label: "Midtones",
    desc: "Most of what you look at: walls, terrain, operators. Small changes go a long way.",
  },
  highlights: {
    label: "Highlights",
    desc: "Sky, sunlit surfaces, bright paint. Warm highlights read as daylight; cool ones read as overcast.",
  },
  global: {
    label: "Simple",
    desc: "The game's simple Customize Color screen (Preset #1–#5), which colours the whole image. Advanced mode's Shadows, Midtones and Highlights apply on top of it. The code carries the selected slot and its colour.",
  },
};

const ZONE_TABS: ZoneKey[] = ["shadows", "midtones", "highlights"];
const ADVANCED_PANELS: Panel[] = ["shadows", "midtones", "highlights"];

const flat = (z: Zone) => z.tint < 3 && Math.abs(z.sat - 50) < 1 && Math.abs(z.bri - 50) < 1;
/** True when the code carries Advanced (shadows / midtones / highlights) values. */
const usesAdvanced = (s: Settings) => !ZONE_TABS.every((k) => flat(s.zones[k]));

const r = Math.round;
const hsl = (h: number, s = 90, l = 55) => `hsl(${r(h)} ${s}% ${l}%)`;

// Image helpers

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

function pixels(c: HTMLCanvasElement, maxW = 320) {
  const scale = Math.min(1, maxW / c.width);
  const t = document.createElement("canvas");
  t.width = Math.max(1, r(c.width * scale));
  t.height = Math.max(1, r(c.height * scale));
  const ctx = t.getContext("2d")!;
  ctx.drawImage(c, 0, 0, t.width, t.height);
  return ctx.getImageData(0, 0, t.width, t.height).data;
}

function sampleCanvas(kind: SceneKind = "urban") {
  const c = document.createElement("canvas");
  c.width = 960;
  c.height = 540;
  drawScene(c.getContext("2d")!, c.width, c.height, kind);
  return c;
}

// Small UI pieces

function Slider({
  label,
  value,
  min,
  max,
  track,
  onChange,
  onReset,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  track: string;
  onChange: (v: number) => void;
  onReset?: () => void;
}) {
  return (
    <label className="grid grid-cols-[6.5rem_1fr_3.75rem] items-center gap-3">
      <span className="font-display text-sm font-bold uppercase tracking-wider text-mute">
        {label}
      </span>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={1}
        value={r(value)}
        style={{ ["--track" as string]: track }}
        onChange={(e) => onChange(Number(e.target.value))}
        onDoubleClick={onReset}
        title={onReset ? `${label}: double-click to reset` : undefined}
      />
      <input
        type="number"
        aria-label={`${label} value`}
        min={min}
        max={max}
        value={r(value)}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="h-9 w-full border border-line bg-black/40 px-1.5 text-right font-mono text-sm tabular-nums pointer-coarse:h-11"
      />
    </label>
  );
}

function DropZone({
  title,
  hint,
  canvas,
  onFile,
  optional,
}: {
  title: string;
  hint: string;
  canvas: HTMLCanvasElement | null;
  onFile: (f: File) => void;
  optional?: boolean;
}) {
  const [over, setOver] = useState(false);
  const url = useMemo(() => canvas?.toDataURL("image/jpeg", 0.8), [canvas]);
  return (
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
      className={`cut group relative flex aspect-video cursor-pointer flex-col justify-end overflow-hidden border bg-black/40 p-4 transition-colors ${
        over ? "border-codm" : "border-line hover:border-mute"
      }`}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
      )}
      {url && <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />}
      <div className="relative">
        <div className="font-display text-xl font-extrabold uppercase tracking-wide">
          {title}
          {optional && (
            <span className="ml-2 align-middle text-xs font-medium text-mute">optional</span>
          )}
        </div>
        <p className="mt-1 max-w-sm text-sm text-mute">{url ? "Click or drop to replace." : hint}</p>
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
  );
}

// Preview

function Preview({
  settings,
  source,
  onUpload,
  onClear,
  view,
  snapshot,
  onPin,
  onFullscreen,
}: {
  settings: Settings;
  source: HTMLCanvasElement | null;
  onUpload: (f: File) => void;
  onClear: () => void;
  view: React.RefObject<HTMLCanvasElement | null>;
  snapshot?: Settings | null;
  onPin?: () => void;
  onFullscreen?: () => void;
}) {
  const [scene, setScene] = useState<SceneKind>(() => getPrefs().scene ?? "urban");
  const [sample, setSample] = useState(() =>
    typeof document === "undefined" ? null : sampleCanvas(getPrefs().scene ?? "urban"),
  );
  useEffect(() => setSample(sampleCanvas(scene)), [scene]);
  // Swap the flat fallback for a lit 3D scene as soon as three.js has loaded.
  useEffect(() => {
    let live = true;
    let timer = 0;
    const later = (fn: () => void) =>
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(fn, { timeout: 1200 })
        : (timer = window.setTimeout(fn, 350));
    const id = later(() => {
      import("@/lib/scene")
        .then((m) => m.renderScene(960, 540))
        .then((c) => {
          if (live && c && scene === "urban") setSample(c);
        })
        .catch(() => {});
    });
    return () => {
      live = false;
      if (typeof cancelIdleCallback === "function") cancelIdleCallback(id);
      else window.clearTimeout(timer);
    };
  }, [scene]);
  const [split, setSplit] = useState(0);
  const wipe = useRef<{ x: number; y: number; on: boolean } | null>(null);
  const src = source ?? sample;
  const snapRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const [loupe, setLoupe] = useState(false);
  const [loupeAt, setLoupeAt] = useState({ x: 0.5, y: 0.5 });
  useEffect(() => {
    if (!loupe) return;
    const c = loupeRef.current,
      v = view.current;
    if (!c || !v) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const sx = Math.min(v.width - 1, Math.max(1, loupeAt.x * v.width));
    const sy = Math.min(v.height - 1, Math.max(1, loupeAt.y * v.height));
    ctx.drawImage(v, sx - 24, sy - 24, 48, 48, 0, 0, c.width, c.height);
  }, [loupe, loupeAt, settings, split]);

  // A pinned "before" grade is composited into the original side of the wipe.
  useEffect(() => {
    if (!snapshot || !src) return;
    const c = snapRef.current;
    if (!c) return;
    c.width = src.width;
    c.height = src.height;
    const data = src.getContext("2d")?.getImageData(0, 0, src.width, src.height);
    if (!data) return;
    applyGrade(data.data, snapshot);
    c.getContext("2d")?.putImageData(data, 0, 0);
  }, [snapshot, src]);

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
    <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2 border-b border-line bg-ink/90 px-4 pb-2 pt-2 backdrop-blur-md sm:-mx-8 sm:px-8 xl:static xl:mx-0 xl:gap-3 xl:border-0 xl:bg-transparent xl:p-0 xl:backdrop-blur-none">
      <div
        className="cut relative mx-auto w-fit max-w-full cursor-ew-resize touch-pan-y overflow-hidden border border-line bg-black xl:w-auto"
        onPointerDown={(e) => {
          wipe.current = { x: e.clientX, y: e.clientY, on: false };
        }}
        onPointerMove={(e) => {
          if (loupe) {
            const b = e.currentTarget.getBoundingClientRect();
            setLoupeAt({
              x: Math.min(1, Math.max(0, (e.clientX - b.left) / b.width)),
              y: Math.min(1, Math.max(0, (e.clientY - b.top) / b.height)),
            });
          }
          const w = wipe.current;
          if (!w) return;
          // only a deliberate sideways pull starts the wipe, so vertical scrolls pass through
          if (!w.on) {
            const dx = Math.abs(e.clientX - w.x),
              dy = Math.abs(e.clientY - w.y);
            if (dx < 8 || dx < dy) return;
            w.on = true;
            e.currentTarget.setPointerCapture(e.pointerId);
          }
          const r = e.currentTarget.getBoundingClientRect();
          setSplit(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
        }}
        onPointerUp={() => (wipe.current = null)}
        onPointerCancel={() => (wipe.current = null)}
        onDoubleClick={() => setSplit(0)}
      >
        <canvas ref={view} className="block aspect-video h-auto max-h-[27svh] w-auto max-w-full object-contain md:max-h-[38svh] xl:max-h-none xl:w-full" />
        {snapshot && (
          <canvas
            ref={snapRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full object-contain"
            style={{ clipPath: `inset(0 0 0 ${split * 100}%)` }}
          />
        )}
        {loupe && (
          <canvas
            ref={loupeRef}
            width={128}
            height={128}
            aria-hidden
            className="pointer-events-none absolute z-20 h-32 w-32 border-2 border-codm bg-black shadow-[0_0_0_3px_rgba(0,0,0,0.7)]"
            style={{ left: `calc(${loupeAt.x * 100}% - 64px)`, top: `calc(${loupeAt.y * 100}% - 64px)` }}
          />
        )}
        <div className="pointer-events-none absolute left-3 top-3 flex gap-2 font-display text-xs font-bold uppercase tracking-widest">
          {split > 0 && (
            <span className="bg-black/70 px-2 py-0.5 text-mute">
              {snapshot ? "Before" : "Original"}
            </span>
          )}
          <span className="bg-codm px-2 py-0.5 text-black">Filtered · approx.</span>
          {split === 0 && <span className="bg-black/70 px-2 py-0.5 text-mute">Drag to compare</span>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-w-48 flex-1 items-center gap-3">
          <span className="font-display text-sm font-bold uppercase tracking-wider text-mute">
            Compare
          </span>
          <input
            type="range"
            className="slider"
            min={0}
            max={100}
            value={r(split * 100)}
            onChange={(e) => setSplit(Number(e.target.value) / 100)}
          />
        </label>
        <label className="cut-sm inline-flex min-h-11 cursor-pointer items-center bg-panel-2 px-3 font-display text-sm font-bold uppercase tracking-wider hover:bg-line">
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
            className="font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
          >
            Sample scene
          </button>
        )}
        <div className="flex items-center gap-1">
          <span className="font-display text-[11px] font-bold uppercase tracking-wider text-mute">Scene</span>
          {(["urban", "range", "portrait"] as SceneKind[]).map((k) => (
            <button
              key={k}
              onClick={() => { setScene(k); setPref("scene", k); }}
              aria-pressed={scene === k}
              disabled={!!source}
              className={`min-h-11 px-2 font-display text-xs font-bold uppercase tracking-wide disabled:opacity-40 ${
                scene === k ? "bg-codm text-black" : "border border-line bg-panel-2 text-mute hover:text-text"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <button
          onClick={onPin}
          className={`cut-sm min-h-11 border px-3 font-display text-sm font-bold uppercase tracking-wider ${
            snapshot ? "border-codm bg-codm/15 text-codm-light" : "border-line bg-panel-2 text-mute hover:text-text"
          }`}
          title="Freeze the current grade and compare it with later edits"
        >
          {snapshot ? "◉ Clear before" : "◎ Pin before"}
        </button>
        <button
          onClick={() => setLoupe((v) => !v)}
          aria-pressed={loupe}
          className={`cut-sm min-h-11 border px-3 font-display text-sm font-bold uppercase tracking-wider ${
            loupe ? "border-codm bg-codm/15 text-codm-light" : "border-line bg-panel-2 text-mute hover:text-text"
          }`}
          title="4× pixel inspector; move the pointer over the preview"
        >
          ⌕ Loupe
        </button>
        <button
          onClick={onFullscreen}
          className="cut-sm min-h-11 border border-line bg-panel-2 px-3 font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
          title="Fullscreen preview (F)"
        >
          ⛶ Fullscreen
        </button>
      </div>
    </div>
  );
}

export default function FilterLab() {
  const [mode, setMode] = useState<Mode>("build");
  const view = useRef<HTMLCanvasElement>(null);
  const [advanced, setAdvanced] = useState(true);
  const [tab, setPanel] = useState<Panel>("highlights");
  // Simple mode has one screen; Advanced never shows it.
  const panel: Panel = !advanced ? "global" : tab === "global" ? "shadows" : tab;
  const hist = useHistory<Settings>(defaultSettings());
  const settings = hist.value;
  const setSettings = hist.set;
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const code = useMemo(() => encode(settings), [settings]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [inspectOpen, setInspectOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Settings | null>(null);
  const [announcement, setAnnouncement] = useState("");
  useEffect(() => {
    const n = codeDiff(code, DEFAULT_CODE).length;
    const id = window.setTimeout(
      () => setAnnouncement(`Share code updated. ${n} of 22 values differ from the in-game default.`),
      300,
    );
    return () => window.clearTimeout(id);
  }, [code]);
  useGlobalHotkeys();
  useActions(
    useCallback(
      (a, detail) => {
        switch (a) {
          case "open-palette":
            setPaletteOpen(true);
            break;
          case "undo":
            if (hist.canUndo) {
              hist.undo();
              notify({ title: "Undone", ms: 1600 });
            }
            break;
          case "redo":
            if (hist.canRedo) {
              hist.redo();
              notify({ title: "Redone", ms: 1600 });
            }
            break;
          case "toggle-mode":
            setAdvanced((v) => !v);
            break;
          case "fullscreen-preview": {
            const stage = view.current?.parentElement;
            const fail = () => notify({ title: "Fullscreen unavailable", tone: "warn" });
            if (document.fullscreenElement) document.exitFullscreen().catch(fail);
            else stage?.requestFullscreen?.().catch(fail);
            break;
          }
          case "open-my-looks":
            setLibraryOpen(true);
            break;
          case "open-inspector":
            setInspectOpen(true);
            break;
          case "open-compare":
            setCompareOpen(true);
            break;
          case "save-look": {
            const saved = saveLookCode(code);
            notify(
              saved
                ? { title: "Look saved", detail: saved.name, tone: "good", action: { label: "Open library", run: () => act("open-my-looks") } }
                : { title: "Already saved", detail: "That code is in My Looks.", tone: "warn" },
            );
            break;
          }
          case "focus-editor": {
            const tab = (detail as { tab?: string } | undefined)?.tab;
            if (tab && ZONE_TABS.includes(tab as ZoneKey)) {
              setAdvanced(true);
              setPanel(tab as ZoneKey);
            }
            document.getElementById("editor")?.scrollIntoView({ behavior: "smooth" });
            break;
          }
        }
      },
      [hist.undo, hist.redo, hist.canUndo, hist.canRedo, code],
    ),
  );


  // A code copied in another tab or chat should be one tap away from loading.
  useEffect(() => {
    const on = (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
      const text = e.clipboardData?.getData("text");
      if (!text) return;
      const code = normalizeCode(text);
      if (!code) return;
      e.preventDefault();
      notify({
        title: "Share code detected",
        detail: "A 22-number CODM code is on your clipboard.",
        action: {
          label: "Load",
          run: () => {
            const s = decode(code);
            if (s) {
              hist.reset(s);
              setMode("build");
              notify({ title: "Code loaded", tone: "good" });
            }
          },
        },
      });
    };
    window.addEventListener("paste", on);
    return () => window.removeEventListener("paste", on);
  }, [hist.reset]);

  // restore from #c=<code>, keep the hash in sync so the URL is shareable
  useEffect(() => {
    const m = location.hash.match(/c=([-\d_]+)/);
    const s = m && decode(m[1]);
    // one-off read of the URL on load; the page is statically rendered so it can't go in initial state
    if (!s) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(s);
    setAdvanced(usesAdvanced(s) || s.zones.global.tint < 3);
  }, []);
  useEffect(() => {
    history.replaceState(null, "", `#c=${code}`);
  }, [code]);

  const [hueHint, setHueHint] = useState<Partial<Record<ZoneKey, number>>>({});
  const setZone = useCallback((k: ZoneKey, patch: Partial<Zone>) => {
    setSettings((s) => ({ ...s, zones: { ...s.zones, [k]: { ...s.zones[k], ...patch } } }));
  }, []);

  const loadCode = useCallback((c: string) => {
    const s = decode(c);
    if (!s) return false;
    setSettings(s);
    setAdvanced(usesAdvanced(s) || s.zones.global.tint < 3);
    return true;
  }, []);
  useEffect(() => {
    const on = (e: Event) => setMode((e as CustomEvent<"convert">).detail);
    const tune = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      const s = decode(code);
      if (!s) return;
      setSnapshot(s);
      loadCode(code);
      setMode("build");
      document.getElementById("editor")?.scrollIntoView({ behavior: "smooth" });
      notify({ title: "Before pinned", detail: "Adjust the sliders and wipe to compare with what you imported.", tone: "good" });
    };
    window.addEventListener("codm:set-mode", on);
    window.addEventListener("codm:tune-again", tune);
    return () => {
      window.removeEventListener("codm:set-mode", on);
      window.removeEventListener("codm:tune-again", tune);
    };
  }, [loadCode]);

  const upload = async (f: File) => {
    try {
      setSource(await fileToCanvas(f, 1280));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1400px] flex-col px-4 pb-40 sm:px-8">
      <p aria-live="polite" className="sr-only">{announcement}</p>
      {/* top bar */}
      <header className="flex flex-wrap items-end justify-between gap-4 pt-5 sm:pt-10">
        <div>
        <div className="flex items-center gap-3 sm:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/codm-logo.svg"
            alt="Call of Duty: Mobile"
            width={1442}
            height={479}
            className="h-10 w-auto shrink-0 sm:mb-4 sm:h-12"
          />
          <div className="min-w-0 border-l border-line pl-3 sm:border-0 sm:pl-0">
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-codm sm:text-xs sm:tracking-[0.3em]"
          >
            <span className="inline-block h-2 w-2 rotate-45 bg-codm" />
            Unofficial fan-made tool
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="font-title text-3xl font-black uppercase leading-[0.95] tracking-wide sm:text-7xl"
          >
            Filter Lab
          </motion.h1>
          </div>
        </div>
          <p className="mt-3 max-w-xl text-sm text-mute sm:mt-2 sm:text-base">
            Colour filter share codes for Call of Duty: Mobile. Copy a ready-made look, or build
            your own.
          </p>
        </div>
        <div className="flex items-center gap-1 self-end">
        <button
          onClick={() => act("open-my-looks")}
          aria-label="Open My Looks"
          title="My Looks"
          className="cut-sm flex h-11 items-center gap-2 border border-line bg-panel/80 px-3 font-display text-sm font-bold uppercase tracking-wider text-mute hover:border-codm hover:text-text"
        >
          ☆ <span className="hidden sm:inline">My Looks</span>
        </button>
        <button
          onClick={() => act("undo")}
          disabled={!hist.canUndo}
          aria-label="Undo last edit"
          title="Undo (⌘Z)"
          className="grid h-11 w-11 place-items-center border border-line bg-panel/80 font-display text-lg text-mute enabled:hover:border-codm enabled:hover:text-text disabled:opacity-40"
        >
          ↶
        </button>
        <button
          onClick={() => act("redo")}
          disabled={!hist.canRedo}
          aria-label="Redo edit"
          title="Redo (⌘⇧Z)"
          className="grid h-11 w-11 place-items-center border border-line bg-panel/80 font-display text-lg text-mute enabled:hover:border-codm enabled:hover:text-text disabled:opacity-40"
        >
          ↷
        </button>
        <button
          onClick={() => act("open-help")}
          aria-label="Keyboard shortcuts"
          title="Keyboard shortcuts (?)"
          className="grid h-11 w-11 place-items-center border border-line bg-panel/80 font-display text-lg text-mute hover:border-codm hover:text-text"
        >
          ?
        </button>
        <button
          onClick={() => act("open-palette")}
          aria-label="Open quick find"
          className="cut-sm flex min-h-11 items-center gap-2 border border-line bg-panel/80 px-3 font-display text-sm font-bold uppercase tracking-wider text-mute transition-colors hover:border-codm hover:text-text"
        >
          <span aria-hidden>⌕</span> Quick find
          <kbd className="hidden border border-line px-1.5 py-0.5 font-mono text-[10px] sm:inline">
            ⌘K
          </kbd>
        </button>
        </div>
      </header>

      <LooksGallery
        onEdit={(c) => {
          loadCode(c);
          setMode("build");
          document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      <div id="editor" className="mt-12 flex scroll-mt-6 flex-wrap items-end justify-between gap-2">
        <h2 className="font-title text-3xl font-black uppercase tracking-wide sm:text-4xl">Make your own</h2>
        <nav aria-label="Mode" className="flex gap-1">
          {(
            [
              ["build", "Generator"],
              ["convert", "Screenshot → Code"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`relative px-4 py-2 font-display text-lg font-bold uppercase tracking-wider transition-colors ${
                mode === m ? "text-text" : "text-mute hover:text-text"
              }`}
            >
              {label}
              {mode === m && (
                <motion.span
                  layoutId="tab-underline"
                  className="absolute inset-x-2 -bottom-0.5 h-[3px] bg-codm"
                />
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-3 h-px bg-gradient-to-r from-codm/60 via-line to-transparent" />

      {error && (
        <p role="alert" className="mt-4 border-l-2 border-red-500 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <AnimatePresence mode="wait">
        {mode === "build" ? (
          <motion.section
            key="build"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]"
          >
            {/* left list, like the mode selector */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-3 bg-white/[0.035] px-4 py-3">
                <span
                  className={`font-display text-lg font-extrabold uppercase tracking-wide ${
                    advanced ? "text-mute" : "text-text"
                  }`}
                >
                  Simple
                </span>
                <button
                  role="switch"
                  aria-checked={advanced}
                  aria-label="Advanced mode"
                  onClick={() => setAdvanced((v) => !v)}
                  className={`relative h-7 w-14 shrink-0 border transition-colors before:absolute before:-inset-2 before:content-[''] ${
                    advanced ? "border-codm bg-codm/25" : "border-line bg-black/50"
                  }`}
                >
                  <motion.span
                    layout
                    transition={{ type: "spring", stiffness: 600, damping: 38 }}
                    className={`absolute top-0.5 h-[22px] w-6 ${
                      advanced ? "right-0.5 bg-codm" : "left-0.5 bg-mute"
                    }`}
                  />
                </button>
                <span
                  className={`font-display text-lg font-extrabold uppercase tracking-wide ${
                    advanced ? "text-codm" : "text-mute"
                  }`}
                >
                  Advanced
                </span>
              </div>
              <ul
                className="flex flex-col gap-1"
                aria-label="Adjustment groups"
                hidden={!advanced}
                onKeyDown={(e) => {
                  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
                  e.preventDefault();
                  const i = ADVANCED_PANELS.indexOf(panel);
                  const next = ADVANCED_PANELS[(i + (e.key === "ArrowDown" ? 1 : ADVANCED_PANELS.length - 1)) % ADVANCED_PANELS.length];
                  setPanel(next);
                  const buttons = e.currentTarget.querySelectorAll("button");
                  buttons[ADVANCED_PANELS.indexOf(next)]?.focus();
                }}
              >
                {ADVANCED_PANELS.map((p) => {
                  const active = p === panel;
                  const z = settings.zones[p];
                  return (
                    <li key={p}>
                      <button
                        onClick={() => setPanel(p)}
                        aria-current={active}
                        className="relative flex w-full items-center justify-between overflow-hidden px-4 py-3 text-left"
                      >
                        {active && (
                          <motion.span
                            layoutId="row-active"
                            className="row-active absolute inset-0"
                            transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          />
                        )}
                        {!active && <span className="absolute inset-0 bg-white/[0.035] hover:bg-white/[0.07]" />}
                        <span
                          className={`relative font-display text-xl font-extrabold uppercase tracking-wide ${
                            active ? "text-[#0b0f05]" : ""
                          }`}
                        >
                          {PANEL_INFO[p].label}
                        </span>
                        {z && (
                          <span
                            className="relative h-3 w-3 rotate-45 border border-black/40"
                            style={{ background: hsl(z.hue, z.tint < 3 ? 0 : 85) }}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

            </div>

            {/* right: preview + controls */}
            <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[1fr_380px]">
              <div className="contents xl:flex xl:flex-col xl:gap-4">
                <Preview
                  settings={settings}
                  source={source}
                  onUpload={upload}
                  onClear={() => setSource(null)}
                  view={view}
                  snapshot={snapshot}
                  onPin={() => {
                    setSnapshot((s) => (s ? null : settings));
                    notify(snapshot ? { title: "Before cleared" } : { title: "Before pinned", detail: "Wipe to compare with your edits.", tone: "good" });
                  }}
                  onFullscreen={() => act("fullscreen-preview")}
                />
                {advanced && (
                  <div className="isolate flex flex-col gap-2 overflow-hidden px-3">
                    <TonalScope
                      viewRef={view}
                      settings={settings}
                      onRange={(r) =>
                        setSettings((s) => ({
                          ...s,
                          ...(r.shadowPos !== undefined && { shadowPos: r.shadowPos, shadowEdge: r.shadowPos + 100 }),
                          ...(r.highlightPos !== undefined && {
                            highlightPos: r.highlightPos,
                            highlightEdge: r.highlightPos + 100,
                          }),
                        }))
                      }
                    />
                    <p className="text-xs text-mute">
                      The in-game Range bar. Drag the blue handle to set where shadows end and the
                      amber one to set where highlights begin; the game writes each one the same way.
                    </p>
                  </div>
                )}
              </div>

              <div className="cut flex flex-col gap-4 border border-line bg-panel/95 p-5">
                <QuickTweaks settings={settings} onChange={(next, label) => setSettings(next, label)} />
                <AnimatePresence mode="wait">
                  <motion.div
                    key={panel}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col gap-4"
                  >
                    {(advanced ? !flat(settings.zones.global) : usesAdvanced(settings)) && (
                      <p className="flex items-start justify-between gap-3 border-l-2 border-codm bg-codm/10 px-3 py-2 text-xs">
                        <span>
                          {advanced
                            ? `This code also carries a Simple colour (Preset #${settings.preset + 1}).`
                            : "This code also carries Advanced values (shadows, midtones, highlights)."}
                        </span>
                        <button
                          onClick={() =>
                            setSettings((s) =>
                              advanced
                                ? { ...s, zones: { ...s.zones, global: { hue: 0, tint: 0, sat: 50, bri: 50 } } }
                                : { ...defaultSettings(), preset: s.preset, zones: { ...defaultSettings().zones, global: s.zones.global } },
                            )
                          }
                          className="shrink-0 font-display font-bold uppercase tracking-wider text-codm hover:text-codm-light"
                        >
                          Clear
                        </button>
                      </p>
                    )}
                    <div>
                      <h2 className="font-display text-3xl font-extrabold uppercase leading-none">
                        {PANEL_INFO[panel].label}
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-mute">{PANEL_INFO[panel].desc}</p>
                    </div>

                    {                      (() => {
                        const k = panel;
                        const z = settings.zones[k];
                        const hp = hueParts(z.hue, hueHint[k]);
                        return (
                          <div className="flex flex-col gap-3">
                            {k === "global" && (
                              <div className="grid grid-cols-5 gap-1" role="group" aria-label="Simple preset slot">
                                {[0, 1, 2, 3, 4].map((i) => (
                                  <button
                                    key={i}
                                    aria-pressed={settings.preset === i}
                                    onClick={() => setSettings((s) => ({ ...s, preset: i }))}
                                    className={`px-1 py-2 font-display text-sm font-bold ${
                                      settings.preset === i
                                        ? "bg-[#6d6a1f] text-codm-light"
                                        : "bg-panel-2 text-mute hover:text-text"
                                    }`}
                                  >
                                    Preset #{i + 1}
                                  </button>
                                ))}
                              </div>
                            )}
                            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Hue swatches">
                              {SWATCH_NAMES.map((name, i) => (
                                <button
                                  key={name}
                                  title={name}
                                  aria-label={name}
                                  aria-pressed={hp.swatch === i}
                                  onClick={() => {
                                    setHueHint((h) => ({ ...h, [k]: i }));
                                    setZone(k, { hue: hueFrom(i, hp.pos) });
                                  }}
                                  className={`relative h-11 border-2 transition-transform hover:scale-105 ${
                                    hp.swatch === i ? "border-white" : "border-black/50"
                                  }`}
                                  style={{ background: hsl(i * 45, 100, 50) }}
                                >
                                  {hp.swatch === i && (
                                    <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-[#2fae4e] text-[10px] font-bold text-white">
                                      ✓
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                            <Slider
                              label="Hue"
                              value={hp.pos}
                              min={0}
                              max={100}
                              track={`linear-gradient(90deg,${hsl(hp.swatch * 45, 100, 50)},${hsl(hp.swatch * 45 + 45, 100, 50)})`}
                              onChange={(v) => {
                                setHueHint((h) => ({ ...h, [k]: hp.swatch }));
                                setZone(k, { hue: hueFrom(hp.swatch, v) });
                              }}
                              onReset={() => setZone(k, { hue: 0 })}
                            />
                            <Slider
                              label="Tint"
                              value={z.tint}
                              min={0}
                              max={100}
                              track={`linear-gradient(90deg,#666,${hsl(z.hue)})`}
                              onChange={(v) => setZone(k, { tint: v })}
                              onReset={() => setZone(k, { tint: 0 })}
                            />
                            <Slider
                              label="Saturation"
                              value={z.sat}
                              min={0}
                              max={100}
                              track={`linear-gradient(90deg,#777,${hsl(z.hue, 100, 50)})`}
                              onChange={(v) => setZone(k, { sat: v })}
                              onReset={() => setZone(k, { sat: 50 })}
                            />
                            <Slider
                              label="Brightness"
                              value={z.bri}
                              min={0}
                              max={100}
                              track="linear-gradient(90deg,#000,#fff)"
                              onChange={(v) => setZone(k, { bri: v })}
                              onReset={() => setZone(k, { bri: 50 })}
                            />
                            <div className="flex flex-wrap gap-3">
                              <button
                                onClick={() => setZone(k, { hue: 0, tint: 0, sat: 50, bri: 50 })}
                                className="inline-flex min-h-11 items-center font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
                              >
                                ↺ Reset {PANEL_INFO[k].label}
                              </button>
                              <button
                                onClick={async () => {
                                  const ok = await copyText(JSON.stringify(settings.zones[k]));
                                  notify(ok
                                    ? { title: `${PANEL_INFO[k].label} values copied`, detail: "Paste them into any zone.", tone: "good" }
                                    : { title: "Copy failed", tone: "warn" });
                                }}
                                className="inline-flex min-h-11 items-center font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
                              >
                                ⧉ Copy values
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const raw = await navigator.clipboard.readText();
                                    const z = JSON.parse(raw) as Partial<Zone>;
                                    if ([z.hue, z.tint, z.sat, z.bri].some((v) => typeof v !== "number")) throw new Error();
                                    setZone(k, z);
                                    notify({ title: `Pasted into ${PANEL_INFO[k].label}`, tone: "good" });
                                  } catch {
                                    notify({ title: "Nothing to paste", detail: "Copy a zone's values first.", tone: "warn" });
                                  }
                                }}
                                className="inline-flex min-h-11 items-center font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
                              >
                                ⇥ Paste values
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </motion.section>
        ) : (
          <Converter
            key="convert"
            onApply={(s) => {
              setSettings(s);
              setMode("build");
            }}
            onError={setError}
          />
        )}
      </AnimatePresence>

      <Notes />
      <CodeBar code={code} onLoad={loadCode} onReset={() => setSettings(defaultSettings())} />
      <ImportGuide />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onLoadCode={loadCode} />
      <ShortcutsHelp />
      <CompareMode open={compareOpen} onClose={() => setCompareOpen(false)} onLoad={loadCode} />
      <Onboarding />
      <LookInspector open={inspectOpen} code={code} onClose={() => setInspectOpen(false)} onLoad={loadCode} />
      <MyLooks open={libraryOpen} onClose={() => setLibraryOpen(false)} onLoad={loadCode} currentCode={code} />
    </div>
  );
}

// Converter

function Converter({
  onApply,
  onError,
}: {
  onApply: (s: Settings) => void;
  onError: (m: string | null) => void;
}) {
  const [target, setTarget] = useState<HTMLCanvasElement | null>(null);
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [strength, setStrength] = useState(100);

  const result = useMemo(
    () =>
      target
        ? blendSettings(defaultSettings(), analyse(pixels(target), base ? pixels(base) : null), strength / 100)
        : null,
    [target, base, strength],
  );

  const load = (set: (c: HTMLCanvasElement) => void) => async (f: File) => {
    try {
      set(await fileToCanvas(f, 960));
      onError(null);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f?.type.startsWith("image/")) load(setTarget)(f);
      }}
    >
      <div className="flex flex-col gap-4">
        <p className="border border-dashed border-line px-3 py-2 text-xs text-mute">
          Drop a reference anywhere in this section, or use the two panels below.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <DropZone
            title="Reference look"
            hint="A screenshot with the colours you want, from any game or photo."
            canvas={target}
            onFile={load(setTarget)}
          />
          <DropZone
            title="Your screen"
            hint="CODM on the default filter. A similar scene to the reference makes the match much closer."
            canvas={base}
            onFile={load(setBase)}
            optional
          />
        </div>
        <p className="text-sm text-mute">
          Images stay in your browser. The converter measures the colour cast, saturation and
          brightness of the shadows, midtones and highlights, then picks slider values that push
          your screen towards the reference. Treat it as a starting point and fine-tune by eye.
        </p>
      </div>

      <div className="cut flex flex-col gap-4 border border-line bg-panel/95 p-5">
        <h2 className="font-display text-3xl font-extrabold uppercase leading-none">Result</h2>
        {!result ? (
          <p className="text-sm text-mute">Add a reference screenshot to get a code.</p>
        ) : (
          <>
            {!base && (
              <p className="border-l-2 border-codm bg-codm/10 px-3 py-2 text-xs">
                No baseline screenshot, so the values are toned down. Add one for a closer match.
              </p>
            )}
            <label className="grid gap-1 border border-line bg-panel-2/60 p-3">
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-display text-sm font-bold uppercase tracking-wider">Match strength</span>
                <span className="font-mono text-xs text-codm-light">{strength}%</span>
              </span>
              <input
                type="range"
                className="slider"
                min={25}
                max={150}
                step={5}
                value={strength}
                style={{ ["--track" as string]: "linear-gradient(90deg,#666,#ffea3b)" }}
                onChange={(e) => setStrength(Number(e.target.value))}
              />
              <span className="text-[11px] text-mute">
                At 100% the code matches the measurement; 50% keeps half the effect.
              </span>
            </label>
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
                {(ZONE_TABS).map((k) => {
                  const z = result.zones[k];
                  return (
                    <tr key={k} className="border-t border-line">
                      <td className="py-2 font-display font-bold uppercase tracking-wide">
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rotate-45"
                          style={{ background: hsl(z.hue) }}
                        />
                        {PANEL_INFO[k].label}
                      </td>
                      <td>
                        {SWATCH_NAMES[hueParts(z.hue).swatch]} {r(hueParts(z.hue).pos)}
                      </td>
                      <td>{r(z.tint)}</td>
                      <td>{r(z.sat)}</td>
                      <td>{r(z.bri)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <code className="block break-all bg-black/50 p-3 font-mono text-xs text-codm">
              {encode(result)}
            </code>
            <button
              onClick={() => onApply(result)}
              className="cut bg-codm px-4 py-3 font-display text-lg font-extrabold uppercase tracking-wider text-black transition-colors hover:bg-codm-light"
            >
              Open in generator
            </button>
            <button
              onClick={() => copyCode(encode(result), "Screenshot match")}
              className="cut-sm min-h-12 border border-line bg-panel-2 px-4 font-display text-sm font-bold uppercase tracking-wider hover:bg-line"
            >
              Copy this code
            </button>
          </>
        )}
      </div>
    </motion.section>
  );
}

// Code bar

function CodeBar({
  code,
  onLoad,
  onReset,
}: {
  code: string;
  onLoad: (c: string) => boolean;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState("");
  const [bad, setBad] = useState(false);
  const [more, setMore] = useState(false);
  const changed = useMemo(() => codeDiff(code, DEFAULT_CODE).length, [code]);
  const inputOk = normalizeCode(input) !== null;

  const copy = async () => {
    await copyCode(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  const downloadText = () => {
    const blob = new Blob([`CODM Filter Lab share code\n${code}\n\nUnofficial fan-made tool.`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `codm-${code.slice(0, 12)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/90 backdrop-blur-md">
      {more && (
        <div className="mx-auto flex max-w-[1400px] flex-wrap gap-2 border-b border-line px-4 py-2 sm:px-8">
          <button
            onClick={async () => {
              const ok = await copyText(`${location.origin}${location.pathname}#c=${code}`);
              notify(ok ? { title: "Link copied", detail: "Opens with this grade loaded.", tone: "good" } : { title: "Copy failed", tone: "warn" });
            }}
            className="min-h-11 border border-line bg-panel-2 px-3 font-display text-xs font-bold uppercase tracking-wide hover:bg-line"
          >
            ⧉ Copy link to grade
          </button>
          <button
            onClick={async () => {
              const data = { title: "CODM Filter Lab", text: `CODM filter code: ${code}`, url: `${location.origin}${location.pathname}#c=${code}` };
              if (navigator.share) {
                try { await navigator.share(data); return; } catch {}
              }
              const ok = await copyText(code);
              notify(ok ? { title: "Code copied", tone: "good" } : { title: "Copy failed", tone: "warn" });
            }}
            className="min-h-11 border border-line bg-panel-2 px-3 font-display text-xs font-bold uppercase tracking-wide hover:bg-line"
          >
            ↗ Share code
          </button>
          <button onClick={downloadText} className="min-h-11 border border-line bg-panel-2 px-3 font-display text-xs font-bold uppercase tracking-wide hover:bg-line">
            ⤓ Save .txt
          </button>
          <button onClick={() => act("save-look")} className="min-h-11 border border-line bg-panel-2 px-3 font-display text-xs font-bold uppercase tracking-wide hover:bg-line">
            ☆ Save look
          </button>
        </div>
      )}
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-8 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="hidden font-display text-xs font-bold uppercase tracking-[0.2em] text-mute sm:block">
            Share code
          </span>
          <output
            aria-live="polite"
            className="min-w-0 flex-1 truncate bg-black/50 px-3 py-2 font-mono text-sm text-codm"
            title={code}
          >
            {code}
          </output>
          <span
            title={`${changed} of 22 values differ from the in-game default`}
            className="hidden shrink-0 font-mono text-[10px] text-mute lg:block"
          >
            {changed}/22 changed
          </span>
          <button
            onClick={copy}
            className="cut-sm relative min-w-28 bg-codm px-4 py-2 font-display text-lg font-extrabold uppercase tracking-wider text-black hover:bg-codm-light"
          >
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            title="More code actions"
            className={`grid h-11 w-10 shrink-0 border border-line font-display text-base ${
              more ? "bg-codm text-black" : "bg-panel-2 text-mute hover:text-text"
            }`}
          >
            ⋯
          </button>
          <button
            onClick={() => act("open-inspector")}
            title="Decode this code"
            aria-label="Decode this share code"
            className="grid h-11 w-10 shrink-0 border border-line bg-panel-2 font-display text-base text-mute hover:border-codm hover:text-text"
          >
            ?
          </button>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const normalized = normalizeCode(input);
            const ok = normalized ? onLoad(normalized) : false;
            setBad(!ok);
            if (ok) setInput("");
          }}
        >
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setBad(false);
            }}
            placeholder="Paste a code to edit it"
            aria-label="Paste a share code"
            aria-invalid={bad}
            className={`min-h-11 w-full min-w-0 border bg-black/50 px-3 font-mono text-sm lg:w-64 ${
              bad ? "border-red-500" : inputOk ? "border-lime/60" : "border-line"
            }`}
          />
          <button
            type="submit"
            className="min-h-11 bg-panel-2 px-3 font-display font-bold uppercase tracking-wider hover:bg-line"
          >
            Load
          </button>
          <button
            type="button"
            onClick={onReset}
            className="min-h-11 px-2 font-display font-bold uppercase tracking-wider text-mute hover:text-text"
          >
            Reset
          </button>
        </form>
      </div>
      {bad && (
        <p className="mx-auto max-w-[1400px] px-4 pb-2 text-xs text-red-400 sm:px-8">
          That doesn&apos;t look like a filter code. It should be 22 numbers joined by underscores.
        </p>
      )}
    </div>
  );
}

// Notes + disclaimer

function Notes() {
  return (
    <footer className="mt-16 border-t border-line pt-8 text-sm text-mute">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mute">
          Pass it on
        </span>
        <button
          onClick={async () => {
            const url = location.origin + location.pathname;
            const data = { title: "CODM Filter Lab", text: "Colour filter share codes for Call of Duty: Mobile", url };
            if (navigator.share) {
              try {
                await navigator.share(data);
                return;
              } catch {}
            }
            const ok = await copyText(url);
            notify(ok
              ? { title: "Link copied", detail: "Send it to your squad.", tone: "good" }
              : { title: "Could not copy", tone: "warn" });
          }}
          className="cut-sm min-h-11 bg-codm px-4 font-display text-sm font-extrabold uppercase tracking-wider text-black hover:bg-codm-light"
        >
          Share this tool
        </button>
        <button
          onClick={() => act("revisit-onboarding")}
          className="min-h-11 border border-line px-3 font-display text-sm font-bold uppercase tracking-wider text-mute hover:border-mute hover:text-text"
        >
          Replay quick tour
        </button>
        <button
          onClick={() => act("open-help")}
          className="min-h-11 border border-line px-3 font-display text-sm font-bold uppercase tracking-wider text-mute hover:border-mute hover:text-text"
        >
          Shortcuts
        </button>
        <Changelog />
      </div>
      <div className="grid gap-8 md:grid-cols-3">
      <div>
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-text">
          How to use a code
        </h2>
        <p>
          In CODM go to Settings → Audio and Graphics, pick a mode tab (MP, BR, DMZ: Recon…), then
          under its Graphic Style tap Import → Go, choose a Custom slot, paste the code into
          &ldquo;Enter the Share code&rdquo; and tap Apply. Share copies your current code; Customize
          Color (where the mode has it) fine-tunes it.
        </p>
      </div>
      <div>
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-text">
          Experimental
        </h2>
        <p>
          The code format was worked out from shared codes, not from any official spec. The preview
          is an approximation of the in-game filter, so check the result in game.
        </p>
      </div>
      <div>
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-text">
          Disclaimer
        </h2>
        <p>
          A fan-made project. Not affiliated with, endorsed by or connected to Activision, TiMi
          Studio Group or Tencent. Call of Duty and Call of Duty: Mobile are trademarks of their
          respective owners.
        </p>
      </div>
      </div>
    </footer>
  );
}
