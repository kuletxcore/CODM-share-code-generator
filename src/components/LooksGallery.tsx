"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { GAMES, LOOKS, applyGrade, decode, drawSample, type Game, type Look } from "@/lib/codm";
import { copyCode } from "@/components/ImportGuide";
import { K, readJson, writeJson } from "@/lib/storage";
import { rememberLook } from "@/components/MyLooks";
import { notify } from "@/components/Toasts";

// One render of the 3D scene shared by every card without an image; each
// look's graded pixels are cached so it is graded once.
const W = 960,
  H = 438;
let base: Promise<ImageData> | null = null;
const graded = new Map<string, Promise<ImageData>>();

function baseImage(): Promise<ImageData> {
  base ??= import("@/lib/scene")
    .then((m) => m.renderScene(W, H, { chips: false }))
    .catch(() => null)
    .then((c) => {
      if (c) return c.getContext("2d")!.getImageData(0, 0, W, H);
      const f = document.createElement("canvas");
      f.width = W;
      f.height = H;
      const ctx = f.getContext("2d")!;
      drawSample(ctx, W, H);
      return ctx.getImageData(0, 0, W, H);
    });
  return base;
}

function gradedImage(code: string): Promise<ImageData> | null {
  const s = decode(code);
  if (!s) return null;
  let p = graded.get(code);
  if (!p) {
    p = baseImage().then((img) => {
      const data = new Uint8ClampedArray(img.data);
      applyGrade(data, s);
      return new ImageData(data, W, H);
    });
    graded.set(code, p);
  }
  return p;
}

/** Preview for looks without a reference image: the 3D scene with the look applied. */
function RenderedThumb({ code }: { code: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    gradedImage(code)?.then((img) => {
      if (live) ref.current?.getContext("2d")?.putImageData(img, 0, 0);
    });
    return () => {
      live = false;
    };
  }, [code]);
  return <canvas ref={ref} width={W} height={H} className="h-full w-full bg-panel-2 object-cover" />;
}

const DWELL = 7; // seconds each look stays on stage while auto-playing
const CHIPS: (Game | null | "favorites")[] = [
  null,
  ...GAMES.filter((g) => LOOKS.some((l) => l.game === g)),
  "favorites",
];

function Art({ look, thumb = false }: { look: Look; thumb?: boolean }) {
  return look.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumb ? look.image.replace("/looks/", "/looks/thumb/") : look.image}
      alt=""
      width={thumb ? 352 : 960}
      height={thumb ? 161 : 439}
      loading={thumb ? "lazy" : undefined}
      fetchPriority={thumb ? "low" : "high"}
      decoding="async"
      className="h-full w-full object-cover"
    />
  ) : (
    <RenderedThumb code={look.code} />
  );
}

