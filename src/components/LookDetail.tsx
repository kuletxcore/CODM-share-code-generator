"use client";

import Link from "next/link";
import { useState } from "react";
import {
  GROUP_LABEL,
  LOOKS,
  describeCode,
  type CodeCell,
  type Look,
} from "@/lib/codm";
import { copyCode } from "@/components/ImportGuide";
import { cardFilename, downloadBlob, renderShareCard } from "@/lib/share";

/**
 * One look's own page: the still, the code, what the code is doing, and the
 * two ways out (copy it now, or open it in the generator).
 *
 * This exists so a look can be linked, searched and shared on its own instead
 * of living only inside a hash on the home page.
 */

function Cell({ cell }: { cell: CodeCell }) {
  return (
    <tr className={cell.active ? "" : "text-mute/60"}>
      <td className="py-1.5 pr-2 font-display text-xs font-bold uppercase tracking-wide">
        {cell.label}
      </td>
      <td className="py-1.5 font-mono text-xs tabular-nums text-text">{cell.text}</td>
      <td className="py-1.5 text-right font-mono text-[11px] tabular-nums text-mute">
        {cell.raw}
      </td>
    </tr>
  );
}

export default function LookDetail({ look }: { look: Look }) {
  const [copied, setCopied] = useState(false);
  const [card, setCard] = useState<"idle" | "busy" | "done" | "failed">("idle");
  const cells = describeCode(look.code);
  const groups = (["shadows", "midtones", "highlights"] as const).map((g) => ({
    key: g,
    label: GROUP_LABEL[g],
    cells: cells?.filter((c) => c.group === g) ?? [],
  }));
  const live = cells?.filter((c) => c.active).length ?? 0;
  const related = LOOKS.filter((l) => l.slug !== look.slug).slice(0, 4);

  const saveCard = async () => {
    setCard("busy");
    const blob = await renderShareCard({ code: look.code, name: look.name, note: look.note, image: look.image });
    if (!blob) return setCard("failed");
    downloadBlob(blob, cardFilename({ code: look.code, name: look.name }));
    setCard("done");
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-[1100px] flex-col px-4 pb-32 sm:px-8">
      <nav className="flex flex-wrap items-center justify-between gap-3 pt-6">
        <Link
          href="/"
          className="font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text"
        >
          ← All looks
        </Link>
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.24em] text-codm">
          <span aria-hidden className="mr-2 inline-block h-2 w-2 rotate-45 bg-codm align-middle" />
          Unofficial fan-made tool
        </span>
      </nav>

      <header className="mt-6 grid gap-6 sm:mt-10 lg:grid-cols-[1.15fr_1fr] lg:items-end">
        <div className="cut relative aspect-[16/10] overflow-hidden border border-line bg-panel-2">
          {look.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={look.image}
              alt={`${look.name} reference still`}
              width={960}
              height={439}
              fetchPriority="high"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full place-items-center bg-[radial-gradient(circle_at_30%_20%,#1c2415,#0a0b0a)]">
              <span className="font-mono text-xs text-mute">{look.code}</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 scanlines opacity-50" />
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2 font-display text-[11px] font-bold uppercase tracking-widest">
            <span className="bg-codm px-2 py-0.5 text-black">{look.mode}</span>
            {look.game && <span className="bg-panel-2 px-2 py-0.5 text-mute">{look.game}</span>}
            <span className="bg-black/60 px-2 py-0.5 text-mute">{live} values in use</span>
          </div>
          <h1 className="mt-2 font-title text-5xl font-black uppercase leading-[0.9] tracking-wide sm:text-6xl">
            {look.name}
          </h1>
          <p className="mt-3 max-w-prose text-sm text-mute sm:text-base">{look.note}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={async () => {
                const ok = await copyCode(look.code, look.name, { note: look.note, image: look.image });
                setCopied(ok);
                setTimeout(() => setCopied(false), 1600);
              }}
              className="cut min-h-12 bg-codm px-5 font-display text-lg font-extrabold uppercase tracking-wider text-black hover:bg-codm-light"
            >
              {copied ? "Copied ✓" : "Copy code"}
            </button>
            <Link
              href={`/#c=${look.code}`}
              className="min-h-12 bg-panel-2 px-5 py-3 font-display text-base font-bold uppercase tracking-wider text-text hover:bg-line"
            >
              Open in generator
            </Link>
            <button
              onClick={saveCard}
              disabled={card === "busy"}
              className="min-h-12 px-3 font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text disabled:opacity-60"
            >
              {card === "busy" ? "Drawing…" : card === "done" ? "Card saved ✓" : "Save look card"}
            </button>
          </div>
        </div>
      </header>

      <section className="mt-10" aria-labelledby="code-title">
        <h2 id="code-title" className="font-title text-2xl font-black uppercase tracking-wide sm:text-3xl">
          What the code does
        </h2>
        <p className="mt-1 max-w-prose text-sm text-mute">
          Every look is 22 numbers the game reads in order. Muted rows are at the default and
          change nothing; tap the generator link above to edit any of them.
        </p>
        <code className="mt-3 block break-all border border-line bg-black/50 p-3 font-mono text-xs text-codm">
          {look.code}
        </code>
        <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-3">
          {groups.map((g) => (
            <table key={g.key} className="w-full">
              <caption className="mb-1 text-left font-display text-sm font-bold uppercase tracking-wider text-text">
                {g.label}
              </caption>
              <tbody>
                {g.cells.map((c) => (
                  <Cell key={c.index} cell={c} />
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </section>

      <section className="mt-12 border-t border-line pt-6" aria-labelledby="related-title">
        <h2 id="related-title" className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mute">
          More looks
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {related.map((l) => (
            <li key={l.slug}>
              <Link
                href={`/look/${l.slug}`}
                className="cut-sm block border border-line bg-panel/70 p-3 transition-colors hover:border-codm"
              >
                <span className="block font-display text-base font-extrabold uppercase leading-tight">
                  {l.name}
                </span>
                <span className="mt-1 block text-[11px] uppercase tracking-wider text-mute">
                  {l.game ?? "Simple"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 text-xs leading-relaxed text-mute">
        Fan-made project. Not affiliated with, endorsed by or connected to Activision, TiMi Studio
        Group or Tencent. The preview and these values are an approximation of the in-game filter;
        check the result in game.
      </p>

      {/* the one action that matters, always in reach on a phone */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/90 px-4 py-3 backdrop-blur-md sm:hidden">
        <button
          onClick={async () => {
            const ok = await copyCode(look.code, look.name, { note: look.note, image: look.image });
            setCopied(ok);
            setTimeout(() => setCopied(false), 1600);
          }}
          className="w-full bg-codm py-3 font-display text-lg font-extrabold uppercase tracking-wider text-black"
        >
          {copied ? "Copied ✓" : `Copy ${look.name} code`}
        </button>
      </div>
    </main>
  );
}
