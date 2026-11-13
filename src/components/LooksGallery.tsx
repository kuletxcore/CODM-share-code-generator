"use client";

import { AnimatePresence, motion } from "motion/react";
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

function Card({
  look,
  index,
  copied,
  onCopy,
  onEdit,
}: {
  look: Look;
  index: number;
  copied: boolean;
  onCopy: () => void;
  onEdit: () => void;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ delay: Math.min(index, 4) * 0.05 }}
      className="cut group relative flex w-[78vw] max-w-[340px] shrink-0 snap-start flex-col overflow-hidden border border-line bg-panel/90 sm:w-auto sm:max-w-none"
    >
      <div className="relative aspect-[480/219] overflow-hidden bg-black">
        {look.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={look.image}
            alt={`${look.name} reference`}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <RenderedThumb code={look.code} />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/85 to-transparent" />
        <span className="absolute left-2 top-2 bg-black/70 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-widest text-text">
          {look.mode}
        </span>
        <span className="absolute right-2 top-2 bg-black/70 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-widest text-mute">
          {look.image ? "Inspiration" : "Preview"}
        </span>
        <div className="absolute inset-x-3 bottom-2">
          <h3 className="font-title text-2xl font-black uppercase leading-none tracking-wide">
            {look.name}
          </h3>
          <p className="mt-1 text-xs text-text/80">{look.note}</p>
        </div>
      </div>
      <div className="flex gap-1 p-2">
        <button
          onClick={onCopy}
          className={`cut-sm flex-1 px-3 py-2.5 font-display text-base font-extrabold uppercase tracking-wider transition-colors ${
            copied ? "bg-lime text-black" : "bg-codm text-black hover:bg-codm-light"
          }`}
        >
          {copied ? "Copied ✓" : "Copy code"}
        </button>
        <button
          onClick={onEdit}
          className="bg-panel-2 px-3 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-mute hover:bg-line hover:text-text"
        >
          Customize
        </button>
      </div>
    </motion.li>
  );
}

export default function LooksGallery({ onEdit }: { onEdit: (code: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(null), 6000);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <section aria-labelledby="looks-title" className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="looks-title" className="font-title text-3xl font-black uppercase tracking-wide sm:text-4xl">
            Pick a look
          </h2>
          <p className="mt-1 text-sm text-mute">
            Copy a code, paste it into CODM, done.
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

      <ul className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
        {LOOKS.map((look, i) => (
          <Card
            key={look.name}
            look={look}
            index={i}
            copied={copied === look.code}
            onCopy={() => {
              copyText(look.code);
              setCopied(look.code);
            }}
            onEdit={() => onEdit(look.code)}
          />
        ))}
      </ul>

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
