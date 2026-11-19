// CODM colour-filter share code: codec, preview grading and screenshot analysis.
//
// The share code is 22 underscore-separated integers, worked out from in-game
// screenshots taken alongside their codes:
//
//   [0] selected Simple preset slot (0-4 = Preset #1-#5)   [1] enabled
//   [2..5] Range bar: shadows handle, falloff, highlights handle, falloff
//   then 4 groups of hue_tint_brightness_saturation: Simple (whole image),
//   shadows, midtones, highlights.
//
// Stored units -> panel units:
//   hue        0..1000   -> swatch (0-7) * 125 + slider (0-100) * 1.25
//   tint       0..1000   -> 0..100
//   brightness -1000..1000 -> 0..100 (50 = neutral)
//   saturation 0..2000   -> 0..100 (50 = neutral)

export type Zone = { hue: number; tint: number; sat: number; bri: number };
export type ZoneKey = "global" | "shadows" | "midtones" | "highlights";
/** Order of the four value groups in a share code (all confirmed in game). */
export const ZONES: ZoneKey[] = ["global", "shadows", "midtones", "highlights"];

export type Settings = {
  /** Selected Simple preset slot, 0-4 (Preset #1-#5). */
  preset: number;
  enabled: number;
  /** Shadows handle on the Range bar, 0–1000. */
  shadowPos: number;
  /** End of the shadows falloff; the game writes handle + 100 once the handle is dragged. */
  shadowEdge: number;
  /** Highlights handle on the Range bar, 0–1000. */
  highlightPos: number;
  /** Highlights falloff; handle + 100 once dragged. */
  highlightEdge: number;
  zones: Record<ZoneKey, Zone>;
};

export const neutralZone = (): Zone => ({ hue: 0, tint: 0, sat: 50, bri: 50 });

export const defaultSettings = (): Settings => ({
  preset: 0,
  enabled: 1,
  shadowPos: 30,
  shadowEdge: 300,
  highlightPos: 1000,
  highlightEdge: 1500,
  zones: {
    shadows: neutralZone(),
    midtones: neutralZone(),
    highlights: neutralZone(),
    global: neutralZone(),
  },
});

export const DEFAULT_CODE =
  "0_1_30_300_1000_1500_0_0_0_1000_0_0_0_1000_0_0_0_1000_0_0_0_1000";

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * Ranges the game can actually write. Codes from other tools, older builds or
 * a mis-typed paste are clamped into them rather than rejected, so the editor
 * never renders a slider outside its own track.
 */
const CODE_RANGES = {
  preset: [0, 4],
  enabled: [0, 1],
  shadowPos: [0, 1000],
  shadowEdge: [0, 1500],
  highlightPos: [0, 1000],
  highlightEdge: [0, 1500],
} as const;

/** True when `code` has the shape of a share code: 22 integers joined by `_`. */
export function isCode(code: string): boolean {
  return decode(code) !== null;
}

export function encode(s: Settings): string {
  const out = [
    s.preset,
    s.enabled,
    s.shadowPos,
    s.shadowEdge,
    s.highlightPos,
    s.highlightEdge,
  ];
  for (const k of ZONES) {
    const z = s.zones[k];
    out.push(
      Math.round((z.hue / 360) * 1000),
      Math.round(z.tint * 10),
      // confirmed in game: brightness is an offset around 0, saturation scales around 1000
      Math.round((z.bri - 50) * 20),
      Math.round(z.sat * 20),
    );
  }
  return out.map((n) => Math.round(n)).join("_");
}

export function decode(code: string): Settings | null {
  const parts = code.trim().split("_");
  if (parts.length !== 22) return null;
  // Integer fields only: "" (a double underscore), "1e3", "0x10" and "1.5"
  // are all paste damage, not codes.
  const n: number[] = [];
  for (const part of parts) {
    const p = part.trim();
    if (!/^[-+]?\d+$/.test(p)) return null;
    n.push(Number(p));
  }
  const s = defaultSettings();
  s.preset = clamp(n[0], ...CODE_RANGES.preset);
  s.enabled = clamp(n[1], ...CODE_RANGES.enabled);
  s.shadowPos = clamp(n[2], ...CODE_RANGES.shadowPos);
  s.shadowEdge = clamp(n[3], ...CODE_RANGES.shadowEdge);
  s.highlightPos = clamp(n[4], ...CODE_RANGES.highlightPos);
  s.highlightEdge = clamp(n[5], ...CODE_RANGES.highlightEdge);
  ZONES.forEach((k, i) => {
    const o = 6 + i * 4;
    s.zones[k] = {
      hue: clamp((n[o] / 1000) * 360, 0, 360),
      tint: clamp(n[o + 1] / 10, 0, 100),
      bri: clamp(n[o + 2] / 20 + 50, 0, 100),
      sat: clamp(n[o + 3] / 20, 0, 100),
    };
  });
  return s;
}

