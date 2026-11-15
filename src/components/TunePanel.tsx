"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import {
  SWATCH_NAMES,
  hueFrom,
  hueParts,
  type Settings,
  type Zone,
  type ZoneKey,
} from "@/lib/codm";

const r = Math.round;
const hsl = (h: number, s = 90, l = 55) => `hsl(${r(h)} ${s}% ${l}%)`;

export type PanelKey = ZoneKey | "range";

const INFO: Record<PanelKey, { label: string; short: string }> = {
  shadows: { label: "Shadows", short: "Interiors, foliage, the dark side of cover." },
  midtones: { label: "Midtones", short: "Walls, terrain, operators — most of the frame." },
  highlights: { label: "Highlights", short: "Sky, sunlit surfaces, bright paint." },
  global: { label: "Simple", short: "The game's whole-image Customize Color screen." },
  range: { label: "Range", short: "Where the shadow colour stops and the highlight colour starts." },
};

const ZONES: ZoneKey[] = ["shadows", "midtones", "highlights"];
const TABS: PanelKey[] = ["shadows", "midtones", "highlights", "range"];
const flat = (z: Zone) => z.tint < 3 && Math.abs(z.sat - 50) < 1 && Math.abs(z.bri - 50) < 1;
const usesAdvanced = (s: Settings) => !ZONES.every((k) => flat(s.zones[k]));

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
  const id = `tune-${label.toLowerCase()}`;
  return (
    <div className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2">
      <label
        htmlFor={id}
        className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-mute"
      >
        {label}
      </label>
      <input
        id={id}
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

export default function TunePanel({
  settings,
  setSettings,
  setZone,
  advanced,
  setAdvanced,
  panel,
  setPanel,
  onReset,
  onLoad,
  focusPaste = false,
}: {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setZone: (k: ZoneKey, patch: Partial<Zone>) => void;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  panel: PanelKey;
  setPanel: (p: PanelKey) => void;
  onReset: () => void;
  onLoad: (code: string) => boolean;
  focusPaste?: boolean;
}) {
  const [hueHint, setHueHint] = useState<Partial<Record<ZoneKey, number>>>({});
  const [paste, setPaste] = useState("");
  const [bad, setBad] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const pasteRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusPaste) pasteRef.current?.focus({ preventScroll: false });
  }, [focusPaste]);

  const k = panel;
  const z = k === "range" ? null : settings.zones[k];
  const hp = z ? hueParts(z.hue, hueHint[k as ZoneKey]) : null;
  const carriesOther = advanced ? !flat(settings.zones.global) : usesAdvanced(settings);

  return (
    <aside className="flex min-w-0 flex-col gap-3 border border-line bg-panel/85 p-3 backdrop-blur sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-extrabold uppercase tracking-[0.16em]">Tune</h2>
        <button
          onClick={onReset}
          className="font-display text-[11px] font-bold uppercase tracking-wider text-mute hover:text-text"
        >
          Reset all
        </button>
      </div>

      {/* Simple colours the whole image; Advanced colours the three tone groups. */}
      <div className="grid grid-cols-2 gap-1" role="tablist" aria-label="Colour mode">
        {(
          [
            [false, "Simple"],
            [true, "Advanced"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={label}
            role="tab"
            aria-selected={advanced === value}
            onClick={() => setAdvanced(value)}
            className={`relative py-1.5 font-display text-xs font-bold uppercase tracking-wider transition-colors ${
              advanced === value ? "bg-panel-2 text-text" : "bg-white/[0.03] text-mute hover:text-text"
            }`}
          >
            {label}
            {advanced === value && (
              <motion.span layoutId="mode-underline" className="absolute inset-x-0 -bottom-px h-[2px] bg-codm" />
            )}
          </button>
        ))}
      </div>

      {advanced && (
        <div className="grid grid-cols-4 gap-1" role="tablist" aria-label="Tone group">
          {TABS.map((zone) => {
            const active = zone === k;
            const zz = zone === "range" ? null : settings.zones[zone];
            return (
              <button
                key={zone}
                role="tab"
                aria-selected={active}
                onClick={() => setPanel(zone)}
                className={`flex flex-col items-start gap-1.5 px-1.5 py-2 text-left transition-colors ${
                  active ? "bg-panel-2" : "bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                {zz ? (
                  <span
                    className="h-2.5 w-2.5 rotate-45 border border-black/50"
                    style={{ background: hsl(zz.hue, zz.tint < 3 ? 8 : 85) }}
                  />
                ) : (
                  <span className="flex h-2.5 w-2.5 items-center justify-between">
                    <span className="h-2.5 w-px bg-mute" />
                    <span className="h-2.5 w-px bg-mute" />
                  </span>
                )}
                <span
                  className={`font-display text-[10px] font-bold uppercase leading-none tracking-wider ${
                    active ? "text-text" : "text-mute"
                  }`}
                >
                  {zone === "midtones" ? "Mids" : INFO[zone].label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div>
        <h3 className="font-display text-xl font-extrabold uppercase leading-none">{INFO[k].label}</h3>
        <p className="mt-1 text-[11px] leading-snug text-mute">{INFO[k].short}</p>
      </div>

      {k === "global" && (
        <div className="grid grid-cols-5 gap-1" role="group" aria-label="Simple preset slot">
          {[0, 1, 2, 3, 4].map((i) => (
            <button
              key={i}
              aria-pressed={settings.preset === i}
              onClick={() => setSettings((s) => ({ ...s, preset: i }))}
              className={`py-1.5 font-display text-[11px] font-bold uppercase tracking-wider ${
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

      {k === "range" ? (
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
          <p className="text-[11px] leading-snug text-mute">
            The two handles of the in-game Range bar. Moving a handle writes it the way the game does
            (handle + 100). Wider shadows push the shadow colour into the midtones; a lower highlight
            handle spreads the highlight colour down.
          </p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-mute">
            raw {settings.shadowPos}_{settings.shadowEdge} ·{" "}
            {settings.highlightPos}_{settings.highlightEdge}
          </p>
          <button
            onClick={() =>
              setSettings((s) => ({
                ...s,
                shadowPos: 30,
                shadowEdge: 300,
                highlightPos: 1000,
                highlightEdge: 1500,
              }))
            }
            className="self-start font-display text-[11px] font-bold uppercase tracking-wider text-mute hover:text-text"
          >
            Reset range
          </button>
        </div>
      ) : (
        z && hp && (
          <>
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
        {SWATCH_NAMES[hp.swatch]} + {r(hp.pos)} · raw {hp.swatch * 125 + r(hp.pos * 1.25)}
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
        onClick={() => setZone(k as ZoneKey, { hue: 0, tint: 0, sat: 50, bri: 50 })}
        className="self-start font-display text-[11px] font-bold uppercase tracking-wider text-mute hover:text-text"
      >
        Reset {INFO[k].label.toLowerCase()}
      </button>
          </>
        )
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

      <form
        className="mt-auto flex flex-col gap-1.5 border-t border-line pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          const ok = onLoad(paste);
          setBad(!ok);
          setLoaded(ok);
          if (ok) setPaste("");
          if (ok) setTimeout(() => setLoaded(false), 1600);
        }}
      >
        <label
          htmlFor="paste-code"
          className="font-display text-[10px] font-bold uppercase tracking-[0.2em] text-mute"
        >
          Have a code? Paste it
        </label>
        <div className="flex gap-1.5">
          <input
            id="paste-code"
            ref={pasteRef}
            value={paste}
            onChange={(e) => {
              setPaste(e.target.value);
              setBad(false);
            }}
            placeholder="0_1_30_300_1000_1500_…"
            aria-invalid={bad}
            className={`min-w-0 flex-1 border bg-black/50 px-2 py-1.5 font-mono text-[11px] ${
              bad ? "border-red-500" : "border-line"
            }`}
          />
          <button
            type="submit"
            className="shrink-0 bg-panel-2 px-3 py-1.5 font-display text-[11px] font-bold uppercase tracking-wider hover:bg-line"
          >
            {loaded ? "Loaded ✓" : "Load"}
          </button>
        </div>
        {bad && <p className="text-[11px] text-red-400">Needs 22 numbers joined by underscores.</p>}
      </form>
    </aside>
  );
}
