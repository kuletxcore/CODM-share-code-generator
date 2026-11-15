"use client";

import { useMemo, useState } from "react";
import { LOOKS, type Look } from "@/lib/codm";
import { copyCode } from "@/components/ImportGuide";

type PlayMode = "mp" | "br" | "night";
type Goal = "visibility" | "cinematic" | "bold";
type Tone = "warm" | "neutral" | "cool";

type Scored = { look: Look; reason: string; score: number };

function recommendLooks(mode: PlayMode, goal: Goal, tone: Tone): Scored[] {
  const playable = LOOKS.filter((l) => l.name !== "Default");
  const scored: Scored[] = playable.map((look) => {
    let score = 0;
    const reasons: string[] = [];

    if (mode === "night") {
      if (look.tags.includes("night")) {
        score += 45;
        reasons.push("tuned specifically for dark & haunting maps");
      }
      if (look.name === "Al Mazrah") {
        score += 18;
        reasons.push("lifted shadows expose dark corners");
      }
    } else if (mode === "mp") {
      if (look.tags.includes("mp")) {
        score += 32;
        reasons.push("built for fast Multiplayer map readability");
      }
      if (look.tags.includes("crisp")) score += 12;
    } else {
      if (look.tags.includes("warzone")) {
        score += 28;
        reasons.push("crafted for wide Battle Royale terrain");
      }
    }

    if (goal === "visibility") {
      if (look.name === "Al Mazrah" || look.name === "Apex" || look.name === "2035") {
        score += 26;
        reasons.push("clean midtones & lifted visibility");
      }
      if (look.name === "Haven's Hollow") {
        score += 20;
        reasons.push("brighter shadow lift helps spot campers");
      }
      if (look.tags.includes("night") && mode !== "night") score -= 18;
    } else if (goal === "cinematic") {
      if (look.name === "Verdansk" || look.name === "Hajin" || look.name === "Caldera") {
        score += 24;
        reasons.push("natural filmic highlight/shadow balance");
      }
      if (look.tags.includes("classic")) score += 12;
    } else {
      if (look.name === "Cold War" || look.name === "Avalon" || look.name === "Hajin") {
        score += 26;
        reasons.push("rich saturated midtones that pop on mobile OLED");
      }
      if (look.name === "Haven's Hollow (Night)") score += 16;
    }

    if (tone === "warm") {
      if (look.tags.includes("warm")) {
        score += 22;
        reasons.push("warm golden sun tone");
      }
    } else if (tone === "cool") {
      if (
        look.name === "Cold War" ||
        look.name === "Haven's Hollow (Night)" ||
        look.name === "Vondead" ||
        look.name === "2035"
      ) {
        score += 24;
        reasons.push("cool crisp shadow cast");
      }
    } else {
      if (look.name === "2035" || look.name === "Al Mazrah" || look.name === "Apex") {
        score += 20;
        reasons.push("balanced neutral colour profile");
      }
    }

    return {
      look,
      score,
      reason: reasons.length
        ? reasons.slice(0, 2).join(" · ")
        : look.note,
    };
  });

  return scored.sort((a, b) => b.score - a.score);
}