// Anatomy of a code

export type CodeGroup = "header" | ZoneKey;

export const GROUP_LABEL: Record<CodeGroup, string> = {
  header: "Range bar",
  global: "Simple",
  shadows: "Shadows",
  midtones: "Midtones",
  highlights: "Highlights",
};

export type CodeField =
  | "preset"
  | "enabled"
  | "shadowPos"
  | "shadowEdge"
  | "highlightPos"
  | "highlightEdge"
  | "hue"
  | "tint"
  | "sat"
  | "bri";

export type CodeCell = {
  /** Position in the 22-number code (0-based). */
  index: number;
  raw: number;
  group: CodeGroup;
  field: CodeField;
  /** What this number means, in the words the game uses. */
  label: string;
  /** The value as a player reads it (percent, swatch, level). */
  text: string;
  /** False when the number is at its default and changes nothing. */
  active: boolean;
};

type HeaderField = Exclude<CodeField, "hue" | "tint" | "sat" | "bri">;

const HEADER_CELLS: { field: HeaderField; label: string; unit: "%" | "#" | "on/off" }[] = [
  { field: "preset", label: "Preset slot", unit: "#" },
  { field: "enabled", label: "Enabled", unit: "on/off" },
  { field: "shadowPos", label: "Shadows end", unit: "%" },
  { field: "shadowEdge", label: "Shadows falloff", unit: "%" },
  { field: "highlightPos", label: "Highlights start", unit: "%" },
  { field: "highlightEdge", label: "Highlights falloff", unit: "%" },
];

/** Defaults as they appear in a code's header. */
const CODE_DEFAULTS: Record<HeaderField, number> = {
  preset: 0,
  enabled: 1,
  shadowPos: 30,
  shadowEdge: 300,
  highlightPos: 1000,
  highlightEdge: 1500,
};

const ZONE_FIELDS: { field: Extract<CodeField, "hue" | "tint" | "sat" | "bri">; label: string }[] = [
  { field: "hue", label: "Hue" },
  { field: "tint", label: "Tint" },
  { field: "bri", label: "Brightness" },
  { field: "sat", label: "Saturation" },
];

/**
 * Explains each of the 22 numbers in a code. The editor shows this next to the
 * code so the format stops being opaque, but the code stays the source of
 * truth: everything here is read back from `decode`.
 */
export function describeCode(code: string): CodeCell[] | null {
  const s = decode(code);
  if (!s) return null;
  const raw = code.trim().split("_").map((p) => Number(p.trim()));
  const cells: CodeCell[] = [];
  const defaults = defaultSettings();

  HEADER_CELLS.forEach((h, i) => {
    const v = raw[i];
    const def = CODE_DEFAULTS[h.field];
    cells.push({
      index: i,
      raw: v,
      group: "header",
      field: h.field,
      label: h.label,
      text:
        h.unit === "#"
          ? `Preset #${s.preset + 1}`
          : h.unit === "on/off"
            ? s.enabled
              ? "On"
              : "Off"
            : `${Math.round(v / 10)}%`,
      active: v !== def,
    });
  });

  ZONES.forEach((zone, zi) => {
    const z = s.zones[zone];
    const hp = hueParts(z.hue);
    ZONE_FIELDS.forEach((f, fi) => {
      const index = 6 + zi * 4 + fi;
      const neutral = defaults.zones[zone];
      const value =
        f.field === "hue"
          ? `${SWATCH_NAMES[hp.swatch]} +${Math.round(hp.pos)}`
          : `${Math.round(z[f.field as "tint" | "sat" | "bri"])}`;
      cells.push({
        index,
        raw: raw[index],
        group: zone,
        field: f.field,
        label: `${GROUP_LABEL[zone]} · ${f.label}`,
        text: value,
        active:
          f.field === "hue"
            ? Math.abs(z.tint) > 0.5
            : f.field === "tint"
              ? z.tint > 0.5
              : Math.abs(z[f.field as "tint" | "sat" | "bri"] - neutral[f.field as "tint" | "sat" | "bri"]) >
                0.5,
      });
    });
  });

  return cells;
}

