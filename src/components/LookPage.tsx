"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PAGE_LOOKS, SWATCH_NAMES, decode, hueParts, lookSlug, type Look, type ZoneKey } from "@/lib/codm";
import ImportGuide, { copyCode } from "@/components/ImportGuide";
import { RenderedThumb } from "@/components/LooksGallery";
import { hashFor } from "@/lib/shareUrl";

const ZONE_LABEL: Record<ZoneKey, string> = {
  global: "Simple",
  shadows: "Shadows",
  midtones: "Midtones",
  highlights: "Highlights",
};

/** What the Customize Color screens show for this code, zone by zone. */
function Values({ look }: { look: Look }) {
  const s = decode(look.code);
  if (!s) return null;
  const r = Math.round;
  const g = s.zones.global;
  const globalUsed = r(g.tint) !== 0 || r(g.sat) !== 50 || r(g.bri) !== 50;
  const zones: ZoneKey[] =
    look.mode === "Simple"
      ? ["global"]
      : [...(globalUsed ? (["global"] as const) : []), "shadows", "midtones", "highlights"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[22rem] text-sm [&_td]:pr-3 [&_th]:pr-3">
        <thead>
          <tr className="text-left font-display uppercase tracking-wider text-mute">
            <th scope="col" className="py-1 font-bold">
              <span className="sr-only">Screen</span>
            </th>
            <th scope="col" className="font-bold">Colour</th>
            <th scope="col" className="font-bold">Tint</th>
            <th scope="col" className="font-bold">Saturation</th>
            <th scope="col" className="font-bold">Brightness</th>
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {zones.map((k) => {
            const z = s.zones[k];
            const hp = hueParts(z.hue);
            return (
              <tr key={k} className="border-t border-line">
                <th scope="row" className="py-2 text-left font-display font-bold uppercase tracking-wide">
                  {k === "global" ? `${ZONE_LABEL[k]} · Preset #${s.preset + 1}` : ZONE_LABEL[k]}
                </th>
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
      {look.mode !== "Simple" && (
        <p className="mt-2 text-xs text-mute">
          Range bar: shadows end at {s.shadowPos} and highlights start at {s.highlightPos}, on a 0 to 1000 bar. The
          game shows the handles without numbers.
        </p>
      )}
    </div>
  );
}

/**
 * One look on its own page, so it can be linked, found by search and opened
 * without the gallery: the picture, the code, the values as the game shows
 * them, and the ways out (copy now, or open it in the generator).
 */
export default function LookPage({ look }: { look: Look }) {
  const router = useRouter();
  const [copied, setCopied] = useState<"" | "ok" | "failed">("");
  const copy = async () => {
    setCopied((await copyCode(look.code, look.name, { note: look.note, image: look.image })) ? "ok" : "failed");
    setTimeout(() => setCopied(""), 1400);
  };
  const sameGame = PAGE_LOOKS.filter((l) => l.code !== look.code && l.game === look.game);
  const more = (sameGame.length ? sameGame : PAGE_LOOKS.filter((l) => l.code !== look.code)).slice(0, 4);
  const label = look.inGame ? "In game" : look.image ? "Inspiration" : "Preview on a CODM scene";

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1100px] flex-col px-4 pb-16 sm:px-8">
        <nav className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-5 sm:pt-8">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
          >
            ← Filter Lab · all looks
          </Link>
          <span className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-[0.18em] text-codm sm:text-xs">
            <span className="inline-block h-2 w-2 rotate-45 bg-codm" />
            Unofficial fan-made tool
          </span>
        </nav>

        <article className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <div className="cut relative aspect-[960/439] overflow-hidden border border-line bg-black">
            {look.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={look.image}
                alt=""
                width={960}
                height={439}
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            ) : (
              <RenderedThumb code={look.code} />
            )}
            <div className="pointer-events-none absolute inset-0 scanlines opacity-50" />
            <span className="absolute left-3 top-3 bg-black/70 px-2 py-0.5 font-display text-[11px] font-bold uppercase tracking-widest text-mute">
              {label}
            </span>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 font-display text-[11px] font-bold uppercase tracking-widest">
              <span className="bg-codm px-2 py-0.5 text-black">{look.mode}</span>
              {look.game && <span className="bg-panel-2 px-2 py-0.5 text-mute">{look.game}</span>}
            </div>
            <h1
              className={`mt-2 font-title font-black uppercase leading-[0.9] tracking-wide ${
                look.name.length > 12 ? "text-4xl sm:text-5xl" : "text-5xl sm:text-6xl"
              }`}
            >
              {look.name}
            </h1>
            <p className="mt-3 max-w-prose text-sm text-text/90 sm:text-base">{look.note}</p>
            <div className="mt-5 flex flex-wrap gap-1">
              <button
                onClick={copy}
                className={`cut-sm min-h-11 px-5 py-3 font-display text-lg font-extrabold uppercase tracking-wider text-black ${
                  copied === "ok" ? "bg-lime" : "bg-codm hover:bg-codm-light"
                }`}
              >
                {copied === "ok" ? "Copied ✓" : copied === "failed" ? "Blocked" : "Copy code"}
              </button>
              <Link
                href={`/${hashFor(look.code)}`}
                className="inline-flex min-h-11 items-center bg-panel-2 px-4 font-display text-sm font-bold uppercase tracking-wider text-text hover:bg-line"
              >
                Customize
              </Link>
            </div>
            <span role="status" className="sr-only">
              {copied === "ok" ? "Code copied" : copied === "failed" ? "Your browser blocked copying. Select the code and copy it." : ""}
            </span>
          </div>
        </article>

        <section aria-labelledby="code-title" className="mt-10">
          <h2 id="code-title" className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mute">
            Share code
          </h2>
          <code className="mt-2 block break-all border border-line bg-black/50 p-3 font-mono text-sm text-codm">
            {look.code}
          </code>
          <p className="mt-2 text-sm text-mute">
            In CODM: Settings → Audio and Graphics → your mode tab → Graphic Style → Import → Go, choose a Custom slot,
            paste the code into &ldquo;Enter the Share code&rdquo; and tap Apply.
          </p>
        </section>

        <section aria-labelledby="values-title" className="mt-10">
          <h2 id="values-title" className="font-title text-2xl font-black uppercase tracking-wide sm:text-3xl">
            In the game&apos;s Customize Color
          </h2>
          <p className="mt-1 text-sm text-mute">The values the code sets, as the game rounds them on screen.</p>
          <div className="mt-3">
            <Values look={look} />
          </div>
        </section>

        <section aria-labelledby="more-title" className="mt-12 border-t border-line pt-6">
          <h2 id="more-title" className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mute">
            {sameGame.length ? `More ${look.game} looks` : "More looks"}
          </h2>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {more.map((l) => (
              <li key={l.name}>
                <Link
                  href={`/look/${lookSlug(l)}`}
                  className="cut-sm flex min-h-11 flex-col border border-line bg-panel/70 p-3 transition-colors hover:border-codm"
                >
                  <span className="font-display text-base font-extrabold uppercase leading-tight">{l.name}</span>
                  <span className="mt-1 text-[11px] uppercase tracking-wider text-mute">{l.game ?? l.mode}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <p className="mt-12 text-xs leading-relaxed text-mute">
          A fan-made project. Not affiliated with, endorsed by or connected to Activision, TiMi Studio Group or
          Tencent. Call of Duty and Call of Duty: Mobile are trademarks of their respective owners. The code format
          was worked out from shared codes, not from any official spec; check the result in game.
        </p>

        <ImportGuide
          onTweak={(code) => {
            // the generator opens on this code with it pinned as the reference
            router.push(`/${hashFor(code, code)}`);
          }}
        />
    </main>
  );
}
