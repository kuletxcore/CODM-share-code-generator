"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { dropCaches, prepareShot, type Shot } from "@/lib/screenPreview";

/*
 * Screen test: one screenshot of the visitor's own game, graded for every look.
 *
 * A look chosen on a stock scene is a guess; the same look on the visitor's own
 * frame is an answer. The shot is held in a provider so the gallery, the stage,
 * the filmstrip and the generator preview all read the same pixels.
 */

type Ctx = {
  shot: Shot | null;
  busy: boolean;
  error: string | null;
  /** Bumped whenever the active shot changes, so canvases can re-point at it. */
  version: number;
  setFile: (f: File) => void;
  clear: () => void;
};

const ScreenTestContext = createContext<Ctx | null>(null);

export function useScreenTest(): Ctx {
  const ctx = useContext(ScreenTestContext);
  return (
    ctx ?? {
      shot: null,
      busy: false,
      error: null,
      version: 0,
      setFile: () => {},
      clear: () => {},
    }
  );
}

export function ScreenTestProvider({ children }: { children: ReactNode }) {
  const [shot, setShot] = useState<Shot | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // Each load gets a ticket; a newer load or Remove makes older tickets stale,
  // so a slow screenshot can't land over a newer one or come back after Remove.
  const ticket = useRef(0);
  const setFile = useCallback((f: File) => {
    const mine = ++ticket.current;
    setBusy(true);
    setError(null);
    prepareShot(f)
      .then((s) => {
        if (!live.current || mine !== ticket.current) return;
        dropCaches();
        setShot(s);
        setVersion((v) => v + 1);
        setError(null);
      })
      .catch((e: Error) => {
        if (live.current && mine === ticket.current) setError(e.message || "Could not read that image.");
      })
      .finally(() => {
        if (live.current && mine === ticket.current) setBusy(false);
      });
  }, []);

  const clear = useCallback(() => {
    ticket.current++;
    dropCaches();
    setBusy(false);
    setShot(null);
    setVersion((v) => v + 1);
    setError(null);
  }, []);

  // Paste a screenshot from anywhere on the page (win+shift+s, then ctrl+v).
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (file) setFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [setFile]);

  const value = useMemo(
    () => ({ shot, busy, error, version, setFile, clear }),
    [shot, busy, error, version, setFile, clear],
  );

  return <ScreenTestContext.Provider value={value}>{children}</ScreenTestContext.Provider>;
}

/** The one place a visitor hands over a screenshot. Sits above the gallery. */
export function ScreenTestBar({ looks }: { looks: number }) {
  const { shot, busy, error, setFile, clear } = useScreenTest();
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const drop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  return (
    <section
      aria-label="Screen test"
      className="cut relative mt-8 overflow-hidden border border-line glass"
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={drop}
    >
      <div className="pointer-events-none absolute inset-0 scanlines opacity-40" aria-hidden />
      <AnimatePresence mode="wait" initial={false}>
        {!shot ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className={`relative grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_auto] md:items-center ${
              over ? "bg-codm/10" : ""
            }`}
          >
            <div className="min-w-0">
              <h2
                className="font-title text-2xl font-black uppercase leading-none tracking-wide sm:text-3xl"
              >
                Try every look on your own screen
              </h2>
              <p className="mt-2 hidden max-w-2xl text-sm text-mute sm:block">
                Drop a match screenshot to see all {looks} looks on it. Nothing is uploaded.
              </p>
            </div>
            <div className="flex flex-col gap-2 md:items-end">
              <button
                type="button"
                onClick={() => input.current?.click()}
                disabled={busy}
                className={`cut-sm flex min-h-11 items-center justify-center gap-2 border px-4 font-display text-base font-bold uppercase tracking-wider transition-colors disabled:text-mute ${
                  over ? "border-codm bg-panel-2" : "border-line bg-panel-2 hover:bg-line"
                }`}
              >
                <svg viewBox="0 0 24 24" aria-hidden className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 16V4m0 0L7 9m5-5 5 5" />
                  <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
                </svg>
                {busy ? "Reading…" : over ? "Drop it" : "Add screenshot"}
              </button>
              <p className="flex items-center gap-1 text-[11px] text-mute pointer-coarse:hidden">
                or press
                <kbd className="border border-line bg-black/50 px-1">Ctrl</kbd>
                <kbd className="border border-line bg-black/50 px-1">V</kbd>
              </p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="live"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="relative flex flex-wrap items-center gap-4 p-3 sm:p-4"
          >
            <div className="relative h-16 w-28 shrink-0 overflow-hidden border border-line bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shot.preview} alt="Your screenshot" className="h-full w-full object-cover" />
              <span className="absolute inset-0 scanlines opacity-60" />
            </div>
            <div className="min-w-0 flex-1 basis-56">
              <div className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-[0.22em] text-lime">
                Screen test on
              </div>
              <p className="mt-1 text-sm text-text">
                Saved look cards use this screenshot, so crop out names first.
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="cut-sm min-h-11 bg-panel-2 px-3 font-display text-sm font-bold uppercase tracking-wider hover:bg-line"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={clear}
                className="min-h-11 px-3 font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
              >
                Remove
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <p aria-live="polite" className="sr-only">
        {busy ? "Reading your screenshot." : shot ? "Screen test active." : ""}
      </p>
      {error && (
        <p role="alert" className="border-t border-red-500/40 bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setFile(f);
          e.target.value = "";
        }}
      />
    </section>
  );
}
