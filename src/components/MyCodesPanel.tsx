"use client";

import { useState, useSyncExternalStore } from "react";
import { copyCode } from "@/components/ImportGuide";
import {
  clearRecent,
  getServerSnapshot,
  getSnapshot,
  remove,
  renameSaved,
  subscribe,
  type MyCode,
} from "@/lib/myCodes";

export const useMyCodes = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

function Row({
  entry,
  current,
  saved,
  onLoad,
}: {
  entry: MyCode;
  current: boolean;
  saved: boolean;
  onLoad: (code: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const btn = "min-h-11 px-2 font-display text-sm font-bold uppercase tracking-wider";
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 px-3 py-1 ${current ? "border-lime bg-lime/10" : "border-line bg-white/[0.035]"}`}>
      <div className="min-w-0 flex-1 basis-48">
        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              renameSaved(entry.code, String(new FormData(e.currentTarget).get("name") ?? ""));
              setEditing(false);
            }}
            className="flex gap-1"
          >
            <input
              name="name"
              defaultValue={entry.name}
              maxLength={40}
              aria-label={`New name for ${entry.name}`}
              autoFocus
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              className="min-h-11 min-w-0 flex-1 border border-line bg-black/50 px-2 font-display text-base font-bold uppercase"
            />
            <button className={`${btn} bg-panel-2 hover:bg-line`}>Save name</button>
          </form>
        ) : (
          <span className="block truncate font-display text-base font-bold uppercase tracking-wide">
            {entry.name}
            {current && <span className="ml-2 text-xs text-lime">· in the editor</span>}
          </span>
        )}
        <code className="block truncate font-mono text-xs text-mute" title={entry.code}>
          {entry.code}
        </code>
      </div>
      <div className="flex gap-1">
        <button onClick={() => onLoad(entry.code)} disabled={current} className={`${btn} bg-panel-2 hover:bg-line disabled:cursor-not-allowed disabled:opacity-40`}>
          Load
        </button>
        <button onClick={() => copyCode(entry.code, entry.name)} className={`${btn} bg-panel-2 hover:bg-line`}>
          Copy
        </button>
        {saved && !editing && (
          <button onClick={() => setEditing(true)} className={`${btn} text-mute hover:text-text`}>
            Rename
          </button>
        )}
        <button
          onClick={() => remove(saved ? "saved" : "recent", entry.code)}
          aria-label={`Remove ${entry.name}`}
          className={`${btn} w-11 text-mute hover:text-text`}
        >
          ✕
        </button>
      </div>
    </li>
  );
}

/** Codes copied or saved on this device. Hidden until there is one. */
export default function MyCodesPanel({ code, onLoad }: { code: string; onLoad: (code: string) => void }) {
  const { recent, saved } = useMyCodes();
  if (!recent.length && !saved.length) return null;
  const list = (title: string, items: MyCode[], isSaved: boolean, extra?: React.ReactNode) =>
    items.length > 0 && (
      // min-w-0: a grid item would otherwise grow to the full width of a 22-number code
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-sm font-bold uppercase tracking-[0.2em] text-mute">{title}</h3>
          {extra}
        </div>
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((e) => (
            <Row key={e.code} entry={e} current={e.code === code} saved={isSaved} onLoad={onLoad} />
          ))}
        </ul>
      </div>
    );
  return (
    <section aria-labelledby="my-codes-title" className="mt-12">
      <h2 id="my-codes-title" className="font-title text-3xl font-black uppercase tracking-wide sm:text-4xl">
        Your codes
      </h2>
      <p className="mt-1 text-sm text-mute">Kept in this browser only. Clearing site data removes them.</p>
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        {list("Saved", saved, true)}
        {list(
          "Recently copied",
          recent,
          false,
          <button onClick={clearRecent} className="min-h-11 px-2 font-display text-sm font-bold uppercase tracking-wider text-mute hover:text-text">
            Clear
          </button>,
        )}
      </div>
    </section>
  );
}
