"use client";

import { useEffect, useRef, useState } from "react";
import { GAMES, LOOKS, applyGrade, decode, type Game, type Look } from "@/lib/codm";
import { SAMPLE } from "@/lib/frame";

/** Position of the visitor's own mix in the strip; looks use their index in LOOKS. */
export const MIX = -1;

const TW = 176,
  TH = 80;
let base: Promise<ImageData | null> | null = null;

/** Pixels of the sample frame at thumbnail size, read once. */
function thumbPixels() {
  base ??= new Promise<ImageData | null>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = TW;
      c.height = TH;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0, TW, TH);
      resolve(ctx.getImageData(0, 0, TW, TH));
    };
    img.onerror = () => resolve(null);
    img.src = SAMPLE.thumb;
  });
  return base;
}

/** The sample frame with a code applied. Small enough to grade on the CPU while a slider moves. */
function GradedThumb({ code }: { code: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    thumbPixels().then((img) => {
      const s = decode(code);
      const ctx = ref.current?.getContext("2d");
      if (!live || !img || !s || !ctx) return;
      const data = new Uint8ClampedArray(img.data);
      applyGrade(data, s);
      ctx.putImageData(new ImageData(data, TW, TH), 0, 0);
    });
    return () => {
      live = false;
    };
  }, [code]);
  return <canvas ref={ref} width={TW} height={TH} className="h-full w-full bg-panel-2 object-cover" />;
}

/** A look's reference still; looks without one show the sample frame, which is what they leave untouched. */
function lookThumb(look: Look) {
  return look.image ? look.image.replace("/looks/", "/looks/thumb/") : SAMPLE.thumb;
}

/** "All", then every game that has a look. */
const FILTERS: (Game | null)[] = [null, ...GAMES.filter((g) => LOOKS.some((l) => l.game === g))];

// Beside the controls the looks sit in rows of four (six from xl); the mix tab stands as tall as those rows.
const MIX_ROWS_LG = ["", "lg:row-span-1", "lg:row-span-2", "lg:row-span-3"];
const MIX_ROWS_XL = ["", "xl:row-span-1", "xl:row-span-2"];

/**
 * Every look, plus the visitor's own mix once they have one. Picking a tab
 * loads that filter into the frame, the controls and the code at once. The
 * chips above narrow the looks down to one game.
 */
