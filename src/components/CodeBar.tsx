"use client";

/**
 * The code and its Copy button, docked to the bottom edge whenever the main
 * Copy button is out of sight, so a copy is always one tap away while tuning.
 */
export default function CodeBar({
  show,
  name,
  code,
  copied,
  onCopy,
}: {
  show: boolean;
  name: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      inert={!show}
      className={`fixed inset-x-0 bottom-0 z-20 border-t border-line bg-ink/90 backdrop-blur-md transition-transform duration-300 ease-out ${
        show ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 pb-[max(0.625rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-8 2xl:max-w-[1720px]">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="shrink-0 truncate font-display text-xs font-bold uppercase tracking-[0.2em] text-mute">
            {name}
          </span>
          {/* not an <output>: the one beside the main button already announces changes */}
          <code
            className="min-w-0 truncate font-mono text-xs text-codm sm:flex-1 sm:bg-black/50 sm:px-3 sm:py-2 sm:text-sm"
            title={code}
          >
            {code}
          </code>
        </div>
        <button
          onClick={onCopy}
          className={`cut-sm min-w-32 shrink-0 px-4 py-2.5 font-display text-lg font-extrabold uppercase tracking-wider text-black transition-colors ${
            copied ? "bg-lime" : "bg-codm hover:bg-codm-light"
          }`}
        >
          {copied ? "Copied ✓" : "Copy code"}
        </button>
      </div>
    </div>
  );
}
