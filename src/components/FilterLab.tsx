"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { LOOKS, decode, defaultSettings, encode, usesAdvanced, type Settings } from "@/lib/codm";
import { fileToCanvas } from "@/lib/frame";
import { localValue } from "@/lib/localValue";
import CodeBar from "@/components/CodeBar";
import Converter from "@/components/Converter";
import ImportGuide, { copyCode } from "@/components/ImportGuide";
import LiveFrame from "@/components/LiveFrame";
import LookStrip, { MIX } from "@/components/LookStrip";
import TunePanel from "@/components/TunePanel";

/** What a first-time visitor sees in the frame: a real look, so the first Copy is worth pasting. */
const OPENING = decode(LOOKS[0].code) ?? defaultSettings();

/** The visitor's last own mix, kept across visits so picking a look never throws it away. */
const mixStore = localValue("codm-mix");

/** Which of the game's two screens a code belongs on. */
const opensAdvanced = (s: Settings) => usesAdvanced(s) || s.zones.global.tint < 3;

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const t = document.createElement("textarea");
    t.value = text;
    document.body.appendChild(t);
    t.select();
    document.execCommand("copy");
    t.remove();
  }
}

export default function FilterLab() {
  // One filter drives everything on the page: the frame, the controls, the code and the URL.
  const [settings, setSettings] = useState<Settings>(OPENING);
  const [advanced, setAdvanced] = useState(() => opensAdvanced(OPENING));
  const [source, setSource] = useState<HTMLCanvasElement | null>(null);
  const [chips, setChips] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fade, setFade] = useState(0);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [docked, setDocked] = useState(false);
  const reduce = useReducedMotion();

  const code = useMemo(() => encode(settings), [settings]);
  // A filter that matches a look is that look; anything else is the visitor's own mix.
  const active = useMemo(() => LOOKS.findIndex((l) => l.code === code), [code]);
  const look = active >= 0 ? LOOKS[active] : null;
  const saved = useSyncExternalStore(mixStore.subscribe, mixStore.get, mixStore.server);
  const mix = look ? (saved && decode(saved) ? saved : null) : code;
  const name = look ? look.name : "Your mix";

  useEffect(() => {
    if (!look) mixStore.set(code);
  }, [look, code]);

  const load = useCallback((s: Settings) => {
    setSettings(s);
    setAdvanced(opensAdvanced(s));
    setFade((n) => n + 1);
  }, []);

  const loadCode = useCallback(
    (c: string) => {
      const s = decode(c);
      if (!s) return false;
      load(s);
      return true;
    },
    [load],
  );

  // restore from #c=<code>, keep the hash in sync so the URL is shareable
  useEffect(() => {
    const read = () => {
      const m = location.hash.match(/c=([-\d_]+)/);
      if (m) loadCode(m[1]);
    };
    // one-off read of the URL on load; the page is statically rendered so it can't go in initial state
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [loadCode]);
  const landed = useRef(false);
  useEffect(() => {
    // a first visit keeps its clean URL until the visitor picks or changes something
    if (!landed.current) {
      landed.current = true;
      return;
    }
    history.replaceState(null, "", `#c=${code}`);
  }, [code]);

  const pick = useCallback(
    (i: number) => {
      const c = i === MIX ? mixStore.get() : LOOKS[i]?.code;
      if (c) loadCode(c);
    },
    [loadCode],
  );

  const upload = async (f: File) => {
    try {
      setSource(await fileToCanvas(f, 1280));
      setError(null);
    } catch (e) {
      // the frame on screen is still good, so the message can step aside by itself
      const message = (e as Error).message;
      setError(message);
      window.setTimeout(() => setError((m) => (m === message ? null : m)), 6000);
    }
  };

  const copy = async () => {
    await copyCode(code, name);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const share = async () => {
    const url = `${location.origin}${location.pathname}#c=${code}`;
    // the system share sheet where sharing means sending to a squadmate; a copied link elsewhere
    if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({ title: `${name} · CODM Filter Lab`, text: `${name}, a colour filter for CODM`, url });
        return;
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return;
      }
    }
    await copyText(url);
    setShared(true);
    window.setTimeout(() => setShared(false), 1600);
  };

  // Dock the code bar whenever the main Copy button is out of sight.
  const cta = useRef<HTMLButtonElement>(null);
  const finder = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const b = cta.current?.getBoundingClientRect();
      if (!b) return;
      const f = finder.current?.getBoundingClientRect();
      // on a phone the frame stays pinned over the page, so the button is gone once it slides under it
      const top = f && f.left < b.right && f.right > b.left ? Math.max(0, f.bottom) : 0;
      setDocked(b.bottom < top + 12 || b.top > window.innerHeight - 8);
    };
    const queue = () => {
      raf ||= requestAnimationFrame(check);
    };
    queue();
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
    // the page also moves under a still viewport: a taller screenshot in the frame, Simple instead of Advanced
    const grown = new ResizeObserver(queue);
    grown.observe(document.body);
    return () => {
      cancelAnimationFrame(raf);
      grown.disconnect();
      window.removeEventListener("scroll", queue);
      window.removeEventListener("resize", queue);
    };
  }, []);

  const custom = look
    ? null
    : "Your own tuning. Copy the code for your game, or share the link to hand it to your squad.";

  return (
    <div className="mx-auto flex min-h-dvh max-w-[1400px] flex-col px-4 pb-28 sm:px-8 2xl:max-w-[1720px]">
      <header className="flex items-center justify-between gap-3 py-3 sm:gap-4 lg:py-4">
        <div className="flex shrink-0 items-center gap-2.5 min-[380px]:gap-3 sm:gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/codm-logo.svg"
            alt="Call of Duty: Mobile"
            width={1442}
            height={479}
            className="h-6 w-auto min-[380px]:h-7 sm:h-9"
          />
          <span aria-hidden className="h-6 w-px bg-line min-[380px]:h-7 sm:h-9" />
          <h1 className="whitespace-nowrap font-title text-xl font-black uppercase leading-none tracking-wide min-[380px]:text-2xl sm:text-4xl">
            Filter Lab
          </h1>
        </div>
        <p className="hidden text-right text-sm text-mute md:block">
          See a filter on a game frame, copy its code, paste it into CODM.
        </p>
        <div className="flex items-center gap-2 whitespace-nowrap font-display text-[10px] font-bold uppercase tracking-[0.2em] text-codm max-[339px]:hidden min-[380px]:tracking-[0.25em] sm:text-xs md:hidden xl:flex">
          <span className="inline-block h-2 w-2 shrink-0 rotate-45 bg-codm" />
          <span className="sm:hidden">Fan-made</span>
          <span className="hidden sm:inline">Unofficial fan-made tool</span>
        </div>
      </header>

      <section
        id="bench"
        aria-label="Try a filter"
        className="flex flex-col lg:grid lg:grid-cols-[minmax(0,calc(var(--frame-h)*16/9))_minmax(25rem,1fr)] lg:items-start lg:gap-x-8"
      >
        {/* On a phone only the frame is pinned; on a wide screen the whole column is. */}
        <div className="contents lg:sticky lg:top-4 lg:block">
          <div ref={finder} className="viewfinder z-10 -mx-4 border-b border-line bg-ink sm:-mx-8 lg:mx-0 lg:border-0 lg:bg-transparent">
            <LiveFrame
              settings={settings}
              name={name}
              source={source}
              chips={chips}
              fadeKey={fade}
              onDropFile={upload}
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 font-display text-[11px] font-bold uppercase tracking-widest text-mute">
            {error ? (
              <span role="alert" className="min-w-0 truncate text-red-400">
                {error}
              </span>
            ) : (
              <span className="min-w-0 truncate">
                {source ? "Your screenshot" : "Sample frame"}
                <span className="max-[359px]:hidden"> · approx. preview</span>
                <span className="hidden sm:inline"> · drag to compare</span>
              </span>
            )}
            <span className="flex shrink-0 items-center gap-3">
              {source && (
                <button onClick={() => setSource(null)} className="uppercase hover:text-text">
                  Sample frame
                </button>
              )}
              <label className="flex cursor-pointer items-center gap-1.5 text-text hover:text-codm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-codm">
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M1.5 3.5h13v9h-13zM1.5 10l3.5-3 3 2.5 2-1.5 4.5 3.5" />
                </svg>
                {source ? "Change" : "Use my screenshot"}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </span>
          </div>

          <div className="mt-2">
            <LookStrip active={active} mix={mix} onPick={pick} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col">
          {/* the selected look */}
          <div
            id="look-stage"
            role="tabpanel"
            aria-labelledby={look ? `look-tab-${active}` : "look-tab-mix"}
            className="relative mt-5 lg:cut lg:mt-0 lg:flex lg:min-h-48 lg:flex-col lg:justify-end lg:overflow-hidden lg:border lg:border-line lg:bg-panel lg:p-5"
          >
            {/* The still a look chases. Wide screens only: on a phone it is already in the strip above. */}
            <AnimatePresence initial={false}>
              {look?.image && (
                <motion.img
                  key={look.image}
                  src={look.image}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 hidden h-full w-full object-cover lg:block"
                />
              )}
            </AnimatePresence>
            <div className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-black/90 via-black/50 to-black/15 lg:block" />
            <div className="pointer-events-none absolute inset-0 hidden scanlines opacity-60 lg:block" />

            <motion.div
              key={name}
              aria-live="polite"
              initial={reduce ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
              className="relative"
            >
              <div className="flex items-center gap-2 font-display text-[11px] font-bold uppercase tracking-widest">
                <span className="bg-codm px-2 py-0.5 text-black">
                  {look ? look.mode : usesAdvanced(settings) ? "Advanced" : "Simple"}
                </span>
                <span className="bg-black/70 px-2 py-0.5 text-mute">
                  {look ? (look.image ? "Inspiration" : "Stock") : "Custom"}
                </span>
                {look && (
                  <span className="ml-auto font-mono text-[11px] font-medium tracking-normal text-mute">
                    {String(active + 1).padStart(2, "0")}/{LOOKS.length}
                  </span>
                )}
              </div>
              <h2
                className={`mt-2 font-title font-black uppercase leading-[0.9] tracking-wide ${
                  name.length > 12 ? "text-3xl sm:text-4xl" : "text-4xl sm:text-5xl"
                }`}
              >
                {name}
              </h2>
              <p className="mt-2 text-sm text-text/90">{look ? look.note : custom}</p>
            </motion.div>
          </div>

          <div className="mt-4 flex gap-1.5">
            <button
              ref={cta}
              onClick={copy}
              className={`cut-sm flex-1 px-5 py-3.5 font-display text-xl font-extrabold uppercase tracking-wider text-black transition-colors ${
                copied ? "bg-lime" : "bg-codm hover:bg-codm-light"
              }`}
            >
              {copied ? "Copied ✓" : "Copy code"}
            </button>
            <button
              onClick={share}
              className="flex items-center gap-2 bg-panel-2 px-4 font-display text-sm font-bold uppercase tracking-wider text-text hover:bg-line"
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                <path d="M8 10V1.5M4.5 4.5 8 1.5l3.5 3M2.5 8v6h11V8" />
              </svg>
              {shared ? "Link copied" : "Share"}
            </button>
          </div>
          <output aria-label="Share code" className="mt-2 block select-all break-all font-mono text-[11px] leading-relaxed text-codm/80">
            {code}
          </output>
          <ol className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 font-display text-xs font-bold uppercase tracking-widest text-mute">
            {["Copy", "Import in game", "Apply"].map((s, i) => (
              <li key={s} className="flex items-center gap-1.5">
                <span className="grid h-5 w-5 place-items-center bg-codm text-[11px] text-black">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>

          <div className="mt-9">
            <TunePanel
              settings={settings}
              setSettings={setSettings}
              advanced={advanced}
              setAdvanced={setAdvanced}
              chips={chips}
              setChips={setChips}
              onLoad={loadCode}
            />
          </div>
        </div>
      </section>

      <Converter
        onApply={(s) => {
          load(s);
          document.getElementById("bench")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        }}
      />

      <Notes />
      <CodeBar show={docked} name={name} code={code} copied={copied} onCopy={copy} />
      <ImportGuide />
    </div>
  );
}

/* ---------- notes + disclaimer ---------- */

function Notes() {
  return (
    <footer className="mt-16 grid gap-8 border-t border-line pt-8 text-sm text-mute md:grid-cols-3">
      <div>
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-text">
          How to use a code
        </h2>
        <p>
          In CODM go to Settings → Audio and Graphics, pick a mode tab (MP, BR, DMZ: Recon…), then
          under its Graphic Style tap Import → Go, choose a Custom slot, paste the code into
          &ldquo;Enter the Share code&rdquo; and tap Apply. Share copies your current code; Customize
          Color (where the mode has it) fine-tunes it.
        </p>
      </div>
      <div>
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-text">
          Experimental
        </h2>
        <p>
          The code format was worked out from shared codes, not from any official spec. The preview
          is an approximation of the in-game filter on a stand-in frame, not a CODM capture, so check
          the result in game or try it on your own screenshot.
        </p>
      </div>
      <div>
        <h2 className="mb-2 font-display text-base font-bold uppercase tracking-wider text-text">
          Disclaimer
        </h2>
        <p>
          A fan-made project. Not affiliated with, endorsed by or connected to Activision, TiMi
          Studio Group or Tencent. Call of Duty and Call of Duty: Mobile are trademarks of their
          respective owners.
        </p>
      </div>
    </footer>
  );
}
