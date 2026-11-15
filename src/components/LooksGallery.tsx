"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LOOKS,
  SWATCH_NAMES,
  applyGrade,
  decode,
  drawSample,
  hueParts,
  type Look,
  type Zone,
} from "@/lib/codm";
import { copyCode } from "@/components/ImportGuide";

// One render of the 3D scene shared by every card/stage preview; each
// look's graded pixels are cached so it is graded once.
const W = 960,
  H = 438;
let base: Promise<ImageData> | null = null;
const graded = new Map<string, Promise<ImageData>>();

export function getGalleryBaseImage(): Promise<ImageData> {
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

export function getGalleryGradedImage(code: string): Promise<ImageData> | null {
  const s = decode(code);
  if (!s) return null;
  let p = graded.get(code);
  if (!p) {
    p = getGalleryBaseImage().then((img) => {
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
    getGalleryGradedImage(code)?.then((img) => {
      if (live) ref.current?.getContext("2d")?.putImageData(img, 0, 0);
    });
    return () => {
      live = false;
    };
  }, [code]);
  return <canvas ref={ref} width={W} height={H} className="h-full w-full bg-panel-2 object-cover" />;
}

/** Interactive Before / After live graded stage canvas with pointer drag-to-wipe. */
function LiveStageSplit({
  code,
  split,
  onSplitChange,
  onInteract,
}: {
  code: string;
  split: number;
  onSplitChange: (v: number) => void;
  onInteract: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [imgs, setImgs] = useState<{ raw: ImageData; graded: ImageData } | null>(null);
  const dragging = useRef(false);

  useEffect(() => {
    let live = true;
    const g = getGalleryGradedImage(code);
    if (!g) return;
    Promise.all([getGalleryBaseImage(), g]).then(([raw, gradedImg]) => {
      if (live) setImgs({ raw, graded: gradedImg });
    });
    return () => {
      live = false;
    };
  }, [code]);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !imgs) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const out = new ImageData(new Uint8ClampedArray(imgs.graded.data), W, H);
    const x = Math.min(W, Math.max(0, Math.round(W * split)));
    if (x > 0) {
      for (let y = 0; y < H; y++) {
        const row = y * W * 4;
        out.data.set(imgs.raw.data.subarray(row, row + x * 4), row);
      }
    }
    ctx.putImageData(out, 0, 0);
  }, [imgs, split]);

  const updateFromClientX = useCallback(
    (clientX: number) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = Math.min(0.96, Math.max(0.04, (clientX - rect.left) / rect.width));
      onSplitChange(pct);
    },
    [onSplitChange],
  );

  return (
    <div
      ref={wrapRef}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        onInteract();
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (!dragging.current) return;
        updateFromClientX(e.clientX);
      }}
      onPointerUp={(e) => {
        if (dragging.current) {
          dragging.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      }}
      className="relative h-full w-full cursor-ew-resize select-none touch-none bg-black"
    >
      <canvas ref={canvasRef} width={W} height={H} className="h-full w-full object-cover" />
      {!imgs && (
        <div className="absolute inset-0 grid place-items-center bg-panel">
          <span className="font-display text-xs font-bold uppercase tracking-[0.25em] text-mute">
            Rendering 3D scene…
          </span>
        </div>
      )}
      {/* Split divider line + tactical drag grip */}
      <div
        className="pointer-events-none absolute inset-y-0 z-10 w-[2px] bg-codm shadow-[0_0_12px_rgba(255,234,59,0.75)]"
        style={{ left: `${split * 100}%` }}
      >
        <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center border-2 border-codm bg-ink/90 text-[11px] font-bold text-codm shadow-lg">
          ◂▸
        </div>
      </div>
      {/* Corner side badges */}
      <span
        className="pointer-events-none absolute left-3 top-3 z-10 bg-black/75 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-widest text-mute transition-opacity"
        style={{ opacity: split > 0.14 ? 1 : 0 }}
      >
        Default CODM
      </span>
      <span
        className="pointer-events-none absolute right-3 top-3 z-10 bg-codm px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-widest text-black transition-opacity sm:right-auto sm:left-[calc(var(--split)+12px)]"
        style={{
          ["--split" as string]: `${split * 100}%`,
          opacity: split < 0.84 ? 1 : 0,
        }}
      >
        Filtered · Drag to wipe
      </span>
    </div>
  );
}

const DWELL = 7; // seconds each look stays on stage while auto-playing

