"use client";

import { useEffect } from "react";

/**
 * Last line of defence. The editor holds hours of work in a URL hash, so a
 * crash must not look like the tool deleted it: say what happened, keep the
 * code reachable, and offer the two ways out (retry the render, reload).
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // The hash is the record of the grade, even on a crashed page.
    console.error("Filter Lab crashed", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-[760px] flex-col justify-center px-4 py-16 sm:px-8">
      <p className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-codm">
        Something broke
      </p>
      <h1 className="mt-2 font-title text-5xl font-black uppercase leading-none tracking-wide">
        The lab hit a snag
      </h1>
      <p className="mt-4 max-w-prose text-sm text-mute sm:text-base">
        Your grade is still in this page&apos;s address, so the code is not lost. Try again, and if
        it keeps happening, copy the code out of the address bar and reload.
      </p>
      <code className="mt-3 block break-all border border-line bg-black/50 p-3 font-mono text-xs text-codm">
        {typeof window === "undefined" ? "" : window.location.hash.replace(/^#c=/, "") || "no code in the URL"}
      </code>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          onClick={reset}
          className="cut bg-codm px-5 py-3 font-display text-lg font-extrabold uppercase tracking-wider text-black hover:bg-codm-light"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="bg-panel-2 px-5 py-3 font-display text-base font-bold uppercase tracking-wider text-text hover:bg-line"
        >
          Reload
        </button>
      </div>
    </main>
  );
}
