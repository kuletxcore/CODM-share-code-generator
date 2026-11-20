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

/** Raw range of each value in a zone group, in code order (hue, tint, bri, sat). */
const ZONE_RANGES: [number, number][] = [
  [0, 1000],
  [0, 1000],
  [-1000, 1000],
  [0, 2000],
];

/**
 * Parses a share code. Returns null unless it is exactly 22 integers with every
 * documented value in range, so a truncated paste ("…_0_0_") or a typo can't
 * load as a washed-out grade. The Range handles and falloffs only have to be
 * non-negative: their upper limit isn't known, and the game itself writes
 * handles past the end of the bar (DisasterNinja's Warzone code, whose in-game
 * settings screen matches it, has the highlights handle at 1084).
 */
export function decode(code: string): Settings | null {
  const parts = code.trim().split("_");
  if (parts.length !== 22 || parts.some((p) => !/^-?\d{1,5}$/.test(p))) return null;
  const n = parts.map(Number);
  const inRange = (v: number, [lo, hi]: [number, number]) => v >= lo && v <= hi;
  if (!inRange(n[0], [0, 4]) || !inRange(n[1], [0, 1])) return null;
  if (n[2] < 0 || n[3] < 0 || n[4] < 0 || n[5] < 0) return null;
  for (let i = 6; i < 22; i++) if (!inRange(n[i], ZONE_RANGES[(i - 6) % 4])) return null;
  const s = defaultSettings();
  [s.preset, s.enabled, s.shadowPos, s.shadowEdge, s.highlightPos, s.highlightEdge] = n;
  ZONES.forEach((k, i) => {
    const o = 6 + i * 4;
    s.zones[k] = {
      hue: (n[o] / 1000) * 360,
      tint: n[o + 1] / 10,
      bri: n[o + 2] / 20 + 50,
      sat: n[o + 3] / 20,
    };
  });
  return s;
}

/**
 * Pull a share code out of pasted text such as "Hajin: 0_1_30_...", a share
 * link, or a code with stray spaces. Returns the 22 numbers joined by "_", or
 * null. It only finds the code; `decode` still decides whether it is valid.
 */
export function extractCode(text: string): string | null {
  // The run must be exactly 22 numbers: no number may touch it on either side,
  // or "5 " before a code would shift every value into the wrong slot.
  const m = text.match(/(?<![\d-][\s,_]*)-?\d+(?:[\s,_]+-?\d+){21}(?![\s,_]*-?\d)/);
  return m ? m[0].split(/[\s,_]+/).join("_") : null;
}

// In-game hue controls

/**
 * In game, hue is one of 8 swatches 45° apart plus a 0–100 slider towards the
 * next swatch (raw = swatch * 125 + slider * 1.25). Confirmed against four
 * in-game screenshots with known codes.
 */
export const SWATCH_NAMES = ["Red", "Orange", "Lime", "Green", "Cyan", "Blue", "Purple", "Magenta"];

