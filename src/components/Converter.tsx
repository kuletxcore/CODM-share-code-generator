"use client";

import { useMemo, useState } from "react";
import { SWATCH_NAMES, analyse, encode, hueParts, type Settings } from "@/lib/codm";
import { fileToCanvas, pixels } from "@/lib/frame";
import { PANEL_INFO, ZONE_TABS, hsl } from "@/components/TunePanel";

const r = Math.round;

function DropZone({
  title,
  hint,
  canvas,
  onFile,
  optional,
}: {
  title: string;
  hint: string;
  canvas: HTMLCanvasElement | null;
  onFile: (f: File) => void;
  optional?: boolean;
}) {
  const [over, setOver] = useState(false);
  const url = useMemo(() => canvas?.toDataURL("image/jpeg", 0.8), [canvas]);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f) onFile(f);
      }}
      className={`cut group relative flex aspect-video cursor-pointer flex-col justify-end overflow-hidden border bg-black/40 p-4 transition-colors focus-within:border-codm ${
        over ? "border-codm" : "border-line hover:border-mute"
      }`}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70" />
      )}
      {url && <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />}
      <div className="relative">
        <div className="font-display text-xl font-extrabold uppercase tracking-wide">
          {title}
          {optional && <span className="ml-2 align-middle text-xs font-medium text-mute">optional</span>}
        </div>
        <p className="mt-1 max-w-sm text-sm text-mute">{url ? "Click or drop to replace." : hint}</p>
      </div>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

/** Turns a reference screenshot into a starting code, then hands it to the frame. */
export default function Converter({ onApply }: { onApply: (s: Settings) => void }) {
  const [target, setTarget] = useState<HTMLCanvasElement | null>(null);
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const result = useMemo(
    () => (target ? analyse(pixels(target), base ? pixels(base) : null) : null),
    [target, base],
  );

  const load = (set: (c: HTMLCanvasElement) => void) => async (f: File) => {
    try {
      set(await fileToCanvas(f, 960));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section id="match" aria-labelledby="match-title" className="mt-14 scroll-mt-4">
      <h2 id="match-title" className="font-title text-2xl font-black uppercase leading-none tracking-wide sm:text-3xl">
        Match a screenshot
      </h2>
      <p className="mt-1.5 max-w-2xl text-sm text-mute">
        Seen colours you like in a video or another game? Drop a screenshot and get a code that pushes CODM towards
        them.
      </p>
      <div className="mt-3 h-px bg-gradient-to-r from-codm/60 via-line to-transparent" />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="flex flex-col gap-4">
          {error && (
            <p role="alert" className="border-l-2 border-red-500 bg-red-500/10 px-3 py-2 text-sm">
              {error}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <DropZone
              title="Reference look"
              hint="A screenshot with the colours you want, from any game or photo."
              canvas={target}
              onFile={load(setTarget)}
            />
            <DropZone
              title="Your screen"
              hint="CODM on the default filter. A similar scene to the reference makes the match much closer."
              canvas={base}
              onFile={load(setBase)}
              optional
            />
          </div>
          <p className="text-sm text-mute">
            Images stay in your browser. The converter measures the colour cast, saturation and brightness of the
            shadows, midtones and highlights, then picks slider values that push your screen towards the reference.
            Treat it as a starting point and fine-tune by eye.
          </p>
        </div>

        <div className="cut flex flex-col gap-4 border border-line bg-panel/85 p-5 backdrop-blur">
          <h3 className="font-display text-3xl font-extrabold uppercase leading-none">Result</h3>
          {!result ? (
            <p className="text-sm text-mute">Add a reference screenshot to get a code.</p>
          ) : (
            <>
              {!base && (
                <p className="border-l-2 border-codm bg-codm/10 px-3 py-2 text-xs">
                  No baseline screenshot, so the values are toned down. Add one for a closer match.
                </p>
              )}
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left font-display uppercase tracking-wider text-mute">
                    <th className="py-1 font-bold"></th>
                    <th className="font-bold">Hue</th>
                    <th className="font-bold">Tint</th>
                    <th className="font-bold">Sat</th>
                    <th className="font-bold">Bri</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {ZONE_TABS.map((k) => {
                    const z = result.zones[k];
                    return (
                      <tr key={k} className="border-t border-line">
                        <td className="py-2 font-display font-bold uppercase tracking-wide">
                          <span className="mr-2 inline-block h-2.5 w-2.5 rotate-45" style={{ background: hsl(z.hue) }} />
                          {PANEL_INFO[k].label}
                        </td>
                        <td>
                          {SWATCH_NAMES[hueParts(z.hue).swatch]} {r(hueParts(z.hue).pos)}
                        </td>
                        <td>{r(z.tint)}</td>
                        <td>{r(z.sat)}</td>
                        <td>{r(z.bri)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <code className="block break-all bg-black/50 p-3 font-mono text-xs text-codm">{encode(result)}</code>
              <button
                onClick={() => onApply(result)}
                className="cut bg-codm px-4 py-3 font-display text-lg font-extrabold uppercase tracking-wider text-black transition-colors hover:bg-codm-light"
              >
                Try it on the frame
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
