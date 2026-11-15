"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cardFileName, hueLabel, renderLookCard, type CardInput } from "@/lib/card";

/**
 * The look as an image: the graded frame, its name and its code, ready to post.
 * Opened from the editor; shared with the system sheet where there is one and
 * downloaded everywhere else.
 */
export default function ShareCard({ input, onClose }: { input: CardInput; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<"working" | "ready" | "error" | "shared">("working");
  const [copied, setCopied] = useState(false);
  const inputRef = useRef(input);

  useEffect(() => {
    let live = true;
    const { frame, settings, name, note, code } = inputRef.current;
    renderLookCard({ frame, settings, name, note, code })
      .then(
        (canvas) =>
          new Promise<{ canvas: HTMLCanvasElement; blob: Blob | null }>((resolve) =>
            canvas.toBlob((b) => resolve({ canvas, blob: b }), "image/png"),
          ),
      )
      .then(({ canvas, blob }) => {
        if (!live) return;
        setUrl(canvas.toDataURL("image/png"));
        setBlob(blob);
        setStatus("ready");
      })
      .catch(() => {
        if (live) setStatus("error");
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fileName = cardFileName(input.name);

  const download = () => {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
  };

  const share = async () => {
    if (!blob) return;
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: `${input.name} — CODM Filter Lab`,
          text: `Share code: ${input.code}`,
        });
        setStatus("shared");
        return;
      } catch {
        /* dismissed — fall through to copying the image */
      }
    }
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      download();
    }
  };

  const canShare = typeof navigator !== "undefined" && !!navigator.canShare && !!blob;
  const { settings } = input;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="card-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/80 p-3 backdrop-blur-sm sm:p-6"
    >
      <div className="flex w-full max-w-3xl items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.26em] text-codm">
            Look card
          </p>
          <h2
            id="card-title"
            className="truncate font-display text-lg font-extrabold uppercase tracking-wide"
          >
            {input.name}
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="Close the look card"
          className="grid h-9 w-9 shrink-0 place-items-center border border-line bg-panel-2 text-sm text-mute hover:bg-line hover:text-text"
        >
          ✕
        </button>
      </div>

      <div className="relative w-full max-w-3xl overflow-hidden border border-line bg-panel">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Look card for ${input.name}`} className="block h-auto w-full" />
        ) : (
          <div className="grid aspect-[1200/630] place-items-center text-sm text-mute">
            {status === "error" ? "Could not draw the card." : "Developing the card…"}
          </div>
        )}
      </div>

      <div className="flex w-full max-w-3xl flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={share}
            disabled={!blob}
            className="cut bg-codm px-4 py-2.5 font-display text-base font-extrabold uppercase tracking-wider text-black transition-colors hover:bg-codm-light disabled:opacity-40"
          >
            {copied ? "Image copied ✓" : status === "shared" ? "Shared ✓" : canShare ? "Share card" : "Copy image"}
          </button>
          <button
            onClick={download}
            disabled={!url}
            className="cut-sm bg-panel-2 px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wider hover:bg-line disabled:opacity-40"
          >
            Download PNG
          </button>
          <code className="ml-auto hidden truncate font-mono text-[11px] text-mute sm:block">
            {fileName}
          </code>
        </div>
        <p className="text-[11px] leading-snug text-mute">
          Frame, name, tone colours and the 22-number code in one image — the thing to drop in a
          group chat. Shadows {hueLabel(settings, "shadows")} · Mids{" "}
          {hueLabel(settings, "midtones")} · Highlights {hueLabel(settings, "highlights")}.
        </p>
      </div>
    </motion.div>
  );
}
