"use client";

import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DEFAULT_CODE,
  LOOKS,
  decode,
  defaultSettings,
  encode,
  hasAdvanced,
  type Look,
  type Settings,
  type Zone,
  type ZoneKey,
} from "@/lib/codm";
import { fileToCanvas, sampleCanvas } from "@/lib/image";
import Editor from "@/components/Editor";
import LooksRail from "@/components/LooksRail";
import MatchScreenshot from "@/components/MatchScreenshot";
import Monitor from "@/components/Monitor";
import CodeCapsule from "@/components/CodeCapsule";
import ImportGuide from "@/components/ImportGuide";

/*
 * One bench, not three screens: the monitor grades live, the shelf drops looks
 * straight onto it, the tone map moves the shadow/highlight split, and the code
 * never leaves the edge of the frame.
 */

const STEPS = ["Copy the code", "Import in CODM", "Apply"];

export default function FilterLab() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [advanced, setAdvanced] = useState(true);
  const [panel, setPanel] = useState<ZoneKey>("shadows");
  const [hoverZone, setHoverZone] = useState<ZoneKey | null>(null);
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [origin, setOrigin] = useState<Look | null>(null);

  // One image drives the whole bench: the monitor grades it and every shelf
  // tile shows a look applied to it. Starts flat, then the lit 3D scene lands.
  const [sample, setSample] = useState<HTMLCanvasElement | null>(() =>
    typeof document === "undefined" ? null : sampleCanvas(),
  );
  useEffect(() => {
    let live = true;
    import("@/lib/scene")
      .then((m) => m.renderScene(960, 540))
      .then((c) => {
        if (live && c) setSample(c);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  const frame = source ?? sample;
  const [error, setError] = useState<string | null>(null);

  const code = useMemo(() => encode(settings), [settings]);
  const panelShown: ZoneKey = advanced ? panel : "global";

  const loadCode = useCallback((c: string) => {
    const s = decode(c);
    if (!s) return false;
    setSettings(s);
    setAdvanced(hasAdvanced(s));
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
    setAdvanced(hasAdvanced(s));
    setOrigin(LOOKS.find((l) => l.code === encode(s)) ?? null);
  }, []);
  useEffect(() => {
    history.replaceState(null, "", `#c=${code}`);
  }, [code]);

  const setZone = useCallback((k: ZoneKey, patch: Partial<Zone>) => {
    setSettings((s) => ({ ...s, zones: { ...s.zones, [k]: { ...s.zones[k], ...patch } } }));
  }, []);

  // Dragging either tone-map handle writes the handle + 100 the game itself writes.
  const setRange = useCallback((patch: { shadowPos?: number; highlightPos?: number }) => {
    setSettings((s) => {
      const shadowPos = patch.shadowPos ?? s.shadowPos;
      const highlightPos = patch.highlightPos ?? s.highlightPos;
      return {
        ...s,
        shadowPos,
        shadowEdge: shadowPos + 100,
        highlightPos,
        highlightEdge: highlightPos + 100,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setSettings(defaultSettings());
    setOrigin(null);
    setAdvanced(true);
  }, []);

  const upload = async (f: File) => {
    try {
      setSource(await fileToCanvas(f, 1280));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const status = !origin ? "custom" : code === origin.code ? "applied" : "edited";

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1440px] flex-col px-4 pb-20 sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 pb-3 pt-5 sm:pt-7">
        <div className="flex items-center gap-3 sm:gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/codm-logo.svg"
            alt="Call of Duty: Mobile"
            width={1442}
            height={479}
            className="h-8 w-auto sm:h-11"
          />
          <span aria-hidden className="h-8 w-px bg-line sm:h-10" />
          <div>
            <div className="flex items-center gap-1.5 font-display text-[10px] font-bold uppercase tracking-[0.26em] text-codm">
              <span className="inline-block h-1.5 w-1.5 rotate-45 bg-codm" />
              Fan-made · unofficial
            </div>
            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="font-title text-4xl font-black uppercase leading-[0.9] tracking-wide sm:text-5xl"
            >
              Filter Lab
            </motion.h1>
          </div>
        </div>

        <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 font-display text-[10px] font-bold uppercase tracking-[0.16em] text-mute sm:text-[11px]">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className="grid h-5 w-5 place-items-center bg-codm text-[10px] text-black">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </header>

      <p className="mb-4 max-w-2xl text-sm text-mute sm:text-[15px]">
        Colour filters for Call of Duty: Mobile. Pick a look, tune it on the live preview, copy the
        22-number code.
      </p>

      {error && (
        <p role="alert" className="mb-4 border-l-2 border-red-500 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      {/* One stacking context: on phones the frame pins over everything below it,
          on large screens the same children are placed into two columns. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_350px] xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-4 lg:contents">
          <Monitor
            className="lg:col-start-1 lg:row-start-1"
            settings={settings}
            onRange={setRange}
            src={frame}
            hasUpload={!!source}
            onUpload={upload}
            onClear={() => setSource(null)}
            title={origin ? origin.name : "Your grade"}
            status={status}
            note={origin?.note}
            hoverZone={hoverZone}
            onHoverZone={setHoverZone}
            onSelectZone={(z) => {
              setAdvanced(true);
              setPanel(z);
            }}
            capsule={<CodeCapsule code={code} onLoad={loadCode} onReset={reset} />}
          />

          <LooksRail
            className="lg:col-start-1 lg:row-start-2"
            src={frame}
            activeCode={code}
            onPick={(l) => loadCode(l.code)}
          />

          <Editor
            className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:sticky lg:top-3 lg:self-start"
            settings={settings}
            setSettings={setSettings}
            setZone={setZone}
            advanced={advanced}
            setAdvanced={setAdvanced}
            panel={panelShown}
            setPanel={setPanel}
            onHoverZone={setHoverZone}
            onReset={reset}
          />
        </div>
      </div>

      <MatchScreenshot onApply={(s) => loadCode(encode(s))} onError={setError} />

      <Notes code={code} />
      <ImportGuide />
    </div>
  );
}

function Notes({ code }: { code: string }) {
  const isDefault = code === DEFAULT_CODE;
  return (
    <footer className="mt-10 grid gap-6 border-t border-line pt-6 text-sm text-mute md:grid-cols-3">
      <div>
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-text">
          Using a code in game
        </h2>
        <p>
          Settings → Audio and Graphics → pick a mode tab (MP, BR, DMZ: Recon…) → that mode&apos;s
          Graphic Style → Import → Go → choose a Custom slot → paste into &ldquo;Enter the Share
          code&rdquo; → Apply. Share copies your current code; Customize Color edits it.
        </p>
      </div>
      <div>
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-text">
          Reading the tone map
        </h2>
        <p>
          The grey shape is your image&apos;s brightness spread. The two handles are the in-game
          Range bar: everything left of the shadow handle takes the shadow colour, everything right
          of the highlight handle takes the highlight colour, and the middle blends.{" "}
          {isDefault && <span className="text-text/60">Both are wide open right now.</span>}
        </p>
      </div>
      <div>
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-text">
          Experimental
        </h2>
        <p>
          The code format was worked out from shared codes, not an official spec, and the preview
          approximates the in-game filter — so check the result in game. A fan-made project, not
          affiliated with Activision, TiMi Studio Group or Tencent. Call of Duty and Call of Duty:
          Mobile are trademarks of their respective owners.
        </p>
      </div>
    </footer>
  );
}
