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
  fitReference,
  readReference,
  scoreReference,
  type CodeGroup,
  type Settings,
  type Zone,
  type ZoneKey,
  SWATCH_NAMES,
  hueFrom,
  hueParts,
} from "@/lib/codm";
import LooksGallery from "@/components/LooksGallery";
import ImportGuide, { copyCode } from "@/components/ImportGuide";
import TonalScope from "@/components/TonalScope";
import CodeAnatomy from "@/components/CodeAnatomy";
import { createGradeGpu, type GradeGpu } from "@/lib/gpuGrade";
import { previewDrawn } from "@/lib/previewBus";
import { useHistory } from "@/lib/useHistory";

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

function sampleCanvas() {
  const c = document.createElement("canvas");
  c.width = 960;
  c.height = 540;
  drawSample(c.getContext("2d")!, c.width, c.height);
  return c;
}

// Small UI pieces

function Slider({
  label,
  value,
  min,
  max,
  track,
  neutral,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  track: string;
  /** Value at which this control changes nothing; marked on the track. */
  neutral?: number;
  onChange: (v: number) => void;
}) {
  // The number field keeps what was typed until it is committed, so clearing it
  // or typing "1" on the way to "12" does not snap the slider to the minimum.
  const [draft, setDraft] = useState<string | null>(null);
  const commit = (raw: string) => {
    const v = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(v)) onChange(Math.min(max, Math.max(min, Math.round(v))));
    setDraft(null);
  };
  return (
    <label className="grid grid-cols-[6.5rem_1fr_3.75rem] items-center gap-3">
      <span className="font-display text-sm font-bold uppercase tracking-wider text-mute">
        {label}
      </span>
      <span className="relative block">
        <input
          type="range"
          className="slider"
          min={min}
          max={max}
          step={1}
          value={r(value)}
          style={{ ["--track" as string]: track }}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
        {neutral !== undefined && neutral > min && neutral < max && (
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-1/2 h-[14px] w-px translate-y-1/2 bg-white/45"
            style={{ left: `calc(${((neutral - min) / (max - min)) * 100}% )` }}
          />
        )}
      </span>
      <input
        type="number"
        aria-label={`${label} value`}
        min={min}
        max={max}
        inputMode="numeric"
        value={draft ?? String(r(value))}
        onFocus={(e) => {
          setDraft(String(r(value)));
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(e.currentTarget.value);
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setDraft(null);
            e.currentTarget.blur();
          }
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
}: {
  settings: Settings;
  source: HTMLCanvasElement | null;
  onUpload: (f: File) => void;
  onClear: () => void;
  view: React.RefObject<HTMLCanvasElement | null>;
}) {
  const [sample, setSample] = useState(() => (typeof document === "undefined" ? null : sampleCanvas()));
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
  const [split, setSplit] = useState(0);
  const wipe = useRef<{ x: number; y: number; on: boolean } | null>(null);
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
  }, [view]);
  useEffect(() => {
    if (gpuOk && src) gpu.current?.setSource(src);
  }, [gpuOk, src]);
  useEffect(() => {
    if (!gpuOk || !src) return;
    const id = requestAnimationFrame(() => {
      gpu.current?.render(settings, split);
      previewDrawn();
    });
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
      previewDrawn();
    });
    return () => cancelAnimationFrame(id);
  }, [orig, graded, split, view]);

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
        <div className="pointer-events-none absolute left-3 top-3 flex gap-2 font-display text-xs font-bold uppercase tracking-widest">
          {split > 0 && <span className="bg-black/70 px-2 py-0.5 text-mute">Original</span>}
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
  const [settings, setSettingsRaw] = useState<Settings>(defaultSettings);
  // One gesture (a slider drag, a swatch click) is one undo step.
  const edits = useHistory(settings, setSettingsRaw, (a, b) => encode(a) === encode(b));
  const setSettings = useCallback(
    (next: Settings | ((s: Settings) => Settings)) => setSettingsRaw(next),
    [],
  );

  // Ctrl/⌘ Z and Ctrl/⌘ ⇧ Z anywhere on the page, except while typing in a
  // field where the browser's own undo is the right answer.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      e.preventDefault();
      if (e.shiftKey) edits.redo();
      else edits.undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [edits]);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const code = useMemo(() => encode(settings), [settings]);

  // restore from #c=<code>, keep the hash in sync so the URL is shareable
  useEffect(() => {
    const m = location.hash.match(/c=([-\d_]+)/);
    const s = m && decode(m[1]);
    // one-off read of the URL on load; the page is statically rendered so it can't go in initial state
    if (!s) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(s);
    setAdvanced(usesAdvanced(s) || s.zones.global.tint < 3);
  }, [setSettings]);
  useEffect(() => {
    history.replaceState(null, "", `#c=${code}`);
  }, [code]);

  const [hueHint, setHueHint] = useState<Partial<Record<ZoneKey, number>>>({});
  const setZone = useCallback(
    (k: ZoneKey, patch: Partial<Zone>) => {
      setSettings((s) => ({ ...s, zones: { ...s.zones, [k]: { ...s.zones[k], ...patch } } }));
    },
    [setSettings],
  );

  const loadCode = useCallback((c: string) => {
    const s = decode(c);
    if (!s) return false;
    setSettings(s);
    setAdvanced(usesAdvanced(s) || s.zones.global.tint < 3);
    return true;
  }, [setSettings]);

  // Code anatomy taps land on the matching control: a group selects its zone,
  // the header group points at the Range bar, which has no panel of its own.
  const goToGroup = useCallback((group: CodeGroup) => {
    if (group === "header") {
      document.getElementById("tonal-range")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setAdvanced(true);
    setPanel(group as ZoneKey);
  }, []);

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
      <a
        href="#editor"
        className="sr-only rounded-none bg-codm px-4 py-3 font-display font-bold uppercase tracking-wider text-black focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to the generator
      </a>
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
        <div className="flex items-end gap-3">
        <div className="flex gap-1" role="group" aria-label="History">
          <button
            onClick={edits.undo}
            disabled={!edits.canUndo}
            title="Undo (Ctrl/⌘ Z)"
            aria-label="Undo"
            className="min-h-11 min-w-11 border border-line bg-panel/80 px-2 font-display text-lg font-bold text-text transition-colors hover:border-mute disabled:cursor-not-allowed disabled:border-line disabled:text-mute/40 disabled:hover:border-line"
          >
            ↶
          </button>
          <button
            onClick={edits.redo}
            disabled={!edits.canRedo}
            title="Redo (Ctrl/⌘ ⇧ Z)"
            aria-label="Redo"
            className="min-h-11 min-w-11 border border-line bg-panel/80 px-2 font-display text-lg font-bold text-text transition-colors hover:border-mute disabled:cursor-not-allowed disabled:border-line disabled:text-mute/40 disabled:hover:border-line"
          >
            ↷
          </button>
        </div>
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
              <ul className="flex flex-col gap-1" aria-label="Adjustment groups" hidden={!advanced}>
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
                            />
                            <Slider
                              label="Tint"
                              value={z.tint}
                              min={0}
                              max={100}
                              neutral={0}
                              track={`linear-gradient(90deg,#666,${hsl(z.hue)})`}
                              onChange={(v) => setZone(k, { tint: v })}
                            />
                            <Slider
                              label="Saturation"
                              value={z.sat}
                              min={0}
                              max={100}
                              neutral={50}
                              track={`linear-gradient(90deg,#777,${hsl(z.hue, 100, 50)})`}
                              onChange={(v) => setZone(k, { sat: v })}
                            />
                            <Slider
                              label="Brightness"
                              value={z.bri}
                              min={0}
                              max={100}
                              neutral={50}
                              track="linear-gradient(90deg,#000,#fff)"
                              onChange={(v) => setZone(k, { bri: v })}
                            />
                            <button
                              onClick={() => setZone(k, { hue: 0, tint: 0, sat: 50, bri: 50 })}
                              className="inline-flex min-h-11 items-center self-start font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
                            >
                              Reset {PANEL_INFO[k].label}
                            </button>
                          </div>
                        );
                      })()}
                  </motion.div>
                </AnimatePresence>
                <CodeAnatomy code={code} onPick={goToGroup} />
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
  // The fit belongs to the screenshots it was computed from: a new upload makes
  // `from` stale and the analyser's suggestion takes over again, with no effect.
  const [fit, setFit] = useState<{ from: Settings | null; result: Settings } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  // Read each upload once. Everything after this is cheap enough to run on a
  // slider tick, which is what lets the score move live.
  const targetPx = useMemo(() => (target ? pixels(target) : null), [target]);
  const basePx = useMemo(() => (base ? pixels(base) : null), [base]);
  const ref = useMemo(
    () => (targetPx ? readReference(targetPx, basePx) : null),
    [targetPx, basePx],
  );
  const suggestion = useMemo(
    () => (targetPx ? analyse(targetPx, basePx) : null),
    [targetPx, basePx],
  );
  const result = fit && fit.from === suggestion ? fit.result : suggestion;
  const score = ref && result ? scoreReference(ref, result) : 0;
  const verdict =
    score >= 85 ? "Very close" : score >= 65 ? "Strong match" : score >= 40 ? "In the region" : "A starting point";

  const load = (set: (c: HTMLCanvasElement) => void) => async (f: File) => {
    try {
      set(await fileToCanvas(f, 960));
      onError(null);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  const autoMatch = () => {
    if (!ref || !result) return;
    setBusy(true);
    // let the button's busy state paint before the hill-climb block
    setTimeout(() => {
      setFit({ from: result, result: fitReference(ref, result) });
      setBusy(false);
    }, 30);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]"
    >
      <div className="flex flex-col gap-4">
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
          your screen towards the reference. Auto-match then searches for the closest code it can
          find and scores it, so you can see how near you are instead of guessing.
        </p>
      </div>

      <div className="cut flex flex-col gap-4 border border-line bg-panel/95 p-5">
        <h2 className="font-display text-3xl font-extrabold uppercase leading-none">Result</h2>
        {!result || !ref ? (
          <p className="text-sm text-mute">Add a reference screenshot to get a code.</p>
        ) : (
          <>
            <div>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="font-display text-[11px] font-bold uppercase tracking-[0.2em] text-mute">
                    Match
                  </p>
                  <p className="font-title text-5xl font-black leading-none tabular-nums">
                    {score}
                    <span className="ml-0.5 text-xl text-mute">%</span>
                  </p>
                </div>
                <p className="pb-1 text-right font-display text-sm font-bold uppercase tracking-wider text-codm">
                  {verdict}
                </p>
              </div>
              <div
                role="meter"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score}
                aria-label="Match to the reference"
                className="mt-2 h-2 w-full bg-black/60"
              >
                <div
                  className="h-full bg-gradient-to-r from-codm-deep via-codm to-lime"
                  style={{ width: `${score}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-mute">
                {base
                  ? "Measured from your reference and your screen."
                  : "No baseline screenshot, so this compares against a typical scene and will read low."}
              </p>
            </div>

            <button
              onClick={autoMatch}
              disabled={busy}
              className="cut bg-lime px-4 py-3 font-display text-lg font-extrabold uppercase tracking-wider text-black transition-colors hover:brightness-110 disabled:opacity-60"
            >
              {busy ? "Matching…" : fit ? "Auto-match again" : "Auto-match"}
            </button>

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
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onApply(result)}
                className="cut flex-1 bg-codm px-4 py-3 font-display text-lg font-extrabold uppercase tracking-wider text-black transition-colors hover:bg-codm-light"
              >
                Open in generator
              </button>
              <button
                onClick={async () => {
                  const ok = await copyCode(encode(result));
                  setCopied(ok);
                  setTimeout(() => setCopied(false), 1400);
                }}
                className="min-h-11 bg-panel-2 px-4 font-display font-bold uppercase tracking-wider hover:bg-line"
              >
                {copied ? "Copied ✓" : "Copy code"}
              </button>
            </div>
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
  const [copyState, setCopyState] = useState<"idle" | "ok" | "fail">("idle");
  const [input, setInput] = useState("");
  const [bad, setBad] = useState(false);
  const out = useRef<HTMLOutputElement>(null);
  // The visible code changes on every slider tick; a live region on it would
  // read 22 numbers per pixel of drag. Announce a settled code instead.
  const [announce, setAnnounce] = useState("");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => setAnnounce(`Share code updated: ${code}`), 900);
    return () => clearTimeout(t);
  }, [code]);

  const copy = async () => {
    const ok = await copyCode(code);
    setCopyState(ok ? "ok" : "fail");
    // A blocked clipboard is recoverable: select the code so ⌘C works.
    if (!ok && out.current) {
      const range = document.createRange();
      range.selectNodeContents(out.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    setTimeout(() => setCopyState("idle"), 1600);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-4 py-3 sm:px-8 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="hidden font-display text-xs font-bold uppercase tracking-[0.2em] text-mute sm:block">
            Share code
          </span>
          <output
            ref={out}
            className="min-w-0 flex-1 truncate bg-black/50 px-3 py-2 font-mono text-sm text-codm"
            title={code}
          >
            {code}
          </output>
          <p className="sr-only" role="status">
            {announce}
          </p>
          <button
            onClick={copy}
            className={`cut-sm relative min-w-28 px-4 py-2 font-display text-lg font-extrabold uppercase tracking-wider ${
              copyState === "fail"
                ? "bg-panel-2 text-codm ring-1 ring-codm"
                : copyState === "ok"
                  ? "bg-lime text-black"
                  : "bg-codm text-black hover:bg-codm-light"
            }`}
          >
            {copyState === "ok" ? "Copied ✓" : copyState === "fail" ? "Select it ⤴" : "Copy"}
          </button>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const ok = onLoad(input);
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
              bad ? "border-red-500" : "border-line"
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
    <footer className="mt-16 grid gap-8 border-t border-line pt-8 text-sm text-mute md:grid-cols-3">
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
    </footer>
  );
}
