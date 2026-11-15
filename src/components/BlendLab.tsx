"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { LOOKS, SWATCH_NAMES, decode, defaultSettings, encode, hueParts, type Settings, type Zone } from "@/lib/codm";
import { DEFAULT_ROUTES, blendSettings, type BlendRoutes, type ZoneRoute } from "@/lib/blend";
import type { SavedSlot } from "@/lib/storage";
import PreviewCanvas from "@/components/PreviewCanvas";
import { copyCode } from "@/components/ImportGuide";

type DeckOption = {
  id: string;
  label: string;
  group: "Active" | "Saved Slots" | "Built-in Looks";
  code: string;
};

function zoneChipColor(z: Zone) {
  return z.tint < 3 ? "#6c736b" : `hsl(${Math.round(z.hue)} 90% 55%)`;
}

function DeckCard({
  tag,
  accentClass,
  options,
  selectedId,
  onSelect,
}: {
  tag: string;
  accentClass: string;
  options: DeckOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const active = options.find((o) => o.id === selectedId) ?? options[0];
  const parsed = useMemo(() => (active ? decode(active.code) : null), [active]);

  return (
    <div className="border border-line bg-black/45 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={`px-2 py-0.5 font-display text-[11px] font-extrabold uppercase tracking-widest ${accentClass}`}>
          {tag}
        </span>
        {parsed && (
          <div className="flex items-center gap-1.5 font-mono text-[10px] text-mute">
            {(["shadows", "midtones", "highlights"] as const).map((zk) => {
              const z = parsed.zones[zk];
              const hp = hueParts(z.hue);
              return (
                <span key={zk} className="flex items-center gap-1">
                  <span
                    className="h-2 w-2 rotate-45"
                    style={{ background: zoneChipColor(z) }}
                  />
                  {z.tint >= 3 ? SWATCH_NAMES[hp.swatch].slice(0, 3) : "Neu"}
                </span>
              );
            })}
          </div>
        )}
      </div>

      <select
        aria-label={`Select ${tag} filter`}
        value={active?.id ?? ""}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full border border-line bg-ink px-2.5 py-2 font-display text-base font-bold uppercase tracking-wide text-text focus:border-codm focus:outline-none"
      >
        {(["Active", "Saved Slots", "Built-in Looks"] as const).map((grp) => {
          const items = options.filter((o) => o.group === grp);
          if (!items.length) return null;
          return (
            <optgroup key={grp} label={grp}>
              {items.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}

const ROUTE_ROWS: { key: keyof BlendRoutes; label: string }[] = [
  { key: "shadows", label: "Shadows" },
  { key: "midtones", label: "Midtones" },
  { key: "highlights", label: "Highlights" },
  { key: "range", label: "Range" },
];

export default function BlendLab({
  currentSettings,
  slots,
  source,
  onUpload,
  onClearSource,
  onApply,
}: {
  currentSettings: Settings;
  slots: (SavedSlot | null)[];
  source: HTMLCanvasElement | null;
  onUpload: (f: File) => void;
  onClearSource: () => void;
  onApply: (fused: Settings) => void;
}) {
  const currentCode = useMemo(() => encode(currentSettings), [currentSettings]);

  const options = useMemo<DeckOption[]>(() => {
    const out: DeckOption[] = [
      { id: "current", label: "Current Generator Build", group: "Active", code: currentCode },
    ];
    slots.forEach((s, i) => {
      if (s) {
        out.push({
          id: `slot-${i}`,
          label: `Slot 0${i + 1} · ${s.name}`,
          group: "Saved Slots",
          code: s.code,
        });
      }
    });
    LOOKS.forEach((l) => {
      out.push({
        id: `look-${l.name}`,
        label: l.name,
        group: "Built-in Looks",
        code: l.code,
      });
    });
    return out;
  }, [currentCode, slots]);

  const [deckAId, setDeckAId] = useState("look-Hajin");
  const [deckBId, setDeckBId] = useState("look-Haven's Hollow (Night)");
  const [mixPct, setMixPct] = useState(50);
  const [routes, setRoutes] = useState<BlendRoutes>(DEFAULT_ROUTES);
  const [compareVsA, setCompareVsA] = useState(false);
  const [copied, setCopied] = useState(false);

  const deckAOpt = options.find((o) => o.id === deckAId) ?? options[1] ?? options[0];
  const deckBOpt = options.find((o) => o.id === deckBId) ?? options[2] ?? options[0];

  const settingsA = useMemo(() => decode(deckAOpt.code) ?? defaultSettings(), [deckAOpt.code]);
  const settingsB = useMemo(() => decode(deckBOpt.code) ?? defaultSettings(), [deckBOpt.code]);

  const fused = useMemo(
    () => blendSettings(settingsA, settingsB, mixPct / 100, routes),
    [settingsA, settingsB, mixPct, routes],
  );
  const fusedCode = useMemo(() => encode(fused), [fused]);

  const randomizePair = () => {
    const playable = LOOKS.filter((l) => l.name !== "Default");
    const i = Math.floor(Math.random() * playable.length);
    let j = Math.floor(Math.random() * (playable.length - 1));
    if (j >= i) j++;
    setDeckAId(`look-${playable[i].name}`);
    setDeckBId(`look-${playable[j].name}`);
    setMixPct(Math.round((30 + Math.random() * 40) / 5) * 5);
    setRoutes(DEFAULT_ROUTES);
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className="mt-6 grid gap-6 xl:grid-cols-[1fr_400px]"
    >
      {/* Live WebGL Preview of the Fused Filter */}
      <div className="flex flex-col gap-3">
        <PreviewCanvas
          settings={fused}
          compareSettings={compareVsA ? settingsA : null}
          compareLabel={compareVsA ? deckAOpt.label : undefined}
          source={source}
          onUpload={onUpload}
          onClear={onClearSource}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border border-line bg-panel/70 px-3.5 py-2 text-xs text-mute">
          <span>
            Vector-blending{" "}
            <strong className="text-[#2dd4ff]">{deckAOpt.label}</strong> ({100 - mixPct}%) ×{" "}
            <strong className="text-codm">{deckBOpt.label}</strong> ({mixPct}%)
          </span>
          <label className="flex cursor-pointer items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-text">
            <input
              type="checkbox"
              checked={compareVsA}
              onChange={(e) => setCompareVsA(e.target.checked)}
              className="h-3.5 w-3.5 accent-[var(--color-lime)]"
            />
            Compare left side vs Deck A
          </label>
        </div>
      </div>

      {/* Fusion Mixer Console */}
      <div className="cut flex flex-col gap-4 border border-line bg-panel/85 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="font-display text-3xl font-extrabold uppercase leading-none">
              Blend Lab
            </h2>
            <p className="mt-1 text-xs text-mute">
              Morph any two looks together or cherry-pick shadows, mids &amp; highlights.
            </p>
          </div>
          <button
            type="button"
            onClick={randomizePair}
            className="border border-line bg-black/50 px-2.5 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-codm hover:border-codm"
          >
            Random Mix
          </button>
        </div>

        {/* Deck A & Deck B Selectors */}
        <div className="flex flex-col gap-2">
          <DeckCard
            tag="Deck A"
            accentClass="bg-[#2dd4ff] text-black"
            options={options}
            selectedId={deckAOpt.id}
            onSelect={setDeckAId}
          />
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setDeckAId(deckBOpt.id);
                setDeckBId(deckAOpt.id);
                setMixPct(100 - mixPct);
              }}
              className="border border-line bg-panel-2 px-3 py-0.5 font-display text-[11px] font-bold uppercase tracking-widest text-mute hover:border-codm hover:text-text"
            >
              ⇅ Swap A ↔ B
            </button>
          </div>
          <DeckCard
            tag="Deck B"
            accentClass="bg-codm text-black"
            options={options}
            selectedId={deckBOpt.id}
            onSelect={setDeckBId}
          />
        </div>

        {/* Crossfader */}
        <div className="border border-line/80 bg-black/45 p-3">
          <div className="flex items-center justify-between font-display text-xs font-bold uppercase tracking-widest">
            <span className="text-[#2dd4ff]">A · {100 - mixPct}%</span>
            <span className="text-mute">Crossfade</span>
            <span className="text-codm">{mixPct}% · B</span>
          </div>
          <input
            type="range"
            aria-label="Deck A to Deck B crossfade percentage"
            className="slider mt-1"
            min={0}
            max={100}
            step={1}
            value={mixPct}
            style={{
              ["--track" as string]: "linear-gradient(90deg, #2dd4ff 0%, #8e948b 50%, #ffea3b 100%)",
            }}
            onChange={(e) => setMixPct(Number(e.target.value))}
          />
          <div className="mt-1 flex gap-1">
            {[0, 25, 50, 75, 100].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setMixPct(v)}
                className={`flex-1 py-1 font-mono text-[10px] tabular-nums ${
                  mixPct === v
                    ? "bg-white/15 text-text ring-1 ring-inset ring-codm/60"
                    : "bg-black/40 text-mute hover:text-text"
                }`}
              >
                {v === 0 ? "100% A" : v === 100 ? "100% B" : `${100 - v}/${v}`}
              </button>
            ))}
          </div>
        </div>

        {/* Per-Zone Cherry-Pick Matrix */}
        <div className="border border-line/80 bg-black/35 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mute">
              Per-Zone Routing
            </span>
            <button
              type="button"
              onClick={() => setRoutes(DEFAULT_ROUTES)}
              className="font-display text-[11px] font-bold uppercase tracking-wider text-mute hover:text-codm"
            >
              Reset Mix
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            {ROUTE_ROWS.map((row) => (
              <div key={row.key} className="grid grid-cols-[1fr_auto] items-center gap-2">
                <span className="font-display text-sm font-bold uppercase tracking-wide text-text">
                  {row.label}
                </span>
                <div className="flex border border-line bg-ink p-0.5" role="group" aria-label={`${row.label} source`}>
                  {(["a", "mix", "b"] as ZoneRoute[]).map((rOpt) => (
                    <button
                      key={rOpt}
                      type="button"
                      aria-pressed={routes[row.key] === rOpt}
                      onClick={() => setRoutes((prev) => ({ ...prev, [row.key]: rOpt }))}
                      className={`px-2.5 py-0.5 font-display text-[11px] font-extrabold uppercase tracking-wider transition-colors ${
                        routes[row.key] === rOpt
                          ? rOpt === "a"
                            ? "bg-[#2dd4ff] text-black"
                            : rOpt === "b"
                              ? "bg-codm text-black"
                              : "bg-lime text-black"
                          : "text-mute hover:text-text"
                      }`}
                    >
                      {rOpt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action CTAs */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={async () => {
              await copyCode(fusedCode, `${deckAOpt.label} × ${deckBOpt.label}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className={`cut px-4 py-3 font-display text-lg font-extrabold uppercase tracking-wider transition-colors ${
              copied ? "bg-lime text-black" : "bg-codm text-black hover:bg-codm-light"
            }`}
          >
            {copied ? "Fused Code Copied ✓" : "Copy Fused Code"}
          </button>
          <button
            type="button"
            onClick={() => onApply(fused)}
            className="border border-line bg-panel-2 px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-text transition-colors hover:border-codm hover:bg-line"
          >
            Send Fusion to Generator →
          </button>
        </div>
      </div>
    </motion.section>
  );
}
