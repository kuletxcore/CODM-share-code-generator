"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_CODE,
  decode,
  defaultSettings,
  encode,
  extractShareCode,
  findClosestLook,
  LOOKS,
  type Settings,
  type Zone,
  type ZoneKey,
  SWATCH_NAMES,
  hueFrom,
  hueParts,
} from "@/lib/codm";
import LooksGallery from "@/components/LooksGallery";
import ImportGuide, { copyCode } from "@/components/ImportGuide";
import PreviewCanvas from "@/components/PreviewCanvas";
import ColorWheel from "@/components/ColorWheel";
import RangeScrubber from "@/components/RangeScrubber";
import TacticalMacros from "@/components/TacticalMacros";
import LoadoutRack from "@/components/LoadoutRack";
import OpticsTelemetry from "@/components/OpticsTelemetry";
import ScreenshotConverter from "@/components/ScreenshotConverter";
import BlendLab from "@/components/BlendLab";
import ShareCardModal from "@/components/ShareCardModal";
import CodeDnaBar, { type DnaTarget } from "@/components/CodeDnaBar";
import CommandHud, { ShortcutsModal } from "@/components/CommandHud";
import { applyMacro, scaleIntensity, type MacroId } from "@/lib/macros";
import { getClientSlots, getServerSlots, saveSlots, subscribeSlots } from "@/lib/storage";

type Mode = "build" | "blend" | "convert";
type Panel = ZoneKey | "range";


const PANEL_INFO: Record<Panel, { label: string; desc: string }> = {
  shadows: {
    label: "Shadows",
    desc: "The darkest parts of the frame: interiors, foliage, the underside of cover. A cool tint here gives depth without muddying skin tones.",
  },
  midtones: {
    label: "Midtones",
    desc: "Most of what you look at: walls, terrain, operators. Small changes go a long way.",
  },
  highlights: {
    label: "Highlights",
    desc: "Sky, sunlit surfaces, bright paint. Warm highlights read as daylight; cool ones read as overcast.",
  },
  global: {
    label: "Simple",
    desc: "The game's simple Customize Color screen (Preset #1–#5), which colours the whole image. Advanced mode's Shadows, Midtones and Highlights apply on top of it. The code carries the selected slot and its colour.",
  },
  range: {
    label: "Range",
    desc: "Where shadows stop and highlights begin. Drag the shadows handle right to push the shadow colour into darker midtones; drag the highlights handle left to spread the highlight colour down.",
  },
};

const ZONE_TABS: ZoneKey[] = ["shadows", "midtones", "highlights"];
const ADVANCED_PANELS: Panel[] = ["shadows", "midtones", "highlights", "range"];

const flat = (z: Zone) => z.tint < 3 && Math.abs(z.sat - 50) < 1 && Math.abs(z.bri - 50) < 1;
/** True when the code carries Advanced (shadows / midtones / highlights) values. */
const usesAdvanced = (s: Settings) => !ZONE_TABS.every((k) => flat(s.zones[k]));

const r = Math.round;
const hsl = (h: number, s = 90, l = 55) => `hsl(${r(h)} ${s}% ${l}%)`;

/* ---------- image helpers ---------- */