export default function LooksGallery({ onEdit }: { onEdit: (code: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null | "favorites">(null);
  const [favs, setFavs] = useState<string[]>([]);
  useEffect(() => setFavs(readJson<string[]>(K.favs, [])), []);
  const toggleFav = (code: string) => {
    const next = favs.includes(code) ? favs.filter((c) => c !== code) : [...favs, code];
    setFavs(next);
    writeJson(K.favs, next);
    notify({
      title: next.includes(code) ? "Added to favourites" : "Removed from favourites",
      ms: 1800,
    });
  };
  const shown =
    game === "favorites"
      ? LOOKS.filter((l) => favs.includes(l.code))
      : game
        ? LOOKS.filter((l) => l.game === game)
        : LOOKS;
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true); // stops for good once the visitor picks a look
  const [hover, setHover] = useState(false);
  const reduce = useReducedMotion();
  const playing = auto && !hover && !reduce;
  const look = shown[Math.min(active, shown.length - 1)] ?? LOOKS[0];
  const [recent, setRecent] = useState<{ name: string; code: string }[]>([]);
  useEffect(() => setRecent(readJson<{ name: string; code: string }[]>(K.recent, [])), [active]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 6000);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    if (!playing || shown.length < 2) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % shown.length), DWELL * 1000);
    return () => clearTimeout(t);
  }, [playing, active, shown.length]);

  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !tab) return;
    // horizontal only, so autoplay never scrolls the page
    const left = tab.offsetLeft - el.offsetLeft;
    if (left < el.scrollLeft || left + tab.offsetWidth > el.scrollLeft + el.clientWidth)
      el.scrollTo({ left: left - (el.clientWidth - tab.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [active, reduce, game]);

  const pick = (i: number) => {
    if (!shown.length) return;
    setAuto(false);
    const next = (i + shown.length) % shown.length;
    setActive(next);
    rememberLook(shown[next].name, shown[next].code);
  };

  return (
    <section
      aria-labelledby="looks-title"
      className="mt-8"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="looks-title" className="font-title text-3xl font-black uppercase tracking-wide sm:text-4xl">
            Pick a look
          </h2>
          <p className="mt-1 text-sm text-mute">Copy a code and the steps to import it in CODM follow.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {recent[0] && (
            <button
              onClick={() => {
                const i = LOOKS.findIndex((l) => l.code === recent[0].code);
                if (i >= 0) { setGame(null); pick(i); }
              }}
              title="Open the last look you viewed"
              className="min-h-11 border border-line bg-panel/80 px-3 font-display text-xs font-bold uppercase tracking-wide text-mute hover:border-codm hover:text-text"
            >
              ↺ Resume: <span className="text-codm-light">{recent[0].name}</span>
            </button>
          )}
          <button
            onClick={() => { setGame(null); pick(Math.floor(Math.random() * LOOKS.length)); }}
            title="Jump to a random look"
            className="min-h-11 border border-line bg-panel/80 px-3 font-display text-xs font-bold uppercase tracking-wide text-mute hover:border-codm hover:text-text"
          >
            ⚄ Surprise me
          </button>
        </div>
        <div
          role="group"
          aria-label="Filter looks by game"
          className="-mx-4 flex w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0"
        >
          {CHIPS.map((g) => (
            <button
              key={g ?? "all"}
              aria-pressed={game === g}
              onClick={() => {
                setGame(g);
                setActive(0);
              }}
              className={`min-h-11 shrink-0 border px-3 font-display text-sm font-bold uppercase tracking-wide transition-colors ${
                game === g
                  ? "border-codm bg-codm text-black"
                  : "border-line bg-panel/80 text-mute hover:border-mute hover:text-text"
              }`}
            >
              {g === "favorites"
                ? `★ Favourites${favs.length ? ` (${favs.length})` : ""}`
                : g
                  ? `${g} (${LOOKS.filter((l) => l.game === g).length})`
                  : `All (${LOOKS.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* stage: the selected look, full width */}
      <div
        role="tabpanel"
        id="look-stage"
        aria-live="polite"
        className="cut relative mt-4 aspect-[4/3] overflow-hidden border border-line bg-black sm:aspect-[21/9]"
      >
        {!shown.length && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-ink/90 p-6 text-center">
            <div>
              <p className="font-display text-xs font-bold uppercase tracking-[0.22em] text-codm">No looks here yet</p>
              <h3 className="mt-2 font-title text-3xl font-black uppercase">Nothing favourited</h3>
              <p className="mt-2 text-sm text-mute">Tap the ★ on any look to pin it here.</p>
              <button
                onClick={() => { setGame(null); setActive(0); }}
                className="cut-sm mt-4 min-h-11 bg-codm px-4 font-display text-sm font-extrabold uppercase text-black"
              >
                Show all looks
              </button>
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          <motion.div
            key={look.name}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: reduce ? 1 : 1.12 }}
            animate={{ opacity: 1, scale: 1, transition: { opacity: { duration: 0.7 }, scale: { duration: DWELL + 1, ease: "easeOut" } } }}
            exit={{ opacity: 0, transition: { duration: 0.7 } }}
          >
            <Art look={look} />
          </motion.div>
        </AnimatePresence>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/10 sm:bg-gradient-to-r sm:from-black/85 sm:via-black/35 sm:to-transparent" />
        <div className="pointer-events-none absolute inset-0 scanlines opacity-60" />

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 sm:inset-y-0 sm:w-[58%] sm:justify-end sm:p-8">
          <motion.div
            key={look.name}
            initial={reduce ? false : { opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          >
            <div className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-widest">
              <span className="bg-codm px-2 py-0.5 text-black">{look.mode}</span>
              <span className="bg-black/70 px-2 py-0.5 text-mute">
                {look.image ? "Inspiration" : "Preview"}
              </span>
            </div>
            <h3
              className={`mt-2 font-title font-black uppercase leading-[0.9] tracking-wide ${
                look.name.length > 12 ? "text-4xl sm:text-5xl lg:text-7xl" : "text-5xl sm:text-6xl lg:text-8xl"
              }`}
            >
              {look.name}
            </h3>
            <p className="mt-2 max-w-md text-sm text-text/90 sm:text-base">{look.note}</p>
          </motion.div>
          <div className="flex max-w-md gap-1">
            <button
              onClick={() => {
                copyCode(look.code, look.name, { note: look.note, image: look.image });
                setCopied(look.code);
                setAuto(false);
              }}
              className={`cut-sm flex-1 px-4 py-3 font-display text-lg font-extrabold uppercase tracking-wider transition-colors ${
                copied === look.code ? "bg-lime text-black" : "bg-codm text-black hover:bg-codm-light"
              }`}
            >
              {copied === look.code ? "Copied ✓" : "Copy code"}
            </button>
            <button
              onClick={() => onEdit(look.code)}
              className="bg-black/70 px-4 py-3 font-display text-sm font-bold uppercase tracking-wider text-text hover:bg-line"
            >
              Customize
            </button>
            <button
              onClick={() => toggleFav(look.code)}
              aria-pressed={favs.includes(look.code)}
              aria-label={favs.includes(look.code) ? "Remove from favourites" : "Add to favourites"}
              title="Favourite this look"
              className={`min-w-12 border border-white/20 px-3 py-3 font-display text-xl ${
                favs.includes(look.code) ? "bg-codm text-black" : "bg-black/70 text-mute hover:text-codm"
              }`}
            >
              ★
            </button>
          </div>
        </div>
      </div>

      {/* filmstrip */}
      <div
        role="tablist"
        aria-label="Looks"
        ref={strip}
        className="-mx-4 mt-2 flex snap-x gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") pick(active + 1);
          else if (e.key === "ArrowLeft") pick(active - 1);
          else return;
          e.preventDefault();
          const strip = e.currentTarget;
          requestAnimationFrame(() =>
            (strip.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus(),
          );
        }}
      >
        {shown.map((l, i) => (
          <button
            key={l.name}
            role="tab"
            id={`look-tab-${i}`}
            aria-selected={i === active}
            aria-controls="look-stage"
            tabIndex={i === active ? 0 : -1}
            onClick={() => pick(i)}
            className={`group relative w-28 shrink-0 snap-start overflow-hidden border bg-black text-left transition-opacity sm:w-44 ${
              i === active ? "border-codm" : "border-line opacity-60 hover:opacity-100"
            }`}
          >
            <div className="aspect-[16/7] overflow-hidden">
              <Art look={l} thumb />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-1.5 pb-1.5 pt-4 font-display text-[10px] font-bold uppercase leading-none tracking-wider sm:text-xs">
              {l.name}
            </div>
            {favs.includes(l.code) && (
              <span className="absolute right-1 top-1 bg-codm px-1 font-display text-[10px] text-black" aria-label="Favourite">
                ★
              </span>
            )}
            {i === active && playing && (
              <motion.span
                key={`${active}-bar`}
                className="absolute inset-x-0 bottom-0 h-[3px] origin-left bg-codm"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: DWELL, ease: "linear" }}
              />
            )}
            {i === active && !playing && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-codm" />}
          </button>
        ))}
      </div>

    </section>
  );
}
