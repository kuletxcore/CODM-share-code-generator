"use client";

import { motion } from "motion/react";
import { useState } from "react";
import {
  SWATCH_NAMES,
  hasAdvanced,
  hueFrom,
  hueParts,
  zoneIsNeutral,
  type Settings,
  type Zone,
  type ZoneKey,
} from "@/lib/codm";

const r = Math.round;
const hsl = (h: number, s = 90, l = 55) => `hsl(${r(h)} ${s}% ${l}%)`;

const PANEL_INFO: Record<ZoneKey, { label: string; desc: string; hint: string }> = {
  shadows: {
    label: "Shadows",
    desc: "Interiors, foliage, the underside of cover.",
    hint: "Cool shadows read as depth; warm ones read as sunset.",
  },
  midtones: {
    label: "Midtones",
    desc: "Most of what you look at: walls, terrain, operators.",
    hint: "Small moves here go a long way.",
  },
  highlights: {
    label: "Highlights",
    desc: "Sky, sunlit surfaces, bright paint.",
    hint: "Warm highlights read as daylight, cool ones as overcast.",
  },
  global: {
    label: "Simple",
    desc: "The game's Simple Customize Color screen — colours the whole image.",
    hint: "Advanced colours (shadows, mids, highlights) layer on top of it.",
  },
};

const ZONES: ZoneKey[] = ["shadows", "midtones", "highlights"];

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
    <div className="grid grid-cols-[5.5rem_1fr_3.25rem] items-center gap-2.5">
      <label
        htmlFor={`s-${label}`}
        className="font-display text-xs font-bold uppercase tracking-[0.14em] text-mute"
      >
        {label}
      </label>
      <input
        id={`s-${label}`}
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
        className="w-full border border-line bg-black/40 px-1 py-0.5 text-right font-mono text-xs tabular-nums"
      />
    </div>
  );
}