// In-game hue controls

/**
 * In game, hue is one of 8 swatches 45° apart plus a 0–100 slider towards the
 * next swatch (raw = swatch * 125 + slider * 1.25). Confirmed against four
 * in-game screenshots with known codes.
 */
export const SWATCH_NAMES = ["Red", "Orange", "Lime", "Green", "Cyan", "Blue", "Purple", "Magenta"];

export function hueParts(deg: number, prefer?: number): { swatch: number; pos: number } {
  const d = ((deg % 360) + 360) % 360;
  // Slider 100 and the next swatch's 0 are the same raw value; honour the swatch
  // the user picked so the end of the slider doesn't jump to the next colour.
  if (prefer !== undefined) {
    const off = (((d - prefer * 45) % 360) + 360) % 360;
    if (off > 44.99 && off < 45.01) return { swatch: prefer, pos: 100 };
  }
  const swatch = Math.min(7, Math.floor(d / 45 + 1e-9));
  return { swatch, pos: Math.min(100, (d - swatch * 45) / 0.45) };
}

export const hueFrom = (swatch: number, pos: number) => swatch * 45 + pos * 0.45;

// Colour helpers

export function hueToRgb(h: number): [number, number, number] {
  const x = (((h % 360) + 360) % 360) / 60;
  const f = (n: number) => {
    const k = (n + x) % 6;
    return 1 - Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

const luma = (r: number, g: number, b: number) =>
  0.2126 * r + 0.7152 * g + 0.0722 * b;

export const smoothstep = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

// Luminance thresholds used by the preview, the analyser and the tone map. The
// falloff shapes are a guess; only the handle positions are confirmed.
export type Bands = { s0: number; s1: number; h0: number; h1: number };

/** Where the three zones meet on the Range bar, in 0–1 luminance. */
export function thresholds(s: Settings): Bands {
  const s0 = clamp(s.shadowPos / 1000, 0, 1);
  const s1 = Math.max(clamp(s.shadowEdge / 1000, 0, 1.5), s0 + 0.02);
  const h1 = clamp(s.highlightPos / 1000, 0, 1);
  const width = Math.max((s.highlightEdge - s.highlightPos) / 1000, 0.02);
  return { s0, s1, h0: h1 - width, h1 };
}

/** How much each zone claims a pixel at luminance `l`. Always sums to 1. */
export function zoneWeights(l: number, t: Bands) {
  const ws = 1 - smoothstep(t.s0, t.s1, l);
  const wh = smoothstep(t.h0, t.h1, l) * (1 - ws);
  const wm = Math.max(0, 1 - ws - wh);
  return [ws, wm, wh] as const;
}

/**
 * Share of a luminance histogram that each zone covers, in percent, using the
 * same falloff the grade uses. `hist` is indexed by luminance bin.
 */
export function zoneShares(hist: ArrayLike<number>, t: Bands): [number, number, number] {
  const bins = hist.length;
  let ws = 0;
  let wm = 0;
  let wh = 0;
  let n = 0;
  for (let i = 0; i < bins; i++) {
    const count = hist[i];
    if (!count) continue;
    const [a, m, h] = zoneWeights((i + 0.5) / bins, t);
    ws += count * a;
    wm += count * m;
    wh += count * h;
    n += count;
  }
  if (!n) return [0, 0, 0];
  // Largest-remainder rounding, so the three shares always add up to 100 and a
  // readout never says "34 + 65 + 2".
  const exact = [ws, wm, wh].map((v) => (v / n) * 100);
  const out = exact.map(Math.floor);
  let left = 100 - out.reduce((a, b) => a + b, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i] += 1;
    left -= 1;
  }
  return out as [number, number, number];
}

/**
 * The per-zone controls resolved once: the tint colour, how much of it to mix
 * in, and the saturation and brightness multipliers. Shared by the CPU grade,
 * the GPU uniforms and the fitter, so the three cannot drift.
 */
export type ZoneOps = {
  colour: [number, number, number];
  /** Luminance of `colour`, so tinting preserves brightness. */
  colourLuma: number;
  tint: number;
  sat: number;
  bri: number;
};

const ZONE_ORDER: ZoneKey[] = ["shadows", "midtones", "highlights", "global"];

export function zoneOps(s: Settings): ZoneOps[] {
  return ZONE_ORDER.map((k) => {
    const z = s.zones[k];
    const colour = hueToRgb(z.hue);
    return {
      colour,
      colourLuma: luma(colour[0], colour[1], colour[2]) || 1,
      tint: clamp(z.tint / 100, 0, 1),
      sat: clamp(z.sat / 50, 0, 2),
      bri: clamp(z.bri / 50, 0, 2),
    };
  });
}

/**
 * Apply one zone at strength `k` to a normalised r/g/b triple, in place.
 * Luminance-preserving tint, then saturation around the new luminance, then a
 * brightness multiplier — in that order, which is what the in-game screen does.
 */
function applyZone(c: [number, number, number], o: ZoneOps, k: number) {
  if (k <= 0.001) return;
  const l = luma(c[0], c[1], c[2]);
  const t = o.tint * k;
  if (t > 0) {
    // c * (1 - t) + colour * (l / colourLuma) * t, kept bright: the tint colour
    // is scaled to the pixel's own luminance before it is mixed in
    const mix = (l / o.colourLuma) * t;
    const keep = 1 - t;
    c[0] = c[0] * keep + o.colour[0] * mix;
    c[1] = c[1] * keep + o.colour[1] * mix;
    c[2] = c[2] * keep + o.colour[2] * mix;
  }
  const sm = 1 + (o.sat - 1) * k;
  if (sm !== 1) {
    const l2 = luma(c[0], c[1], c[2]);
    c[0] = l2 + (c[0] - l2) * sm;
    c[1] = l2 + (c[1] - l2) * sm;
    c[2] = l2 + (c[2] - l2) * sm;
  }
  const bm = 1 + (o.bri - 1) * k;
  if (bm !== 1) {
    c[0] *= bm;
    c[1] *= bm;
    c[2] *= bm;
  }
}

/** Approximate preview of the filter. Operates in place on RGBA pixel data. */
export function applyGrade(data: Uint8ClampedArray, s: Settings) {
  const bands = thresholds(s);
  const ops = zoneOps(s);
  const w = [0, 0, 0, 1];
  const c: [number, number, number] = [0, 0, 0];

  for (let i = 0; i < data.length; i += 4) {
    c[0] = data[i] / 255;
    c[1] = data[i + 1] / 255;
    c[2] = data[i + 2] / 255;
    const [ws, wm, wh] = zoneWeights(luma(c[0], c[1], c[2]), bands);
    w[0] = ws;
    w[1] = wm;
    w[2] = wh;
    // index 3 is the first code group, applied to the whole image
    for (let z = 0; z < 4; z++) applyZone(c, ops[z], w[z]);
    data[i] = c[0] * 255;
    data[i + 1] = c[1] * 255;
    data[i + 2] = c[2] * 255;
  }
}

/** The per-zone inputs applyGrade uses, flattened for the GPU version of the same maths. */
export function gradeUniforms(s: Settings) {
  const b = thresholds(s);
  const ops = zoneOps(s);
  return {
    bands: [b.s0, b.s1, b.h0, b.h1],
    tint: ops.flatMap((o) => o.colour),
    params: ops.flatMap((o) => [o.tint, o.sat, o.bri]),
  };
}

// Screenshot -> settings

export type ZoneStat = { r: number; g: number; b: number; l: number; sat: number; n: number };

/** A neutral scene's per-zone luma and saturation, used when no baseline is given. */
const NEUTRAL_ZONES = [
  { l: 0.11, sat: 0.3 },
  { l: 0.42, sat: 0.3 },
  { l: 0.8, sat: 0.14 },
];

function zoneStats(data: Uint8ClampedArray, bands: Bands): ZoneStat[] {
  const acc = [0, 1, 2].map(() => ({ r: 0, g: 0, b: 0, l: 0, sat: 0, n: 0 }));
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i] / 255,
      g = data[i + 1] / 255,
      b = data[i + 2] / 255;
    const l = luma(r, g, b);
    const mx = Math.max(r, g, b),
      mn = Math.min(r, g, b);
    const sat = mx > 0.02 ? (mx - mn) / mx : 0;
    const w = zoneWeights(l, bands);
    for (let z = 0; z < 3; z++) {
      const a = acc[z];
      a.r += r * w[z];
      a.g += g * w[z];
      a.b += b * w[z];
      a.l += l * w[z];
      a.sat += sat * w[z];
      a.n += w[z];
    }
  }
  return acc.map((a) => {
    const n = a.n || 1;
    return { r: a.r / n, g: a.g / n, b: a.b / n, l: a.l / n, sat: a.sat / n, n: a.n };
  });
}