export default function LookStrip({
  active,
  mix,
  onPick,
}: {
  /** Index into LOOKS, or MIX. */
  active: number;
  /** Code of the visitor's own mix, if they have made one. */
  mix: string | null;
  onPick: (i: number) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  const [game, setGame] = useState<Game | null>(null);
  // A look from another game can still arrive, from a pasted code or a link. The filter gives way to it.
  if (game && active !== MIX && LOOKS[active]?.game !== game) setGame(null);
  const shown = LOOKS.map((_, i) => i).filter((i) => !game || LOOKS[i].game === game);
  const order = [...(mix ? [MIX] : []), ...shown];

  const filter = (g: Game | null) => {
    setGame(g);
    // the look on the frame is always one of the tabs: when the filter hides it, move to the first that is left
    if (g && active !== MIX && LOOKS[active]?.game !== g) onPick(LOOKS.findIndex((l) => l.game === g));
  };

  // keep the selected tab in sight; horizontal only, so it never scrolls the page
  useEffect(() => {
    const el = strip.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !tab || el.scrollWidth <= el.clientWidth) return;
    const left = tab.offsetLeft - el.offsetLeft;
    if (left < el.scrollLeft || left + tab.offsetWidth > el.scrollLeft + el.clientWidth)
      el.scrollTo({
        left: left - (el.clientWidth - tab.offsetWidth) / 2,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      });
  }, [active, game]);

  // A remembered mix joins the strip at its start after the page has loaded. Scroll
  // snapping would hold on to the tab that was first and push the mix out of sight.
  const hasMix = !!mix;
  useEffect(() => {
    const el = strip.current;
    if (hasMix && el && el.scrollLeft < el.clientWidth / 2) el.scrollTo({ left: 0, behavior: "auto" });
  }, [hasMix]);

  const tab =
    "group relative w-28 shrink-0 snap-start overflow-hidden border bg-black text-left transition-[filter,border-color] sm:w-36 lg:w-auto";
  const idle = "brightness-[0.72] saturate-[0.85] hover:brightness-100 hover:saturate-100";
  const caption =
    "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1.5 pt-4 font-display text-[10px] font-bold uppercase leading-none tracking-wider sm:text-[11px]";

  return (
    <>
      <div
        role="group"
        aria-label="Filter looks by game"
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-8 sm:flex-wrap sm:px-8 lg:mx-0 lg:px-0"
      >
        {FILTERS.map((g) => (
          <button
            key={g ?? "all"}
            aria-pressed={game === g}
            onClick={() => filter(g)}
            className={`game-chip min-h-11 shrink-0 border px-3 font-display text-sm font-bold uppercase tracking-wide transition-colors lg:max-xl:px-2.5 ${
              game === g
                ? "border-codm bg-codm text-black"
                : "border-line bg-panel/80 text-mute hover:border-mute hover:text-text"
            }`}
          >
            {g ?? "All"}
          </button>
        ))}
      </div>

      <div
        role="tablist"
        aria-label="Looks"
        ref={strip}
        className={`-mx-4 mt-2 flex snap-x scroll-px-4 gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:grid lg:overflow-visible lg:px-0 lg:pb-0 ${
          // beside the controls every look shows at once, in rows; the visitor's mix stands next to them
          mix
            ? "lg:grid-cols-[minmax(0,0.8fr)_repeat(4,minmax(0,1fr))] xl:grid-cols-[minmax(0,0.8fr)_repeat(6,minmax(0,1fr))]"
            : "lg:grid-cols-4 xl:grid-cols-6"
        }`}
        onKeyDown={(e) => {
          const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
          if (!step) return;
          e.preventDefault();
          const at = Math.max(0, order.indexOf(active));
          onPick(order[(at + step + order.length) % order.length]);
          const el = e.currentTarget;
          requestAnimationFrame(() => el.querySelector<HTMLElement>('[aria-selected="true"]')?.focus());
        }}
      >
        {mix && (
          <button
            role="tab"
            id="look-tab-mix"
            aria-selected={active === MIX}
            aria-controls="look-stage"
            tabIndex={active === MIX ? 0 : -1}
            onClick={() => onPick(MIX)}
            className={`${tab} ${MIX_ROWS_LG[Math.ceil(shown.length / 4)]} ${MIX_ROWS_XL[Math.ceil(shown.length / 6)]} ${active === MIX ? "border-codm" : `border-dashed border-codm/60 ${idle}`}`}
          >
            <div className="aspect-[16/7] overflow-hidden lg:aspect-auto lg:h-full">
              <GradedThumb code={mix} />
            </div>
            <div className={`${caption} flex items-center gap-1 text-codm`}>
              <span className="inline-block h-1.5 w-1.5 shrink-0 rotate-45 bg-codm" />
              Your mix
            </div>
            {active === MIX && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-codm" />}
          </button>
        )}
        {shown.map((i) => {
          const l = LOOKS[i];
          return (
            <button
              key={l.name}
              role="tab"
              id={`look-tab-${i}`}
              aria-selected={i === active}
              aria-controls="look-stage"
              tabIndex={i === active || (active === MIX && !mix && i === shown[0]) ? 0 : -1}
              onClick={() => onPick(i)}
              className={`${tab} ${i === active ? "border-codm" : `border-line ${idle}`}`}
            >
              <div className="aspect-[16/7] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={lookThumb(l)}
                  alt=""
                  width={352}
                  height={161}
                  decoding="async"
                  fetchPriority="low"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className={caption}>{l.name}</div>
              {i === active && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-codm" />}
            </button>
          );
        })}
      </div>
    </>
  );
}
