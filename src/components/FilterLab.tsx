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
  SWATCH_NAMES,
  hueFrom,
  hueParts,
} from "@/lib/codm";
import LooksGallery from "@/components/LooksGallery";

type Mode = "build" | "convert";
type Panel = ZoneKey | "range";


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
  range: {
    label: "Range",
    desc: "Where shadows stop and highlights begin. Drag the shadows handle right to push the shadow colour into darker midtones; drag the highlights handle left to spread the highlight colour down.",
  },
};

const ZONE_TABS: ZoneKey[] = ["shadows", "midtones", "highlights"];
const ADVANCED_PANELS: Panel[] = ["shadows", "midtones", "highlights", "range"];

const flat = (z: Zone) => z.tint < 3 && Math.abs(z.sat - 50) < 1 && Math.abs(z.bri - 50) < 1;
/** True when the code carries Advanced (shadows / midtones / highlights) values. */
const usesAdvanced = (s: Settings) => !ZONE_TABS.every((k) => flat(s.zones[k]));

const r = Math.round;
const hsl = (h: number, s = 90, l = 55) => `hsl(${r(h)} ${s}% ${l}%)`;

/* ---------- image helpers ---------- */

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

/* ---------- small UI pieces ---------- */

function Slider({
  label,
  value,
  min,
  max,
  track,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  track: string;
  onChange: (v: number) => void;
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
        className="w-full border border-line bg-black/40 px-1.5 py-1 text-right font-mono text-sm tabular-nums"
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

/* ---------- preview ---------- */

function Preview({
  settings,
  source,
  onUpload,
  onClear,
}: {
  settings: Settings;
  source: HTMLCanvasElement | null;
  onUpload: (f: File) => void;
  onClear: () => void;
}) {
  const view = useRef<HTMLCanvasElement>(null);
  const [sample] = useState(() => (typeof document === "undefined" ? null : sampleCanvas()));
  const [split, setSplit] = useState(0);
  const src = source ?? sample;

  // Original pixels, read once per image.
  const orig = useMemo(
    () => src?.getContext("2d")?.getImageData(0, 0, src.width, src.height) ?? null,
    [src],
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
    <div className="flex flex-col gap-3">
      <div className="cut relative overflow-hidden border border-line bg-black">
        <canvas ref={view} className="block aspect-video h-auto w-full object-contain" />
        <div className="pointer-events-none absolute left-3 top-3 flex gap-2 font-display text-xs font-bold uppercase tracking-widest">
          {split > 0 && <span className="bg-black/70 px-2 py-0.5 text-mute">Original</span>}
          <span className="bg-codm px-2 py-0.5 text-black">Filtered · approx.</span>
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
        <label className="cut-sm cursor-pointer bg-panel-2 px-3 py-2 font-display text-sm font-bold uppercase tracking-wider hover:bg-line">
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

/* ---------- main ---------- */

export default function FilterLab() {
  const [mode, setMode] = useState<Mode>("build");
  const [advanced, setAdvanced] = useState(true);
  const [tab, setPanel] = useState<Panel>("highlights");
  // Simple mode has one screen; Advanced never shows it.
  const panel: Panel = !advanced ? "global" : tab === "global" ? "shadows" : tab;
  const [settings, setSettings] = useState<Settings>(defaultSettings);
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
  }, []);
  useEffect(() => {
    history.replaceState(null, "", `#c=${code}`);
  }, [code]);

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
      {/* top bar */}
      <header className="flex flex-wrap items-end justify-between gap-4 pt-6 sm:pt-10">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/codm-logo.svg"
            alt="Call of Duty: Mobile"
            width={1442}
            height={479}
            className="mb-4 h-10 w-auto sm:h-12"
          />
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.3em] text-codm"
          >
            <span className="inline-block h-2 w-2 rotate-45 bg-codm" />
            Unofficial fan-made tool
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="font-title text-5xl font-black uppercase leading-[0.95] tracking-wide sm:text-7xl"
          >
            Filter Lab
          </motion.h1>
          <p className="mt-2 max-w-xl text-mute">
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
                  className={`relative h-7 w-14 shrink-0 border transition-colors ${
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
                  const z = p !== "range" ? settings.zones[p] : null;
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
            <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
              <Preview
                settings={settings}
                source={source}
                onUpload={upload}
                onClear={() => setSource(null)}
              />

              <div className="cut flex flex-col gap-4 border border-line bg-panel/85 p-5 backdrop-blur">
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

                    {panel === "range" ? (
                      <div className="flex flex-col gap-3">
                        <Slider
                          label="Shadows"
                          value={settings.shadowPos / 10}
                          min={0}
                          max={100}
                          track="linear-gradient(90deg,#000,#777)"
                          onChange={(v) =>
                            setSettings((s) => {
                              const pos = Math.min(v * 10, s.highlightPos);
                              return { ...s, shadowPos: pos, shadowEdge: pos + 100 };
                            })
                          }
                        />
                        <Slider
                          label="Highlights"
                          value={settings.highlightPos / 10}
                          min={0}
                          max={100}
                          track="linear-gradient(90deg,#777,#fff)"
                          onChange={(v) =>
                            setSettings((s) => {
                              const pos = Math.max(v * 10, s.shadowPos);
                              return { ...s, highlightPos: pos, highlightEdge: pos + 100 };
                            })
                          }
                        />
                        <p className="text-xs text-mute">
                          The two handles of the in-game Range bar, as a percentage of its width.
                          Moving a handle writes it the same way the game does.
                        </p>
                      </div>
                    ) : (
                      (() => {
                        const k = panel;
                        const z = settings.zones[k];
                        const hp = hueParts(z.hue);
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
                                  onClick={() => setZone(k, { hue: hueFrom(i, hp.pos) })}
                                  className={`relative h-10 border-2 transition-transform hover:scale-105 ${
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
                              onChange={(v) => setZone(k, { hue: hueFrom(hp.swatch, v) })}
                            />
                            <Slider
                              label="Tint"
                              value={z.tint}
                              min={0}
                              max={100}
                              track={`linear-gradient(90deg,#666,${hsl(z.hue)})`}
                              onChange={(v) => setZone(k, { tint: v })}
                            />
                            <Slider
                              label="Saturation"
                              value={z.sat}
                              min={0}
                              max={100}
                              track={`linear-gradient(90deg,#777,${hsl(z.hue, 100, 50)})`}
                              onChange={(v) => setZone(k, { sat: v })}
                            />
                            <Slider
                              label="Brightness"
                              value={z.bri}
                              min={0}
                              max={100}
                              track="linear-gradient(90deg,#000,#fff)"
                              onChange={(v) => setZone(k, { bri: v })}
                            />
                            <button
                              onClick={() => setZone(k, { hue: 0, tint: 0, sat: 50, bri: 50 })}
                              className="self-start font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
                            >
                              Reset {PANEL_INFO[k].label}
                            </button>
                          </div>
                        );
                      })()
                    )}
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
    </div>
  );
}

