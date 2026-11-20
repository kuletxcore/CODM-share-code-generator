"use client";

import { TWEAKS, neutralize, type Tweak } from "@/lib/quickTweaks";
import type { Settings } from "@/lib/codm";

/** Compact one-tap moves above the precise sliders. */
export default function QuickTweaks({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (s: Settings, label: string) => void;
}) {
  const apply = (t: Tweak) => onChange(t.run(settings), `tweak:${t.id}`);
  return (
    <div className="border-b border-line pb-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-mute">
          Quick moves
        </p>
        <p className="text-[11px] text-mute">Then fine-tune below</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {TWEAKS.map((t) => (
          <button
            key={t.id}
            onClick={() => apply(t)}
            title={t.hint}
            className="min-h-10 border border-line bg-panel-2/70 px-2.5 font-display text-xs font-bold uppercase tracking-wide text-mute transition-colors hover:border-codm hover:text-codm-light"
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => onChange(neutralize(settings), "tweak:neutral")}
          title="Reset shadows, midtones and highlights, keeping the Simple colour"
          className="min-h-10 border border-line px-2.5 font-display text-xs font-bold uppercase tracking-wide text-mute hover:text-text"
        >
          ↺ Neutral
        </button>
      </div>
    </div>
  );
}
