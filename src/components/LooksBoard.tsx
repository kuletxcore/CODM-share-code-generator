"use client";

import { motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LOOKS, applyGrade, decode } from "@/lib/codm";
import { copyCode } from "@/components/ImportGuide";
import { sampleFrame } from "@/lib/frame";

/*
 * The look board. Twelve codes, one frame — and the frame can be yours.
 *
 * The old gallery showed one look at a time on that look's own footage, which
 * meant you could never tell what a code would do to the game in front of you,
 * and never compare two looks without a slideshow. Here every tile is the same
 * frame graded by a different code, so the choice is a comparison instead of a
 * memory test. Drop in a screenshot and all twelve re-grade onto your screen.
 */

const W = 400,
  H = 250;

const bases = new WeakMap<HTMLCanvasElement, ImageData>();
const gradedCache = new WeakMap<HTMLCanvasElement, Map<string, ImageData>>();

function baseOf(frame: HTMLCanvasElement) {
  let base = bases.get(frame);
  if (!base) {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    // cover-crop, so a portrait phone screenshot fills the tile
    const s = Math.max(W / frame.width, H / frame.height);
    const dw = frame.width * s;
    const dh = frame.height * s;
    ctx.drawImage(frame, (W - dw) / 2, (H - dh) / 2, dw, dh);
    base = ctx.getImageData(0, 0, W, H);
    bases.set(frame, base);
  }
  return base;
}

function gradedOf(frame: HTMLCanvasElement, code: string) {
  let forFrame = gradedCache.get(frame);
  if (!forFrame) {
    forFrame = new Map();
    gradedCache.set(frame, forFrame);
  }
  let img = forFrame.get(code);
  if (!img) {
    const s = decode(code);
    if (!s) return null;
    const data = new Uint8ClampedArray(baseOf(frame).data);
    applyGrade(data, s);
    img = new ImageData(data, W, H);
    forFrame.set(code, img);
  }
  return img;
}

const STEPS = ["Copy", "Import in game", "Apply"];

type Tile = { name: string; note: string; mode: string; code: string; image?: string; custom?: boolean };

// Each look's three zone colours, so the tiles still read as different even when
// the frame is a hazy daytime scene where the grades are subtle.
const signatures = new Map<string, string[]>();

function signature(code: string) {
  const hit = signatures.get(code);
  if (hit) return hit;
  const s = decode(code);
  const chips = s
    ? (["shadows", "midtones", "highlights"] as const).map((k) => {
        const z = s.zones[k];
        const global = s.zones.global;
        const tinted = z.tint > 3 || global.tint > 3;
        const hue = z.tint > 3 ? z.hue : global.hue;
        return tinted ? `hsl(${Math.round(hue)} 85% 55%)` : "rgba(255,255,255,0.14)";
      })
    : [];
  signatures.set(code, chips);
  return chips;
}

