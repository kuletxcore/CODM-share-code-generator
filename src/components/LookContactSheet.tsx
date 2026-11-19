"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LOOKS, decode, gradePlan, paintGrade, type Settings } from "@/lib/codm";
import { copyCode } from "@/components/ImportGuide";

// A live wall of grades: every look in the gallery plus "your code", all rendered
// from one small source image and one shared grade plan per crop.
//
// Why this exists: the gallery above shows stills of looks, and the editor below
// shows one grade at full size. Neither answers the question a visitor actually
// arrives with — "what does THIS look like on MY screen, and how do the others
// compare?" — without a copy-and-scroll round trip. This panel answers both in one
// glance, using only the CPU grader, so it works with no WebGL at all.

/** One source crop, downsampled once and reused for every tile. */
export type Source = { data: Uint8ClampedArray; width: number; height: number };

/** Tile size in the contact sheet. Deliberately tiny: it is a contact sheet. */
const TILE_W = 168;
const TILE_H = 108;

/**
 * Downsample a canvas to an RGBA buffer at most `maxW` wide.
 *
 * One `drawImage` does the box filter, which is both faster and better-looking
 * than sampling pixels by hand.
 */
export function toSource(c: HTMLCanvasElement, maxW = TILE_W * 2): Source {
  const scale = Math.min(1, maxW / Math.max(1, c.width));
  const w = Math.max(1, Math.round(c.width * scale));
  const h = Math.max(1, Math.round(c.height * scale));
  const t = document.createElement("canvas");
  t.width = w;
  t.height = h;
  const ctx = t.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { data: new Uint8ClampedArray(0), width: 0, height: 0 };
  ctx.drawImage(c, 0, 0, w, h);
  return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
}

type Tile = { key: string; name: string; code: string; note?: string };

/** Look-first ordering: the curated gallery looks, then the extra presets. */
const TILES: Tile[] = LOOKS.map((l) => ({
  key: l.name,
  name: l.name,
  code: l.code,
  note: l.note,
}));

type Props = {
  settings: Settings;
  /** Code currently in the editor, shown as its own tile. */
  code: string;
  source: Source | null;
  onPickLook: (code: string) => void;
  /** Snapshot of the live preview, used to give the card a real image. */
  onCopyLook: (code: string, name: string, note?: string) => void;
};