function Art({ look, thumb = false }: { look: Look; thumb?: boolean }) {
  return look.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumb ? look.image.replace("/looks/", "/looks/thumb/") : look.image}
      alt=""
      loading={thumb ? "lazy" : undefined}
      decoding="async"
      className="h-full w-full object-cover"
    />
  ) : (
    <RenderedThumb code={look.code} />
  );
}

function zoneSummary(z: Zone): { color: string; label: string; delta: string } {
  const hp = hueParts(z.hue);
  const tint = Math.round(z.tint);
  const dSat = Math.round(z.sat - 50);
  const dBri = Math.round(z.bri - 50);
  const parts: string[] = [];
  if (tint >= 2) parts.push(`${SWATCH_NAMES[hp.swatch]} ${tint}%`);
  if (Math.abs(dSat) >= 2) parts.push(`Sat ${dSat > 0 ? "+" : ""}${dSat}`);
  if (Math.abs(dBri) >= 2) parts.push(`Bri ${dBri > 0 ? "+" : ""}${dBri}`);
  return {
    color: tint >= 2 ? `hsl(${Math.round(z.hue)} 88% 55%)` : "#6f766d",
    label: tint >= 2 ? SWATCH_NAMES[hp.swatch] : "Neutral",
    delta: parts.length ? parts.join(" · ") : "Neutral",
  };
}

function LookDnaStrip({ code }: { code: string }) {
  const dna = useMemo(() => {
    const s = decode(code);
    if (!s) return null;
    return [
      { key: "Shd", ...zoneSummary(s.zones.shadows) },
      { key: "Mid", ...zoneSummary(s.zones.midtones) },
      { key: "Hlt", ...zoneSummary(s.zones.highlights) },
    ];
  }, [code]);

  if (!dna) return null;
  return (
    <div
      className="flex flex-wrap gap-1.5"
      aria-label="Filter tonal breakdown"
    >
      {dna.map((z) => (
        <div
          key={z.key}
          className="flex items-center gap-1.5 border border-white/10 bg-black/65 px-2 py-1 backdrop-blur-sm"
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rotate-45 border border-white/30"
            style={{ background: z.color }}
          />
          <span className="font-display text-[10px] font-bold uppercase tracking-widest text-mute">
            {z.key}
          </span>
          <span className="font-mono text-[11px] text-text/95">{z.delta}</span>
        </div>
      ))}
    </div>
  );
}

function HitmarkerBurst() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 40 40"
      className="hitmarker-burst pointer-events-none absolute left-1/2 top-1/2 h-11 w-11 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]"
    >
      <path
        d="M8 8 L15 15 M32 8 L25 15 M8 32 L15 25 M32 32 L25 25"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="square"
      />
    </svg>
  );
}