/* ---------- converter ---------- */

function Converter({
  onApply,
  onError,
}: {
  onApply: (s: Settings) => void;
  onError: (m: string | null) => void;
}) {
  const [target, setTarget] = useState<HTMLCanvasElement | null>(null);
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);

  const result = useMemo(
    () => (target ? analyse(pixels(target), base ? pixels(base) : null) : null),
    [target, base],
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
          your screen towards the reference. Treat it as a starting point and fine-tune by eye.
        </p>
      </div>

      <div className="cut flex flex-col gap-4 border border-line bg-panel/85 p-5 backdrop-blur">
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
          </>
        )}
      </div>
    </motion.section>
  );
}

/* ---------- code bar ---------- */

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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const t = document.createElement("textarea");
      t.value = code;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/90 backdrop-blur-md">
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
          <button
            onClick={copy}
            className="cut-sm relative min-w-28 bg-codm px-4 py-2 font-display text-lg font-extrabold uppercase tracking-wider text-black hover:bg-codm-light"
          >
            {copied ? "Copied" : "Copy"}
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
            className={`w-full min-w-0 border bg-black/50 px-3 py-2 font-mono text-sm lg:w-64 ${
              bad ? "border-red-500" : "border-line"
            }`}
          />
          <button
            type="submit"
            className="bg-panel-2 px-3 py-2 font-display font-bold uppercase tracking-wider hover:bg-line"
          >
            Load
          </button>
          <button
            type="button"
            onClick={onReset}
            className="px-2 py-2 font-display font-bold uppercase tracking-wider text-mute hover:text-text"
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

/* ---------- notes + disclaimer ---------- */

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
