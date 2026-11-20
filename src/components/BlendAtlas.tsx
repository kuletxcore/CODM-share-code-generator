"use client";

import { useState } from "react";
import atlas from "@/lib/atlas.json";
import { LOOKS } from "@/lib/codm";
import { copyCode } from "./ImportGuide";

const number = (i: number) => String(i + 1).padStart(3, "0");
const sources = new Map(LOOKS.map(look => [look.name, look]));

export default function BlendAtlas({ onEdit }: { onEdit: (code: string) => void }) {
  const [index, select] = useState(0);
  const [copied, setCopied] = useState("");
  const { shadow, light, code } = atlas[index];
  const title = `Blend ${number(index)}`;
  const note = `${shadow} shadows with ${light} midtones and highlights.`;
  return <section aria-labelledby="atlas-title" className="mt-4 border border-line bg-panel">
    <div className="grid sm:grid-cols-[1fr_2fr]">
      <div className="flex flex-col justify-between gap-5 p-4 sm:p-7">
        <div className="font-mono text-xs uppercase tracking-widest text-lime">Field archive / split tone</div>
        <div>
          <h2 id="atlas-title" className="font-title text-4xl uppercase leading-none lg:text-6xl">Blend atlas</h2>
          <p className="mt-3 max-w-sm text-sm text-mute">Shadows from one look. Light from another. Explore a hybrid, then take its code into CODM.</p>
        </div>
        <div className="flex items-baseline gap-2 font-mono"><b className="text-4xl text-codm">{number(index)}</b><span className="text-sm text-mute">/ {atlas.length}</span></div>
      </div>
      <div className="grid grid-cols-2 gap-px bg-line" aria-live="polite">
        {[shadow, light].map((name, i) => <div key={i} className="relative isolate flex min-h-48 flex-col justify-end overflow-hidden bg-black p-3 sm:min-h-80 sm:p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="absolute inset-0 -z-20 h-full w-full object-cover" src={sources.get(name)?.image} alt="" />
          <div className="absolute inset-0 -z-10 bg-gradient-to-t from-black via-black/25 to-transparent" />
          <span className="font-display text-xs font-bold uppercase tracking-widest text-codm">{i ? '02 / Mids + highs' : '01 / Shadows'}</span>
          <strong className="mt-1 font-title text-xl uppercase leading-tight sm:text-3xl">{name}</strong>
          <span className="mt-2 text-xs text-text">Source inspiration</span>
        </div>)}
      </div>
    </div>
    <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2 sm:p-6">
      <div>
        <label htmlFor="atlas-channel" className="font-display text-sm font-bold uppercase tracking-wider">Tune the blend dial</label>
        <div className="flex items-center gap-3">
          <button className="h-11 w-11 shrink-0 border border-line" aria-label="Previous blend" onClick={() => select((index + atlas.length - 1) % atlas.length)}>←</button>
          <input className="slider" id="atlas-channel" type="range" min="1" max={atlas.length} value={index + 1} aria-valuetext={`${title}: ${note}`} onChange={e => select(Number(e.target.value) - 1)} />
          <button className="h-11 w-11 shrink-0 border border-line" aria-label="Next blend" onClick={() => select((index + 1) % atlas.length)}>→</button>
        </div>
      </div>
      <div className="flex items-end gap-2 sm:justify-end">
        <button className="cut-sm min-h-11 flex-1 bg-codm px-4 font-display font-bold uppercase text-black hover:bg-codm-light" onClick={async () => { await copyCode(code, title, { note }); setCopied(code); }}>{copied === code ? 'Copy again' : 'Copy blend code'}</button>
        <button className="min-h-11 border border-line px-4 font-display font-bold uppercase hover:border-mute" onClick={() => onEdit(code)}>Preview & edit</button>
      </div>
    </div>
  </section>;
}