export default function LooksGallery({ onEdit }: { onEdit: (code: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [burstKey, setBurstKey] = useState(0);
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true); // stops for good once the visitor picks a look
  const [hover, setHover] = useState(false);
  const [stageView, setStageView] = useState<"inspiration" | "live">("inspiration");
  const [heroSplit, setHeroSplit] = useState(0.42);
  const reduce = useReducedMotion();
  const playing = auto && !hover && !reduce && stageView === "inspiration";
  const look = LOOKS[active];
  const effectiveView = look.image ? stageView : "live";

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

  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = strip.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!el || !tab) return;
    // horizontal only, so autoplay never scrolls the page
    const left = tab.offsetLeft - el.offsetLeft;
    if (left < el.scrollLeft || left + tab.offsetWidth > el.scrollLeft + el.clientWidth)
      el.scrollTo({ left: left - (el.clientWidth - tab.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  }, [active, reduce]);

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
          <p className="mt-1 text-sm text-mute">
            Compare inspiration vs live filter grade, copy a code, paste it into CODM.
          </p>
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
        {effectiveView === "live" ? (
          <div className="absolute inset-0">
            <LiveStageSplit
              code={look.code}
              split={heroSplit}
              onSplitChange={setHeroSplit}
              onInteract={() => setAuto(false)}
            />
          </div>
        ) : (
          <AnimatePresence initial={false}>
            <motion.div
              key={look.name}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: reduce ? 1 : 1.1 }}
              animate={{
                opacity: 1,
                scale: 1,
                transition: { opacity: { duration: 0.65 }, scale: { duration: DWELL + 1, ease: "easeOut" } },
              }}
              exit={{ opacity: 0, transition: { duration: 0.65 } }}
            >
              <Art look={look} />
            </motion.div>
          </AnimatePresence>
        )}

        <div
          className={`pointer-events-none absolute inset-0 ${
            effectiveView === "live"
              ? "bg-gradient-to-t from-black/90 via-black/25 to-transparent"
              : "bg-gradient-to-t from-black/90 via-black/30 to-black/10 sm:bg-gradient-to-r sm:from-black/85 sm:via-black/35 sm:to-transparent"
          }`}
        />
        <div className="pointer-events-none absolute inset-0 scanlines opacity-55" />

        {/* top-right stage controls: view switcher + slide counter */}
        <div className="absolute right-3 top-3 z-20 flex items-center gap-2 sm:right-5 sm:top-5">
          {look.image && (
            <div
              role="group"
              aria-label="Stage view mode"
              className="flex border border-white/15 bg-ink/85 p-0.5 backdrop-blur-md"
            >
              {(
                [
                  ["inspiration", "Inspiration"],
                  ["live", "Live Filter"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={stageView === v}
                  onClick={() => {
                    setAuto(false);
                    setStageView(v);
                  }}
                  className={`px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider transition-colors ${
                    stageView === v
                      ? "bg-codm text-black"
                      : "text-mute hover:text-text"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <div className="hidden items-center border border-white/15 bg-ink/80 backdrop-blur-md sm:flex">
            <button
              type="button"
              aria-label="Previous look"
              onClick={() => pick(active - 1)}
              className="px-2.5 py-1 font-display text-sm font-bold text-mute hover:bg-white/10 hover:text-text"
            >
              ‹
            </button>
            <span className="px-2 font-mono text-[11px] tabular-nums text-mute">
              {String(active + 1).padStart(2, "0")}/{String(LOOKS.length).padStart(2, "0")}
            </span>
            <button
              type="button"
              aria-label="Next look"
              onClick={() => pick(active + 1)}
              className="px-2.5 py-1 font-display text-sm font-bold text-mute hover:bg-white/10 hover:text-text"
            >
              ›
            </button>
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col gap-2.5 p-4 sm:inset-y-0 sm:w-[62%] sm:justify-end sm:p-7">
          <motion.div
            key={look.name}
            initial={reduce ? false : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
          >
            <div className="flex flex-wrap items-center gap-2 font-display text-[11px] font-bold uppercase tracking-widest">
              <span className="bg-codm px-2 py-0.5 text-black">{look.mode}</span>
              <span className="bg-black/75 px-2 py-0.5 text-mute">
                {effectiveView === "live" ? "Live 3D Grade · Approx." : "Inspiration"}
              </span>
            </div>
            <h3
              className={`mt-1.5 font-title font-black uppercase leading-[0.9] tracking-wide ${
                look.name.length > 12 ? "text-3xl sm:text-5xl lg:text-6xl" : "text-4xl sm:text-6xl lg:text-7xl"
              }`}
            >
              {look.name}
            </h3>
            <p className="mt-1.5 max-w-lg text-xs text-text/90 sm:text-sm">{look.note}</p>
          </motion.div>

          <LookDnaStrip code={look.code} />

          <div className="pointer-events-auto flex max-w-md gap-1.5 pt-0.5">
            <button
              onClick={() => {
                copyCode(look.code, look.name);
                setCopied(look.code);
                setBurstKey((k) => k + 1);
                setAuto(false);
              }}
              className={`cut-sm relative flex-1 overflow-visible px-4 py-3 font-display text-lg font-extrabold uppercase tracking-wider transition-colors ${
                copied === look.code ? "bg-lime text-black" : "bg-codm text-black hover:bg-codm-light"
              }`}
            >
              {copied === look.code ? "Copied ✓" : "Copy code"}
              {burstKey > 0 && copied === look.code && <HitmarkerBurst key={burstKey} />}
            </button>
            <button
              onClick={() => onEdit(look.code)}
              className="border border-white/15 bg-black/75 px-4 py-3 font-display text-sm font-bold uppercase tracking-wider text-text backdrop-blur-sm hover:border-codm hover:bg-line"
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
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") pick(active + 1);
          else if (e.key === "ArrowLeft") pick(active - 1);
          else return;
          e.preventDefault();
          const el = e.currentTarget;
          requestAnimationFrame(() =>
            (el.querySelector('[aria-selected="true"]') as HTMLElement | null)?.focus(),
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
