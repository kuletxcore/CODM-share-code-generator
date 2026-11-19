"use client";

import { useId, useState } from "react";
import {
  GROUP_LABEL,
  describeCode,
  type CodeCell,
  type CodeGroup,
  type ZoneKey,
} from "@/lib/codm";

/**
 * The 22 numbers, spelled out.
 *
 * The code is the one thing a visitor has to trust, and it is the one thing the
 * page could not explain: a wall of digits whose meaning lived in a README. This
 * shows every number with the name and the value a player would read in game,
 * dims the ones that are at their default, and hands a group back to the editor
 * so tapping "Shadows · Tint" takes you to the Tint slider.
 */

const GROUP_TONE: Record<CodeGroup, { chip: string; cell: string; dot: string }> = {
  header: { chip: "bg-panel-2 text-mute", cell: "bg-white/10", dot: "#8e948b" },
  global: { chip: "bg-[#6d6a1f] text-codm-light", cell: "bg-codm/25", dot: "#ffea3b" },
  shadows: { chip: "bg-[#1e3346] text-[#8fc2ff]", cell: "bg-[#8fc2ff]/25", dot: "#8fc2ff" },
  midtones: { chip: "bg-[#2a2f28] text-text", cell: "bg-white/20", dot: "#e9ece6" },
  highlights: { chip: "bg-[#3a2c17] text-[#ffc46b]", cell: "bg-[#ffc46b]/25", dot: "#ffc46b" },
};

const ORDER: CodeGroup[] = ["header", "global", "shadows", "midtones", "highlights"];

export default function CodeAnatomy({
  code,
  onPick,
}: {
  code: string;
  /** Called with the group a visitor tapped; the editor selects that zone. */
  onPick: (group: CodeGroup) => void;
}) {
  const [open, setOpen] = useState(false);
  const [peek, setPeek] = useState<CodeCell | null>(null);
  const panelId = useId();
  const cells = describeCode(code);

  if (!cells) return null;
  const live = cells.filter((c) => c.active).length;

  return (
    <section className="border border-line bg-black/25">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className="text-codm">
            ⌗
          </span>
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Code anatomy
          </span>
          <span className="truncate font-mono text-[11px] text-mute">
            {live} of 22 values in use
          </span>
        </span>
        <span
          aria-hidden
          className={`shrink-0 text-mute transition-transform ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div id={panelId} className="border-t border-line px-3 pb-3 pt-2">
          <p className="text-xs text-mute">
            Every number in the code, in the order the game writes it. Tap a group to edit it.
          </p>

          <div className="mt-2 flex flex-col gap-2">
            {ORDER.map((group) => {
              const groupCells = cells.filter((c) => c.group === group);
              const zone = group === "header" ? null : (group as ZoneKey);
              return (
                <div key={group} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onPick(group)}
                    title={zone ? `Edit ${GROUP_LABEL[group]}` : "Range bar is under the preview"}
                    className={`w-[5.6rem] shrink-0 px-1.5 py-1 font-display text-[10px] font-bold uppercase leading-tight tracking-wider ${GROUP_TONE[group].chip}`}
                  >
                    {GROUP_LABEL[group]}
                  </button>
                  <ul className="flex flex-wrap gap-1">
                    {groupCells.map((cell) => (
                      <li key={cell.index}>
                        <button
                          type="button"
                          onMouseEnter={() => setPeek(cell)}
                          onFocus={() => setPeek(cell)}
                          onClick={() => {
                            setPeek(cell);
                            onPick(group);
                          }}
                          aria-label={`${cell.label}: ${cell.text}${
                            cell.active ? "" : " (default)"
                          }`}
                          className={`flex min-w-9 flex-col items-center border px-1 py-0.5 font-mono text-[10px] leading-tight tabular-nums transition-colors ${
                            cell.active
                              ? "border-line text-text hover:border-codm"
                              : "border-transparent text-mute/60 hover:border-line hover:text-mute"
                          }`}
                        >
                          <span>{cell.text}</span>
                          <span className="text-[9px] opacity-60">
                            {cell.field === "hue" ? "hue" : cell.field === "bri" ? "bri" : cell.field}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <p className="mt-2 min-h-8 border-l-2 border-line pl-2 text-xs text-mute" aria-live="polite">
            {peek ? (
              <>
                <span className="font-display font-bold uppercase tracking-wider text-text">
                  {peek.label}
                </span>
                {" · "}
                <span className="text-text">{peek.text}</span>
                {" · raw "}
                <span className="font-mono text-codm">{peek.raw}</span>
                {" · position "}
                <span className="font-mono">{peek.index + 1}</span>
                {!peek.active && " · at default"}
              </>
            ) : (
              "Point at a value to see what it means."
            )}
          </p>
        </div>
      )}
    </section>
  );
}