export function hueParts(deg: number, prefer?: number): { swatch: number; pos: number } {
  // Clamp, don't wrap: raw 1000 (360°) is Magenta at slider 100, not Red at 0.
  // Wrapping would show the wrong swatch and rewrite the hue on the next drag.
  const d = Math.min(360, Math.max(0, deg));
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

const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

// Luminance thresholds used by both the preview and the analyser. The falloff
// shapes are a guess; only the handle positions are confirmed.
type Bands = { s0: number; s1: number; h0: number; h1: number };

function thresholds(s: Settings): Bands {
  const s0 = clamp(s.shadowPos / 1000, 0, 1);
  const s1 = Math.max(clamp(s.shadowEdge / 1000, 0, 1.5), s0 + 0.02);
  const h1 = clamp(s.highlightPos / 1000, 0, 1);
  const width = Math.max((s.highlightEdge - s.highlightPos) / 1000, 0.02);
  return { s0, s1, h0: h1 - width, h1 };
}

function zoneWeights(l: number, t: Bands) {
  const ws = 1 - smooth(t.s0, t.s1, l);
  const wh = smooth(t.h0, t.h1, l) * (1 - ws);
  const wm = Math.max(0, 1 - ws - wh);
  return [ws, wm, wh] as const;
}

/**
 * Per-pixel constants for one grade, computed once.
 *
 * The zone maths is the same for every pixel, so the only things worth doing per
 * pixel are the luminance lookup and the four zone blends. `applyGrade` used to
 * re-derive the tint/amount/multiplier arrays for every pixel; hoisting them here
 * is what makes a full-frame regrade cheap enough to run inside a pointer move.
 */
export type GradePlan = {
  s0: number;
  s1: number;
  h0: number;
  h1: number;
  /** Tint colour per zone, pre-divided by its own luma (luminance-preserving). */
  tint: Float64Array;
  /** Tint amount 0..1 per zone. */
  amount: Float64Array;
  /** Saturation multiplier per zone. */
  sat: Float64Array;
  /** Brightness multiplier per zone. */
  bri: Float64Array;
  /** 1 when the zone would change anything at all, 0 when it is a no-op. */
  live: Uint8Array;
  /** True when no zone can do anything, so the whole grade is a no-op. */
  neutral: boolean;
};

export function gradePlan(s: Settings): GradePlan {
  const b = thresholds(s);
  const zs = [s.zones.shadows, s.zones.midtones, s.zones.highlights, s.zones.global];
  const tint = new Float64Array(12);
  const amount = new Float64Array(4);
  const sat = new Float64Array(4);
  const bri = new Float64Array(4);
  const live = new Uint8Array(4);
  for (let z = 0; z < 4; z++) {
    const zone = zs[z];
    const c = hueToRgb(zone.hue);
    const cl = luma(c[0], c[1], c[2]) || 1;
    tint[z * 3] = c[0] / cl;
    tint[z * 3 + 1] = c[1] / cl;
    tint[z * 3 + 2] = c[2] / cl;
    amount[z] = clamp(zone.tint / 100, 0, 1);
    sat[z] = clamp(zone.sat / 50, 0, 2);
    bri[z] = clamp(zone.bri / 50, 0, 2);
    live[z] = amount[z] > 0 || sat[z] !== 1 || bri[z] !== 1 ? 1 : 0;
  }
  return {
    s0: b.s0,
    s1: b.s1,
    h0: b.h0,
    h1: b.h1,
    tint,
    amount,
    sat,
    bri,
    live,
    neutral: !live[0] && !live[1] && !live[2] && !live[3],
  };
}

/** Approximate preview of the filter. Operates in place on RGBA pixel data. */
export function applyGrade(data: Uint8ClampedArray, s: Settings) {
  paintGrade(data, gradePlan(s));
}

/**
 * `applyGrade` with the plan already built. Call this in a loop over several
 * buffers that share one grade.
 */
export function paintGrade(data: Uint8ClampedArray, plan: GradePlan) {
  // Nothing to do: the code is the reset state. Skipping the loop entirely is
  // what makes "no filter" free instead of a full-frame pass.
  if (plan.neutral) return;

  const { s0, s1, h0, h1, tint, amount, sat, bri, live } = plan;
  const allLive = live[0] && live[1] && live[2] && live[3];

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255,
      g = data[i + 1] / 255,
      b = data[i + 2] / 255;
    // Zone weights come from the pixel's ORIGINAL luminance, all at once.
    const l0 = luma(r, g, b);
    const ws = 1 - smooth(s0, s1, l0);
    const wh = smooth(h0, h1, l0) * (1 - ws);
    const wm = Math.max(0, 1 - ws - wh);
    for (let z = 0; z < 4; z++) {
      if (!allLive && !live[z]) continue;
      // index 3 is the first code group, applied to the whole image
      const k = z === 3 ? 1 : z === 0 ? ws : z === 1 ? wm : wh;
      if (k <= 0.001) continue;
      const l = luma(r, g, b);
      const t = amount[z] * k;
      const p = z * 3;
      // luminance-preserving tint
      let nr = r + (l * tint[p] - r) * t;
      let ng = g + (l * tint[p + 1] - g) * t;
      let nb = b + (l * tint[p + 2] - b) * t;
      const sm = 1 + (sat[z] - 1) * k;
      const l2 = luma(nr, ng, nb);
      nr = l2 + (nr - l2) * sm;
      ng = l2 + (ng - l2) * sm;
      nb = l2 + (nb - l2) * sm;
      const bm = 1 + (bri[z] - 1) * k;
      r = nr * bm;
      g = ng * bm;
      b = nb * bm;
    }
    data[i] = r * 255;
    data[i + 1] = g * 255;
    data[i + 2] = b * 255;
  }
}

