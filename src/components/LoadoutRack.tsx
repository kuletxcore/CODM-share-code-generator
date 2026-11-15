"use client";

import { useState } from "react";
import { decode, type Zone } from "@/lib/codm";
import type { SavedSlot } from "@/lib/storage";

function zoneDotColor(z: Zone) {
  return z.tint < 3 ? "#6c736b" : `hsl(${Math.round(z.hue)} 90% 55%)`;
}

export default function LoadoutRack({
  slots,
  activeCode,
  compareSlotIndex,
  canUndo,
  canRedo,
  undoCount,
  onSaveSlot,
  onRenameSlot,
  onLoadSlot,
  onDeleteSlot,
  onToggleCompare,
  onUndo,
  onRedo,
}: {
  slots: (SavedSlot | null)[];
  activeCode: string;
  compareSlotIndex: number | null;
  canUndo: boolean;
  canRedo: boolean;
  undoCount: number;
  onSaveSlot: (index: number) => void;
  onRenameSlot: (index: number, name: string) => void;
  onLoadSlot: (index: number) => void;
  onDeleteSlot: (index: number) => void;
  onToggleCompare: (index: number) => void;
  onUndo: () => void;
  onRedo: () => void;
}) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");

  const commitRename = (index: number) => {
    const clean = draftName.trim();
    if (clean) onRenameSlot(index, clean.slice(0, 28));
    setEditingIdx(null);
  };

  return (
    <div className="mt-5 border border-line bg-panel/75 p-3 backdrop-blur">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-xs font-bold uppercase tracking-[0.22em] text-codm">
            Armory Loadouts
          </span>
          <span className="text-xs text-mute">
            Mirrors CODM&apos;s 5 Custom Slots · Saved locally in browser
          </span>
          {compareSlotIndex !== null && slots[compareSlotIndex] && (
            <button
              type="button"
              onClick={() => onToggleCompare(compareSlotIndex)}
              className="flex items-center gap-1.5 bg-lime px-2 py-0.5 font-display text-[11px] font-extrabold uppercase tracking-wider text-black hover:opacity-90"
            >
              A/B vs {slots[compareSlotIndex]!.name} · Clear ×
            </button>
          )}
        </div>

        {/* Undo / Redo controls */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            title="Undo last adjustment (Ctrl/Cmd+Z)"
            className="border border-line bg-black/40 px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider text-text transition-colors hover:border-codm disabled:cursor-not-allowed disabled:opacity-35"
          >
            ↶ Undo{undoCount > 0 ? ` (${undoCount})` : ""}
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            title="Redo adjustment (Ctrl/Cmd+Shift+Z)"
            className="border border-line bg-black/40 px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider text-text transition-colors hover:border-codm disabled:cursor-not-allowed disabled:opacity-35"
          >
            ↷ Redo
          </button>
        </div>
      </div>

      {/* 5 Custom Slot Cards */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-5">
        {slots.map((slot, i) => {
          const isCurrent = slot?.code === activeCode;
          const isComparing = compareSlotIndex === i;
          const parsed = slot ? decode(slot.code) : null;

          if (!slot) {
            return (
              <button
                key={i}
                type="button"
                onClick={() => onSaveSlot(i)}
                className="group flex min-h-[66px] flex-col justify-between border border-dashed border-line/80 bg-black/25 px-3 py-2 text-left transition-colors hover:border-codm hover:bg-codm/5"
              >
                <span className="font-mono text-[10px] font-medium uppercase tracking-widest text-mute">
                  Slot 0{i + 1}
                </span>
                <span className="font-display text-xs font-bold uppercase tracking-wider text-mute group-hover:text-codm">
                  + Save current here
                </span>
              </button>
            );
          }

          return (
            <div
              key={i}
              className={`group relative flex min-h-[66px] flex-col justify-between border px-2.5 py-2 transition-colors ${
                isComparing
                  ? "border-lime bg-lime/10"
                  : isCurrent
                    ? "border-codm bg-codm/10"
                    : "border-line bg-black/45 hover:border-mute"
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-mute">
                  0{i + 1}
                </span>
                {parsed && (
                  <span className="flex items-center gap-1" aria-hidden>
                    {(["shadows", "midtones", "highlights"] as const).map((zk) => (
                      <span
                        key={zk}
                        className="h-2 w-2 rotate-45 border border-black/60"
                        style={{ background: zoneDotColor(parsed.zones[zk]) }}
                      />
                    ))}
                  </span>
                )}
              </div>

              {editingIdx === i ? (
                <input
                  autoFocus
                  value={draftName}
                  maxLength={28}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => commitRename(i)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(i);
                    else if (e.key === "Escape") setEditingIdx(null);
                  }}
                  aria-label={`Rename slot ${i + 1}`}
                  className="my-0.5 w-full border border-codm bg-black px-1 py-0.5 font-display text-sm font-bold uppercase text-text outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => onLoadSlot(i)}
                  onDoubleClick={() => {
                    setEditingIdx(i);
                    setDraftName(slot.name);
                  }}
                  title="Click to load · Double-click to rename"
                  className="truncate text-left font-display text-sm font-extrabold uppercase tracking-wide text-text hover:text-codm"
                >
                  {slot.name}
                </button>
              )}

              <div className="mt-1 flex items-center justify-between gap-1 border-t border-white/5 pt-1">
                <button
                  type="button"
                  aria-pressed={isComparing}
                  onClick={() => onToggleCompare(i)}
                  title="Compare this slot on the left half of the split preview"
                  className={`px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase transition-colors ${
                    isComparing
                      ? "bg-lime text-black"
                      : "bg-white/5 text-mute hover:bg-white/15 hover:text-text"
                  }`}
                >
                  A/B
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSaveSlot(i)}
                    title="Overwrite slot with current filter"
                    className="px-1 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider text-mute hover:text-codm"
                  >
                    Update
                  </button>
                  <button
                    type="button"
                    aria-label={`Rename slot ${i + 1}`}
                    onClick={() => {
                      setEditingIdx(i);
                      setDraftName(slot.name);
                    }}
                    title="Rename slot"
                    className="px-1 py-0.5 font-mono text-[10px] text-mute hover:text-text"
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    aria-label={`Clear slot ${i + 1}`}
                    onClick={() => onDeleteSlot(i)}
                    title="Clear slot"
                    className="px-1 py-0.5 font-mono text-[10px] text-mute hover:text-red-400"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
