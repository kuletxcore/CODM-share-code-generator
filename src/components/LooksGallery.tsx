"use client";

import { useEffect, useRef, useState } from "react";
import { LOOKS, applyGrade, decode, drawSample, type Look } from "@/lib/codm";
import { copyCode } from "@/components/ImportGuide";

// The default look has no reference image. Render one shared sample for it.
const W = 960, H = 438;
let base: Promise<ImageData> | null = null;
const graded = new Map<string, Promise<ImageData>>();

function gradedImage(code: string): Promise<ImageData> | null {
  const settings = decode(code);
  if (!settings) return null;
  base ??= import("@/lib/scene")
    .then((m) => m.renderScene(W, H, { chips: false }))
    .catch(() => null)
    .then((canvas) => {
      if (canvas) return canvas.getContext("2d")!.getImageData(0, 0, W, H);
      const fallback = document.createElement("canvas");
      fallback.width = W;
      fallback.height = H;
      const ctx = fallback.getContext("2d")!;
      drawSample(ctx, W, H);
      return ctx.getImageData(0, 0, W, H);
    });
  let result = graded.get(code);
  if (!result) {
    result = base.then((image) => {
      const data = new Uint8ClampedArray(image.data);
      applyGrade(data, settings);
      return new ImageData(data, W, H);
    });
    graded.set(code, result);
  }
  return result;
}

function Art({ look, thumb = false }: { look: Look; thumb?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (look.image) return;
    let live = true;
    gradedImage(look.code)?.then((image) => {
      if (live) ref.current?.getContext("2d")?.putImageData(image, 0, 0);
    });
    return () => { live = false; };
  }, [look]);
  return look.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={thumb ? look.image.replace("/looks/", "/looks/thumb/") : look.image} alt="" loading={thumb ? "lazy" : "eager"} decoding="async" className="h-full w-full object-cover" />
  ) : (
    <canvas ref={ref} width={W} height={H} className="h-full w-full bg-panel-2 object-cover" />
  );
}

const FILTERS = ["All looks", "Warm", "Cool & dark", "Muted", "Classic"] as const;
type Filter = (typeof FILTERS)[number];
const CATEGORIES: Record<string, Filter> = {
  Hajin: "Warm", Apex: "Warm", Avalon: "Warm", "Haven's Hollow": "Warm", Caldera: "Warm", Verdansk: "Warm",
  "Haven's Hollow (Night)": "Cool & dark", Vondead: "Cool & dark",
  "2035": "Muted", "Al Mazrah": "Muted",
  "Cold War": "Classic", Default: "Classic",
};

export default function LooksGallery({ onEdit }: { onEdit: (code: string) => void }) {
  const [active, setActive] = useState(0);
  const [filter, setFilter] = useState<Filter>("All looks");
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const look = LOOKS[active];
  const visible = LOOKS.filter((item) => filter === "All looks" || CATEGORIES[item.name] === filter);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(null), 4000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <section aria-labelledby="looks-title" className="mt-8 sm:mt-10">
      <div ref={stage} className="relative scroll-mt-4 overflow-hidden border border-[#3b3e35] bg-[#10120f]">
        <div className="absolute inset-0 md:left-[32%]">
          <Art look={look} />
          <div className="absolute inset-0 bg-gradient-to-t from-[#10120f] via-[#10120f]/65 to-black/10 md:bg-gradient-to-r md:from-[#10120f] md:via-[#10120f]/65 md:to-black/10" />
          <div className="scanlines absolute inset-0 opacity-50" />
        </div>
        <div className="relative flex min-h-[470px] flex-col justify-between p-5 sm:min-h-[500px] sm:p-8 lg:min-h-[520px] lg:p-12">
          <div className="flex items-center justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.2em] text-white/70 sm:text-xs">
            <span className="flex items-center gap-2"><span className="h-2 w-2 bg-codm" /> The look collection</span>
            <span>{String(active + 1).padStart(2, "0")} / {String(LOOKS.length).padStart(2, "0")}</span>
          </div>
          <div className="max-w-xl pt-20">
            <p className="font-display text-sm font-bold uppercase tracking-[0.24em] text-codm">Your next drop looks different</p>
            <h2 id="looks-title" className="mt-3 font-title text-4xl font-black uppercase leading-[0.95] tracking-wide sm:text-6xl lg:text-7xl">Find your<br /><span className="text-codm">visual edge.</span></h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">Choose a look inspired by your favourite maps. Copy the code, import it in CODM, and make it yours.</p>
            <div className="mt-7 border-l-2 border-codm pl-4">
              <div className="flex flex-wrap items-center gap-2"><span className="font-display text-2xl font-extrabold uppercase tracking-wide sm:text-3xl">{look.name}</span><span className="border border-white/25 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/70">{look.image ? "Inspiration image" : "Sample preview"}</span></div>
              <p className="mt-1 text-sm text-white/65">{look.note}</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={async () => { const ok = await copyCode(look.code, look.name); setCopyError(!ok); if (ok) setCopied(look.code); }} className="cut-sm min-w-44 bg-codm px-6 py-3.5 font-display text-lg font-extrabold uppercase tracking-wider text-black transition-colors hover:bg-codm-light">
                {copied === look.code ? "Copied ✓" : "Copy this code  ↗"}
              </button>
              <button onClick={() => onEdit(look.code)} className="border border-white/30 bg-black/30 px-6 py-3.5 font-display text-lg font-bold uppercase tracking-wider text-white transition-colors hover:border-codm hover:text-codm">Customize</button>
            </div>
            {copyError && <p role="alert" className="mt-3 text-sm text-red-300">Could not copy automatically. Open Customize to select and copy the code.</p>}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-codm">The collection / {String(LOOKS.length).padStart(2, "0")} looks</p>
          <h3 className="mt-1 font-title text-2xl font-black uppercase tracking-wide sm:text-3xl">Choose your atmosphere</h3>
          <p className="mt-1 text-sm text-mute">Select a look to see its details above.</p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter looks by atmosphere">
          {FILTERS.map((item) => (
            <button key={item} onClick={() => setFilter(item)} aria-pressed={filter === item} className={`border px-3 py-2 font-display text-sm font-bold uppercase tracking-wider transition-colors ${filter === item ? "border-codm bg-codm text-black" : "border-line bg-panel/70 text-mute hover:border-mute hover:text-text"}`}>{item}</button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {visible.map((item) => {
          const index = LOOKS.indexOf(item);
          const selected = index === active;
          return (
            <button key={item.name} onClick={() => { setActive(index); setCopyError(false); stage.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }); }} aria-pressed={selected} className={`group relative overflow-hidden border text-left transition-colors ${selected ? "border-codm" : "border-line hover:border-white/60"}`}>
              <div className="aspect-[16/10] overflow-hidden bg-panel-2"><Art look={item} thumb /></div>
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-3"><span className="block font-mono text-[9px] uppercase tracking-widest text-white/60">{CATEGORIES[item.name]}</span><span className="mt-1 block font-display text-base font-extrabold uppercase leading-tight tracking-wide text-white sm:text-lg">{item.name}</span></div>
              {selected && <span className="absolute right-2 top-2 bg-codm px-1.5 py-1 font-mono text-[9px] font-bold uppercase text-black">Selected</span>}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-mute">Images show the inspiration, not the in-game result. Filter previews are approximate; check your look in CODM.</p>
    </section>
  );
}
