"use client";

// A small library for the grades a player actually wants to keep: saved,
// favourited and recently viewed, all local to the browser.

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { K, pushUnique, readJson, removeKey, writeJson, type SavedLook } from "@/lib/storage";
import { suggestName } from "@/lib/codeTools";
import { LOOKS } from "@/lib/codm";
import { notify } from "@/components/Toasts";

type Recent = { name: string; code: string; at: number };

/** Save from anywhere in the app (header button, keyboard S, command palette). */
export function saveLookCode(code: string, thumb?: string, name?: string): SavedLook | null {
  const list = readJson<SavedLook[]>(K.looks, []);
  if (list.some((l) => l.code === code)) return null;
  const item: SavedLook = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: suggestName(code),
    code,
    thumb,
    created: Date.now(),
  };
  writeJson(K.looks, [item, ...list]);
  return item;
}

function download(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export default function MyLooks({
  open,
  onClose,
  onLoad,
  currentCode,
}: {
  open: boolean;
  onClose: () => void;
  onLoad: (code: string) => void;
  currentCode: string;
}) {
  const [tab, setTab] = useState<"saved" | "favorites" | "recent" | "history" | "built-in">("saved");
  const [looks, setLooks] = useState<SavedLook[]>([]);
  const [favs, setFavs] = useState<string[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [history, setHistory] = useState<Recent[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useFocusTrap(dialog, !!open);

  const refresh = () => {
    setLooks(readJson<SavedLook[]>(K.looks, []));
    setFavs(readJson<string[]>(K.favs, []));
    setRecent(readJson<Recent[]>(K.recent, []));
    setHistory(readJson<Recent[]>(K.history, []));
  };
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) refresh();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open, onClose]);

  const save = () => {
    const item = saveLookCode(currentCode);
    if (!item) {
      notify({ title: "Already saved", detail: "That code is in My Looks.", tone: "warn" });
      return;
    }
    refresh();
    notify({ title: "Look saved", detail: item.name, tone: "good", action: { label: "Rename", run: () => {
      setTab("saved");
      setEditing(item.id);
      setDraft(item.name);
    } } });
  };

  const rename = (id: string) => {
    const next = looks.map((l) => (l.id === id ? { ...l, name: draft.trim() || l.name } : l));
    writeJson(K.looks, next);
    setEditing(null);
    refresh();
  };

  const exportAll = () => download(JSON.stringify({ looks, favs, recent }, null, 2), "codm-my-looks.json");
  const importAll = async (f: File) => {
    try {
      const data = JSON.parse(await f.text()) as { looks?: SavedLook[]; favs?: string[] };
      const merged = [...(data.looks ?? []), ...looks].filter(
        (l, i, all) => all.findIndex((x) => x.code === l.code) === i,
      );
      writeJson(K.looks, merged);
      if (data.favs) writeJson(K.favs, [...new Set([...data.favs, ...favs])]);
      refresh();
      notify({ title: "Looks imported", detail: `${merged.length} in library`, tone: "good" });
    } catch {
      notify({ title: "Import failed", detail: "That file is not a CODM looks export.", tone: "warn" });
    }
  };

  const rows: { key: string; name: string; code: string; meta: string; item?: SavedLook }[] =
    tab === "saved"
      ? looks.map((l) => ({ key: l.id, name: l.name, code: l.code, meta: new Date(l.created).toLocaleDateString(), item: l }))
      : tab === "favorites"
        ? favs.flatMap((code) => {
            const look = looks.find((l) => l.code === code);
            return [{ key: code, name: look?.name ?? suggestName(code), code, meta: "Favourite" }];
          })
        : tab === "recent"
          ? recent.map((r) => ({ key: r.code, name: r.name, code: r.code, meta: "Recently viewed" }))
          : tab === "built-in"
          ? LOOKS.map((l) => ({ key: `b-${l.name}`, name: l.name, code: l.code, meta: l.game ?? "Default" }))
          : history.map((r) => ({ key: `${r.code}-${r.at}`, name: r.name, code: r.code, meta: new Date(r.at).toLocaleString() }));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[55] flex items-end justify-end bg-black/70 backdrop-blur-sm sm:items-stretch"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.aside
            ref={dialog as React.RefObject<HTMLElement & HTMLDivElement>}
            role="dialog"
            aria-modal="true"
            aria-labelledby="mylooks-title"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            className="cut flex max-h-[85svh] w-full flex-col border-t-2 border-codm bg-panel shadow-2xl sm:h-full sm:max-h-none sm:w-[420px] sm:border-l-2 sm:border-t-0"
          >
            <div className="flex items-start justify-between gap-3 border-b border-line p-4">
              <div>
                <p className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-codm">
                  Stays on this device
                </p>
                <h2 id="mylooks-title" className="font-title text-3xl font-black uppercase">
                  My Looks
                </h2>
              </div>
              <button onClick={onClose} aria-label="Close My Looks" className="grid h-11 w-11 place-items-center text-2xl text-mute hover:text-text">×</button>
            </div>

            <div className="flex gap-1 border-b border-line px-4 py-2">
              {(["saved", "favorites", "recent", "history", "built-in"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  aria-pressed={tab === t}
                  className={`min-h-10 flex-1 font-display text-sm font-bold uppercase tracking-wider ${
                    tab === t ? "bg-codm text-black" : "bg-panel-2 text-mute hover:text-text"
                  }`}
                >
                  {t}
                  <span className="ml-1 font-mono text-[10px]">
                    {t === "saved" ? looks.length : t === "favorites" ? favs.length : t === "recent" ? recent.length : t === "history" ? history.length : LOOKS.length}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {!rows.length && (
                <div className="px-3 py-10 text-center text-sm text-mute">
                  {tab === "saved" && "Save a grade you want to come back to."}
                  {tab === "favorites" && "Tap the star on a gallery look to keep it here."}
                  {tab === "recent" && "Looks you open will show up here."}
                  {tab === "history" && "Every code you have edited this session stays here."}
                  {tab === "built-in" && "All ready-made looks, ready to load into the generator."}
                </div>
              )}
              {rows.map((row) => (
                <div key={row.key} className="mb-2 border border-line bg-panel-2/60 p-3">
                  {editing === row.item?.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        rename(row.item!.id);
                      }}
                      className="flex gap-2"
                    >
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        aria-label="Look name"
                        className="min-h-10 min-w-0 flex-1 border border-codm bg-black/50 px-2 font-display text-base"
                      />
                      <button className="bg-codm px-3 font-display text-sm font-bold text-black">Save</button>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {row.item?.thumb && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={row.item.thumb} alt="" className="h-9 w-16 shrink-0 border border-line object-cover" />
                          )}
                          <p className="truncate font-display text-base font-bold uppercase tracking-wide">{row.name}</p>
                        </div>
                        <p className="truncate font-mono text-[10px] text-mute">{row.code}</p>
                        <p className="mt-0.5 font-display text-[10px] uppercase tracking-wider text-mute">{row.meta}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          onClick={() => { onLoad(row.code); onClose(); }}
                          aria-label={`Load ${row.name}`}
                          className="min-h-11 bg-codm px-3 font-display text-sm font-bold uppercase text-black"
                        >
                          Load
                        </button>
                        {row.item && (
                          <>
                            <button
                              onClick={() => {
                                setEditing(row.item!.id);
                                setDraft(row.name);
                              }}
                              aria-label={`Rename ${row.name}`}
                              className="min-h-11 w-9 border border-line text-mute hover:text-text"
                            >
                              ✎
                            </button>
                            <button
                              onClick={() => {
                                writeJson(K.looks, looks.filter((l) => l.id !== row.item!.id));
                                refresh();
                              }}
                              aria-label={`Delete ${row.name}`}
                              className="min-h-11 w-9 border border-line text-mute hover:text-[#ff7a6b]"
                            >
                              ×
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-line p-3">
              <button onClick={save} className="cut-sm min-h-12 bg-codm px-3 font-display text-base font-extrabold uppercase tracking-wide text-black hover:bg-codm-light">
                Save current code
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={exportAll} className="min-h-12 border border-line bg-panel-2 px-2 font-display text-xs font-bold uppercase text-mute hover:text-text">Export</button>
                <button onClick={() => file.current?.click()} className="min-h-12 border border-line bg-panel-2 px-2 font-display text-xs font-bold uppercase text-mute hover:text-text">Import</button>
                <input ref={file} type="file" accept="application/json" className="sr-only" onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importAll(f);
                  e.target.value = "";
                }} />
              </div>
              {looks.length > 0 && (
                <button onClick={() => { removeKey(K.looks); removeKey(K.favs); removeKey(K.recent); refresh(); }} className="col-span-2 min-h-10 text-xs text-mute underline-offset-2 hover:text-[#ff7a6b] hover:underline">
                  Clear local library
                </button>
              )}
              <button
                onClick={(e) => {
                  const btn = e.currentTarget;
                  if (btn.dataset.armed !== "1") {
                    btn.dataset.armed = "1";
                    btn.textContent = "Tap again to erase every local setting";
                    return;
                  }
                  Object.values(K).forEach(removeKey);
                  location.reload();
                }}
                className="col-span-2 min-h-10 text-xs text-[#ff7a6b] hover:underline"
              >
                Reset all app data
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Add a look to the recent list. Safe to call from gallery handlers. */
export function rememberLook(name: string, code: string) {
  pushUnique<Recent>(K.recent, { name, code, at: Date.now() }, 8);
}