export default function LooksBoard({
  source,
  activeCode,
  customCode,
  onUpload,
  onClear,
  onEdit,
}: {
  /** The visitor's own screenshot, if they've dropped one in. */
  source: HTMLCanvasElement | null;
  /** Code currently loaded in the editor, so the board can mark it. */
  activeCode: string;
  /** A build of their own, shown as a tile once it exists. */
  customCode?: string | null;
  onUpload: (f: File) => void;
  onClear: () => void;
  onEdit: (code: string) => void;
}) {
  const [sample, setSample] = useState<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Live grades by default; the reference footage is kept one tap away.
  const [art, setArt] = useState<"live" | "stills">("live");
  const canvases = useRef(new Map<string, HTMLCanvasElement>());
  const reduce = useReducedMotion();
  const frame = source ?? sample;

  // Their own build joins the shelf, first, as soon as it differs from a preset.
  const tiles = useMemo<Tile[]>(() => {
    const out: Tile[] = LOOKS.map((l) => ({
      name: l.name,
      note: l.note,
      mode: l.mode,
      code: l.code,
      image: l.image,
    }));
    if (customCode && !out.some((t) => t.code === customCode)) {
      out.unshift({
        name: "Your look",
        note: "Your edits, ready to copy",
        mode: "Custom",
        code: customCode,
        custom: true,
      });
    }
    return out;
  }, [customCode]);

  // One shared scene render for the whole page; nothing is graded until it lands.
  useEffect(() => {
    if (source) return;
    let live = true;
    sampleFrame().then((c) => {
      if (live) setSample(c);
    });
    return () => {
      live = false;
    };
  }, [source]);

  // Grade one tile per frame: twelve tiles in a single pass would stall the page.
  useEffect(() => {
    if (!frame) return;
    let live = true;
    let i = 0;
    const paint = () => {
      if (!live || i >= tiles.length) return;
      const tile = tiles[i++];
      const img = gradedOf(frame, tile.code);
      const c = canvases.current.get(tile.code);
      if (c && img) {
        if (c.width !== W) c.width = W;
        if (c.height !== H) c.height = H;
        c.getContext("2d")!.putImageData(img, 0, 0);
      }
      requestAnimationFrame(paint);
    };
    const id = requestAnimationFrame(paint);
    return () => {
      live = false;
      cancelAnimationFrame(id);
    };
  }, [frame, tiles]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 4000);
    return () => clearTimeout(t);
  }, [copied]);

  const pick = useCallback(
    (l: Tile) => {
      onEdit(l.code);
      document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [onEdit],
  );

  return (
    <section aria-labelledby="looks-title" className="mt-8 sm:mt-10">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h2
            id="looks-title"
            className="font-title text-3xl font-black uppercase tracking-wide sm:text-4xl"
          >
            Pick a look
          </h2>
          <p className="mt-1 max-w-xl text-sm text-mute">
            {art === "stills"
              ? "The reference footage each look was built from. Switch back to Live to compare them on one frame."
              : source
                ? "Every code run on your own screenshot. Copy one, or open it in the generator."
                : "Every code run on the same frame, so you can actually compare them. Drop in a screenshot to see them on your game."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ol className="flex gap-3 font-display text-[11px] font-bold uppercase tracking-widest text-mute">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center bg-codm text-[11px] text-black">
                  {i + 1}
                </span>
                {s}
              </li>
            ))}
          </ol>
          <div className="flex items-center gap-1.5">
            <div role="group" aria-label="Tile art" className="flex border border-line">
              {(
                [
                  ["live", "Live"],
                  ["stills", "Stills"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  aria-pressed={art === m}
                  onClick={() => setArt(m)}
                  className={`px-2.5 py-2 font-display text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    art === m ? "bg-codm text-black" : "bg-panel-2 text-mute hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="cut-sm cursor-pointer bg-codm px-3 py-2 font-display text-xs font-extrabold uppercase tracking-wider text-black hover:bg-codm-light">
              {source ? "Replace screenshot" : "Use my screenshot"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUpload(f);
                  e.target.value = "";
                }}
              />
            </label>
            {source && (
              <button
                onClick={onClear}
                className="px-2 py-2 font-display text-xs font-bold uppercase tracking-wider text-mute hover:text-text"
              >
                Sample
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 sm:gap-2 lg:grid-cols-4">
        {tiles.map((l, i) => {
          const active = l.code === activeCode;
          const isCopied = copied === l.code;
          return (
            <motion.article
              key={l.name}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduce ? 0 : Math.min(i * 0.025, 0.3), duration: 0.35 }}
              className={`group relative overflow-hidden border bg-panel-2 ${
                active ? "border-codm" : l.custom ? "border-codm/50" : "border-line"
              }`}
            >
              <div className="relative aspect-[16/10] overflow-hidden">
                <canvas
                  ref={(c) => {
                    if (c) canvases.current.set(l.code, c);
                    else canvases.current.delete(l.code);
                  }}
                  width={W}
                  height={H}
                  aria-hidden
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                />
                {art === "stills" && l.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.image.replace("/looks/", "/looks/thumb/")}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10" />
                <span className="pointer-events-none absolute inset-0 opacity-0 ring-1 ring-inset ring-codm/0 transition group-hover:ring-codm/40" />

                {/* the whole tile opens it in the generator */}
                <button
                  onClick={() => pick(l)}
                  aria-label={`Edit the ${l.name} look in the generator`}
                  className="absolute inset-0 z-0 cursor-pointer focus-visible:outline-offset-[-3px]"
                />

                <button
                  onClick={async () => {
                    await copyCode(l.code, l.name);
                    setCopied(l.code);
                  }}
                  aria-label={`Copy the ${l.name} code`}
                  className={`absolute right-1.5 top-1.5 z-10 px-2 py-1 font-display text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-sm transition-colors ${
                    isCopied
                      ? "bg-lime text-black"
                      : "bg-black/65 text-text hover:bg-codm hover:text-black"
                  }`}
                >
                  {isCopied ? "Copied ✓" : "Copy"}
                </button>

                {l.custom ? (
                  <span className="pointer-events-none absolute left-1.5 top-1.5 z-10 bg-lime px-1.5 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-wider text-black">
                    your build
                  </span>
                ) : (
                  active && (
                    <span className="pointer-events-none absolute left-1.5 top-1.5 z-10 bg-codm px-1.5 py-0.5 font-display text-[9px] font-extrabold uppercase tracking-wider text-black">
                      in editor
                    </span>
                  )
                )}

                <span className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex h-[3px]">
                  {signature(l.code).map((c, k) => (
                    <span key={k} className="flex-1" style={{ background: c }} />
                  ))}
                </span>

                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-2 pb-2.5">
                  <span className="min-w-0">
                    <span className="block truncate font-display text-sm font-extrabold uppercase leading-tight tracking-wide text-text sm:text-base">
                      {l.name}
                    </span>
                    <span className="block truncate text-[10px] leading-tight text-mute sm:text-[11px]">
                      {l.mode} · {l.note}
                    </span>
                  </span>
                  <span className="hidden shrink-0 font-display text-[10px] font-bold uppercase tracking-wider text-codm opacity-0 transition-opacity group-hover:opacity-100 sm:block">
                    Tune →
                  </span>
                </div>
              </div>
            </motion.article>
          );
        })}
      </div>

      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-mute">
        <span>
          {source
            ? "Graded from your screenshot — the same frame the generator is working on."
            : "Graded from the sample scene. Your own screenshot gives a truer read."}
        </span>
        <span className="text-line">|</span>
        <span>The preview is an approximation of the in-game filter — check it in game.</span>
      </p>
    </section>
  );
}