function castOf(z: ZoneStat) {
  // chroma vector on the opponent axes, normalised by luminance
  const l = z.l || 1e-3;
  const dr = (z.r - z.l) / l,
    dg = (z.g - z.l) / l,
    db = (z.b - z.l) / l;
  const x = dr - 0.5 * dg - 0.5 * db;
  const y = (Math.sqrt(3) / 2) * (dg - db);
  return { x, y };
}

/**
 * Estimate settings that move `base` towards `target`.
 * Without a base image, a neutral scene is assumed (no cast, typical
 * saturation and exposure), which is a rougher guess.
 */
export function analyse(
  target: Uint8ClampedArray,
  base: Uint8ClampedArray | null,
): Settings {
  const s = defaultSettings();
  if (target.length < 4) return s;
  const bands = thresholds(s);
  const t = zoneStats(target, bands);
  // A zone with no pixels (a screenshot of a letterboxed scene, say) has no
  // statistics to compare; treat it as a neutral scene rather than divide by ~0.
  const b = base && base.length >= 4 ? zoneStats(base, bands) : null;
  (["shadows", "midtones", "highlights"] as ZoneKey[]).forEach((k, i) => {
    // Nothing in the reference falls in this zone (a flat or a letterboxed
    // screenshot), so no slider value here could change the result.
    if (t[i].n < 1) {
      s.zones[k] = neutralZone();
      return;
    }
    const ct = castOf(t[i]);
    const cb = b ? castOf(b[i]) : { x: 0, y: 0 };
    const dx = ct.x - cb.x,
      dy = ct.y - cb.y;
    const mag = Math.hypot(dx, dy);
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const hasBase = !!b && b[i].n > 0;
    // without a baseline the scene's own colours inflate the cast, so damp it
    const tint = clamp(mag * (hasBase ? 70 : 35), 0, 60);
    const refSat = hasBase ? b![i].sat : NEUTRAL_ZONES[i].sat;
    const refL = hasBase ? b![i].l : NEUTRAL_ZONES[i].l;
    const sat = clamp(50 * (t[i].sat / (refSat || 0.01)), 15, 85);
    const bri = clamp(50 * Math.pow(t[i].l / (refL || 0.01), 0.6), 25, 75);
    s.zones[k] = {
      hue: Math.round(hue),
      tint: Math.round(tint),
      sat: Math.round(hasBase ? sat : 50 + (sat - 50) * 0.5),
      bri: Math.round(hasBase ? bri : 50 + (bri - 50) * 0.5),
    };
  });
  return s;
}


