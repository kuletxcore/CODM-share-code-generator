"use client";

import { useState } from "react";
import { TACTICAL_MACROS, type MacroId } from "@/lib/macros";

export default function TacticalMacros({
  intensity,
  onIntensityChange,
  onApplyMacro,
}: {
  intensity: number;
  onIntensityChange: (pct: number) => void;
  onApplyMacro: (id: MacroId) => void;
}) {
  const [lastMacro, setLastMacro] = useState<MacroId | null>(null);

  return (
    <div className="cut flex flex-col gap-4 border border-line bg-panel/80 p-4 backdrop-blur">
      {/* Master Intensity Scaler */}
      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-codm">
            Master Strength
          </span>
          <span className="font-mono text-sm font-medium tabular-nums text-text">
            {Math.round(intensity)}%
          </span>
        </div>

        <input
          type="range"
          aria-label="Master filter intensity percentage"
          className="slider mt-1"
          min={0}
          max={175}
          step={1}
          value={Math.round(intensity)}
          style={{
            ["--track" as string]:
              "linear-gradient(90deg, #2c302b 0%, #8e948b 57%, #ffea3b 100%)",
          }}
          onChange={(e) => onIntensityChange(Number(e.target.value))}
        />

        <div className="mt-1 flex items-center justify-between gap-1">
          {[50, 100, 140, 175].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onIntensityChange(preset)}
              className={`flex-1 py-1 font-mono text-[11px] tabular-nums transition-colors ${
                Math.round(intensity) === preset
                  ? "bg-codm/20 text-codm ring-1 ring-inset ring-codm/60"
                  : "bg-black/40 text-mute hover:bg-panel-2 hover:text-text"
              }`}
            >
              {preset}%
            </button>
          ))}
        </div>
      </div>

      {/* Tactical Smart-Tune Macros */}
      <div className="border-t border-line/80 pt-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-xs font-bold uppercase tracking-[0.2em] text-mute">
            Quick Modifiers
          </span>
          <span className="font-mono text-[10px] uppercase text-mute">1-Tap Tune</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {TACTICAL_MACROS.map((m) => {
            const flashed = lastMacro === m.id;
            return (
              <button
                key={m.id}
                type="button"
                title={m.desc}
                onClick={() => {
                  onApplyMacro(m.id);
                  setLastMacro(m.id);
                  setTimeout(() => setLastMacro((cur) => (cur === m.id ? null : cur)), 700);
                }}
                className={`group flex flex-col items-start border px-2.5 py-2 text-left transition-colors ${
                  flashed
                    ? "border-lime bg-lime/15 text-text"
                    : "border-line/80 bg-black/40 hover:border-codm hover:bg-panel-2"
                }`}
              >
                <span className="flex w-full items-center justify-between gap-1">
                  <span className="font-display text-sm font-extrabold uppercase tracking-wide text-text group-hover:text-codm">
                    {m.label}
                  </span>
                  <span className="bg-white/10 px-1 py-0.5 font-mono text-[9px] font-bold text-mute group-hover:bg-codm group-hover:text-black">
                    {m.badge}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
