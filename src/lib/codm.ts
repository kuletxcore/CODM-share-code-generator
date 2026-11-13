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

export function decode(code: string): Settings | null {
  const parts = code.trim().split("_");
  if (parts.length !== 22) return null;
  const n = parts.map((p) => Number(p));
  if (n.some((v) => !Number.isFinite(v))) return null;
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

// ---------- in-game hue controls ----------

/**
 * In game, hue is one of 8 swatches 45° apart plus a 0–100 slider towards the
 * next swatch (raw = swatch * 125 + slider * 1.25). Confirmed against four
 * in-game screenshots with known codes.
 */
export const SWATCH_NAMES = ["Red", "Orange", "Lime", "Green", "Cyan", "Blue", "Purple", "Magenta"];

export function hueParts(deg: number): { swatch: number; pos: number } {
  const d = ((deg % 360) + 360) % 360;
  const swatch = Math.min(7, Math.floor(d / 45 + 1e-9));
  return { swatch, pos: Math.min(100, (d - swatch * 45) / 0.45) };
}

export const hueFrom = (swatch: number, pos: number) => swatch * 45 + pos * 0.45;

// ---------- colour helpers ----------

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

/** Approximate preview of the filter. Operates in place on RGBA pixel data. */
export function applyGrade(data: Uint8ClampedArray, s: Settings) {
  const bands = thresholds(s);
  const zs = [s.zones.shadows, s.zones.midtones, s.zones.highlights, s.zones.global];
  const tintRgb = zs.map((z) => hueToRgb(z.hue));
  const tintAmt = zs.map((z) => clamp(z.tint / 100, 0, 1));
  const satMul = zs.map((z) => clamp(z.sat / 50, 0, 2));
  const briMul = zs.map((z) => clamp(z.bri / 50, 0, 2));
  const w = [0, 0, 0, 1];

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255,
      g = data[i + 1] / 255,
      b = data[i + 2] / 255;
    const l0 = luma(r, g, b);
    const [ws, wm, wh] = zoneWeights(l0, bands);
    w[0] = ws;
    w[1] = wm;
    w[2] = wh;
    // index 3 is the first code group, applied to the whole image
    for (let z = 0; z < 4; z++) {
      const k = w[z];
      if (k <= 0.001) continue;
      const l = luma(r, g, b);
      const t = tintAmt[z] * k;
      const c = tintRgb[z];
      const cl = luma(c[0], c[1], c[2]) || 1;
      // luminance-preserving tint
      let nr = r + (l * (c[0] / cl) - r) * t;
      let ng = g + (l * (c[1] / cl) - g) * t;
      let nb = b + (l * (c[2] / cl) - b) * t;
      const sm = 1 + (satMul[z] - 1) * k;
      const l2 = luma(nr, ng, nb);
      nr = l2 + (nr - l2) * sm;
      ng = l2 + (ng - l2) * sm;
      nb = l2 + (nb - l2) * sm;
      const bm = 1 + (briMul[z] - 1) * k;
      r = nr * bm;
      g = ng * bm;
      b = nb * bm;
    }
    data[i] = r * 255;
    data[i + 1] = g * 255;
    data[i + 2] = b * 255;
  }
}

// ---------- screenshot -> settings ----------

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
  const b = base ? zoneStats(base, bands) : null;
  const neutral = [
    { l: 0.11, sat: 0.3 },
    { l: 0.42, sat: 0.3 },
    { l: 0.8, sat: 0.14 },
  ];
  (["shadows", "midtones", "highlights"] as ZoneKey[]).forEach((k, i) => {
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

// ---------- presets ----------

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
    note: "Approximates the Black Ops Cold War colour grade",
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

// ---------- looks gallery ----------

export type Look = {
  name: string;
  note: string;
  mode: "Simple" | "Advanced";
  code: string;
  /** Reference image the look is based on (not a CODM capture). */
  image?: string;
};

/** Ready-made looks shown in the gallery. */
export const LOOKS: Look[] = [
  {
    // Shadows Cyan 60 / tint 10 / bri 46, midtones Orange 0 / tint 6 / sat 56,
    // highlights Orange 10 / tint 12 / sat 52 / bri 53.
    name: "Hajin",
    note: "MW4 inspired: bright sun, warm autumn, cool shadows",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_575_100_-80_1000_125_60_20_1120_138_120_60_1040",
    image: "/looks/hajin.webp",
  },
  {
    name: "Verdansk",
    note: "Warm highlights, cool shadows, muted",
    mode: "Advanced",
    code: PRESETS[1].code,
    image: "/looks/verdansk.webp",
  },
  {
    name: "Cold War",
    note: "Approximates the Black Ops Cold War colour grade",
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