// Scoring a grade against a reference, and fitting one

const FIT_ZONES: ZoneKey[] = ["shadows", "midtones", "highlights"];

/** Zone statistics of a reference screenshot and (optionally) the screen to match from. */
export type Reference = {
  target: ZoneStat[];
  base: ZoneStat[] | null;
};

/** Read a reference once; scoring and fitting then cost almost nothing. */
export function readReference(target: Uint8ClampedArray, base: Uint8ClampedArray | null): Reference | null {
  if (target.length < 4) return null;
  const bands = thresholds(defaultSettings());
  return {
    target: zoneStats(target, bands),
    base: base && base.length >= 4 ? zoneStats(base, bands) : null,
  };
}

/** The zone statistics a scene at `stat` would show after this zone's controls. */
function predictStat(stat: ZoneStat, ops: ZoneOps[], zone: number): ZoneStat {
  const c: [number, number, number] = [stat.r, stat.g, stat.b];
  applyZone(c, ops[zone], 1);
  applyZone(c, ops[3], 1);
  return {
    r: c[0],
    g: c[1],
    b: c[2],
    l: luma(c[0], c[1], c[2]),
    // Saturation is a ratio, so it scales with the saturation controls and is
    // unaffected by brightness; tinting moves it too, which this ignores.
    sat: clamp(stat.sat * ops[zone].sat * ops[3].sat, 0, 1),
    n: stat.n,
  };
}

