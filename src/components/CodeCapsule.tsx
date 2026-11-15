"use client";

import { useState } from "react";
import { copyCode } from "@/components/ImportGuide";

/**
 * The share code docked to the monitor: the thing you came for, always one tap
 * away and never hidden behind a scroll. Pasting someone else's code lives
 * behind the small caret so it stays out of the way until you need it.
 */
export default function CodeCapsule({
  code,
  onLoad,
  onReset,
}: {
  code: string;
  onLoad: (c: string) => boolean;
  onReset: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState("");
  const [bad, setBad] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const copy = async () => {
    await copyCode(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="mt-2">
      <div className="flex items-stretch gap-1.5">
        <output
          aria-live="polite"
          title={code}
          className="min-w-0 flex-1 truncate border border-line bg-black/60 px-2.5 py-1.5 font-mono text-[11px] leading-5 text-codm sm:text-xs"
        >
          {code}
        </output>
        <button
          onClick={copy}
          className={`cut-sm min-w-20 shrink-0 px-3.5 font-display text-sm font-extrabold uppercase tracking-wider text-black transition-colors ${
            copied ? "bg-lime" : "bg-codm hover:bg-codm-light"
          }`}
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <details className="group relative shrink-0 open:bg-panel">
          <summary
            aria-label="Paste a code"
            className="grid h-full min-h-[30px] w-9 cursor-pointer list-none place-items-center border border-line bg-panel-2 text-mute hover:text-text [&::-webkit-details-marker]:hidden"
          >
            <span className="font-mono text-sm leading-none transition-transform group-open:rotate-180">
              ⌄
            </span>
          </summary>
          <div className="absolute right-0 top-full z-30 mt-1 w-[min(92vw,26rem)] border border-line bg-panel p-2 shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const ok = onLoad(input);
                setBad(!ok);
                setLoaded(ok);
                if (ok) setInput("");
                if (ok) setTimeout(() => setLoaded(false), 1600);
              }}
            >
              <label
                htmlFor="paste-code"
                className="font-display text-xs font-bold uppercase tracking-[0.18em] text-mute"
              >
                Paste a share code
              </label>
              <input
                id="paste-code"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setBad(false);
                }}
                placeholder="0_1_30_300_1000_1500_…"
                aria-invalid={bad}
                className={`w-full border bg-black/50 px-2 py-1.5 font-mono text-xs ${
                  bad ? "border-red-500" : "border-line"
                }`}
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  className="bg-codm px-3 py-1.5 font-display text-sm font-bold uppercase tracking-wider text-black hover:bg-codm-light"
                >
                  {loaded ? "Loaded ✓" : "Load"}
                </button>
                <button
                  type="button"
                  onClick={onReset}
                  className="px-2 py-1.5 font-display text-xs font-bold uppercase tracking-wider text-mute hover:text-text"
                >
                  Reset to default
                </button>
                {bad && <span className="text-xs text-red-400">Needs 22 numbers.</span>}
              </div>
            </form>
          </div>
        </details>
      </div>
    </div>
  );
}
