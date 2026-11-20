// Understanding, comparing and classifying the 22-number codes.
import { decode, defaultSettings, LOOKS, type Settings, type ZoneKey } from "@/lib/codm";

/** Accept codes copied with spaces, newlines, dashes or a leading label. */
export function normalizeCode(input: string): string | null {
  const clean = input.replace(/[^\d_-]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  const parts = clean.split("_");
  if (parts.length !== 22 || parts.some((p) => p === "" || !/^-?\d+$/.test(p))) return null;
  return parts.join("_");
}

export const FIELD_LABELS = [
  "Simple preset slot",
  "Filter enabled",
  "Shadows handle",
  "Shadows falloff",
  "Highlights handle",
  "Highlights falloff",
  "Simple hue",
  "Simple tint",
  "Simple brightness",
  "Simple saturation",
  "Shadows hue",
  "Shadows tint",
  "Shadows brightness",
  "Shadows saturation",
  "Midtones hue",
  "Midtones tint",
  "Midtones brightness",
  "Midtones saturation",
  "Highlights hue",
  "Highlights tint",
  "Highlights brightness",
  "Highlights saturation",
] as const;

export type Field = { i: number; label: string; value: string; group: "range" | ZoneKey };

/** Human-readable breakdown of every number in a code. */
export function describeCode(code: string): Field[] | null {
  const s = decode(code);
  if (!s) return null;
  const raw = code.split("_").map(Number);
  const groups: Field["group"][] = ["range", "range", "range", "range", "range", "range", "global", "global", "global", "global", "shadows", "shadows", "shadows", "shadows", "midtones", "midtones", "midtones", "midtones", "highlights", "highlights", "highlights", "highlights"];
  return raw.map((value, i) => {
    let label: string = FIELD_LABELS[i];
    let shown = String(value);
    if (i === 0) shown = `Preset #${Math.min(5, Math.max(1, value + 1))}`;
    if (i === 1) shown = value ? "On" : "Off";
    if (i >= 2) shown = `${value}`;
    if (i === 6 || i === 10 || i === 14 || i === 18) {
      const swatch = Math.floor(value / 125);
      shown = `${Math.round((value / 1000) * 360)}°${swatch < 8 ? ` · ${["Red", "Orange", "Lime", "Green", "Cyan", "Blue", "Purple", "Magenta"][swatch]}` : ""}`;
    }
    if (i === 8 || i === 12 || i === 16 || i === 20)
      shown = `${Math.round(value / 20) - 50} (${Math.round(value / 20)} panel)`;
    if (i === 9 || i === 13 || i === 17 || i === 21) shown = `${Math.round(value / 20)} panel`;
    if (i === 7 || i === 11 || i === 15 || i === 19) shown = `${Math.round(value / 10)} panel`;
    return { i, label, value: shown, group: groups[i] };
  });
}

export function codeDiff(a: string, b: string): number[] {
  const x = a.split("_"),
    y = b.split("_");
  if (x.length !== y.length) return [];
  return x.flatMap((v, i) => (v === y[i] ? [] : [i]));
}

export function lookForCode(code: string) {
  return LOOKS.find((l) => l.code === code);
}

const strength = (n: number, center = 50) => Math.abs(n - center);

/** Computed tags, never a claim about a game: they describe the code itself. */
export function codeMood(s: Settings): string[] {
  const zones = [s.zones.shadows, s.zones.midtones, s.zones.highlights, s.zones.global];
  const warm = zones.filter((z) => {
    const h = ((z.hue % 360) + 360) % 360;
    return h < 90 || h > 300;
  }).length;
  const cool = zones.filter((z) => {
    const h = ((z.hue % 360) + 360) % 360;
    return h >= 150 && h <= 270;
  }).length;
  const vivid = zones.some((z) => z.tint >= 25 || strength(z.sat) >= 18);
  const muted = zones.every((z) => z.tint <= 20 && strength(z.sat) <= 18);
  const dark = zones.some((z) => z.bri <= 43);
  const bright = zones.some((z) => z.bri >= 57);
  const tags: string[] = [];
  if (warm >= 2) tags.push("Warm");
  else if (cool >= 2) tags.push("Cool");
  if (vivid) tags.push("Vivid");
  if (muted) tags.push("Muted");
  if (dark) tags.push("Dark");
  if (bright) tags.push("Bright");
  return tags.length ? tags : ["Neutral"];
}

/** Deterministic PRNG so a random-looking grade can be reproduced from its seed. */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomCode(seed = Math.floor(Math.random() * 1e9)): { code: string; seed: number } {
  const rnd = mulberry32(seed);
  const s = defaultSettings();
  const pick = (k: ZoneKey) => {
    const r = rnd();
    s.zones[k] = {
      hue: Math.floor(rnd() * 8) * 45 + Math.floor(rnd() * 8) * 5.6,
      tint: Math.floor(rnd() * 24),
      sat: 38 + Math.floor(rnd() * 26),
      bri: 42 + Math.floor(rnd() * 17),
    };
    if (r < 0.28) s.zones[k] = { hue: 0, tint: 0, sat: 50, bri: 50 };
  };
  (["shadows", "midtones", "highlights"] as ZoneKey[]).forEach(pick);
  return { code: encodeSettings(s), seed };
}

// Local import kept at the bottom so the module reads top-down.
import { encode as encodeSettings } from "@/lib/codm";
