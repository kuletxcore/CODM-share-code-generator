"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { GAMES, LOOKS, applyGrade, decode, drawSample, type Game, type Look } from "@/lib/codm";
import { announceCopy, copyText } from "@/components/ImportGuide";
import { useScreenTest } from "@/components/ScreenTest";
import ShotFrame from "@/components/ShotFrame";
import { DEFAULT_SAMPLE, loadSample } from "@/lib/samples";
import { shotCardImage } from "@/lib/screenPreview";

// One CODM still shared by every card without an image; each look's graded
// pixels are cached so it is graded once.
const W = 960,
  H = 438;
let base: Promise<ImageData> | null = null;
const graded = new Map<string, Promise<ImageData>>();

function baseImage(): Promise<ImageData> {
  base ??= loadSample(DEFAULT_SAMPLE, W, H)
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

function Art({ look, thumb = false, split = 0 }: { look: Look; thumb?: boolean; split?: number }) {
  const { shot } = useScreenTest();
  if (shot)
    return (
      <ShotFrame
        code={look.code}
        w={thumb ? 352 : 960}
        h={thumb ? 161 : 439}
        split={split}
        className="h-full w-full object-cover"
      />
    );
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
  const { shot } = useScreenTest();
  // Hold the Compare chip to wipe the plain frame in from the left.
  const [compare, setCompare] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const shown = game ? LOOKS.filter((l) => l.game === game) : LOOKS;
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true); // stops for good once the visitor picks a look
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  // Only a deliberate change may be announced. Autoplay rotates every 7s, so a
  // live region on the stage would read a new look name at the visitor forever.
  // A one-shot message keeps this from sticking on after the first pick, which
  // would have let the rotation announce again.
  const [announcement, setAnnouncement] = useState("");
  const reduce = useReducedMotion();
  const playing = auto && !hover && !focused && !reduce;
  const look = shown[Math.min(active, shown.length - 1)];

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 6000);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    if (!playing) return;
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
    setAuto(false);
    const nextIndex = (i + shown.length) % shown.length;
    setActive(nextIndex);
    setAnnouncement(shown[nextIndex] ? `${shown[nextIndex].name}. ${shown[nextIndex].note}` : "");
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
        <div
          role="group"
          aria-label="Filter looks by game"
          className="-mx-4 flex w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:w-auto sm:flex-wrap sm:px-0"
        >
          {[null, ...GAMES.filter((g) => LOOKS.some((l) => l.game === g))].map((g) => (
            <button
              key={g ?? "all"}
              aria-pressed={game === g}
              onClick={() => {
                setGame(g);
                setActive(0);
                setAnnouncement("");
              }}
              className={`min-h-11 shrink-0 border px-3 font-display text-sm font-bold uppercase tracking-wide transition-colors ${
                game === g
                  ? "border-codm bg-codm text-black"
                  : "border-line bg-panel/80 text-mute hover:border-mute hover:text-text"
              }`}
            >
              {g ?? "All"}
            </button>
          ))}
        </div>
      </div>

      {/* stage: the selected look, full width */}
      <div
        role="tabpanel"
        id="look-stage"
        aria-labelledby={`look-tab-${Math.min(active, shown.length - 1)}`}
        // Keyboard focus inside the stage stops the rotation, so a keyboard
        // visitor can actually read what is on screen.
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="cut relative mt-4 aspect-[4/3] overflow-hidden border border-line bg-black sm:aspect-[21/9]"
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={look.name}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: reduce ? 1 : 1.12 }}
            animate={{ opacity: 1, scale: 1, transition: { opacity: { duration: 0.7 }, scale: { duration: DWELL + 1, ease: "easeOut" } } }}
            exit={{ opacity: 0, transition: { duration: 0.7 } }}
          >
            <Art look={look} split={compare && shot ? 0.5 : 0} />
          </motion.div>
        </AnimatePresence>
        {/*
          Announce the look only when the visitor chose it. The stage itself is not
          a live region: autoplay rotates it, and a live region there would read a
          new name every 7 s until the visitor touched something.
        */}
        <p className="sr-only" role="status">
          {announcement}
        </p>
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
                {shot ? "Your screen · approx." : look.inGame ? "In game" : look.image ? "Inspiration" : "Preview"}
              </span>
              {shot && compare && (
                <span className="bg-black/70 px-2 py-0.5 text-codm">Original · left</span>
              )}
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
              onClick={async () => {
                setAuto(false);
                // The clipboard write starts inside the click, before any canvas
                // work, so a slow card render can never cost the copy itself.
                const write = copyText(look.code);
                let image = look.image;
                let note = look.note;
                let source: "screen-test" | undefined;
                if (shot) {
                  // With a screen test on, the card shows the look on the visitor's own frame.
                  const own = await shotCardImage(shot, look.code);
                  if (own) {
                    image = own;
                    note = `${look.note} Graded on your own screenshot.`;
                    source = "screen-test";
                  }
                }
                const ok = await write;
                if (ok) setCopied(look.code);
                announceCopy(look.code, look.name, { note, image, source, blocked: !ok });
              }}
              className={`cut-sm flex-1 px-4 py-3 font-display text-lg font-extrabold uppercase tracking-wider transition-colors ${
                copied === look.code ? "bg-lime text-black" : "bg-codm text-black hover:bg-codm-light"
              }`}
            >
              {copied === look.code ? "Copied ✓" : "Copy code"}
            </button>
            {shot && (
              <button
                onPointerDown={() => {
                  // stop autoplay so the look can't change under the finger
                  setAuto(false);
                  setCompare(true);
                }}
                onPointerUp={() => setCompare(false)}
                onPointerLeave={() => setCompare(false)}
                onKeyDown={(e) => {
                  if (e.key === " " || e.key === "Enter") {
                    setAuto(false);
                    setCompare(true);
                  }
                }}
                onKeyUp={() => setCompare(false)}
                onBlur={() => setCompare(false)}
                aria-label="Hold to compare with your ungraded screenshot"
                className="min-h-11 touch-none select-none bg-black/70 px-4 py-3 font-display text-sm font-bold uppercase tracking-wider text-text hover:bg-line"
              >
                {compare ? "Original" : "Compare"}
              </button>
            )}
            <button
              onClick={() => onEdit(look.code)}
              className="bg-black/70 px-4 py-3 font-display text-sm font-bold uppercase tracking-wider text-text hover:bg-line"
            >
              Customize
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
            onKeyDown={(e) => {
              let next: number | null = null;
              if (e.key === "ArrowRight") next = i + 1;
              else if (e.key === "ArrowLeft") next = i - 1;
              else if (e.key === "Home") next = 0;
              else if (e.key === "End") next = shown.length - 1;
              if (next === null) return;
              e.preventDefault();
              pick((next + shown.length) % shown.length);
              requestAnimationFrame(() => {
                strip.current
                  ?.querySelector<HTMLElement>('[aria-selected="true"]')
                  ?.focus();
              });
            }}
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