export default function Editor({
  settings,
  setSettings,
  setZone,
  advanced,
  setAdvanced,
  panel,
  setPanel,
  onHoverZone,
  onReset,
  className = "",
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setZone: (k: ZoneKey, patch: Partial<Zone>) => void;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  panel: ZoneKey;
  setPanel: (p: ZoneKey) => void;
  onHoverZone: (z: ZoneKey | null) => void;
  onReset: () => void;
  className?: string;
}) {
  const [hueHint, setHueHint] = useState<Partial<Record<ZoneKey, number>>>({});
  const k = panel;
  const z = settings.zones[k];
  const hp = hueParts(z.hue, hueHint[k]);
  const info = PANEL_INFO[k];

  const carriesOther = advanced ? !zoneIsNeutral(settings.zones.global) : hasAdvanced(settings);

  return (
    <aside className={`cut flex min-w-0 flex-col gap-4 border border-line bg-panel/85 p-4 backdrop-blur ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-extrabold uppercase tracking-[0.16em]">Tune</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="font-display text-[11px] font-bold uppercase tracking-wider text-mute hover:text-text"
          >
            Reset all
          </button>
          <button
            role="switch"
            aria-checked={advanced}
            aria-label="Advanced colours"
            title="Simple colours the whole image; Advanced colours shadows, mids and highlights separately"
            onClick={() => setAdvanced(!advanced)}
            className="relative h-6 w-11 shrink-0 border border-line bg-black/50"
          >
            <motion.span
              layout
              transition={{ type: "spring", stiffness: 600, damping: 38 }}
              className={`absolute top-0.5 h-4 w-4 ${advanced ? "right-0.5 bg-codm" : "left-0.5 bg-mute"}`}
            />
          </button>
        </div>
      </div>

      <div className="-mt-2 flex items-baseline justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.18em] text-mute">
          {advanced ? "Shadows · Mids · Highlights" : "Whole image"}
        </span>
        <span className="font-display text-[11px] font-bold uppercase tracking-wider text-codm">
          {advanced ? "Advanced" : "Simple"}
        </span>
      </div>

      {advanced && (
        <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Tone group">
          {ZONES.map((zone) => {
            const active = zone === k;
            const zz = settings.zones[zone];
            return (
              <button
                key={zone}
                role="tab"
                aria-selected={active}
                onClick={() => setPanel(zone)}
                onPointerEnter={() => onHoverZone(zone)}
                onPointerLeave={() => onHoverZone(null)}
                onFocus={() => onHoverZone(zone)}
                onBlur={() => onHoverZone(null)}
                className={`relative flex flex-col items-start gap-1.5 px-2 py-2 text-left transition-colors ${
                  active ? "bg-panel-2" : "bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rotate-45 border border-black/50"
                  style={{ background: hsl(zz.hue, zz.tint < 3 ? 8 : 85) }}
                />
                <span
                  className={`font-display text-xs font-bold uppercase leading-none tracking-wider ${
                    active ? "text-text" : "text-mute"
                  }`}
                >
                  {PANEL_INFO[zone].label}
                </span>
                {active && (
                  <motion.span layoutId="zone-active" className="absolute inset-x-0 -top-px h-[2px] bg-codm" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {carriesOther && (
        <p className="flex items-start justify-between gap-2 border-l-2 border-codm bg-codm/10 px-2.5 py-1.5 text-[11px] leading-snug">
          <span>
            {advanced
              ? `Also carries a Simple colour (Preset #${settings.preset + 1}).`
              : "Also carries Advanced colours."}
          </span>
          <button
            onClick={() =>
              setSettings((s) =>
                advanced
                  ? { ...s, zones: { ...s.zones, global: { hue: 0, tint: 0, sat: 50, bri: 50 } } }
                  : {
                      ...s,
                      zones: {
                        global: s.zones.global,
                        shadows: { hue: 0, tint: 0, sat: 50, bri: 50 },
                        midtones: { hue: 0, tint: 0, sat: 50, bri: 50 },
                        highlights: { hue: 0, tint: 0, sat: 50, bri: 50 },
                      },
                    },
              )
            }
            className="shrink-0 font-display text-[11px] font-bold uppercase tracking-wider text-codm hover:text-codm-light"
          >
            Clear
          </button>
        </p>
      )}

      <motion.div
        key={k}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="flex flex-col gap-3"
      >
        <div>
          <h3 className="font-display text-2xl font-extrabold uppercase leading-none">
            {info.label}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-mute">
            {info.desc} <span className="text-text/60">{info.hint}</span>
          </p>
        </div>

        {k === "global" && (
          <div className="grid grid-cols-5 gap-1" role="group" aria-label="Simple preset slot">
            {[0, 1, 2, 3, 4].map((i) => (
              <button
                key={i}
                aria-pressed={settings.preset === i}
                onClick={() => setSettings((s) => ({ ...s, preset: i }))}
                className={`px-1 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider ${
                  settings.preset === i
                    ? "bg-[#6d6a1f] text-codm-light"
                    : "bg-panel-2 text-mute hover:text-text"
                }`}
              >
                #{i + 1}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-8 gap-1" role="group" aria-label="Hue swatches">
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
              className={`relative aspect-square border-2 transition-transform hover:scale-110 ${
                hp.swatch === i ? "border-white" : "border-black/50"
              }`}
              style={{ background: hsl(i * 45, 100, 50) }}
            >
              {hp.swatch === i && (
                <span className="absolute inset-0 grid place-items-center text-[9px] font-bold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
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
        <p className="-mt-2 text-right font-mono text-[10px] uppercase tracking-wider text-mute">
          {SWATCH_NAMES[hp.swatch]} + {r(hp.pos)} · in game shows {hp.swatch * 125 + r(hp.pos * 1.25)}
        </p>
        <Slider
          label="Tint"
          value={z.tint}
          min={0}
          max={100}
          track={`linear-gradient(90deg,#5b5f59,${hsl(z.hue)})`}
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
          className="self-start font-display text-[11px] font-bold uppercase tracking-wider text-mute hover:text-text"
        >
          Reset {PANEL_INFO[k].label}
        </button>
      </motion.div>
    </aside>
  );
}