/** 0 = identical, roughly 1 = unrelated. Chroma counts most, then tone. */
function zoneDistance(a: ZoneStat, b: ZoneStat): number {
  const ca = castOf(a);
  const cb = castOf(b);
  return Math.hypot(ca.x - cb.x, ca.y - cb.y) * 1.6 + Math.abs(a.l - b.l) * 2.4 + Math.abs(a.sat - b.sat) * 0.9;
}

/** Mean zone distance for a grade, and how many zones could be compared. */
function distanceOf(ref: Reference, s: Settings): { mean: number; n: number } {
  const ops = zoneOps(s);
  let sum = 0;
  let n = 0;
  FIT_ZONES.forEach((_, i) => {
    const t = ref.target[i];
    if (t.n < 1) return;
    const from: ZoneStat = ref.base && ref.base[i].n > 0 ? ref.base[i] : {
      r: NEUTRAL_ZONES[i].l,
      g: NEUTRAL_ZONES[i].l,
      b: NEUTRAL_ZONES[i].l,
      l: NEUTRAL_ZONES[i].l,
      sat: NEUTRAL_ZONES[i].sat,
      n: 1,
    };
    sum += zoneDistance(predictStat(from, ops, i), t);
    n += 1;
  });
  return { mean: n ? sum / n : 1, n };
}

/**
 * How close a grade would land to the reference, 0–100. Measured on the zone
 * statistics the converter already computes, not on a re-render, so it updates
 * while a slider moves. Treat it as a compass, not a promise: the preview is an
 * approximation of a filter the game applies its own way.
 */
export function scoreReference(ref: Reference, s: Settings): number {
  const { mean, n } = distanceOf(ref, s);
  if (!n) return 0;
  return Math.round(clamp(100 * Math.exp(-2.6 * mean), 0, 100));
}

const FIT_KNOBS: { field: "hue" | "tint" | "sat" | "bri"; min: number; max: number }[] = [
  { field: "hue", min: 0, max: 360 },
  { field: "tint", min: 0, max: 100 },
  { field: "sat", min: 0, max: 100 },
  { field: "bri", min: 0, max: 100 },
];

/**
 * Hill-climb from `start` towards the reference: try each knob either side of
 * where it is, at a step that halves as it converges. Deterministic, so the
 * same two screenshots always give the same code.
 *
 * Costs a few hundred cheap evaluations over 9 zone statistics — no pixels are
 * re-graded.
 */
export function fitReference(ref: Reference, start: Settings): Settings {
  let best = cloneSettings(start);
  let bestScore = scoreReference(ref, best);
  const steps = [45, 22, 11, 5, 2, 1];
  for (const coarse of steps) {
    let improved = true;
    let guard = 0;
    while (improved && guard++ < 40) {
      improved = false;
      for (const zone of FIT_ZONES) {
        for (const knob of FIT_KNOBS) {
          // hue is in degrees, the rest in percent
          const step = knob.field === "hue" ? coarse * 4 : coarse;
          for (const dir of [-1, 1]) {
            const next = cloneSettings(best);
            const v = clamp(Math.round(next.zones[zone][knob.field] + dir * step), knob.min, knob.max);
            if (v === next.zones[zone][knob.field]) continue;
            next.zones[zone][knob.field] = v;
            const score = scoreReference(ref, next);
            if (score > bestScore) {
              best = next;
              bestScore = score;
              improved = true;
            }
          }
        }
      }
    }
  }
  return best;
}

const cloneSettings = (s: Settings): Settings => ({
  ...s,
  zones: {
    global: { ...s.zones.global },
    shadows: { ...s.zones.shadows },
    midtones: { ...s.zones.midtones },
    highlights: { ...s.zones.highlights },
  },
});

// Presets

export const PRESETS: { name: string; note: string; code: string }[] = [
  { name: "Default", note: "In-game reset state", code: DEFAULT_CODE },
  {
    name: "Verdansk",
    note: "Warm highlights, cool shadows, muted",
    code: encode({
      ...defaultSettings(),
      zones: {
        shadows: { hue: 215, tint: 14, sat: 42, bri: 45 },
        midtones: { hue: 35, tint: 8, sat: 45, bri: 49 },
        highlights: { hue: 38, tint: 18, sat: 50, bri: 53 },
        global: neutralZone(),
      },
    }),
  },
  {
    name: "Cold War",
    note: "Black Ops Cold War colour grade",
    code: "2_1_30_130_1000_1100_624_83_376_677_500_406_80_892_124_121_-161_1094_0_9_1000_385",
  },
];