export default function LookContactSheet({ settings, code, source, onPickLook, onCopyLook }: Props) {
  const [open, setOpen] = useState(false);
  const grid = useRef<HTMLDivElement>(null);
  const canvases = useRef(new Map<string, HTMLCanvasElement>());
  /** Scratch buffer for compositing a graded frame into a tile. */
  const offscreen = useRef<HTMLCanvasElement | null>(null);
  // Grade every tile off the main thread's critical path, one per frame, so the
  // sheet paints immediately and fills in.
  const queue = useRef<string[]>([]);
  const raf = useRef(0);

  const src = source;

  const tiles = useMemo<Tile[]>(() => {
    const mine: Tile = { key: "__yours", name: "Your code", code, note: "What you are editing right now" };
    // Hide a gallery look whose code is byte-identical to the editor's, so the
    // sheet never shows the same grade twice.
    return [mine, ...TILES.filter((t) => t.code !== code)];
  }, [code]);

  // The queue reads this instead of closing over `tiles`, so editing a slider does
  // not re-grade the twelve gallery tiles that did not change.
  const tilesRef = useRef<Tile[]>(tiles);
  useEffect(() => {
    tilesRef.current = tiles;
  }, [tiles]);

  /** Draw one tile: neutral source pixels, then this look's grade, then the chip. */
  const paint = useCallback(
    (tile: Tile, canvasKey?: string) => {
      const c = canvases.current.get(canvasKey ?? tile.key);
      if (!c || !src || !src.data.length) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const s = decode(tile.code);
      if (!s) return;
      const plan = gradePlan(s);
      const buf = new Uint8ClampedArray(src.data);
      paintGrade(buf, plan);
      const img = new ImageData(buf, src.width, src.height);
      // Centre-crop to the tile aspect so the sheet reads as a row of stills.
      const scale = Math.max(c.width / src.width, c.height / src.height);
      const dw = src.width * scale;
      const dh = src.height * scale;
      // One offscreen buffer, reused for every tile: allocating a canvas per
      // paint dominated the per-tile cost (4.7ms vs 1.1ms for the grade itself).
      let off = offscreen.current;
      if (!off) {
        off = document.createElement("canvas");
        offscreen.current = off;
      }
      if (off.width !== src.width || off.height !== src.height) {
        off.width = src.width;
        off.height = src.height;
      }
      off.getContext("2d")!.putImageData(img, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(off, (c.width - dw) / 2, (c.height - dh) / 2, dw, dh);
      // Mark the reset state, which otherwise looks like a bug ("why is this one
      // not graded?") rather than the interesting thing it is.
      if (plan.neutral) {
        ctx.fillStyle = "rgba(10,11,10,0.55)";
        ctx.fillRect(0, c.height - 16, c.width, 16);
        ctx.fillStyle = "#8e948b";
        ctx.font = '600 9px "Hitmarker Condensed", system-ui, sans-serif';
        ctx.textBaseline = "middle";
        ctx.fillText("NO FILTER", 6, c.height - 8);
      }
    },
    [src],
  );

  // Queue every tile, painting one per animation frame.
  // Fill the sheet: one tile per frame so opening it never blocks input. When
  // collapsed, only the three teaser stills are worth painting.
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    queue.current = open
      ? tilesRef.current.map((t) => t.key)
      : TILES.slice(0, 3).map((t) => `peek-${t.key}`);
    const step = () => {
      const key = queue.current.shift();
      if (key) {
        const peek = key.startsWith("peek-");
        const target = peek ? key.slice(5) : key;
        const tile = tilesRef.current.find((t) => t.key === target);
        // Teaser canvases are registered under their own key.
        if (tile) paint(tile, peek ? key : undefined);
        raf.current = requestAnimationFrame(step);
      }
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [open, paint, tiles.length]);

  // While the visitor drags a slider, only the editor's tile changes. Repainting
  // the gallery tiles too would multiply the cost of every pointer move by twelve.
  useEffect(() => {
    if (!open) return;
    const mine = tilesRef.current.find((t) => t.key === "__yours");
    if (!mine) return;
    const id = requestAnimationFrame(() => paint(mine));
    return () => cancelAnimationFrame(id);
  }, [open, settings, paint]);

  // Close on Escape, matching every other overlay in the app.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const register = (key: string) => (el: HTMLCanvasElement | null) => {
    if (el) {
      canvases.current.set(key, el);
    } else {
      canvases.current.delete(key);
    }
  };

  return (
    <section aria-labelledby="sheet-title" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="sheet-title"
            className="font-title text-2xl font-black uppercase tracking-wide sm:text-3xl"
          >
            Compare at a glance
          </h2>
          <p className="mt-1 text-sm text-mute">
            {source
              ? "Every look applied to your screenshot, side by side. Tap one to load it into the generator."
              : "Every look applied to a sample frame, side by side. Add your own screenshot below to see them on it."}
          </p>
        </div>
        {/* Tiles are the point, so the only control here is the one that reveals
            them. A filter row would just be the gallery's chips again. */}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="contact-sheet"
          className={`cut-sm min-h-11 shrink-0 px-4 font-display text-sm font-bold uppercase tracking-wider transition-colors ${
            open ? "bg-panel-2 text-mute hover:bg-line hover:text-text" : "bg-codm text-black hover:bg-codm-light"
          }`}
        >
          {open ? "Hide the wall" : `Open the wall · ${TILES.length}`}
        </button>
      </div>

      {open ? (
        <div
          id="contact-sheet"
          ref={grid}
          role="list"
          aria-label="Grades preview"
          className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
        >
          {tiles.map((tile) => {
            const active = tile.key === "__yours";
            return (
              <div
                role="listitem"
                key={tile.key}
                className={`group relative overflow-hidden border bg-black transition-colors ${
                  active ? "border-codm" : "border-line hover:border-mute"
                }`}
              >
                <canvas
                  ref={register(tile.key)}
                  width={TILE_W}
                  height={TILE_H}
                  role="img"
                  aria-label={`${tile.name} applied to the ${
                    source ? "uploaded screenshot" : "sample frame"
                  }`}
                  className="block aspect-[168/108] w-full"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/45 to-transparent px-1.5 pb-1 pt-4">
                  <span className="block truncate font-display text-[11px] font-bold uppercase leading-none tracking-wider">
                    {tile.name}
                  </span>
                </div>
                {/* Actions stay visible on touch (no hover) and appear on hover on
                    a pointer device. */}
                <div className="absolute inset-0 flex items-end justify-center gap-1 p-1.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <button
                    onClick={() => onPickLook(tile.code)}
                    className="cut-sm bg-codm px-2 py-1 font-display text-[10px] font-extrabold uppercase tracking-wider text-black hover:bg-codm-light"
                  >
                    {active ? "Edit" : "Use"}
                  </button>
                  <button
                    onClick={() =>
                      active
                        ? copyCode(tile.code, tile.name, { note: tile.note })
                        : onCopyLook(tile.code, tile.name, tile.note)
                    }
                    aria-label={`Copy the ${tile.name} share code`}
                    className="cut-sm bg-black/80 px-2 py-1 font-display text-[10px] font-extrabold uppercase tracking-wider text-text hover:bg-line"
                  >
                    Copy
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Collapsed: three graded stills of the SAME frame, which is the whole
        // pitch in one image — these differ, so open it and see the rest.
        <button
          onClick={() => setOpen(true)}
          aria-label={`Open the wall: ${TILES.length} looks compared on one frame`}
          className="cut group mt-3 flex w-full items-stretch gap-2 border border-line bg-panel/40 p-2 text-left transition-colors hover:border-mute"
        >
          {TILES.slice(0, 3).map((t) => (
            <span key={t.key} className="relative w-1/3 overflow-hidden bg-black">
              <canvas
                ref={register(`peek-${t.key}`)}
                width={TILE_W}
                height={TILE_H}
                aria-hidden
                className="block aspect-[168/108] w-full"
              />
              <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black to-transparent px-1 pb-0.5 pt-3 font-display text-[9px] font-bold uppercase tracking-wider text-white/80">
                {t.name}
              </span>
            </span>
          ))}
          <span className="flex w-1/3 flex-col items-center justify-center gap-0.5 bg-black/40 px-2 text-center">
            <span className="font-display text-xl font-black leading-none text-codm">
              +{TILES.length - 3}
            </span>
            <span className="font-display text-[9px] font-bold uppercase leading-tight tracking-wider text-mute">
              more looks
            </span>
          </span>
        </button>
      )}
    </section>
  );
}
