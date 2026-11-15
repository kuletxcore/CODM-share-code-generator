"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderShareCard } from "@/lib/shareCard";
import { drawQr } from "@/lib/qr";
import { copyCode } from "@/components/ImportGuide";

export default function ShareCardModal({
  open,
  code,
  defaultTitle,
  sourceCanvas,
  onClose,
}: {
  open: boolean;
  code: string;
  defaultTitle: string;
  sourceCanvas: HTMLCanvasElement | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [split, setSplit] = useState(36);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const cardCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrMiniRef = useRef<HTMLCanvasElement>(null);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `#c=${code}`;
    return `${window.location.origin}${window.location.pathname}#c=${code}`;
  }, [code]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const card = renderShareCard({
      title,
      code,
      shareUrl,
      sourceCanvas,
      split: split / 100,
    });
    const view = cardCanvasRef.current;
    if (view) {
      view.width = card.width;
      view.height = card.height;
      view.getContext("2d")?.drawImage(card, 0, 0);
    }
    const q = qrMiniRef.current;
    if (q) {
      q.width = 160;
      q.height = 160;
      const qctx = q.getContext("2d");
      if (qctx) {
        try {
          drawQr(qctx, shareUrl, 0, 0, 160, "#0a0b0a", "#ffffff");
        } catch {
          drawQr(qctx, code, 0, 0, 160, "#0a0b0a", "#ffffff");
        }
      }
    }
  }, [open, title, code, shareUrl, sourceCanvas, split]);

  const handleDownload = () => {
    const view = cardCanvasRef.current;
    if (!view) return;
    const slug = (title.trim() || "codm-filter")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const a = document.createElement("a");
    a.download = `${slug || "codm-filter"}-loadout.png`;
    a.href = view.toDataURL("image/png");
    a.click();
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 2000);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // fallback
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-card-title"
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            className="cut max-h-[92svh] w-full max-w-4xl overflow-y-auto border-2 border-codm bg-ink p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-display text-xs font-bold uppercase tracking-[0.25em] text-codm">
                  Share &amp; Mobile Handoff
                </p>
                <h2
                  id="share-card-title"
                  className="mt-1 font-title text-3xl font-black uppercase leading-none tracking-wide"
                >
                  Tactical Filter Card
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close share card"
                className="border border-line bg-panel-2 px-3 py-1 font-display text-sm font-bold uppercase tracking-wider text-mute hover:border-codm hover:text-text"
              >
                Close ×
              </button>
            </div>

            {/* Live rendered 1200x675 PNG preview */}
            <div className="mt-4 overflow-hidden border border-line bg-black">
              <canvas
                ref={cardCanvasRef}
                className="block aspect-video w-full"
                aria-label="Preview of downloadable CODM tactical filter card"
              />
            </div>

            {/* Customization + Direct Mobile QR */}
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
              <div className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-mute">
                      Card Title
                    </span>
                    <input
                      value={title}
                      maxLength={28}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Ranked Visibility V2"
                      className="border border-line bg-black/60 px-3 py-2 font-display text-base font-bold uppercase tracking-wide text-text focus:border-codm focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="flex justify-between font-display text-xs font-bold uppercase tracking-wider text-mute">
                      <span>Before / After Split</span>
                      <span className="font-mono text-codm">{split}%</span>
                    </span>
                    <input
                      type="range"
                      className="slider mt-1"
                      min={0}
                      max={85}
                      value={split}
                      style={{ ["--track" as string]: "linear-gradient(90deg,#3a3f39,#ffea3b)" }}
                      onChange={(e) => setSplit(Number(e.target.value))}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className={`cut-sm px-5 py-2.5 font-display text-base font-extrabold uppercase tracking-wider transition-colors ${
                      downloaded
                        ? "bg-lime text-black"
                        : "bg-codm text-black hover:bg-codm-light"
                    }`}
                  >
                    {downloaded ? "PNG Saved ✓" : "Download PNG Card"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="border border-line bg-panel-2 px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-text hover:border-codm"
                  >
                    {copiedLink ? "Share Link Copied ✓" : "Copy Share Link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      void copyCode(code, title.trim() || "Custom Filter");
                      onClose();
                    }}
                    className="border border-line bg-black/50 px-4 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-mute hover:border-text hover:text-text"
                  >
                    Copy Raw Code
                  </button>
                </div>
              </div>

              {/* Standalone Crisp Phone Scan Block */}
              <div className="flex items-center gap-3 border border-codm/50 bg-panel p-3">
                <canvas
                  ref={qrMiniRef}
                  width={160}
                  height={160}
                  className="h-24 w-24 shrink-0 border border-white/20 bg-white"
                />
                <div className="max-w-[160px]">
                  <p className="font-display text-xs font-extrabold uppercase tracking-wider text-codm">
                    On PC? Scan to Phone
                  </p>
                  <p className="mt-1 text-xs leading-snug text-mute">
                    Point your phone camera here to open this code on mobile &amp; paste straight into CODM.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
