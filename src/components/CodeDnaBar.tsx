"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import {
  SWATCH_NAMES,
  extractShareCode,
  findClosestLook,
  hueParts,
  type Settings,
  type Zone,
} from "@/lib/codm";
import { copyCode } from "@/components/ImportGuide";

export type DnaTarget = "global" | "range" | "shadows" | "midtones" | "highlights";

type Segment = {
  id: string;
  label: string;
  raw: string;
  target: DnaTarget;
  dotColor: string;
  textClass: string;
  summary: string;
};

function zoneReadout(z: Zone): { dot: string; summary: string } {
  const hp = hueParts(z.hue);
  const tint = Math.round(z.tint);
  const sat = Math.round(z.sat);
  const bri = Math.round(z.bri);
  const dot = tint >= 2 ? `hsl(${Math.round(z.hue)} 88% 55%)` : "#6f766d";
  const parts: string[] = [];
  if (tint >= 2) parts.push(`${SWATCH_NAMES[hp.swatch]} ${tint}%`);
  else parts.push("Neutral");
  parts.push(`Sat ${sat}`);
  parts.push(`Bri ${bri}`);
  return { dot, summary: parts.join(" · ") };
}

export default function CodeDnaBar({
  code,
  settings,
  onLoad,
  onJumpToPanel,
  onShareCard,
  onReset,
}: {
  code: string;
  settings: Settings;
  onLoad: (c: string) => boolean;
  onJumpToPanel: (target: DnaTarget) => void;
  onShareCard: () => void;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [input, setInput] = useState("");
  const [pasteNotice, setPasteNotice] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [xrayOpen, setXrayOpen] = useState(false);

  const closest = useMemo(() => findClosestLook(settings), [settings]);

  const segments = useMemo<Segment[]>(() => {
    const parts = code.split("_");
    const g = zoneReadout(settings.zones.global);
    const sh = zoneReadout(settings.zones.shadows);
    const mid = zoneReadout(settings.zones.midtones);
    const hi = zoneReadout(settings.zones.highlights);
    return [
      {
        id: "head",
        label: "Preset",
        raw: parts.slice(0, 2).join("_"),
        target: "global",
        dotColor: "#989e95",
        textClass: "text-mute hover:text-text",
        summary: `Simple Preset #${settings.preset + 1} · ${settings.enabled ? "Filter ON" : "OFF"}`,
      },
      {
        id: "range",
        label: "Range",
        raw: parts.slice(2, 6).join("_"),
        target: "range",
        dotColor: "#2dd4ff",
        textClass: "text-cyan-300/90 hover:text-cyan-200",
        summary: `Shadows ${Math.round(settings.shadowPos / 10)}% · Highlights ${Math.round(
          settings.highlightPos / 10,
        )}%`,
      },
      {
        id: "global",
        label: "Simple",
        raw: parts.slice(6, 10).join("_"),
        target: "global",
        dotColor: g.dot,
        textClass: "text-text/80 hover:text-white",
        summary: g.summary,
      },
      {
        id: "shadows",
        label: "Shadows",
        raw: parts.slice(10, 14).join("_"),
        target: "shadows",
        dotColor: sh.dot,
        textClass: "text-sky-300 hover:text-sky-200",
        summary: sh.summary,
      },
      {
        id: "midtones",
        label: "Midtones",
        raw: parts.slice(14, 18).join("_"),
        target: "midtones",
        dotColor: mid.dot,
        textClass: "text-lime hover:text-lime",
        summary: mid.summary,
      },
      {
        id: "highlights",
        label: "Highlights",
        raw: parts.slice(18, 22).join("_"),
        target: "highlights",
        dotColor: hi.dot,
        textClass: "text-codm hover:text-codm-light",
        summary: hi.summary,
      },
    ];
  }, [code, settings]);

  const hoveredSeg = segments.find((s) => s.id === hoveredId) ?? null;

  const handleCopy = async () => {
    const label = closest.exact ? closest.look.name : `Custom (≈ ${closest.look.name})`;
    await copyCode(code, label);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#c=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  const tryExtractAndLoad = (raw: string, fromPaste = false) => {
    const extracted = extractShareCode(raw);
    if (extracted && onLoad(extracted)) {
      const wasDirty = extracted !== raw.trim();
      setInput("");
      setPasteNotice({
        kind: "ok",
        text: wasDirty
          ? "Smart-extracted filter code from pasted text ✓"
          : fromPaste
            ? "Loaded code from clipboard ✓"
            : "Code loaded ✓",
      });
      setTimeout(() => setPasteNotice(null), 3200);
      return true;
    }
    if (!fromPaste) {
      setPasteNotice({
        kind: "err",
        text: "No valid 22-number CODM filter code found in that text or link.",
      });
    }
    return false;
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/95 backdrop-blur-md">
      {/* Hover inspection bar or expanded X-Ray DNA panel */}
      <AnimatePresence>
        {(xrayOpen || hoveredSeg) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-b border-line/80 bg-panel/95"
          >
            <div className="mx-auto max-w-[1400px] px-4 py-2.5 sm:px-8">
              {xrayOpen ? (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-bold uppercase tracking-[0.2em] text-codm">
                        Code DNA X-Ray
                      </span>
                      <span className="border border-line bg-black/50 px-2 py-0.5 font-mono text-[11px] text-lime">
                        {closest.exact
                          ? `Exact match: ${closest.look.name}`
                          : `Closest look: ${closest.look.name} (${closest.similarity}%)`}
                      </span>
                    </div>
                    <span className="text-[11px] text-mute">
                      Click any block to jump directly to its controls
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
                    {segments.map((seg) => (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => {
                          onJumpToPanel(seg.target);
                          setXrayOpen(false);
                        }}
                        className="flex flex-col gap-0.5 border border-line bg-black/50 px-2.5 py-2 text-left transition-colors hover:border-codm hover:bg-panel-2"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="flex items-center gap-1.5 font-display text-[11px] font-bold uppercase tracking-wider text-text">
                            <span
                              className="h-2 w-2 rotate-45 border border-white/30"
                              style={{ background: seg.dotColor }}
                            />
                            {seg.label}
                          </span>
                          <span className="font-mono text-[9px] text-mute">edit ↗</span>
                        </div>
                        <span className="truncate font-mono text-[10px] text-text/90">
                          {seg.summary}
                        </span>
                        <span className={`truncate font-mono text-[10px] opacity-80 ${seg.textClass}`}>
                          {seg.raw}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                hoveredSeg && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rotate-45 border border-white/40"
                        style={{ background: hoveredSeg.dotColor }}
                      />
                      <span className="font-display font-bold uppercase tracking-wider text-codm">
                        {hoveredSeg.label}
                      </span>
                      <span className="font-mono text-text">{hoveredSeg.summary}</span>
                    </div>
                    <span className="font-display text-[11px] font-bold uppercase tracking-wider text-mute">
                      Click segment to jump to {hoveredSeg.label} →
                    </span>
                  </div>
                )
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Command Dock row */}
      <div className="mx-auto flex max-w-[1400px] flex-col gap-2.5 px-4 py-2.5 sm:px-8 lg:flex-row lg:items-center">
        {/* Left: Interactive Color-Coded DNA Code + Actions */}
        <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            aria-expanded={xrayOpen}
            onClick={() => setXrayOpen((v) => !v)}
            title="Inspect the 6 decoded blocks inside this 22-integer share code"
            className={`shrink-0 border px-2 py-2 font-display text-xs font-extrabold uppercase tracking-wider transition-colors ${
              xrayOpen
                ? "border-codm bg-codm/20 text-codm"
                : "border-line bg-panel-2 text-mute hover:border-codm hover:text-text"
            }`}
          >
            DNA {xrayOpen ? "▾" : "▴"}
          </button>

          {/* Segmented clickable share code */}
          <div
            aria-label="Interactive filter share code segments"
            className="flex min-w-0 flex-1 items-center overflow-x-auto bg-black/55 px-2.5 py-1.5 font-mono text-xs [scrollbar-width:none] sm:text-sm"
          >
            {segments.map((seg, i) => (
              <span key={seg.id} className="inline-flex shrink-0 items-center">
                {i > 0 && <span className="text-line select-none">_</span>}
                <button
                  type="button"
                  onMouseEnter={() => setHoveredId(seg.id)}
                  onMouseLeave={() => setHoveredId((cur) => (cur === seg.id ? null : cur))}
                  onFocus={() => setHoveredId(seg.id)}
                  onBlur={() => setHoveredId((cur) => (cur === seg.id ? null : cur))}
                  onClick={() => onJumpToPanel(seg.target)}
                  title={`${seg.label}: ${seg.summary} (click to edit)`}
                  className={`rounded-xs px-0.5 py-0.5 transition-colors hover:bg-white/10 ${seg.textClass}`}
                >
                  {seg.raw}
                </button>
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            title="Copy a direct shareable link to this exact filter"
            className={`hidden shrink-0 border px-2.5 py-2 font-display text-xs font-bold uppercase tracking-wider transition-colors sm:inline-block ${
              linkCopied
                ? "border-lime bg-lime text-black"
                : "border-line bg-panel-2 text-text hover:border-codm"
            }`}
          >
            {linkCopied ? "Link ✓" : "Link"}
          </button>

          <button
            type="button"
            onClick={onShareCard}
            title="Download Tactical PNG Filter Card or scan QR to phone"
            className="shrink-0 border border-line bg-panel-2 px-2.5 py-2 font-display text-xs font-bold uppercase tracking-wider text-codm hover:border-codm hover:bg-line sm:text-sm"
          >
            Card / QR
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className={`cut-sm relative min-w-20 shrink-0 px-3.5 py-2 font-display text-base font-extrabold uppercase tracking-wider transition-colors sm:min-w-28 sm:px-4 sm:text-lg ${
              copied ? "bg-lime text-black" : "bg-codm text-black hover:bg-codm-light"
            }`}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>

        {/* Right: Dirty-Text Smart Paste + Closest Look pill */}
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            tryExtractAndLoad(input, false);
          }}
        >
          <input
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (pasteNotice?.kind === "err") setPasteNotice(null);
            }}
            onPaste={(e) => {
              const text = e.clipboardData?.getData("text");
              if (text && extractShareCode(text)) {
                e.preventDefault();
                tryExtractAndLoad(text, true);
              }
            }}
            placeholder="Paste code, Discord msg, or link..."
            aria-label="Paste a share code, Discord message, or Filter Lab link"
            aria-invalid={pasteNotice?.kind === "err"}
            className={`w-full min-w-0 border bg-black/55 px-2.5 py-2 font-mono text-xs sm:text-sm lg:w-60 ${
              pasteNotice?.kind === "err"
                ? "border-red-500"
                : pasteNotice?.kind === "ok"
                  ? "border-lime"
                  : "border-line"
            }`}
          />
          <button
            type="submit"
            className="shrink-0 bg-panel-2 px-3 py-2 font-display text-sm font-bold uppercase tracking-wider hover:bg-line"
          >
            Load
          </button>
          <button
            type="button"
            onClick={onReset}
            className="shrink-0 px-2 py-2 font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
          >
            Reset
          </button>
        </form>
      </div>

      {/* Live status feedback row */}
      {pasteNotice && (
        <div className="mx-auto max-w-[1400px] px-4 pb-2 sm:px-8">
          <p
            role={pasteNotice.kind === "err" ? "alert" : "status"}
            className={`text-xs ${pasteNotice.kind === "ok" ? "text-lime" : "text-red-400"}`}
          >
            {pasteNotice.text}
          </p>
        </div>
      )}
    </div>
  );
}