/** The per-zone inputs applyGrade uses, flattened for the GPU version of the same maths. */
export function gradeUniforms(s: Settings) {
  const b = thresholds(s);
  const zs = [s.zones.shadows, s.zones.midtones, s.zones.highlights, s.zones.global];
  return {
    bands: [b.s0, b.s1, b.h0, b.h1],
    tint: zs.flatMap((z) => hueToRgb(z.hue)),
    params: zs.flatMap((z) => [clamp(z.tint / 100, 0, 1), clamp(z.sat / 50, 0, 2), clamp(z.bri / 50, 0, 2)]),
  };
}

// Screenshot -> settings

type ZoneStat = { r: number; g: number; b: number; l: number; sat: number; n: number };

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
  const bands = thresholds(s);
  const t = zoneStats(target, bands);
  // zoneStats samples a subset of pixels, so compare against what it counted
  const counted = t.reduce((sum, z) => sum + z.n, 0);
  const b = base ? zoneStats(base, bands) : null;
  const neutral = [
    { l: 0.11, sat: 0.3 },
    { l: 0.42, sat: 0.3 },
    { l: 0.8, sat: 0.14 },
  ];
  (["shadows", "midtones", "highlights"] as ZoneKey[]).forEach((k, i) => {
    // (Almost) no pixels in this tonal range: nothing was measured, so leave it
    // neutral rather than invent a grade from a near-empty bucket.
    if (t[i].n < counted * 0.005) return;
    const ct = castOf(t[i]);
    const cb = b ? castOf(b[i]) : { x: 0, y: 0 };
    const dx = ct.x - cb.x,
      dy = ct.y - cb.y;
    const mag = Math.hypot(dx, dy);
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    // without a baseline the scene's own colours inflate the cast, so damp it
    const tint = clamp(mag * (b ? 70 : 35), 0, 60);
    const refSat = b ? b[i].sat : neutral[i].sat;
    const refL = b ? b[i].l : neutral[i].l;
    const sat = clamp(50 * (t[i].sat / (refSat || 0.01)), 15, 85);
    const bri = clamp(50 * Math.pow(t[i].l / (refL || 0.01), 0.6), 25, 75);
    s.zones[k] = {
      hue: Math.round(hue),
      tint: Math.round(tint),
      sat: Math.round(b ? sat : 50 + (sat - 50) * 0.5),
      bri: Math.round(b ? bri : 50 + (bri - 50) * 0.5),
    };
  });
  return s;
}

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
  /** Reference image the look is based on (not a CODM capture), unless `inGame`. */
  image?: string;
  /** The image is a CODM capture with this exact code applied, so it is labelled "In game". */
  inGame?: boolean;
  /** Game the look comes from, for the gallery filter. */
  game?: Game;
};