function fileToCanvas(file: File, maxW: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.max(1, r(img.naturalWidth * scale));
      c.height = Math.max(1, r(img.naturalHeight * scale));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

/* ---------- small UI pieces ---------- */

function Slider({
  label,
  value,
  min,
  max,
  track,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  track: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid grid-cols-[6.5rem_1fr_3.75rem] items-center gap-3">
      <span className="font-display text-sm font-bold uppercase tracking-wider text-mute">
        {label}
      </span>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={1}
        value={r(value)}
        style={{ ["--track" as string]: track }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <input
        type="number"
        aria-label={`${label} value`}
        min={min}
        max={max}
        value={r(value)}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        className="w-full border border-line bg-black/40 px-1.5 py-1 text-right font-mono text-sm tabular-nums"
      />
    </label>
  );
}

/* ---------- main ---------- */

export default function FilterLab() {
  const [mode, setMode] = useState<Mode>("build");
  const [advanced, setAdvanced] = useState(true);
  const [tab, setPanel] = useState<Panel>("highlights");
  // Simple mode has one screen; Advanced never shows it.
  const panel: Panel = !advanced ? "global" : tab === "global" ? "shadows" : tab;
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [activeCanvas, setActiveCanvas] = useState<HTMLCanvasElement | null>(null);
  const [maskPinned, setMaskPinned] = useState(false);
  const [scrubMask, setScrubMask] = useState(false);
  const [intensity, setIntensity] = useState(100);
  const intensityBaseRef = useRef<Settings | null>(null);
  const [shareCard, setShareCard] = useState<{ code: string; title: string; key: number } | null>(null);
  const [incomingShare, setIncomingShare] = useState<{ code: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 5-Slot localStorage Armory + A/B split compare slot
  const slots = useSyncExternalStore(subscribeSlots, getClientSlots, getServerSlots);
  const [compareSlotIndex, setCompareSlotIndex] = useState<number | null>(null);
  const activeCompareSlot = compareSlotIndex !== null ? slots[compareSlotIndex] : null;
  const compareSettings = useMemo(
    () => (activeCompareSlot ? decode(activeCompareSlot.code) : null),
    [activeCompareSlot],
  );

  // Undo / Redo history with smart stroke coalescing (50 steps)
  const [hist, setHist] = useState<{ past: Settings[]; future: Settings[] }>({
    past: [],
    future: [],
  });
  const histRef = useRef(hist);
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    histRef.current = hist;
  }, [hist]);
  const lastCoalesceRef = useRef(0);

  const resetIntensityAnchor = useCallback(() => {
    intensityBaseRef.current = null;
    setIntensity(100);
  }, []);

  const commitSettings = useCallback(
    (updater: Settings | ((prev: Settings) => Settings), opts?: { coalesce?: boolean }) => {
      const prev = settingsRef.current;
      const next = typeof updater === "function" ? updater(prev) : updater;
      if (encode(prev) === encode(next)) return;
      const now = Date.now();
      const shouldRecord = !opts?.coalesce || now - lastCoalesceRef.current > 420;
      if (opts?.coalesce) lastCoalesceRef.current = now;
      else lastCoalesceRef.current = 0;
      settingsRef.current = next;
      setSettings(next);
      if (shouldRecord) {
        const nextHist = { past: [...histRef.current.past.slice(-49), prev], future: [] };
        histRef.current = nextHist;
        setHist(nextHist);
      }
    },
    [],
  );

  const handleUndo = useCallback(() => {
    const h = histRef.current;
    if (!h.past.length) return;
    resetIntensityAnchor();
    const prev = h.past[h.past.length - 1];
    const curr = settingsRef.current;
    const nextHist = { past: h.past.slice(0, -1), future: [curr, ...h.future.slice(0, 49)] };
    histRef.current = nextHist;
    settingsRef.current = prev;
    setHist(nextHist);
    setSettings(prev);
  }, [resetIntensityAnchor]);

  const handleRedo = useCallback(() => {
    const h = histRef.current;
    if (!h.future.length) return;
    resetIntensityAnchor();
    const next = h.future[0];
    const curr = settingsRef.current;
    const nextHist = { past: [...h.past.slice(-49), curr], future: h.future.slice(1) };
    histRef.current = nextHist;
    settingsRef.current = next;
    setHist(nextHist);
    setSettings(next);
  }, [resetIntensityAnchor]);

  // Ctrl/Cmd+Z & Ctrl/Cmd+Shift+Z keyboard undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleUndo, handleRedo]);

  const code = useMemo(() => encode(settings), [settings]);

  // restore from #c=<code>, keep the hash in sync so the URL is shareable
  useEffect(() => {
    const m = location.hash.match(/c=([-\d_]+)/);
    const s = m && decode(m[1]);
    // one-off read of the URL on load; the page is statically rendered so it can't go in initial state
    if (!s) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(s);
    setAdvanced(usesAdvanced(s) || s.zones.global.tint < 3);
    if (m[1] !== DEFAULT_CODE) {
      const matched = LOOKS.find((l) => l.code === m[1])?.name ?? "Shared Custom Filter";
      setIncomingShare({ code: m[1], name: matched });
    }
  }, []);
  useEffect(() => {
    window.history.replaceState(null, "", `#c=${code}`);
  }, [code]);

  const [hueHint, setHueHint] = useState<Partial<Record<ZoneKey, number>>>({});
  const setZone = useCallback(
    (k: ZoneKey, patch: Partial<Zone>) => {
      resetIntensityAnchor();
      commitSettings(
        (s) => ({ ...s, zones: { ...s.zones, [k]: { ...s.zones[k], ...patch } } }),
        { coalesce: true },
      );
    },
    [resetIntensityAnchor, commitSettings],
  );

  const loadCode = useCallback(
    (c: string) => {
      const clean = extractShareCode(c);
      const s = clean ? decode(clean) : null;
      if (!s) return false;
      resetIntensityAnchor();
      commitSettings(s);
      setAdvanced(usesAdvanced(s) || s.zones.global.tint < 3);
      return true;
    },
    [resetIntensityAnchor, commitSettings],
  );

  const handleJumpToPanel = useCallback((target: DnaTarget) => {
    setMode("build");
    if (target === "global") {
      setAdvanced(false);
    } else {
      setAdvanced(true);
      setPanel(target);
    }
    document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handleIntensityChange = useCallback(
    (pct: number) => {
      if (!intensityBaseRef.current) {
        intensityBaseRef.current = settings;
      }
      setIntensity(pct);
      commitSettings(scaleIntensity(intensityBaseRef.current, pct), { coalesce: true });
    },
    [settings, commitSettings],
  );

  const handleApplyMacro = useCallback(
    (id: MacroId) => {
      resetIntensityAnchor();
      setAdvanced(true);
      commitSettings((s) => applyMacro(s, id));
    },
    [resetIntensityAnchor, commitSettings],
  );

  const handleSaveSlot = useCallback(
    (index: number) => {
      const matchedLook = LOOKS.find((l) => l.code === code)?.name;
      const existing = slots[index];
      const next = [...slots];
      next[index] = {
        name: existing?.name || matchedLook || `Custom #${index + 1}`,
        code,
        updatedAt: Date.now(),
      };
      saveSlots(next);
    },
    [slots, code],
  );

  const handleRenameSlot = useCallback(
    (index: number, name: string) => {
      const cur = slots[index];
      if (!cur) return;
      const next = [...slots];
      next[index] = { ...cur, name };
      saveSlots(next);
    },
    [slots],
  );

  const handleLoadSlot = useCallback(
    (index: number) => {
      const cur = slots[index];
      if (!cur) return;
      loadCode(cur.code);
    },
    [slots, loadCode],
  );

  const handleDeleteSlot = useCallback(
    (index: number) => {
      const next = [...slots];
      next[index] = null;
      saveSlots(next);
      if (compareSlotIndex === index) setCompareSlotIndex(null);
    },
    [slots, compareSlotIndex],
  );

  const handleToggleCompare = useCallback(
    (index: number) => {
      setCompareSlotIndex((cur) => (cur === index ? null : index));
    },
    [],
  );

  const handleAutoFixVisibility = useCallback(
    (status: "crush" | "clip" | "both") => {
      resetIntensityAnchor();
      setAdvanced(true);
      commitSettings((s) => {
        const next = { ...s, zones: { ...s.zones } };
        if (status === "crush" || status === "both") {
          next.zones.shadows = {
            ...s.zones.shadows,
            bri: Math.min(72, Math.max(54, Math.round(s.zones.shadows.bri + 10))),
            tint: Math.min(s.zones.shadows.tint, 28),
          };
          next.zones.midtones = {
            ...s.zones.midtones,
            bri: Math.min(64, Math.max(48, Math.round(s.zones.midtones.bri + 4))),
          };
        }
        if (status === "clip" || status === "both") {
          next.zones.highlights = {
            ...s.zones.highlights,
            bri: Math.max(36, Math.min(48, Math.round(s.zones.highlights.bri - 10))),
          };
        }
        return next;
      });
    },
    [resetIntensityAnchor, commitSettings],
  );

  const upload = useCallback(async (f: File) => {
    try {
      setSource(await fileToCanvas(f, 1280));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [hudToast, setHudToast] = useState<string | null>(null);
  const hudTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashHud = useCallback((msg: string) => {
    setHudToast(msg);
    if (hudTimerRef.current) clearTimeout(hudTimerRef.current);
    hudTimerRef.current = setTimeout(() => setHudToast(null), 1800);
  }, []);

  const closestLook = useMemo(() => findClosestLook(settings), [settings]);
  const activeFilterLabel = closestLook.exact
    ? closestLook.look.name
    : `Custom · ≈ ${closestLook.look.name} (${closestLook.similarity}%)`;

  const openCurrentShareCard = useCallback(() => {
    const label = closestLook.exact ? closestLook.look.name : "Custom Filter";
    setShareCard({ code, title: label, key: Date.now() });
  }, [code, closestLook]);

  const jumpToStudioMode = useCallback((m: Mode) => {
    setMode(m);
    document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Power-user keyboard shortcuts (1-4 zones, G simple, M zone mask, C copy, Q QR/card, R shuffle, ? help)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        return;
      }
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }
      if (shortcutsOpen || shareCard) return;
      const k = e.key.toLowerCase();
      if (k === "1") {
        handleJumpToPanel("shadows");
        flashHud("Panel · Shadows");
      } else if (k === "2") {
        handleJumpToPanel("midtones");
        flashHud("Panel · Midtones");
      } else if (k === "3") {
        handleJumpToPanel("highlights");
        flashHud("Panel · Highlights");
      } else if (k === "4") {
        handleJumpToPanel("range");
        flashHud("Panel · Range Curve");
      } else if (k === "g") {
        handleJumpToPanel("global");
        flashHud("Mode · Simple Global");
      } else if (k === "m") {
        setMaskPinned((v) => {
          flashHud(!v ? "Zone Mask ON" : "Zone Mask OFF");
          return !v;
        });
      } else if (k === "c") {
        void copyCode(code, activeFilterLabel);
        flashHud("Copied share code ✓");
      } else if (k === "q") {
        openCurrentShareCard();
      } else if (k === "r") {
        handleApplyMacro("shuffle");
        flashHud("Surprise Shuffle applied");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    shortcutsOpen,
    shareCard,
    code,
    activeFilterLabel,
    handleJumpToPanel,
    openCurrentShareCard,
    handleApplyMacro,
    flashHud,
  ]);

  return (
    <div id="top" className="mx-auto flex min-h-dvh max-w-[1400px] flex-col px-4 pb-44 sm:px-8">
      <CommandHud
        activeLabel={activeFilterLabel}
        code={code}
        mode={mode}
        canUndo={hist.past.length > 0}
        canRedo={hist.future.length > 0}
        onSelectLooks={() =>
          document.getElementById("looks-title")?.scrollIntoView({ behavior: "smooth", block: "start" })
        }
        onSelectMode={jumpToStudioMode}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onShareCard={openCurrentShareCard}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      {/* top bar */}
      <header className="flex flex-wrap items-end justify-between gap-4 pt-6 sm:pt-10">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/codm-logo.svg"
            alt="Call of Duty: Mobile"
            width={1442}
            height={479}
            className="mb-4 h-10 w-auto sm:h-12"
          />
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-[0.3em] text-codm"
          >
            <span className="inline-block h-2 w-2 rotate-45 bg-codm" />
            Unofficial fan-made tool
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="font-title text-5xl font-black uppercase leading-[0.95] tracking-wide sm:text-7xl"
          >
            Filter Lab
          </motion.h1>
          <p className="mt-2 max-w-xl text-mute">
            Colour filter share codes for Call of Duty: Mobile. Copy a ready-made look, blend two
            looks, convert a screenshot, or dial in your own.
          </p>
        </div>

        {/* Fast studio launchers for returning power users */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => jumpToStudioMode("build")}
            className="border border-line bg-panel/80 px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-text backdrop-blur-sm hover:border-codm hover:text-codm"
          >
            Generator ↓
          </button>
          <button
            type="button"
            onClick={() => jumpToStudioMode("blend")}
            className="border border-line bg-panel/80 px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-text backdrop-blur-sm hover:border-codm hover:text-codm"
          >
            Blend Lab ↓
          </button>
          <button
            type="button"
            onClick={() => jumpToStudioMode("convert")}
            className="border border-line bg-panel/80 px-3 py-2 font-display text-xs font-bold uppercase tracking-wider text-text backdrop-blur-sm hover:border-codm hover:text-codm"
          >
            Screenshot → Code ↓
          </button>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            title="Keyboard shortcuts (?)"
            className="hidden border border-line bg-black/60 px-2.5 py-2 font-mono text-xs font-bold text-mute hover:border-codm hover:text-codm sm:inline-block"
          >
            [?] Hotkeys
          </button>
        </div>
      </header>

      {/* Deep-link / Mobile QR landing conversion banner */}
      <AnimatePresence>
        {incomingShare && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="cut mt-5 flex flex-wrap items-center justify-between gap-3 border-2 border-codm bg-codm/10 px-4 py-3 backdrop-blur-md"
          >
            <div className="min-w-0">
              <p className="font-display text-[11px] font-bold uppercase tracking-[0.25em] text-codm">
                Shared Filter Loaded From Link / QR
              </p>
              <p className="mt-0.5 font-display text-xl font-extrabold uppercase tracking-wide text-text">
                {incomingShare.name}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void copyCode(incomingShare.code, incomingShare.name)}
                className="cut-sm bg-codm px-4 py-2 font-display text-base font-extrabold uppercase tracking-wider text-black hover:bg-codm-light"
              >
                Copy Code for CODM
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("build");
                  document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="border border-line bg-black/60 px-3 py-2 font-display text-sm font-bold uppercase tracking-wider text-text hover:border-codm"
              >
                Inspect in Studio ↓
              </button>
              <button
                type="button"
                aria-label="Dismiss shared filter banner"
                onClick={() => setIncomingShare(null)}
                className="px-2 py-1 font-mono text-sm text-mute hover:text-text"
              >
                ×
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <LooksGallery
        onEdit={(c) => {
          loadCode(c);
          setMode("build");
          document.getElementById("editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
        onShareCard={(c, name) => setShareCard({ code: c, title: name, key: Date.now() })}
      />

      <div id="editor" className="mt-12 flex scroll-mt-16 flex-wrap items-end justify-between gap-2">
        <h2 className="font-title text-3xl font-black uppercase tracking-wide sm:text-4xl">Make your own</h2>
        <nav aria-label="Mode" className="flex flex-wrap gap-1">
          {(
            [
              ["build", "Generator"],
              ["blend", "Blend Lab"],
              ["convert", "Screenshot → Code"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`relative px-4 py-2 font-display text-lg font-bold uppercase tracking-wider transition-colors ${
                mode === m ? "text-text" : "text-mute hover:text-text"
              }`}
            >
              {label}
              {mode === m && (
                <motion.span
                  layoutId="tab-underline"
                  className="absolute inset-x-2 -bottom-0.5 h-[3px] bg-codm"
                />
              )}
            </button>
          ))}
        </nav>
      </div>
      <div className="mt-3 h-px bg-gradient-to-r from-codm/60 via-line to-transparent" />

      {error && (
        <p role="alert" className="mt-4 border-l-2 border-red-500 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <AnimatePresence mode="wait">
        {mode === "build" ? (
          <motion.section
            key="build"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col"
          >
            <LoadoutRack
              slots={slots}
              activeCode={code}
              compareSlotIndex={compareSlotIndex}
              canUndo={hist.past.length > 0}
              canRedo={hist.future.length > 0}
              undoCount={hist.past.length}
              onSaveSlot={handleSaveSlot}
              onRenameSlot={handleRenameSlot}
              onLoadSlot={handleLoadSlot}
              onDeleteSlot={handleDeleteSlot}
              onToggleCompare={handleToggleCompare}
              onUndo={handleUndo}
              onRedo={handleRedo}
            />
            <div className="mt-5 grid gap-6 lg:grid-cols-[300px_1fr]">
            {/* left list, like the mode selector */}
            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between gap-3 bg-white/[0.035] px-4 py-3">
                <span
                  className={`font-display text-lg font-extrabold uppercase tracking-wide ${
                    advanced ? "text-mute" : "text-text"
                  }`}
                >
                  Simple
                </span>
                <button
                  role="switch"
                  aria-checked={advanced}
                  aria-label="Advanced mode"
                  onClick={() => setAdvanced((v) => !v)}
                  className={`relative h-7 w-14 shrink-0 border transition-colors ${
                    advanced ? "border-codm bg-codm/25" : "border-line bg-black/50"
                  }`}
                >
                  <motion.span
                    layout
                    transition={{ type: "spring", stiffness: 600, damping: 38 }}
                    className={`absolute top-0.5 h-[22px] w-6 ${
                      advanced ? "right-0.5 bg-codm" : "left-0.5 bg-mute"
                    }`}
                  />
                </button>
                <span
                  className={`font-display text-lg font-extrabold uppercase tracking-wide ${
                    advanced ? "text-codm" : "text-mute"
                  }`}
                >
                  Advanced
                </span>
              </div>
              <ul className="flex flex-col gap-1" aria-label="Adjustment groups" hidden={!advanced}>
                {ADVANCED_PANELS.map((p) => {
                  const active = p === panel;
                  const z = p !== "range" ? settings.zones[p] : null;
                  return (
                    <li key={p}>
                      <button
                        onClick={() => setPanel(p)}
                        aria-current={active}
                        className="relative flex w-full items-center justify-between overflow-hidden px-4 py-3 text-left"
                      >
                        {active && (
                          <motion.span
                            layoutId="row-active"
                            className="row-active absolute inset-0"
                            transition={{ type: "spring", stiffness: 500, damping: 40 }}
                          />
                        )}
                        {!active && <span className="absolute inset-0 bg-white/[0.035] hover:bg-white/[0.07]" />}
                        <span
                          className={`relative font-display text-xl font-extrabold uppercase tracking-wide ${
                            active ? "text-[#0b0f05]" : ""
                          }`}
                        >
                          {PANEL_INFO[p].label}
                        </span>
                        {z && (
                          <span
                            className="relative h-3 w-3 rotate-45 border border-black/40"
                            style={{ background: hsl(z.hue, z.tint < 3 ? 0 : 85) }}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <TacticalMacros
                intensity={intensity}
                onIntensityChange={handleIntensityChange}
                onApplyMacro={handleApplyMacro}
              />
            </div>

            {/* right: preview + controls */}
            <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[1fr_380px]">
              <div className="flex flex-col gap-4">
                <PreviewCanvas
                  settings={settings}
                  compareSettings={compareSettings}
                  compareLabel={activeCompareSlot?.name}
                  source={source}
                  zoneMask={maskPinned || scrubMask}
                  onToggleZoneMask={() => setMaskPinned((v) => !v)}
                  onUpload={upload}
                  onClear={() => setSource(null)}
                  onActiveCanvasChange={setActiveCanvas}
                />
                <OpticsTelemetry
                  activeCanvas={activeCanvas}
                  settings={settings}
                  onAutoFixVisibility={handleAutoFixVisibility}
                />
              </div>

              <div className="cut flex flex-col gap-4 border border-line bg-panel/85 p-5 backdrop-blur">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={panel}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col gap-4"
                  >
                    {(advanced ? !flat(settings.zones.global) : usesAdvanced(settings)) && (
                      <p className="flex items-start justify-between gap-3 border-l-2 border-codm bg-codm/10 px-3 py-2 text-xs">
                        <span>
                          {advanced
                            ? `This code also carries a Simple colour (Preset #${settings.preset + 1}).`
                            : "This code also carries Advanced values (shadows, midtones, highlights)."}
                        </span>
                        <button
                          onClick={() =>
                            setSettings((s) =>
                              advanced
                                ? { ...s, zones: { ...s.zones, global: { hue: 0, tint: 0, sat: 50, bri: 50 } } }
                                : { ...defaultSettings(), preset: s.preset, zones: { ...defaultSettings().zones, global: s.zones.global } },
                            )
                          }
                          className="shrink-0 font-display font-bold uppercase tracking-wider text-codm hover:text-codm-light"
                        >
                          Clear
                        </button>
                      </p>
                    )}
                    <div>
                      <h2 className="font-display text-3xl font-extrabold uppercase leading-none">
                        {PANEL_INFO[panel].label}
                      </h2>
                      <p className="mt-2 text-sm leading-relaxed text-mute">{PANEL_INFO[panel].desc}</p>
                    </div>

                    {panel === "range" ? (
                      <div className="flex flex-col gap-4">
                        <RangeScrubber
                          settings={settings}
                          activeCanvas={activeCanvas}
                          maskPinned={maskPinned}
                          onToggleMask={() => setMaskPinned((v) => !v)}
                          onScrubMask={setScrubMask}
                          onChange={(patch) => {
                            resetIntensityAnchor();
                            commitSettings((s) => ({ ...s, ...patch }), { coalesce: true });
                          }}
                          onReset={() => {
                            resetIntensityAnchor();
                            commitSettings((s) => ({
                              ...s,
                              shadowPos: 30,
                              shadowEdge: 300,
                              highlightPos: 1000,
                              highlightEdge: 1500,
                            }));
                          }}
                        />
                        <div className="flex flex-col gap-2 border-t border-line/70 pt-3">
                          <Slider
                            label="Shadows"
                            value={settings.shadowPos / 10}
                            min={0}
                            max={100}
                            track="linear-gradient(90deg,#000,#2dd4ff)"
                            onChange={(v) =>
                              setSettings((s) => {
                                const pos = Math.min(v * 10, s.highlightPos);
                                return { ...s, shadowPos: pos, shadowEdge: pos + 100 };
                              })
                            }
                          />
                          <Slider
                            label="Highlights"
                            value={settings.highlightPos / 10}
                            min={0}
                            max={100}
                            track="linear-gradient(90deg,#777,#ffea3b)"
                            onChange={(v) =>
                              setSettings((s) => {
                                const pos = Math.max(v * 10, s.shadowPos);
                                return { ...s, highlightPos: pos, highlightEdge: pos + 100 };
                              })
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      (() => {
                        const k = panel;
                        const z = settings.zones[k];
                        const hp = hueParts(z.hue, hueHint[k]);
                        return (
                          <div className="flex flex-col gap-3">
                            {k === "global" && (
                              <div className="grid grid-cols-5 gap-1" role="group" aria-label="Simple preset slot">
                                {[0, 1, 2, 3, 4].map((i) => (
                                  <button
                                    key={i}
                                    aria-pressed={settings.preset === i}
                                    onClick={() => setSettings((s) => ({ ...s, preset: i }))}
                                    className={`px-1 py-2 font-display text-sm font-bold ${
                                      settings.preset === i
                                        ? "bg-[#6d6a1f] text-codm-light"
                                        : "bg-panel-2 text-mute hover:text-text"
                                    }`}
                                  >
                                    Preset #{i + 1}
                                  </button>
                                ))}
                              </div>
                            )}
                            <ColorWheel
                              hue={z.hue}
                              tint={z.tint}
                              preferSwatch={hueHint[k]}
                              zoneLabel={PANEL_INFO[k].label}
                              onChange={({ hue, tint, swatch }) => {
                                setHueHint((h) => ({ ...h, [k]: swatch }));
                                setZone(k, { hue, tint });
                              }}
                            />
                            <div className="grid grid-cols-8 gap-1.5" role="group" aria-label="Hue swatches">
                              {SWATCH_NAMES.map((name, i) => (
                                <button
                                  key={name}
                                  title={name}
                                  aria-label={name}
                                  aria-pressed={hp.swatch === i}
                                  onClick={() => {
                                    setHueHint((h) => ({ ...h, [k]: i }));
                                    setZone(k, { hue: hueFrom(i, hp.pos) });
                                  }}
                                  className={`relative h-8 border-2 transition-transform hover:scale-105 ${
                                    hp.swatch === i ? "border-white scale-105" : "border-black/50"
                                  }`}
                                  style={{ background: hsl(i * 45, 100, 50) }}
                                >
                                  {hp.swatch === i && (
                                    <span className="absolute inset-0 grid place-items-center text-[11px] font-black text-black drop-shadow-[0_0_2px_rgba(255,255,255,0.9)]">
                                      ✓
                                    </span>
                                  )}
                                </button>
                              ))}
                            </div>
                            <Slider
                              label="Hue"
                              value={hp.pos}
                              min={0}
                              max={100}
                              track={`linear-gradient(90deg,${hsl(hp.swatch * 45, 100, 50)},${hsl(hp.swatch * 45 + 45, 100, 50)})`}
                              onChange={(v) => {
                                setHueHint((h) => ({ ...h, [k]: hp.swatch }));
                                setZone(k, { hue: hueFrom(hp.swatch, v) });
                              }}
                            />
                            <Slider
                              label="Tint"
                              value={z.tint}
                              min={0}
                              max={100}
                              track={`linear-gradient(90deg,#666,${hsl(z.hue)})`}
                              onChange={(v) => setZone(k, { tint: v })}
                            />
                            <Slider
                              label="Saturation"
                              value={z.sat}
                              min={0}
                              max={100}
                              track={`linear-gradient(90deg,#777,${hsl(z.hue, 100, 50)})`}
                              onChange={(v) => setZone(k, { sat: v })}
                            />
                            <Slider
                              label="Brightness"
                              value={z.bri}
                              min={0}
                              max={100}
                              track="linear-gradient(90deg,#000,#fff)"
                              onChange={(v) => setZone(k, { bri: v })}
                            />
                            <button
                              onClick={() => setZone(k, { hue: 0, tint: 0, sat: 50, bri: 50 })}
                              className="self-start font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
                            >
                              Reset {PANEL_INFO[k].label}
                            </button>
                          </div>
                        );
                      })()
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
            </div>
          </motion.section>
        ) : mode === "blend" ? (
          <BlendLab
            key="blend"
            currentSettings={settings}
            slots={slots}
            source={source}
            onUpload={upload}
            onClearSource={() => setSource(null)}
            onApply={(fused) => {
              resetIntensityAnchor();
              setAdvanced(true);
              commitSettings(fused);
              setMode("build");
            }}
          />
        ) : (
          <ScreenshotConverter
            key="convert"
            onApply={(s, baseImg) => {
              resetIntensityAnchor();
              setAdvanced(true);
              commitSettings(s);
              if (baseImg) setSource(baseImg);
              setMode("build");
            }}
            onError={setError}
          />
        )}
      </AnimatePresence>

      <Notes />
      <CodeDnaBar
        code={code}
        settings={settings}
        onLoad={loadCode}
        onJumpToPanel={handleJumpToPanel}
        onShareCard={openCurrentShareCard}
        onReset={() => {
          resetIntensityAnchor();
          commitSettings(defaultSettings());
        }}
      />
      <ShareCardModal
        key={shareCard?.key ?? 0}
        open={!!shareCard}
        code={shareCard?.code ?? code}
        defaultTitle={shareCard?.title ?? "Custom Filter"}
        sourceCanvas={activeCanvas}
        onClose={() => setShareCard(null)}
      />
      <ShortcutsModal open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <AnimatePresence>
        {hudToast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed bottom-28 left-1/2 z-40 -translate-x-1/2 border border-codm bg-ink/95 px-4 py-1.5 font-display text-xs font-extrabold uppercase tracking-[0.2em] text-codm shadow-xl backdrop-blur-md"
          >
            {hudToast}
          </motion.div>
        )}
      </AnimatePresence>
      <ImportGuide />
    </div>
  );
}

/* ---------- notes + disclaimer ---------- */

function Notes() {
  return (
    <footer className="mt-16 grid gap-8 border-t border-line pt-8 text-sm text-mute md:grid-cols-3">
      <div>
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-text">
          How to use a code
        </h2>
        <p>
          In CODM go to Settings → Audio and Graphics, pick a mode tab (MP, BR, DMZ: Recon…), then
          under its Graphic Style tap Import → Go, choose a Custom slot, paste the code into
          &ldquo;Enter the Share code&rdquo; and tap Apply. Share copies your current code; Customize
          Color (where the mode has it) fine-tunes it.
        </p>
      </div>
      <div>
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-text">
          Experimental
        </h2>
        <p>
          The code format was worked out from shared codes, not from any official spec. The preview
          is an approximation of the in-game filter, so check the result in game.
        </p>
      </div>
      <div>
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-text">
          Disclaimer
        </h2>
        <p>
          A fan-made project. Not affiliated with, endorsed by or connected to Activision, TiMi
          Studio Group or Tencent. Call of Duty and Call of Duty: Mobile are trademarks of their
          respective owners.
        </p>
      </div>
    </footer>
  );
}
