"use client";

import { useMemo, useState } from "react";
import {
  SWATCH_NAMES,
  analyse,
  encode,
  hueParts,
  type Settings,
  type ZoneKey,
} from "@/lib/codm";
import { fileToCanvas, pixels } from "@/lib/image";

const r = Math.round;
const hsl = (h: number) => `hsl(${r(h)} 90% 55%)`;
const ZONES: ZoneKey[] = ["shadows", "midtones", "highlights"];

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
      className={`cut group relative flex aspect-video cursor-pointer flex-col justify-end overflow-hidden border bg-black/40 p-4 transition-colors ${
        over ? "border-codm" : "border-line hover:border-mute"
      }`}
    >
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
      )}
      {url && <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />}
      <div className="relative">
        <div className="font-display text-lg font-extrabold uppercase tracking-wide">
          {title}
          {optional && <span className="ml-2 align-middle text-[10px] font-medium text-mute">optional</span>}
        </div>
        <p className="mt-1 max-w-sm text-xs text-mute">{url ? "Click or drop to replace." : hint}</p>
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

/**
 * Screenshot → starting code. Lives under the bench rather than in a separate
 * mode: the result lands in the same monitor, so you can judge it immediately.
 */
export default function MatchScreenshot({
  onApply,
  onError,
}: {
  onApply: (s: Settings) => void;
  onError: (m: string | null) => void;
}) {
  const [target, setTarget] = useState<HTMLCanvasElement | null>(null);
  const [base, setBase] = useState<HTMLCanvasElement | null>(null);

  const result = useMemo(
    () => (target ? analyse(pixels(target), base ? pixels(base) : null) : null),
    [target, base],
  );

  const load = (set: (c: HTMLCanvasElement) => void) => async (f: File) => {
    try {
      set(await fileToCanvas(f, 960));
      onError(null);
    } catch (e) {
      onError((e as Error).message);
    }
  };

  return (
    <details className="group mt-12 border-t border-line pt-4">
      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
        <div>
          <h2 className="flex items-center gap-2 font-title text-2xl font-black uppercase tracking-wide sm:text-3xl">
            <span className="font-mono text-base text-codm transition-transform group-open:rotate-90">
              ▸
            </span>
            Match a screenshot
          </h2>
          <p className="mt-1 text-sm text-mute">
            Got a look from another game? Drop the picture and this measures it into a starting
            code. Nothing leaves your browser.
          </p>
        </div>
        <span className="font-display text-xs font-bold uppercase tracking-[0.18em] text-mute group-open:hidden">
          Open
        </span>
      </summary>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <DropZone
              title="Reference look"
              hint="A screenshot with the colours you want, from any game or photo."
              canvas={target}
              onFile={load(setTarget)}
            />
            <DropZone
              title="Your screen"
              hint="CODM on the default filter. A similar scene makes the match much closer."
              canvas={base}
              onFile={load(setBase)}
              optional
            />
          </div>
          <p className="text-sm text-mute">
            The converter measures the colour cast, saturation and brightness of the shadows,
            midtones and highlights, then picks slider values that push your screen towards the
            reference. Treat it as a starting point and fine-tune by eye.
          </p>
        </div>

        <div className="cut flex flex-col gap-3 border border-line bg-panel/85 p-4 backdrop-blur">
          <h3 className="font-display text-xl font-extrabold uppercase leading-none">Result</h3>
          {!result ? (
            <p className="text-sm text-mute">Add a reference screenshot to get a code.</p>
          ) : (
            <>
              {!base && (
                <p className="border-l-2 border-codm bg-codm/10 px-2.5 py-1.5 text-[11px] leading-snug">
                  No baseline screenshot, so the values are toned down. Add one for a closer match.
                </p>
              )}
              <table className="w-full text-xs">
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
                  {ZONES.map((k) => {
                    const z = result.zones[k];
                    const hp = hueParts(z.hue);
                    return (
                      <tr key={k} className="border-t border-line">
                        <td className="py-1.5 font-display font-bold uppercase tracking-wide">
                          <span
                            className="mr-1.5 inline-block h-2 w-2 rotate-45"
                            style={{ background: hsl(z.hue) }}
                          />
                          {k}
                        </td>
                        <td>
                          {SWATCH_NAMES[hp.swatch]} {r(hp.pos)}
                        </td>
                        <td>{r(z.tint)}</td>
                        <td>{r(z.sat)}</td>
                        <td>{r(z.bri)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <code className="block break-all bg-black/50 p-2 font-mono text-[10px] leading-relaxed text-codm">
                {encode(result)}
              </code>
              <button
                onClick={() => onApply(result)}
                className="cut bg-codm px-4 py-2.5 font-display text-base font-extrabold uppercase tracking-wider text-black transition-colors hover:bg-codm-light"
              >
                Load on the monitor →
              </button>
            </>
          )}
        </div>
      </div>
    </details>
  );
}