export const GAMES = ["MW4", "Black Ops 7", "Black Ops 6", "MWIII", "MWII", "Vanguard", "MW 2019", "Cold War", "CODM"] as const;
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
    // Black Ops 6, derived relative to the pooled daytime footage of all the
    // games sampled, like 2035 and Avalon. Sources: 396 in-game stills of 125
    // weapons from the archived IMFDB page (gallery renders and menus filtered
    // out), plus two weapon-inspect videos on one firing range
    // (youtu.be/PYKQS55ybeg, oib4jqSmRn0) and the first 15 s of
    // youtu.be/Tw7be_2GCHw. Stills and videos agree on darker, more saturated
    // shadows and muted, slightly cool highlights; the videos' green shadow
    // cast came from the one firing range and drops out with the stills.
    // The card is the owner's own screenshot (Nuketown), cropped clear of an ID string.
    name: "Black Ops 6",
    game: "Black Ops 6",
    note: "Black Ops 6: darker, richer shadows and muted, slightly cool highlights",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_642_20_-120_1160_644_30_0_980_689_30_0_640",
    image: "/looks/black-ops-6.webp",
  },
  {
    // MWIII, derived relative to the pooled daytime footage of all the games
    // sampled. Sources: five multiplayer videos (youtu.be/F-EGowtfMS4,
    // CRF20NdUcgw, CPv_ll8Tw9A, NHKlrR6UFr0, and cluAqepnjEY cropped clear of
    // its facecam) and 429 in-game stills of 96 weapons from the archived IMFDB
    // page (renders and menus filtered out). Both agree on cooler shadows and
    // less saturation throughout; the stills add slightly darker shadows.
    // The card is the owner's own screenshot, cropped clear of an ID string.
    name: "MWIII",
    game: "MWIII",
    note: "MWIII: cooler shadows, muted colour across the range",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_547_50_-80_920_656_30_0_920_683_30_20_700",
    image: "/looks/mwiii.webp",
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
    // Shared by MorganPixy in the pinned comment of their video "Call of Duty
    // Mobile with Modern Warfare 2022 Color Filter" (youtu.be/DtpgvsKhR5w),
    // which also shows the in-game settings: Shadows only, Orange swatch,
    // slider 0, Tint 40, Saturation 35, Brightness 100, shadows handle moved.
    // The code decodes to exactly those values. The card is a frame from it.
    name: "MW2022",
    game: "MWII",
    note: "MorganPixy's MWII filter: warm orange, washed-out lifted shadows",
    mode: "Advanced",
    code: "0_1_189_289_1000_1100_0_0_0_1000_125_396_1000_697_0_0_0_1000_0_0_0_1000",
    image: "/looks/mw2022.webp",
    inGame: true,
  },
  {
    // Shared by MorganPixy in the pinned comment of their video "Call Of Duty
    // Mobile Season 3 2026 - Modern Warfare 2019 Color Filter"
    // (youtu.be/TImj7OGnM60). They say it suits recent MW 2019 maps on
    // High/Very High graphics with anti-aliasing and bloom on. The card is a
    // frame from that video, cropped clear of its picture-in-picture inset.
    name: "MW2019",
    game: "MW 2019",
    note: "MorganPixy's MW 2019 multiplayer filter: darker warm shadows, brighter highlights. Made for MW 2019 maps with bloom on",
    mode: "Advanced",
    code: "0_1_259_359_1000_1100_0_0_0_1000_197_129_-204_1000_0_0_-3_990_0_0_195_1007",
    image: "/looks/mw2019.webp",
    inGame: true,
  },
  {
    // Shared by DisasterNinja in the pinned comment of "COD Mobile BEST Color
    // Settings: Make Your Graphics Look Like WARZONE!" (youtu.be/Kq2q9lV2VOY,
    // 4 Sep 2026), which shows the in-game screen: Simple Red 0 / Tint 23 /
    // Saturation 77 / Brightness 70, Shadows Lime 0 / 17 / 59 / 78, and both
    // Range handles at the right end. The code decodes to exactly those values.
    // Warzone ran on Black Ops 7 then (Season 05; Activision's Season 06
    // announcement, Sep 2026). The card is a frame from the video, cropped
    // clear of the HUD. The map is Black Ops 6's Nuketown, identified by its
    // house; the minimap's "Special Forces Base" is CODM's callout for a team spawn.
    name: "Warzone",
    game: "Black Ops 7",
    note: "DisasterNinja's Warzone look: bright, warm and saturated, with lime-lifted shadows",
    mode: "Advanced",
    code: "0_1_974_1074_1084_1094_0_232_403_1531_250_169_552_1175_0_0_0_1000_0_0_0_1000",
    image: "/looks/warzone-bo7.webp",
    inGame: true,
  },
  {
    // HunterRafi, "Turn COD Mobile into MODERN WARFARE 2019 - COD Mobile Best
    // Colour Settings" (youtu.be/vi1WYrsuXDs, 2 Jan 2026). No code is posted;
    // this one is rebuilt from the four settings pages shown at 0:23-0:44
    // (Simple: Preset #2, Red 98 / Tint 24 / Sat 42 / Bri 56; Shadows Orange
    // 13/18/51/60; Midtones Orange 14/14/47/75; Highlights Red 0/1/36/70, the
    // shown Tint 1 being the game's display of 0). Range handles measured from
    // the bar at about 17.5% and 89%, so they are within about 2% of his.
    name: "MW2019 (HunterRafi)",
    game: "MW 2019",
    note: "HunterRafi's MW 2019 settings: warm, bright midtones and highlights, softer colour",
    mode: "Advanced",
    code: "1_1_175_275_890_990_123_240_120_840_141_180_200_1020_143_140_500_940_0_0_400_720",
    image: "/looks/mw2019-hunterrafi.webp",
    inGame: true,
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
    // Mr.CODM_PRO_YT, "Low End Device Best Colour graphics settings in CODM BR"
    // (youtu.be/kRGy1BqMwgo, 13 Nov 2026), made for CODM's Verdansk on low-end
    // phones. No code is posted; rebuilt from the Simple panel it shows: Blue,
    // Hue 94, Tint 12, Saturation 51, Brightness 44. The card is the filtered
    // half of that Short, cropped clear of the HUD and the creator's watermark.
    name: "Verdansk Low-End",
    game: "CODM",
    note: "Mr.CODM_PRO_YT's setting for CODM Verdansk on low-end phones: slight blue tint, a touch darker",
    mode: "Simple",
    code: "0_1_30_300_1000_1500_743_120_-120_1020_0_0_0_1000_0_0_0_1000_0_0_0_1000",
    image: "/looks/verdansk-low-end.webp",
    inGame: true,
  },
  {
    // Kith, "The BEST Settings To See Enemies Better in CODM"
    // (youtu.be/FpxFdjQg5bg, 7 Feb 2025). No code is posted; rebuilt from the
    // final state of each page in his walkthrough (1:19, 1:41, 1:53): Shadows
    // Cyan 90 / Tint 5 / Sat 65 / Bri 100, Midtones Red 10 / 90 / 65 / 80,
    // Highlights Orange 0 / 1 (shown; 0 in code) / 30 / 50; Range left at the
    // ends; Preset #5. The card is a "Setting: ON" frame from the video.
    name: "Kith",
    game: "CODM",
    note: "Kith's visibility settings: lifted cyan shadows, strong red-tinted mids, softer highlights",
    mode: "Advanced",
    code: "4_1_30_300_1000_1500_0_0_0_1000_613_50_1000_1300_13_900_600_1300_125_0_0_600",
    image: "/looks/kith.webp",
    inGame: true,
  },
  {
    // Serotonin, "Best Color Settings for CODM to Spot Enemies Faster!"
    // (youtu.be/MvEatDU4eiE, 30 Jun 2026). A tutorial that tries several
    // colours; this is the state he saves in the closing recap (6:24-6:32):
    // Simple Blue 98 / Tint 25 / Sat 25 / Bri 70 (Preset #1), Highlights Red
    // 0 / 25 / 70 / 100, Midtones Red 98 / 15 / 80 / 70, and the last Shadows
    // page shown (3:13-3:18), Green 96 / 25 / 90 / 95. Range at the default.
    // No card: the video is 360p, so the look is shown on the preview scene.
    name: "Serotonin",
    game: "CODM",
    note: "Serotonin's spotting settings: bright green-tinted shadows, warm saturated mids, very bright highlights",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_748_250_400_500_495_250_900_1800_123_150_400_1600_0_250_1000_1400",
  },
  {
    name: "Default",
    note: "The in-game reset state",
    mode: "Simple",
    code: DEFAULT_CODE,
  },
];