/** Procedural sample scene so the preview works before an upload. */
export function drawSample(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  sky.addColorStop(0, "#4f86c6");
  sky.addColorStop(1, "#cfe0ee");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  for (const [x, y, r] of [[0.2, 0.18, 0.07], [0.27, 0.2, 0.05], [0.7, 0.12, 0.06], [0.76, 0.15, 0.045]]) {
    ctx.beginPath();
    ctx.ellipse(x * w, y * h, r * w, r * w * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  const ridge = (base: number, amp: number, col: string, seed: number) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) {
      const y = base * h - (Math.sin(x * 0.006 + seed) + Math.sin(x * 0.017 + seed * 2) * 0.5) * amp * h;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.fill();
  };
  ridge(0.52, 0.07, "#8e9aa6", 1);
  ridge(0.58, 0.04, "#6f7f63", 3);
  const ground = ctx.createLinearGradient(0, h * 0.6, 0, h);
  ground.addColorStop(0, "#b39f78");
  ground.addColorStop(1, "#6e5f45");
  ctx.fillStyle = ground;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  // buildings
  const blocks: [number, number, number, number, string][] = [
    [0.08, 0.44, 0.16, 0.2, "#7d8fb0"],
    [0.3, 0.5, 0.1, 0.14, "#a4533f"],
    [0.62, 0.42, 0.13, 0.22, "#c9c2b2"],
    [0.8, 0.5, 0.12, 0.14, "#4d5a3c"],
  ];
  for (const [x, y, bw, bh, c] of blocks) {
    ctx.fillStyle = c;
    ctx.fillRect(x * w, y * h, bw * w, bh * h);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(x * w, (y + bh) * h, bw * w * 1.3, h * 0.025);
    ctx.fillStyle = "rgba(10,12,16,0.8)";
    for (let i = 0; i < 3; i++) ctx.fillRect((x + 0.015 + i * (bw / 3.2)) * w, (y + 0.04) * h, bw * w * 0.16, bh * h * 0.25);
  }
  // trees
  for (const x of [0.02, 0.24, 0.47, 0.55, 0.95]) {
    ctx.fillStyle = "#2c3a22";
    ctx.beginPath();
    ctx.moveTo(x * w, h * 0.66);
    ctx.lineTo((x + 0.025) * w, h * 0.4);
    ctx.lineTo((x + 0.05) * w, h * 0.66);
    ctx.fill();
  }
  // weapon-ish dark shape for deep shadows
  ctx.fillStyle = "#17191c";
  ctx.beginPath();
  ctx.moveTo(w * 0.58, h);
  ctx.lineTo(w * 0.66, h * 0.72);
  ctx.lineTo(w * 0.72, h * 0.7);
  ctx.lineTo(w * 0.98, h * 0.9);
  ctx.lineTo(w, h);
  ctx.fill();
  // colour chips
  const chips = ["#e23b2e", "#f2a71b", "#8fd13f", "#27b36a", "#29b8d6", "#2f5fd0", "#7a3fd0", "#d93fa6", "#f2f2f2", "#8a8a8a", "#1e1e1e"];
  chips.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(w * 0.04 + i * w * 0.042, h * 0.86, w * 0.036, h * 0.08);
  });
}

// Looks gallery

export type Look = {
  name: string;
  note: string;
  mode: "Simple" | "Advanced";
  code: string;
  /** Reference image the look is based on (not a CODM capture). */
  image?: string;
  /** Game the look comes from, for the gallery filter. */
  game?: Game;
};

export const GAMES = ["MW4", "Black Ops 7", "MWII", "Vanguard", "MW 2019", "Cold War"] as const;
export type Game = (typeof GAMES)[number];

