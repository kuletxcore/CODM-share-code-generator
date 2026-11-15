"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_CODE,
  LOOKS,
  decode,
  defaultSettings,
  encode,
  type Look,
  type Settings,
  type Zone,
  type ZoneKey,
} from "@/lib/codm";
import { fileToCanvas } from "@/lib/image";
import { type PanelKey } from "@/components/TunePanel";
import LooksBoard from "@/components/LooksBoard";
import Darkroom from "@/components/Darkroom";
import MatchScreenshot from "@/components/MatchScreenshot";
import ImportGuide from "@/components/ImportGuide";

/*
 * Browse on the board, edit in the darkroom, copy from either. The page has one
 * hero and one workspace instead of a gallery, a scrolled-away generator and a
 * code bar all describing the same thing.
 */

const ZONES: ZoneKey[] = ["shadows", "midtones", "highlights"];
const flat = (z: Zone) => z.tint < 3 && Math.abs(z.sat - 50) < 1 && Math.abs(z.bri - 50) < 1;
const usesAdvanced = (s: Settings) => !ZONES.every((k) => flat(s.zones[k]));
const DEFAULT_LOOK = LOOKS.find((l) => l.code === DEFAULT_CODE) ?? null;

export default function FilterLab() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [advanced, setAdvanced] = useState(true);
  const [panel, setPanel] = useState<PanelKey>("shadows");
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [focusPaste, setFocusPaste] = useState(false);
  // Which ready-made look the current values came from, for naming.
  const [origin, setOrigin] = useState<Look | null>(DEFAULT_LOOK);
  // A build of the visitor's own, kept on the shelf even while they browse.
  const [mine, setMine] = useState<string | null>(null);

  const code = useMemo(() => encode(settings), [settings]);
  const codeRef = useRef(code);
  useEffect(() => {
    codeRef.current = code;
  }, [code]);
  const name = origin ? origin.name : "Your look";
  const edited = origin ? code !== origin.code : true;

  const loadCode = useCallback((c: string) => {
    const s = decode(c);
    if (!s) return false;
    setSettings(s);
    setAdvanced(usesAdvanced(s));
    setOrigin(LOOKS.find((l) => l.code === c) ?? null);
    return true;
  }, []);

  // restore from #c=<code>, keep the hash in sync so the URL is shareable
  useEffect(() => {
    const m = location.hash.match(/c=([-\d_]+)/);
    const s = m && decode(m[1]);
    if (!s) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(s);
    setAdvanced(usesAdvanced(s));
    setOrigin(LOOKS.find((l) => l.code === encode(s)) ?? null);
  }, []);
  useEffect(() => {
    history.replaceState(null, "", `#c=${code}`);
  }, [code]);

  const setZone = useCallback((k: ZoneKey, patch: Partial<Zone>) => {
    setSettings((s) => ({ ...s, zones: { ...s.zones, [k]: { ...s.zones[k], ...patch } } }));
  }, []);

  const upload = async (f: File) => {
    try {
      setSource(await fileToCanvas(f, 1280));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const openLook = useCallback(
    (c: string) => {
      loadCode(c);
      setFocusPaste(false);
      setOpen(true);
    },
    [loadCode],
  );

  const openBlank = () => {
    setSettings(defaultSettings());
    setAdvanced(true);
    setOrigin(DEFAULT_LOOK);
    setFocusPaste(false);
    setOpen(true);
  };

  // Leaving the editor keeps the build around as its own tile — exploring other
  // looks shouldn't throw your work away.
  const close = useCallback(() => {
    const c = codeRef.current;
    if (!LOOKS.some((l) => l.code === c)) setMine(c);
    setOpen(false);
    setFocusPaste(false);
  }, []);

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1400px] flex-col px-4 pb-16 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4 pt-6 sm:pt-9">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/codm-logo.svg"
            alt="Call of Duty: Mobile"
            width={1442}
            height={479}
            className="mb-3 h-9 w-auto sm:h-11"
          />
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-[0.3em] text-codm"
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
            Colour filter share codes for Call of Duty: Mobile. Copy a ready-made look, or open the
            editor and build your own.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-display text-[11px] font-bold uppercase tracking-[0.16em]">
            <button onClick={openBlank} className="text-codm hover:text-codm-light">
              Make your own →
            </button>
            <button
              onClick={() => {
                setFocusPaste(true);
                setOpen(true);
              }}
              className="text-mute hover:text-text"
            >
              Paste a code
            </button>
          </div>
        </div>
      </header>

      {error && (
        <p role="alert" className="mt-4 border-l-2 border-red-500 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <LooksBoard
        source={source}
        activeCode={code}
        /* only offer a "Your look" tile once it exists and the editor is closed */
        customCode={open ? null : mine}
        onUpload={upload}
        onClear={() => setSource(null)}
        onEdit={openLook}
      />

      <MatchScreenshot
        onApply={(s) => {
          setSettings(s);
          setAdvanced(usesAdvanced(s));
          setOrigin(null);
          setOpen(true);
        }}
        onError={setError}
      />

      <Notes />

      <ImportGuide />

      {open && (
        <Darkroom
          name={name}
          edited={!!origin && edited}
          note={origin?.note}
          code={code}
          settings={settings}
          setSettings={setSettings}
          setZone={setZone}
          advanced={advanced}
          setAdvanced={setAdvanced}
          panel={advanced ? panel : "global"}
          setPanel={setPanel}
          source={source}
          onUpload={upload}
          onClear={() => setSource(null)}
          onReset={() => {
            setSettings(defaultSettings());
            setOrigin(DEFAULT_LOOK);
          }}
          onLoad={loadCode}
          onClose={close}
          focusPaste={focusPaste}
        />
      )}
    </div>
  );
}

function Notes() {
  return (
    <footer className="mt-10 grid gap-6 border-t border-line pt-6 text-sm text-mute md:grid-cols-3">
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
          is an approximation of the in-game filter, so check the result in game. The footage-based
          looks are measured relative to pooled daytime footage, so only what sets a game apart is
          kept — expect subtle results.
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