export default function FilterRecommender({
  onSelectLook,
  onEdit,
}: {
  onSelectLook: (lookName: string) => void;
  onEdit: (code: string) => void;
}) {
  const [mode, setMode] = useState<PlayMode>("mp");
  const [goal, setGoal] = useState<Goal>("visibility");
  const [tone, setTone] = useState<Tone>("warm");
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const ranked = useMemo(() => recommendLooks(mode, goal, tone), [mode, goal, tone]);
  const top = ranked[0];
  const runnerUp = ranked[1];

  return (
    <div className="cut mt-3 border border-codm/60 bg-panel/90 p-4 backdrop-blur-md">
      <div className="grid gap-4 lg:grid-cols-[1fr_360px] lg:items-center">
        {/* 3 quick selector rows */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <span className="block font-display text-[11px] font-bold uppercase tracking-[0.2em] text-mute">
              1 · Main Mode
            </span>
            <div className="mt-1.5 flex flex-col gap-1">
              {(
                [
                  ["mp", "MP Ranked / Core"],
                  ["br", "Battle Royale / DMZ"],
                  ["night", "Night / Zombies"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={mode === v}
                  onClick={() => setMode(v)}
                  className={`px-2.5 py-1.5 text-left font-display text-xs font-bold uppercase tracking-wider transition-colors ${
                    mode === v
                      ? "bg-codm text-black"
                      : "bg-black/45 text-mute hover:bg-panel-2 hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block font-display text-[11px] font-bold uppercase tracking-[0.2em] text-mute">
              2 · Priority
            </span>
            <div className="mt-1.5 flex flex-col gap-1">
              {(
                [
                  ["visibility", "Spot Enemies"],
                  ["cinematic", "Cinematic Realism"],
                  ["bold", "Rich Colour Pop"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={goal === v}
                  onClick={() => setGoal(v)}
                  className={`px-2.5 py-1.5 text-left font-display text-xs font-bold uppercase tracking-wider transition-colors ${
                    goal === v
                      ? "bg-codm text-black"
                      : "bg-black/45 text-mute hover:bg-panel-2 hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block font-display text-[11px] font-bold uppercase tracking-[0.2em] text-mute">
              3 · Colour Tone
            </span>
            <div className="mt-1.5 flex flex-col gap-1">
              {(
                [
                  ["warm", "Warm Sunlit"],
                  ["neutral", "Clean Neutral"],
                  ["cool", "Cool Tactical"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={tone === v}
                  onClick={() => setTone(v)}
                  className={`px-2.5 py-1.5 text-left font-display text-xs font-bold uppercase tracking-wider transition-colors ${
                    tone === v
                      ? "bg-codm text-black"
                      : "bg-black/45 text-mute hover:bg-panel-2 hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Instant Best Match Recommendation Card */}
        <div className="border-l-2 border-codm bg-black/55 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-lime">
              ★ Best Match for You
            </span>
            <button
              type="button"
              onClick={() => onSelectLook(top.look.name)}
              className="font-display text-[11px] font-bold uppercase tracking-wider text-mute underline-offset-4 hover:text-codm hover:underline"
            >
              View on stage
            </button>
          </div>
          <div className="mt-1 font-title text-2xl font-black uppercase leading-tight tracking-wide text-text">
            {top.look.name}
          </div>
          <p className="mt-0.5 text-xs capitalize text-mute">{top.reason}</p>

          <div className="mt-3 flex gap-1.5">
            <button
              type="button"
              onClick={async () => {
                await copyCode(top.look.code, top.look.name);
                setCopiedName(top.look.name);
                setTimeout(() => setCopiedName(null), 2000);
              }}
              className={`cut-sm flex-1 px-3 py-2 font-display text-sm font-extrabold uppercase tracking-wider transition-colors ${
                copiedName === top.look.name
                  ? "bg-lime text-black"
                  : "bg-codm text-black hover:bg-codm-light"
              }`}
            >
              {copiedName === top.look.name ? "Copied ✓" : `Copy ${top.look.name}`}
            </button>
            <button
              type="button"
              onClick={() => onEdit(top.look.code)}
              className="border border-line bg-panel-2 px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-text hover:border-codm"
            >
              Tune
            </button>
          </div>

          {runnerUp && (
            <div className="mt-2.5 flex items-center justify-between border-t border-line/70 pt-2 text-xs text-mute">
              <span>
                Runner-up:{" "}
                <button
                  type="button"
                  onClick={() => onSelectLook(runnerUp.look.name)}
                  className="font-display font-bold uppercase tracking-wide text-text hover:text-codm"
                >
                  {runnerUp.look.name}
                </button>
              </span>
              <button
                type="button"
                onClick={() => void copyCode(runnerUp.look.code, runnerUp.look.name)}
                className="font-display text-[11px] font-bold uppercase tracking-wider text-codm hover:text-codm-light"
              >
                Quick Copy
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