/** Ready-made looks shown in the gallery. */
export const LOOKS: Look[] = [
  {
    // Shadows Cyan 60 / tint 10 / bri 46, midtones Orange 0 / tint 6 / sat 56,
    // highlights Orange 10 / tint 12 / sat 52 / bri 53.
    name: "Hajin",
    game: "MW4",
    note: "MW4 BR / Warzone: bright sun, warm autumn",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_575_100_-80_1000_125_60_20_1120_138_120_60_1040",
    image: "/looks/hajin.webp",
  },
  {
    // Shadows Cyan 60 / tint 8 / sat 46 / bri 48, midtones Orange 20 / tint 8 /
    // sat 52 / bri 52, highlights Orange 10 / tint 8 / sat 48 / bri 54.
    name: "Apex",
    game: "MW4",
    note: "MW4 Multiplayer: hazy daylight, golden mids",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_575_80_-40_920_150_80_40_1040_138_80_80_960",
    image: "/looks/apex.webp",
  },
  {
    // Black Ops 7 multiplayer. Derived from gameplay footage relative to the pooled daytime footage of all the games sampled, so only the difference from typical footage is kept. Casts disagree between videos, so they cancel out; muted highlights are what they share. (6 videos.)
    name: "2035",
    game: "Black Ops 7",
    note: "Black Ops 7 Multiplayer: neutral, muted highlights",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_992_40_0_960_767_20_-20_960_572_30_20_620",
    image: "/looks/2035.webp",
  },
  {
    // Black Ops Royale on Avalon. Derived from gameplay footage relative to the pooled daytime footage of all the games sampled, so only the difference from typical footage is kept. (4 videos.)
    name: "Avalon",
    game: "Black Ops 7",
    note: "Black Ops 7 Warzone: warm gold shadows, rich mids",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_231_80_0_1080_125_30_0_1260_153_20_-20_1040",
    image: "/looks/avalon.webp",
  },
  {
    // Haven's Hollow by day. Derived from gameplay footage relative to the pooled daytime footage of all the games sampled, so only the difference from typical footage is kept. (2 videos.)
    name: "Haven's Hollow",
    game: "Black Ops 7",
    note: "Black Ops 7 Warzone Resurgence: warm sunlit highlights",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_819_30_40_1020_142_10_0_1020_175_100_0_1060",
    image: "/looks/havens-hollow.webp",
  },
  {
    // Haunted Hollow (The Haunting) at night. Derived from gameplay footage relative to the pooled daytime footage of all the games sampled, so only the difference from typical footage is kept. (2 videos.)
    name: "Haven's Hollow (Night)",
    game: "Black Ops 7",
    note: "Haunted Hollow, Black Ops 7 Warzone: deep blue shadows, darker mids",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_653_190_-60_1180_656_110_-120_1080_697_10_0_800",
    image: "/looks/havens-hollow-night.webp",
  },
  {
    // Warzone 2.0 on Al Mazrah. Derived from gameplay footage relative to the pooled daytime footage of all the games sampled, so only the difference from typical footage is kept. (3 videos.)
    name: "Al Mazrah",
    game: "MWII",
    note: "MWII Warzone: dusty, desaturated, lifted shadows",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_542_20_100_680_661_10_0_900_175_20_0_1040",
    image: "/looks/al-mazrah.webp",
  },
  {
    // MWII Warzone Zombie Royale (The Haunting) on Vondel at night. Derived from
    // gameplay footage relative to the pooled daytime footage of all the games
    // sampled. Videos disagree on cast (red vs blue) and agree on darker mids. (3 videos.)
    name: "Vondead",
    game: "MWII",
    note: "MWII Warzone Zombie Royale: dark mids, reddish shadows, cool muted highlights",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_994_60_-20_1040_614_30_-120_1060_522_60_0_880",
    image: "/looks/vondead.webp",
  },
  {
    // Warzone Pacific on Caldera. Derived from gameplay footage relative to the pooled daytime footage of all the games sampled, so only the difference from typical footage is kept. (2 videos.)
    name: "Caldera",
    game: "Vanguard",
    note: "Vanguard Warzone Pacific: olive shadows, warm mids",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_244_80_40_1040_147_30_40_1060_136_30_20_900",
    image: "/looks/caldera.webp",
  },
  {
    // Re-tuned from six MW 2019 Warzone videos on Verdansk, relative to the
    // pooled daytime footage. All six show warm (not cool) shadows and richer
    // mids; highlights sit close to typical footage. The earlier hand-made
    // version (cool shadows, strong warm highlights) is PRESETS[1].
    name: "Verdansk",
    game: "MW 2019",
    note: "MW 2019: warm, richer mids",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_117_30_0_900_94_30_0_1120_203_10_40_1020",
    image: "/looks/verdansk.webp",
  },
  {
    name: "Cold War",
    game: "Cold War",
    note: "Black Ops Cold War colour grade",
    mode: "Advanced",
    code: PRESETS[2].code,
    image: "/looks/cold-war.webp",
  },
  {
    name: "Default",
    note: "The in-game reset state",
    mode: "Simple",
    code: DEFAULT_CODE,
  },
];
