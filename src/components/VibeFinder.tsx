"use client";

import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { VIBES, decode, type Vibe } from "@/lib/codm";

const r = Math.round;
const hsl = (h: number, s = 90, l = 55) => `hsl(${r(h)} ${s}% ${l}%)`;

/** Three colour dots (shadows / midtones / highlights) for a vibe's grade. */
function VibeDots({ vibe }: { vibe: Vibe }) {
  const s = decode(vibe.code);
  if (!s) return null;
  const zones = [s.zones.shadows, s.zones.midtones, s.zones.highlights];
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {zones.map((z, i) => (
        <span
          key={i}
          className="h-2.5 w-2.5 rotate-45 border border-black/50"
          style={{ background: hsl(z.hue, z.tint < 3 ? 0 : 85) }}
        />
      ))}
    </span>
  );
}

/**
 * Vibe Finder: six one-tap starting points for players who don't want to
 * touch sliders. Picking a vibe loads its code into the generator and the
 * Mission Console, ready to copy. "Surprise me" randomises for exploration.
 */
export default function VibeFinder({
  onPick,
  onScreenshot,
}: {
  onPick: (code: string, name: string) => void;
  onScreenshot: () => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const pick = (vibe: Vibe) => {
    setActive(vibe.name);
    try {
      navigator.vibrate?.(8);
    } catch {}
    onPick(vibe.code, vibe.name);
  };

  const surprise = () => {
    const vibe = VIBES[Math.floor(Math.random() * VIBES.length)];
    pick(vibe);
  };

  return (
    <section aria-labelledby="vibe-title" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-codm">
            No sliders needed
          </p>
          <h2
            id="vibe-title"
            className="mt-1 font-title text-3xl font-black uppercase tracking-wide sm:text-4xl"
          >
            Find your vibe
          </h2>
          <p className="mt-1 max-w-xl text-sm text-mute">
            Six starting points, tuned by hand. Tap one and the code is ready in the bar below —
            test it in game, then tweak if you like.
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={surprise}
            className="cut-sm min-h-11 bg-panel-2 px-4 font-display text-sm font-bold uppercase tracking-wider transition-colors hover:bg-line active:scale-[0.98]"
          >
            🎲 Surprise me
          </button>
          <button
            onClick={onScreenshot}
            className="cut-sm min-h-11 bg-panel-2 px-4 font-display text-sm font-bold uppercase tracking-wider transition-colors hover:bg-line active:scale-[0.98]"
          >
            Match a screenshot
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Vibes">
        {VIBES.map((vibe, i) => {
          const isActive = active === vibe.name;
          return (
            <motion.button
              key={vibe.name}
              onClick={() => pick(vibe)}
              aria-pressed={isActive}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              className={`group relative overflow-hidden border p-4 text-left transition-all active:scale-[0.99] ${
                isActive
                  ? "border-codm bg-codm/10"
                  : "border-line bg-panel/80 hover:border-mute hover:bg-panel"
              }`}
            >
              {isActive && (
                <span className="absolute inset-y-0 left-0 w-1 bg-codm" aria-hidden />
              )}
              <span className="flex items-center justify-between gap-2">
                <span className="font-display text-xl font-extrabold uppercase tracking-wide">
                  {vibe.name}
                </span>
                <VibeDots vibe={vibe} />
              </span>
              <span className="mt-1 block text-sm text-text/90">{vibe.tagline}</span>
              <span className="mt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-mute">{vibe.bestFor}</span>
                <span
                  className={`font-display text-xs font-bold uppercase tracking-wider ${
                    isActive ? "text-codm" : "text-mute group-hover:text-text"
                  }`}
                >
                  {isActive ? "Loaded ✓" : "Load →"}
                </span>
              </span>
            </motion.button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-mute">
        Starting points only — the preview is an approximation, so check the result in game.
      </p>
    </section>
  );
}
