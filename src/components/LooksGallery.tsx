"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { LOOKS, applyGrade, decode, drawSample, type Look } from "@/lib/codm";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    t.remove();
  }
}

/** Approximate preview for looks without an in-game capture. */
function RenderedThumb({ code }: { code: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    const s = decode(code);
    if (!c || !s) return;
    const ctx = c.getContext("2d")!;
    drawSample(ctx, c.width, c.height);
    const img = ctx.getImageData(0, 0, c.width, c.height);
    applyGrade(img.data, s);
    ctx.putImageData(img, 0, 0);
  }, [code]);
  return <canvas ref={ref} width={480} height={219} className="h-full w-full object-cover" />;
}

const DWELL = 7; // seconds each look stays on stage while auto-playing

function Art({ look }: { look: Look }) {
  return look.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={look.image} alt="" className="h-full w-full object-cover" />
  ) : (
    <RenderedThumb code={look.code} />
  );
}

export default function LooksGallery({ onEdit }: { onEdit: (code: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true); // stops for good once the visitor picks a look
  const [hover, setHover] = useState(false);
  const reduce = useReducedMotion();
  const playing = auto && !hover && !reduce;
  const look = LOOKS[active];

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 6000);
    return () => clearTimeout(t);
  }, [copied]);

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % LOOKS.length), DWELL * 1000);
    return () => clearTimeout(t);
  }, [playing, active]);

  const pick = (i: number) => {
    setAuto(false);
    setActive((i + LOOKS.length) % LOOKS.length);
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
          <p className="mt-1 text-sm text-mute">Copy a code, paste it into CODM, done.</p>
        </div>
        <ol className="flex gap-3 font-display text-xs font-bold uppercase tracking-widest text-mute">
          {["Copy", "Import in game", "Apply"].map((s, i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="grid h-5 w-5 place-items-center bg-codm text-[11px] text-black">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      {/* stage: the selected look, full width */}
      <div
        role="tabpanel"
        id="look-stage"
        aria-live="polite"
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
            <h3 className="mt-2 font-title text-5xl font-black uppercase leading-[0.9] tracking-wide sm:text-6xl lg:text-8xl">
              {look.name}
            </h3>
            <p className="mt-2 max-w-md text-sm text-text/90 sm:text-base">{look.note}</p>
          </motion.div>
          <div className="flex max-w-md gap-1">
            <button
              onClick={() => {
                copyText(look.code);
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
          </div>
        </div>
      </div>

      {/* filmstrip */}
      <div
        role="tablist"
        aria-label="Looks"
        className="mt-2 grid grid-cols-6 gap-1.5"
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
        {LOOKS.map((l, i) => (
          <button
            key={l.name}
            role="tab"
            id={`look-tab-${i}`}
            aria-selected={i === active}
            aria-controls="look-stage"
            tabIndex={i === active ? 0 : -1}
            onClick={() => pick(i)}
            className={`group relative overflow-hidden border bg-black text-left transition-opacity ${
              i === active ? "border-codm" : "border-line opacity-60 hover:opacity-100"
            }`}
          >
            <div className="aspect-[16/7] overflow-hidden">
              <Art look={l} />
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

      <AnimatePresence>
        {copied && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="cut fixed inset-x-4 bottom-36 z-30 mx-auto max-w-xl border border-codm bg-ink/95 p-4 shadow-2xl backdrop-blur lg:bottom-24"
          >
            <p className="font-display text-lg font-extrabold uppercase tracking-wide text-codm">
              Code copied
            </p>
            <p className="mt-1 text-sm text-text/90">
              In CODM: Settings → Audio and Graphics → Graphic Style → Import → Go, pick a Custom
              slot, paste, then Apply.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
