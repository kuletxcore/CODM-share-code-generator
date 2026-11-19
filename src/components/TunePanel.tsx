"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import {
  SWATCH_NAMES,
  defaultSettings,
  flat,
  hueFrom,
  hueParts,
  usesAdvanced,
  type Settings,
  type Zone,
  type ZoneKey,
} from "@/lib/codm";

export type Panel = ZoneKey | "range";

export const PANEL_INFO: Record<Panel, { label: string; desc: string }> = {
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

export const ZONE_TABS: ZoneKey[] = ["shadows", "midtones", "highlights"];
const ADVANCED_PANELS: Panel[] = ["shadows", "midtones", "highlights", "range"];

const r = Math.round;
export const hsl = (h: number, s = 90, l = 55) => `hsl(${r(h)} ${s}% ${l}%)`;

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
    <label className="grid grid-cols-[5.75rem_1fr_3.5rem] items-center gap-2.5">
      <span className="font-display text-sm font-bold uppercase tracking-wider text-mute">{label}</span>
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

/**
 * The game's own controls, acting on the filter in the frame: Simple (one
 * colour for the whole image) or Advanced (shadows, midtones, highlights and
 * the range between them).
 */
export default function TunePanel({
  settings,
  setSettings,
  advanced,
  setAdvanced,
  chips,
  setChips,
  onLoad,
}: {
  settings: Settings;
  setSettings: Dispatch<SetStateAction<Settings>>;
  advanced: boolean;
  setAdvanced: Dispatch<SetStateAction<boolean>>;
  chips: boolean;
  setChips: Dispatch<SetStateAction<boolean>>;
  /** Loads a pasted share code; false when it is not one. */
  onLoad: (code: string) => boolean;
}) {
  const [tab, setPanel] = useState<Panel>("highlights");
  // Simple mode has one screen; Advanced never shows it.
  const panel: Panel = !advanced ? "global" : tab === "global" ? "shadows" : tab;
  const [hueHint, setHueHint] = useState<Partial<Record<ZoneKey, number>>>({});
  const [input, setInput] = useState("");
  const [bad, setBad] = useState(false);

  const setZone = useCallback(
    (k: ZoneKey, patch: Partial<Zone>) => {
      setSettings((s) => ({ ...s, zones: { ...s.zones, [k]: { ...s.zones[k], ...patch } } }));
    },
    [setSettings],
  );

  return (
    <section id="tune" aria-labelledby="tune-title" className="scroll-mt-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="tune-title" className="font-title text-2xl font-black uppercase leading-none tracking-wide sm:text-3xl">
          Tune it
        </h2>
        <div className="flex items-center gap-2.5">
          <span
            className={`font-display text-base font-extrabold uppercase tracking-wide ${advanced ? "text-mute" : "text-text"}`}
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
              className={`absolute top-0.5 h-[22px] w-6 ${advanced ? "right-0.5 bg-codm" : "left-0.5 bg-mute"}`}
            />
          </button>
          <span
            className={`font-display text-base font-extrabold uppercase tracking-wide ${advanced ? "text-codm" : "text-mute"}`}
          >
            Advanced
          </span>
        </div>
      </div>
      <p className="mt-2 text-sm text-mute">Every change shows on the frame and lands in the code.</p>
      <div className="mt-3 h-px bg-gradient-to-r from-codm/60 via-line to-transparent" />

      <ul className="mt-4 grid grid-cols-4 gap-1" aria-label="Adjustment groups" hidden={!advanced}>
        {ADVANCED_PANELS.map((p) => {
          const active = p === panel;
          const z = p !== "range" ? settings.zones[p] : null;
          return (
            <li key={p}>
              <button
                onClick={() => setPanel(p)}
                aria-current={active}
                className="relative flex w-full flex-col items-center gap-1.5 overflow-hidden px-1 pb-2 pt-2.5"
              >
                {active && (
                  <motion.span
                    layoutId="row-active"
                    className="row-active absolute inset-0"
                    transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  />
                )}
                {!active && <span className="absolute inset-0 bg-white/[0.035] hover:bg-white/[0.07]" />}
                {z ? (
                  <span
                    className="relative h-2.5 w-2.5 rotate-45 border border-black/40"
                    style={{ background: hsl(z.hue, flat(z) || z.tint < 3 ? 0 : 85) }}
                  />
                ) : (
                  <span className="relative h-2.5 w-5 border border-black/40 bg-gradient-to-r from-black to-white" />
                )}
                <span
                  className={`relative font-display text-sm font-extrabold uppercase leading-none tracking-wide sm:text-base ${
                    active ? "text-[#0b0f05]" : ""
                  }`}
                >
                  {PANEL_INFO[p].label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="cut mt-2 flex flex-col gap-4 border border-line bg-panel/85 p-4 backdrop-blur sm:p-5">
        <AnimatePresence mode="wait" initial={false}>
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
                        : {
                            ...defaultSettings(),
                            preset: s.preset,
                            zones: { ...defaultSettings().zones, global: s.zones.global },
                          },
                    )
                  }
                  className="shrink-0 font-display font-bold uppercase tracking-wider text-codm hover:text-codm-light"
                >
                  Clear
                </button>
              </p>
            )}
            <div>
              <h3 className="font-display text-2xl font-extrabold uppercase leading-none">{PANEL_INFO[panel].label}</h3>
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
                  The two handles of the in-game Range bar, as a percentage of its width. Moving a handle writes it
                  the same way the game does.
                </p>
              </div>
            ) : (
              (() => {
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
                    <div className="grid grid-cols-8 gap-1.5" role="group" aria-label="Hue swatches">
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
                          className={`relative grid h-10 place-items-center border-2 transition-transform hover:scale-105 ${
                            hp.swatch === i ? "border-white" : "border-black/50"
                          }`}
                          style={{ background: hsl(i * 45, 100, 50) }}
                        >
                          {hp.swatch === i && (
                            <svg viewBox="0 0 16 16" className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)]" aria-hidden>
                              <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="#fff" strokeWidth="2.5" />
                            </svg>
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

      <form
        className="mt-4 flex items-center gap-2"
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
          placeholder="Have a code? Paste it to edit it"
          aria-label="Paste a share code"
          aria-invalid={bad}
          aria-describedby={bad ? "paste-error" : undefined}
          className={`w-full min-w-0 border bg-black/50 px-3 py-2 font-mono text-sm placeholder:text-mute/80 ${
            bad ? "border-red-500" : "border-line"
          }`}
        />
        <button
          type="submit"
          className="bg-panel-2 px-4 py-2 font-display font-bold uppercase tracking-wider hover:bg-line"
        >
          Load
        </button>
      </form>
      {bad && (
        <p id="paste-error" role="alert" className="mt-1.5 text-xs text-red-400">
          That doesn&apos;t look like a filter code. It should be 22 numbers joined by underscores.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 font-display text-sm font-bold uppercase tracking-wider">
        <button
          aria-pressed={chips}
          onClick={() => setChips((v) => !v)}
          className={`flex items-center gap-2 ${chips ? "text-codm" : "text-mute hover:text-text"}`}
        >
          <span className="grid grid-cols-3 gap-px" aria-hidden>
            {["#e23b2e", "#8fd13f", "#2f5fd0", "#f2a71b", "#29b8d6", "#d93fa6"].map((c) => (
              <span key={c} className="h-1.5 w-1.5" style={{ background: chips ? c : "currentColor" }} />
            ))}
          </span>
          Colour chips {chips ? "on" : "off"}
        </button>
      </div>
    </section>
  );
}
