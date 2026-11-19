import Link from "next/link";
import { LOOKS } from "@/lib/codm";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[900px] flex-col justify-center px-4 py-16 sm:px-8">
      <p className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-codm">
        <span aria-hidden className="mr-2 inline-block h-2 w-2 rotate-45 bg-codm align-middle" />
        404
      </p>
      <h1 className="mt-2 font-title text-5xl font-black uppercase leading-none tracking-wide sm:text-7xl">
        No code here
      </h1>
      <p className="mt-4 max-w-prose text-sm text-mute sm:text-base">
        That page does not exist. Every look has its own page and the generator is on the home
        page; both are one tap away.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href="/"
          className="cut bg-codm px-5 py-3 font-display text-lg font-extrabold uppercase tracking-wider text-black hover:bg-codm-light"
        >
          Filter Lab home
        </Link>
        <Link
          href="/#editor"
          className="bg-panel-2 px-5 py-3 font-display text-base font-bold uppercase tracking-wider text-text hover:bg-line"
        >
          Build a filter
        </Link>
      </div>
      <ul className="mt-10 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
        {LOOKS.slice(0, 8).map((look) => (
          <li key={look.slug}>
            <Link
              href={`/look/${look.slug}`}
              className="block border border-line px-3 py-2 font-display font-bold uppercase tracking-wide text-mute hover:border-codm hover:text-text"
            >
              {look.name}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
