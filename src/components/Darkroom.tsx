"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { Settings, Zone, ZoneKey } from "@/lib/codm";
import Preview from "@/components/Preview";
import TunePanel, { type PanelKey } from "@/components/TunePanel";
import { copyCode } from "@/components/ImportGuide";

/**
 * Editing is a mode, not a page. It opens from any look on the board with the
 * frame big, the code in reach and the controls under your thumb, and closes
 * back to the board — where whatever you built becomes its own tile.
 */
export default function Darkroom({
  name,
  edited,
  code,
  settings,
  setSettings,
  setZone,
  advanced,
  setAdvanced,
  panel,
  setPanel,
  source,
  onUpload,
  onClear,
  onReset,
  onLoad,
  onClose,
  focusPaste,
}: {
  name: string;
  edited: boolean;
  code: string;
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  setZone: (k: ZoneKey, patch: Partial<Zone>) => void;
  advanced: boolean;
  setAdvanced: (v: boolean) => void;
  panel: PanelKey;
  setPanel: (p: PanelKey) => void;
  source: HTMLCanvasElement | null;
  onUpload: (f: File) => void;
  onClear: () => void;
  onReset: () => void;
  onLoad: (code: string) => boolean;
  onClose: () => void;
  focusPaste: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      // the import guide opens on top after a copy; Escape belongs to it then
      if (e.key === "Escape" && !document.getElementById("guide-title")) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const copy = async () => {
    await copyCode(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="darkroom-title"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="fixed inset-0 z-30 flex flex-col bg-ink/97 backdrop-blur-md"
    >
      <header className="flex shrink-0 items-center gap-2.5 border-b border-line px-3 py-2 sm:gap-4 sm:px-5">
        <button
          ref={closeRef}
          onClick={onClose}
          aria-label="Close the editor"
          className="grid h-9 w-9 shrink-0 place-items-center border border-line bg-panel-2 text-sm text-mute hover:bg-line hover:text-text"
        >
          ✕
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[9px] font-bold uppercase tracking-[0.26em] text-codm">
            Editing
          </p>
          <h2
            id="darkroom-title"
            className="truncate font-display text-lg font-extrabold uppercase leading-tight tracking-wide sm:text-xl"
          >
            {name}
            {edited && <span className="ml-1.5 text-xs font-bold text-mute">· edited</span>}
          </h2>
        </div>
        <code
          className="hidden max-w-[18rem] truncate font-mono text-[11px] text-codm lg:block"
          title={code}
        >
          {code}
        </code>
        <button
          onClick={copy}
          className={`cut-sm shrink-0 px-3 py-2 font-display text-sm font-extrabold uppercase tracking-wider text-black transition-colors sm:px-4 ${
            copied ? "bg-lime" : "bg-codm hover:bg-codm-light"
          }`}
        >
          {copied ? "Copied ✓" : "Copy code"}
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto grid w-full max-w-[1280px] items-start gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_370px] lg:gap-5">
          <Preview
            big
            settings={settings}
            source={source}
            onUpload={onUpload}
            onClear={onClear}
          />
          <TunePanel
            settings={settings}
            setSettings={setSettings}
            setZone={setZone}
            advanced={advanced}
            setAdvanced={setAdvanced}
            panel={panel}
            setPanel={setPanel}
            onReset={onReset}
            onLoad={onLoad}
            focusPaste={focusPaste}
          />
        </div>
      </div>
    </motion.div>
  );
}
