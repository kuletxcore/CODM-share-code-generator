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

/**
 * Whitespace the game's field parser skips around a number: the .NET
 * `Char.IsWhiteSpace` set of its runtime, which predates Unicode 6.3, so it
 * still holds U+180E. It does not hold U+FEFF or U+200B, which JavaScript's
 * `trim()` would strip.
 */
const GAME_WS =
  "\\t\\n\\v\\f\\r \\u0085\\u00a0\\u1680\\u180e\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
/**
 * One field: optional whitespace, one optional sign, ASCII digits, optional
 * whitespace. A NUL character ends the field early, so anything after it is
 * ignored (read from the game's parser, not yet tested in game).
 */
const FIELD_RE = new RegExp(`^[${GAME_WS}]*([+-]?[0-9]+)[${GAME_WS}]*(?:\\u0000[^]*)?$`);
const INT32_MIN = -2147483648;
const INT32_MAX = 2147483647;

/**
 * Splits a share code the way the game does: on "_", exactly 22 parts, each a
 * signed 32-bit decimal integer. No range checks happen here, as in the game,
 * whose import stores whatever parses and only clamps later, when it renders.
 * Returns null when the game would reject the code ("invalid share code").
 */
export function parseFields(code: string): number[] | null {
  const parts = code.split("_");
  if (parts.length !== 22) return null;
  const out: number[] = [];
  for (const p of parts) {
    const m = FIELD_RE.exec(p);
    if (!m) return null;
    const v = Number(m[1]);
    if (!Number.isSafeInteger(v) || v < INT32_MIN || v > INT32_MAX) return null;
    out.push(v === 0 ? 0 : v); // no -0
  }
  return out;
}

export type CodeCheck =
  | { ok: true; settings: Settings; notes: string[] }
  | { ok: false; reason: string; notes: string[] };

/**
 * Reads a share code and says what the game does with it. The game accepts
 * any 22 integers; this returns the settings it would render, with values the
 * game clamps already clamped, plus a note for every value it changed. It
 * returns ok: false when the game rejects the code, or when the game accepts
 * it but renders something the preview can't show (no grade at all, or a
 * tint outside 0-100%). A hue outside -166..1166 is kept and renders black.
 */
export function checkCode(code: string): CodeCheck {
  const notes: string[] = [];
  const n = parseFields(code);
  if (!n) return { ok: false, reason: "The game rejects this: it needs exactly 22 whole numbers joined by _.", notes };
  if (n[0] < 0 || n[0] > 4) {
    return {
      ok: false,
      reason: `Preset ${n[0]} doesn't exist (0-4). The game imports the code but then shows no colour filter.`,
      notes,
    };
  }
  const s = defaultSettings();
  s.preset = n[0];
  // The second number only marks the slot as saved; any value imports.
  if (n[1] !== 0 && n[1] !== 1) notes.push(`The second number (${n[1]}) is only a marker; read as 1.`);
  s.enabled = n[1] === 0 ? 0 : 1;
  // Range: the game clamps each value to 0-5000 when it renders. Customize
  // Color shows only 0-1000 on its bar, so opening it moves a handle past 1000.
  const range = n.slice(2, 6).map((v, i) => {
    const c = clamp(v, 0, 5000);
    if (c !== v) notes.push(`Range value ${i + 1} (${v}) is clamped to ${c}.`);
    else if ((i === 0 || i === 2) && v > 1000)
      notes.push(`Range handle ${v} is past the bar; opening Customize Color in game moves it to 1000.`);
    return c;
  });
  [s.shadowPos, s.shadowEdge, s.highlightPos, s.highlightEdge] = range;
  for (const [i, k] of ZONES.entries()) {
    const o = 6 + i * 4;
    const [rawHue, tint, bri, sat] = n.slice(o, o + 4);
    let hue = rawHue;
    if (tint < 0 || tint > 1000) {
      return { ok: false, reason: `${k} tint ${tint} is outside 0-1000; the game renders it unclamped.`, notes };
    }
    if (hue < -166 || hue > 1166) {
      if (tint !== 0) {
        // Kept raw: the key maths turns it black, as the game does.
        notes.push(`${k} hue ${hue} is outside -166 to 1166; the game turns that zone's colour black.`);
      } else {
        notes.push(`${k} hue ${hue} has no effect at tint 0; read as 0.`);
        hue = 0;
      }
    } else if (hue < 0 || hue > 1000) {
      const w = hue < 0 ? hue + 1000 : hue - 1000;
      notes.push(`${k} hue ${hue} wraps to ${w}.`);
      hue = w;
    }
    const b = clamp(bri, -1000, 1000);
    if (b !== bri) notes.push(`${k} brightness ${bri} is clamped to ${b}.`);
    const t = clamp(sat, 0, 2000);
    if (t !== sat) notes.push(`${k} saturation ${sat} is clamped to ${t}.`);
    s.zones[k] = { hue: (hue / 1000) * 360, tint: tint / 10, bri: b / 20 + 50, sat: t / 20 };
  }
  return { ok: true, settings: s, notes };
}

/**
 * Parses a share code into the settings the game renders, or null when the
 * game rejects it or the preview can't show it (see `checkCode`).
 */
export function decode(code: string): Settings | null {
  const r = checkCode(code);
  return r.ok ? r.settings : null;
}

/** The game's Range repair. Alias of `rangeEdges` (float32, see there). */
export function rangeKeys(r0: number, r1: number, r2: number, r3: number): [number, number, number, number] {
  return rangeEdges(r0, r1, r2, r3);
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

/*
 * Preview grade. When USE_GAME_KEY_MODEL is true (the default), the keys
 * follow the game's colour model for CODM 1.0.60: Rec.601 luma when a
 * zone tint also darkens, a plain HSV wheel with linear tint, a single
 * 0–2× brightness gain, 0–2 saturation with the Simple group's
 * saturation added into each zone, and linear Range ramps. Flip it to
 * false to restore the earlier screenshot-fitted curves. See
 * docs/GAME_MODEL_NOTES.md.
 *
 * PIXEL_TRANSFER chooses how a static sRGB screenshot is taken into
 * linear light and back. The default, "aces", undoes a 2.2 gamma, applies
 * the inverse of the standard Narkowicz ACES tone map, grades, then
 * applies ACES and gamma. "reinhard-hdr" keeps the earlier screenshot
 * fit. Range ramps are evaluated in that linear light, using Rec.709.
 */
const USE_GAME_KEY_MODEL = true;

const LUMA_R = USE_GAME_KEY_MODEL ? 0.299 : 0.2126;
const LUMA_G = USE_GAME_KEY_MODEL ? 0.587 : 0.7152;
const LUMA_B = USE_GAME_KEY_MODEL ? 0.114 : 0.0722;

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const x = (((h % 360) + 360) % 360) / 60;
  const f = (n: number) => {
    const k = (n + x) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [f(5), f(3), f(1)];
}

export function hueToRgb(h: number): [number, number, number] {
  return hsvToRgb(h, 1, 1);
}

/** Rec.601 — used when a Shadows/Midtones/Highlights tint also darkens. */
export const luma601 = (r: number, g: number, b: number) =>
  0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Rec.709 weights used to pick the zone blend from a linear-light pixel.
 * 0.2125 / 0.7154 / 0.0721 is the set the grade itself uses.
 */
export const LUMA709 = [0.2125, 0.7154, 0.0721] as const;
export const luma709 = (r: number, g: number, b: number) =>
  LUMA709[0] * r + LUMA709[1] * g + LUMA709[2] * b;

/** Alias kept for older call sites; equals Rec.601 under the game model. */
export const luma = (r: number, g: number, b: number) =>
  LUMA_R * r + LUMA_G * g + LUMA_B * b;

/*
 * How a static sRGB screenshot is taken into linear light and back.
 * "aces" is the game's tone map (standard Narkowicz coefficients).
 * "reinhard-hdr" is the earlier screenshot fit, kept so it can be compared.
 */
export type PixelTransfer = "aces" | "reinhard-hdr";
const PIXEL_TRANSFER: PixelTransfer = "aces";
const DISPLAY_GAMMA = 2.2;
const INV_DISPLAY_GAMMA = 1 / DISPLAY_GAMMA;
/** Display values at or above this would invert to infinite light on the Reinhard path. */
const REINHARD_WHITE = 0.999;
/** Exposure multiplied after the colour grade, before the tone map. */
const EXPOSURE = 1;
// Standard Narkowicz ACES: y = x(ax+b) / (x(cx+d)+e)
const ACES_A = 2.51;
const ACES_B = 0.03;
const ACES_C = 2.43;
const ACES_D = 0.59;
const ACES_E = 0.14;
/** Forward tone map is floored here before gamma encode; values at or below it have no unique inverse. */
const ACES_FLOOR = 1e-4;
/**
 * The tone map clamps its input from above only, at a white point of 50
 * plus a small epsilon. It has no lower clamp: a lane pushed below zero by
 * saturation above 1 or a negative key goes through the rational curve as
 * is, and below about -0.012 the curve is positive again (a strongly
 * negative lane comes out bright, not black). The preview copies that.
 */
const ACES_WHITE = 50.001;
const SAT_TOP = USE_GAME_KEY_MODEL ? 2 : 1.75;
const BRI_TOP = USE_GAME_KEY_MODEL ? 2 : 2.4;
/** Earlier fit: Shadows Brightness pushed harder (~3.3×). The game model uses 2× for every zone. */
const SHADOW_BRI_TOP = USE_GAME_KEY_MODEL ? 2 : 3.3;
/** Earlier fit below 50. The game model is a straight 0–2× line through 50 = 1. */
const BRI_POWER = USE_GAME_KEY_MODEL ? 1 : 1.56;
const TINT_POWER = USE_GAME_KEY_MODEL ? 1 : 1.5;
const ADD_MASTER_SAT_INTO_ZONES = USE_GAME_KEY_MODEL;
const RANGE_HANDLES_AS_DISPLAY_GAMMA = !USE_GAME_KEY_MODEL;
const USE_LINEAR_RAMPS = USE_GAME_KEY_MODEL;
const USE_PLAIN_HSV = USE_GAME_KEY_MODEL;

/**
 * Earlier screenshot fit: measured swatch colours at Tint 100, whose second
 * channel is stronger than a plain hue wheel. Kept so the flag can restore
 * them. The game model uses a plain HSV wheel instead (Orange is 1, 0.75, 0).
 */
const SWATCHES: [number, number, number][] = [
  [1, 0, 0],
  [1, 0.84, 0],
  [0.59, 1, 0],
  [0, 1, 0.42],
  [0, 0.91, 1],
  [0, 0.35, 1],
  [0.54, 0, 1],
  [1, 0, 0.92],
];

/** A hue in degrees to the colour multiplied at full tint, in linear light. */
export function gameHue(h: number): [number, number, number] {
  if (USE_PLAIN_HSV) {
    // Used as a linear-light multiplier, so the HSV value is left as-is.
    return hsvToRgb(h, 1, 1);
  }
  const x = ((((h % 360) + 360) % 360) / 45) % 8;
  const i = Math.floor(x),
    f = x - i;
  const a = SWATCHES[i],
    b = SWATCHES[(i + 1) % 8];
  return [0, 1, 2].map((c) => (a[c] + (b[c] - a[c]) * f) ** DISPLAY_GAMMA) as [number, number, number];
}
/** Display values above this would map to infinite light; 0.999 is ~500x. */
/** 0..1 blend between two luma positions. Linear under the game model; smoothstep was the earlier fit. */
export const bandMix = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a || 1e-6), 0, 1);
  return USE_LINEAR_RAMPS ? t : t * t * (3 - 2 * t);
};

/** Standard Narkowicz ACES tone map, per channel: clamped above at ACES_WHITE only, floored at ACES_FLOOR. */
export function acesForward(x: number) {
  if (x > ACES_WHITE) x = ACES_WHITE;
  const y = (x * (ACES_A * x + ACES_B)) / (x * (ACES_C * x + ACES_D) + ACES_E);
  return Math.max(y, ACES_FLOOR);
}

/**
 * Inverse of `acesForward` (without the floor). The unique non-negative
 * root of the quadratic is the one a preview needs — with these
 * coefficients that is the minus root; the plus root is negative. Values
 * at or below ACES_FLOOR have no unique inverse and map to 0. Values at
 * or above the asymptote a/c have no inverse and are clamped just below it.
 */
export function acesInverse(y: number) {
  if (y <= ACES_FLOOR) return 0;
  const cap = ACES_A / ACES_C;
  if (y >= cap) y = cap * (1 - 1e-6);
  const A = y * ACES_C - ACES_A;
  const B = y * ACES_D - ACES_B;
  const C = y * ACES_E;
  const disc = Math.max(0, B * B - 4 * A * C);
  const s = Math.sqrt(disc);
  const r1 = (-B + s) / (2 * A);
  const r2 = (-B - s) / (2 * A);
  const x = r1 > 0 ? r1 : r2;
  return x > 0 ? x : 0;
}

/** Display value (0..1) to linear light, and back, via PIXEL_TRANSFER. */
export function toLight(x: number) {
  const y = clamp(x, 0, 1) ** DISPLAY_GAMMA;
  if (PIXEL_TRANSFER === "reinhard-hdr") {
    const l = Math.min(y, REINHARD_WHITE);
    return l / Math.max(1e-6, 1 - l);
  }
  return acesInverse(y);
}
// The CPU fallback grades every preview pixel on each slider move; inputs are
// 8-bit, so the linearise step is a table lookup instead of two pow() calls.
const LIGHT_LUT = Float64Array.from({ length: 256 }, (_, v) => toLight(v / 255));

export function toDisplay(v: number) {
  // Only the Reinhard fit needs a non-negative input; the ACES path keeps negative lanes (see ACES_WHITE).
  const y = PIXEL_TRANSFER === "reinhard-hdr" ? Math.max(0, v) / (1 + Math.max(0, v)) : acesForward(v);
  return Math.max(0, y) ** INV_DISPLAY_GAMMA;
}

/** Tint 0..100 to the weight given the hue colour. Linear under the game model; ^1.5 was the earlier fit. */
export const tintWeight = (tint: number) => {
  const t = clamp(tint / 100, 0, 1);
  return TINT_POWER === 1 ? t : 1 - (1 - t) ** TINT_POWER;
};
/** Saturation 0..100 to a colour gain (0..2, 50 = 1). The earlier fit capped the top at 1.75. */
export const satGain = (sat: number) => {
  const x = clamp(sat / 50, 0, 2);
  return x <= 1 ? x : 1 + (x - 1) * (SAT_TOP - 1);
};
/**
 * Brightness 0..100 to an exposure gain. Under the game model this is a
 * straight 0–2× line (0 at 0, 1 at 50, 2 at 100) for every zone. The earlier
 * fit used a power below 50 and a higher top on Shadows.
 */
export const briGain = (bri: number, top = BRI_TOP) => {
  const x = clamp(bri / 50, 0, 2);
  return USE_GAME_KEY_MODEL ? x : x <= 1 ? x ** BRI_POWER : 1 + (top - 1) * (x - 1);
};
/** `briGain` inverted. */
const briFromGain = (gain: number, top = BRI_TOP) =>
  USE_GAME_KEY_MODEL
    ? 50 * clamp(gain, 0, 2)
    : 50 * (gain <= 1 ? gain ** (1 / BRI_POWER) : 1 + (gain - 1) / (top - 1));

/**
 * The extra darkening a Shadows, Midtones or Highlights tint brings (the
 * Simple tab has none). Under the game model this is Rec.601 luma of the
 * HSV colour at that tint (Red 100 keeps 0.299, Orange 0.739). The earlier
 * fit used a Rec.709-based curve through 0.17 at Red 100.
 */
export const zoneDim = (tint: number, hue: number) => {
  if (USE_GAME_KEY_MODEL) {
    const t = clamp(tint / 100, 0, 1);
    if (t === 0) return 1;
    const c = hsvToRgb(hue, t, 1);
    return luma(c[0], c[1], c[2]);
  }
  const c = gameHue(hue);
  const full = clamp(0.17 + 1.386 * (luma(c[0], c[1], c[2]) - 0.2126), 0.05, 1);
  return 1 - (1 - full) * clamp(tint / 100, 0, 1) ** 0.85;
};

// Luminance bands (display luma) used by both the preview and the analyser.
type Bands = { s0: number; s1: number; h0: number; h1: number };

function thresholds(s: Settings): Bands {
  const at = (v: number) => {
    const x = clamp(v / 1000, 0, 1.5);
    return RANGE_HANDLES_AS_DISPLAY_GAMMA ? x ** INV_DISPLAY_GAMMA : x;
  };
  const s0 = at(s.shadowPos);
  const s1 = Math.max(at(s.shadowEdge), s0 + 1e-6);
  const h0 = at(s.highlightPos);
  const h1 = Math.max(at(s.highlightEdge), h0 + 1e-6);
  return { s0, s1, h0, h1 };
}

function zoneWeights(l: number, t: Bands) {
  const ws = 1 - bandMix(t.s0, t.s1, l);
  const wh = bandMix(t.h0, t.h1, l) * (1 - ws);
  const wm = Math.max(0, 1 - ws - wh);
  return [ws, wm, wh] as const;
}

/**
 * Per-pixel constants for one grade, computed once.
 *
 * The zone maths is the same for every pixel, so the only things worth doing per
 * pixel are the luminance lookup and the four zone blends. Hoisting them here is
 * what makes a full-frame regrade cheap enough to run inside a pointer move.
 */
export type GradePlan = {
  s0: number;
  s1: number;
  h0: number;
  h1: number;
  /** Linear-light ramps: w1 = sat(L*ramp.x + ramp.y), w2 = sat(L*ramp.z + ramp.w). */
  ramp: Float64Array;
  /** Shadows key after Simple is folded in, as (r, g, b, sat). */
  key0: Float64Array;
  /** Midtones minus Shadows, same layout. */
  key1Delta: Float64Array;
  /** Highlights minus Midtones, same layout. */
  key2Delta: Float64Array;
  /** The colour each zone multiplies by at full weight (legacy / fitted path). */
  tint: Float64Array;
  /** Extra exposure from a zone tint (1 for the Simple group). */
  dim: Float64Array;
  /** Tint weight 0..1 per zone (`tintWeight`). */
  amount: Float64Array;
  /** Saturation gain per zone. */
  sat: Float64Array;
  /** Exposure gain per zone. */
  bri: Float64Array;
  /** 1 when the zone would change anything at all, 0 when it is a no-op. */
  live: Uint8Array;
  /** True when no zone can do anything, so the whole grade is a no-op. */
  neutral: boolean;
};

/** Zone order everywhere: shadows, midtones, highlights, then the Simple group. */
function zoneList(s: Settings) {
  return [s.zones.shadows, s.zones.midtones, s.zones.highlights, s.zones.global];
}

function zoneTint(hue: number) {
  return gameHue(hue);
}

type Key4 = { r: number; g: number; b: number; s: number };

/*
 * Colour keys, computed in float32 like the game (Math.fround after every
 * operation) so the uploaded uniforms match the research reference model.
 */
const f32 = Math.fround;

/** Plain HSV wheel in float32. Hue 0..1; only the sectors next to 0..6 wrap, anything else is black. */
function hsvKey(h: number, s: number): [number, number, number] {
  h = f32(h);
  s = f32(s);
  if (s === 0) return [1, 1, 1];
  const h6 = f32(h * 6);
  const sector = Math.floor(h6);
  if (sector < -1 || sector > 6) return [0, 0, 0];
  const frac = f32(h6 - sector);
  // 1 - s*x is rounded once (fused multiply-subtract).
  const p = f32(1 - s);
  const q = f32(1 - s * frac);
  const t = f32(1 - s * f32(1 - frac));
  const rows: [number, number, number][] = [
    [1, t, p],
    [q, 1, p],
    [p, 1, t],
    [p, q, 1],
    [t, p, 1],
    [1, p, q],
  ];
  return rows[((sector % 6) + 6) % 6];
}

/** Rec.601 luma in the game's float32 operation order. */
function luma601f([r, g, b]: [number, number, number]) {
  return f32(0.114 * b + f32(0.299 * r + f32(0.587 * g)));
}

/** A zone's tint colour darkened by its own Rec.601 luma (divide by the rounded reciprocal). */
function bandTint(c: [number, number, number]): [number, number, number] {
  const inv = f32(1 / luma601f(c));
  return [f32(c[0] / inv), f32(c[1] / inv), f32(c[2] / inv)];
}

/** Master temperature -> the colour temperature the white balance asks for. */
function wbTemperature(t: number) {
  const k0 = 6500,
    kmax = 15000;
  t = f32(t);
  if (t < k0) return f32(f32(f32(f32(k0 - t) / k0) * f32(kmax - k0)) + k0);
  return f32(f32(f32(f32(k0 - t) / f32(kmax - k0)) * k0) + k0);
}

/** Correlated colour temperature (K) to RGB, float32 rational fit, clamped to 0..1. */
function cctToRgb(kelvin: number): [number, number, number] {
  let K = f32(kelvin);
  if (K > 40000) K = 40000;
  const t = K < 1000 ? 1 : f32(K / 1000);
  const t2 = f32(t * t);
  let r: number, g: number, b: number;
  if (t < f32(6.57)) {
    r = 1;
    g = f32(
      f32(f32(f32(-399.809) + f32(f32(414.271) * t)) + f32(f32(111.543) * t2)) /
        f32(f32(f32(2779.24) + f32(f32(164.143) * t)) + f32(f32(84.7356) * t2)),
    );
    b = f32(
      f32(f32(f32(348.963) - f32(f32(523.53) * t)) + f32(f32(183.62) * t2)) /
        f32(f32(f32(2848.82) - f32(f32(214.52) * t)) + f32(f32(78.8614) * t2)),
    );
  } else {
    r = f32(
      f32(
        f32(f32(1.35651) + f32(f32(0.216422) * t)) + f32(f32(0.000633715) * t2),
      ) / f32(f32(-3.24223) + f32(f32(0.918711) * t)),
    );
    g = f32(
      f32(f32(f32(1370.38) + f32(f32(734.616) * t)) + f32(f32(0.689955) * t2)) /
        f32(f32(-4625.69) + f32(f32(1699.87) * t)),
    );
    b = 1;
  }
  return [r, g, b].map((c) => (c !== c || c < 0 ? 0 : c > 1 ? 1 : c)) as [
    number,
    number,
    number,
  ];
}

/** The game's master temperature. Every shipped look uses 6500 K. */
export const MASTER_TEMPERATURE = 6500;

/** White-balance multiplier folded into every zone key: rgb / Rec.601(rgb). */
export function whiteBalance(
  temperature = MASTER_TEMPERATURE,
): [number, number, number] {
  const rgb = cctToRgb(wbTemperature(temperature));
  const L = luma601f(rgb);
  return [f32(rgb[0] / L), f32(rgb[1] / L), f32(rgb[2] / L)];
}
const WB = whiteBalance();

/** Clamp that lets NaN through, as the game's compare-and-select does. */
const constrain = (v: number, lo: number, hi: number) => {
  v = f32(v);
  if (v > hi) v = hi;
  if (lo > v) v = lo;
  return v;
};

/** Raw code integers of a zone group, recovered from panel units. */
function zoneRaw(zone: Zone) {
  return {
    hue: Math.round((zone.hue / 360) * 1000),
    tint: Math.round(zone.tint * 10),
    bri: Math.round((zone.bri - 50) * 20),
    sat: Math.round(zone.sat * 20),
  };
}

type RawKey = { c: [number, number, number]; bri: number; sat: number };

/** One group -> (colour, brightness, saturation). Bands are darkened and clamped; Simple is neither. */
function makeKey(zone: Zone, band: boolean): RawKey {
  const raw = zoneRaw(zone);
  const u = (v: number) => f32(f32(v) / 1000);
  let c = hsvKey(u(raw.hue), u(raw.tint));
  let bri = u(raw.bri),
    sat = u(raw.sat);
  if (band) {
    c = bandTint(c);
    bri = constrain(bri, -1, 1);
    sat = constrain(sat, 0, 2);
  }
  return { c, bri, sat };
}

/** Fold Simple and white balance into a band. Saturation adds around 1 with no clamp afterwards (-1..3). */
function foldSimple(zone: RawKey, simple: RawKey): Key4 {
  const gain = f32(f32(1 + zone.bri) * f32(1 + simple.bri));
  const ch = (i: number) =>
    f32(f32(f32(zone.c[i] * gain) * simple.c[i]) * WB[i]);
  return {
    r: ch(0),
    g: ch(1),
    b: ch(2),
    s: f32(zone.sat + f32(simple.sat - 1)),
  };
}

/**
 * Range fields -> (dark max, mid min, mid max, bright min). Each is clamped to
 * 0..5, then walked left to right: a value not strictly above the (repaired)
 * one before it becomes that value + 0.01. Nothing is clamped after the repair.
 */
export function rangeEdges(r0: number, r1: number, r2: number, r3: number) {
  const step = f32(0.01);
  const e = [r0, r1, r2, r3].map((v) => constrain(f32(f32(v) / 1000), 0, 5));
  for (let i = 1; i < 4; i++)
    if (!(e[i - 1] < e[i])) e[i] = f32(e[i - 1] + step);
  return e as [number, number, number, number];
}

function keyNearlyNeutral(k: Key4) {
  return k.r === 1 && k.g === 1 && k.b === 1 && k.s === 1;
}

const sub = (a: Key4, b: Key4): Key4 => ({
  r: f32(a.r - b.r),
  g: f32(a.g - b.g),
  b: f32(a.b - b.b),
  s: f32(a.s - b.s),
});

/** Packed zone keys and luma ramps the per-pixel pass interpolates. */
export function packedKeys(s: Settings) {
  const simpleRaw = makeKey(s.zones.global, false);
  const shadows = foldSimple(makeKey(s.zones.shadows, true), simpleRaw);
  const midtones = foldSimple(makeKey(s.zones.midtones, true), simpleRaw);
  const highlights = foldSimple(makeKey(s.zones.highlights, true), simpleRaw);
  const simple: Key4 = {
    r: f32(simpleRaw.c[0] * f32(1 + simpleRaw.bri)),
    g: f32(simpleRaw.c[1] * f32(1 + simpleRaw.bri)),
    b: f32(simpleRaw.c[2] * f32(1 + simpleRaw.bri)),
    s: simpleRaw.sat,
  };
  const [d, m0, m1, b0] = rangeEdges(
    s.shadowPos,
    s.shadowEdge,
    s.highlightPos,
    s.highlightEdge,
  );
  const a = f32(m0 - d),
    b = f32(b0 - m1);
  return {
    key0: shadows,
    key1Delta: sub(midtones, shadows),
    key2Delta: sub(highlights, midtones),
    ramp: [f32(1 / a), f32(-d / a), f32(1 / b), f32(-m1 / b)] as [
      number,
      number,
      number,
      number,
    ],
    shadows,
    midtones,
    highlights,
    simple,
  };
}

/**
 * What the preview's source pixels already contain. Screenshots were rendered
 * by the game with the default (neutral) code, whose keys already carry the
 * 6500 K white balance. "neutral": preview applies the grade relative to that
 * code (key rgb / neutral key rgb), so the default code is exact identity.
 * "none": apply the absolute keys, as if the source had no grade at all.
 */
export const SOURCE_BASELINE: "neutral" | "none" = "neutral";

let neutralKeysCache: ReturnType<typeof packedKeys> | null = null;

/**
 * Keys the preview applies. Absolute keys (`packedKeys`, the parity reference)
 * divided per zone and channel by the neutral code's keys when
 * SOURCE_BASELINE is "neutral". Saturation and ramps stay absolute.
 */
export function previewKeys(s: Settings) {
  const abs = packedKeys(s);
  if (SOURCE_BASELINE === "none") return abs;
  const n = (neutralKeysCache ??= packedKeys(defaultSettings()));
  const rel = (a: Key4, b: Key4): Key4 => ({
    r: f32(a.r / b.r),
    g: f32(a.g / b.g),
    b: f32(a.b / b.b),
    s: a.s,
  });
  const shadows = rel(abs.shadows, n.shadows);
  const midtones = rel(abs.midtones, n.midtones);
  const highlights = rel(abs.highlights, n.highlights);
  return {
    ...abs,
    key0: shadows,
    key1Delta: sub(midtones, shadows),
    key2Delta: sub(highlights, midtones),
    shadows,
    midtones,
    highlights,
  };
}

export function gradePlan(s: Settings): GradePlan {
  const b = thresholds(s);
  const zs = zoneList(s);
  const tint = new Float64Array(12);
  const amount = new Float64Array(4);
  const sat = new Float64Array(4);
  const bri = new Float64Array(4);
  const live = new Uint8Array(4);
  const dim = new Float64Array(4);
  const masterSat = satGain(zs[3].sat);
  for (let z = 0; z < 4; z++) {
    const zone = zs[z];
    tint.set(zoneTint(zone.hue), z * 3);
    dim[z] = z === 3 ? 1 : zoneDim(zone.tint, zone.hue);
    amount[z] = tintWeight(zone.tint);
    // The game adds Simple saturation into each zone (zone + master − 1) and
    // does not apply the Simple slot a second time. The earlier fit applied
    // each slot separately, which multiplied them.
    sat[z] = ADD_MASTER_SAT_INTO_ZONES
      ? z === 3
        ? 1
        : satGain(zone.sat) + masterSat - 1
      : satGain(zone.sat);
    bri[z] = briGain(zone.bri, z === 0 ? SHADOW_BRI_TOP : BRI_TOP);
    live[z] = amount[z] > 0 || sat[z] !== 1 || bri[z] !== 1 ? 1 : 0;
  }
  // Relative to the neutral code (SOURCE_BASELINE); GPU reads the same plan.
  const packed = previewKeys(s);
  const toVec = (k: Key4) => new Float64Array([k.r, k.g, k.b, k.s]);
  const gameNeutral =
    keyNearlyNeutral(packed.shadows) &&
    keyNearlyNeutral(packed.midtones) &&
    keyNearlyNeutral(packed.highlights);
  return {
    ...b,
    ramp: new Float64Array(packed.ramp),
    key0: toVec(packed.key0),
    key1Delta: toVec(packed.key1Delta),
    key2Delta: toVec(packed.key2Delta),
    tint,
    dim,
    amount,
    sat,
    bri,
    live,
    neutral: USE_GAME_KEY_MODEL
      ? gameNeutral
      : !live[0] && !live[1] && !live[2] && !live[3],
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

  if (USE_GAME_KEY_MODEL) {
    paintGameGrade(data, plan);
    return;
  }

  const { s0, s1, h0, h1, tint, dim, amount, sat, bri, live } = plan;
  const allLive = live[0] && live[1] && live[2] && live[3];

  for (let i = 0; i < data.length; i += 4) {
    const r0 = data[i] / 255,
      g0 = data[i + 1] / 255,
      b0 = data[i + 2] / 255;
    // Legacy path: zone weights from the pixel's display luminance.
    const l0 = luma(r0, g0, b0);
    const ws = 1 - bandMix(s0, s1, l0);
    const wh = bandMix(h0, h1, l0) * (1 - ws);
    const wm = Math.max(0, 1 - ws - wh);
    let r = LIGHT_LUT[data[i]],
      g = LIGHT_LUT[data[i + 1]],
      b = LIGHT_LUT[data[i + 2]];
    for (let z = 0; z < 4; z++) {
      if (!allLive && !live[z]) continue;
      const k = z === 3 ? 1 : z === 0 ? ws : z === 1 ? wm : wh;
      if (k <= 0.001) continue;
      const sm = 1 + (sat[z] - 1) * k;
      const l = luma(r, g, b);
      r = Math.max(0, l + (r - l) * sm);
      g = Math.max(0, l + (g - l) * sm);
      b = Math.max(0, l + (b - l) * sm);
      const t = amount[z] * k;
      const e = (1 + (bri[z] - 1) * k) * (1 + (dim[z] - 1) * k);
      const p = z * 3;
      r *= (1 + (tint[p] - 1) * t) * e;
      g *= (1 + (tint[p + 1] - 1) * t) * e;
      b *= (1 + (tint[p + 2] - 1) * t) * e;
    }
    data[i] = toDisplay(r) * 255;
    data[i + 1] = toDisplay(g) * 255;
    data[i + 2] = toDisplay(b) * 255;
  }
}

/** Game path: interpolate one key from Rec.709 luma, sat then colour, then tone-map. */
function paintGameGrade(data: Uint8ClampedArray, plan: GradePlan) {
  const { key0, key1Delta, key2Delta, ramp } = plan;
  const exp = Math.max(EXPOSURE, 0);
  for (let i = 0; i < data.length; i += 4) {
    let r = LIGHT_LUT[data[i]],
      g = LIGHT_LUT[data[i + 1]],
      b = LIGHT_LUT[data[i + 2]];
    const L = luma709(r, g, b);
    const w1 = clamp(L * ramp[0] + ramp[1], 0, 1);
    const w2 = clamp(L * ramp[2] + ramp[3], 0, 1);
    const kr = key0[0] + key1Delta[0] * w1 + key2Delta[0] * w2;
    const kg = key0[1] + key1Delta[1] * w1 + key2Delta[1] * w2;
    const kb = key0[2] + key1Delta[2] * w1 + key2Delta[2] * w2;
    const ks = key0[3] + key1Delta[3] * w1 + key2Delta[3] * w2;
    // lerp(L, rgb, sat) then multiply by the key's colour (which includes brightness).
    r = (L + (r - L) * ks) * kr * exp;
    g = (L + (g - L) * ks) * kg * exp;
    b = (L + (b - L) * ks) * kb * exp;
    data[i] = toDisplay(r) * 255;
    data[i + 1] = toDisplay(g) * 255;
    data[i + 2] = toDisplay(b) * 255;
  }
}

/** The per-zone inputs applyGrade uses, flattened for the GPU version of the same maths. */
export function gradeUniforms(s: Settings) {
  const p = gradePlan(s);
  return {
    bands: [p.s0, p.s1, p.h0, p.h1],
    tint: Array.from(p.tint),
    params: [0, 1, 2, 3].flatMap((z) => [p.amount[z], p.sat[z], p.bri[z], p.dim[z]]),
    luma: [LUMA_R, LUMA_G, LUMA_B] as [number, number, number],
    smooth: USE_LINEAR_RAMPS ? 0 : 1,
    useGameModel: USE_GAME_KEY_MODEL ? 1 : 0,
    key0: Array.from(p.key0),
    key1Delta: Array.from(p.key1Delta),
    key2Delta: Array.from(p.key2Delta),
    ramp: Array.from(p.ramp),
    luma709: [...LUMA709] as [number, number, number],
    exposure: EXPOSURE,
    pixelTransfer: PIXEL_TRANSFER === "reinhard-hdr" ? 1 : 0,
    displayGamma: DISPLAY_GAMMA,
    reinhardWhite: REINHARD_WHITE,
    aces: [ACES_A, ACES_B, ACES_C, ACES_D] as [number, number, number, number],
    acesE: ACES_E,
    acesFloor: ACES_FLOOR,
    acesWhite: ACES_WHITE,
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
    const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    const refSat = b ? b[i].sat : neutral[i].sat;
    const refL = b ? b[i].l : neutral[i].l;
    const sat = clamp(50 * (t[i].sat / (refSat || 0.01)), 15, 85);
    // Run the forward model on the zone's average colour: the tint whose
    // multiply best matches the target's colour balance, then the exposure
    // that matches its brightness after that tint's own darkening.
    const from = (b ? [b[i].r, b[i].g, b[i].b] : [refL, refL, refL]).map(toLight);
    const to = [t[i].r, t[i].g, t[i].b].map(toLight);
    const h = zoneTint(hue);
    const balance = (v: number[]) => {
      const l = luma(v[0], v[1], v[2]) || 1e-6;
      return v.map((c) => c / l);
    };
    const want = balance(to);
    const tinted = (tint: number) => from.map((c, j) => c * (1 + (h[j] - 1) * tintWeight(tint)) * zoneDim(tint, hue));
    let best = 0,
      bestErr = Infinity;
    for (let tint = 0; tint <= 100; tint++) {
      const got = balance(tinted(tint));
      const err = got.reduce((sum, c, j) => sum + (c - want[j]) ** 2, 0);
      if (err < bestErr) [best, bestErr] = [tint, err];
    }
    // without a baseline the scene's own colours inflate the cast, so damp it
    const tint = b ? best : best * 0.5;
    const lit = tinted(tint);
    const gain = luma(to[0], to[1], to[2]) / (luma(lit[0], lit[1], lit[2]) || 1e-6);
    const bri = clamp(briFromGain(gain, i === 0 ? SHADOW_BRI_TOP : BRI_TOP), 15, 85);
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
  /**
   * A stronger code for the same look, behind the Cranked switch (named after
   * the Call of Duty mode): twice the footage difference, so it reads clearly in game.
   */
  cranked?: string;
};

/** The look as shown with the Cranked switch on, or the look itself. */
export const withCranked = (look: Look, on: boolean): Look =>
  on && look.cranked ? { ...look, name: `${look.name} (Cranked)`, code: look.cranked } : look;

/** URL slug for a look's own page, from its name ("MW2019 (HunterRafi)" becomes "mw2019-hunterrafi"). */
export const lookSlug = (look: Pick<Look, "name">) =>
  look.name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const GAMES = ["MW4", "Black Ops 7", "Black Ops 6", "MWIII", "MWII", "Vanguard", "MW 2019", "Cold War", "CODM"] as const;
export type Game = (typeof GAMES)[number];

/** Ready-made looks shown in the gallery. */
export const LOOKS: Look[] = [
  {
    // Re-derived for the calibrated preview (docs/AFTER-MERGE.md, section 8): the
    // code whose in-game result matches what the earlier preview showed for the
    // footage. Previous code: 0_1_30_300_1000_1500_0_0_0_1000_575_100_-80_1000_125_60_20_1120_138_120_60_1040.
    name: "Hajin",
    game: "MW4",
    note: "MW4 BR / Warzone: bright sun, warm autumn",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_461_40_240_1000_10_70_-80_1040_125_270_20_1020_0_0_0_1000",
    // twice the footage difference, for a look that reads clearly in game
    cranked: "0_1_30_300_1000_1500_125_140_240_1000_576_60_-80_1120_134_360_180_1080_0_0_0_1000",
    image: "/looks/hajin.webp",
  },
  {
    // Re-derived for the calibrated preview (docs/AFTER-MERGE.md, section 8): the
    // code whose in-game result matches what the earlier preview showed for the
    // footage. Previous code: 0_1_30_300_1000_1500_0_0_0_1000_575_80_-40_920_150_80_40_1040_138_80_80_960.
    name: "Apex",
    game: "MW4",
    note: "MW4 Multiplayer: hazy daylight, golden mids",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_250_30_240_1000_9_70_-60_980_157_230_40_1000_0_0_0_1000",
    // twice the footage difference, for a look that reads clearly in game
    cranked: "0_1_30_300_1000_1500_176_130_240_1000_190_130_-40_980_131_310_220_1020_0_0_0_1000",
    image: "/looks/apex.webp",
  },
  {
    // Re-derived for the calibrated preview (docs/AFTER-MERGE.md, section 8): the
    // code whose in-game result matches what the earlier preview showed for the
    // footage. Previous code: 0_1_30_300_1000_1500_0_0_0_1000_992_40_0_960_767_20_-20_960_572_30_20_620.
    // Black Ops 7 multiplayer. Derived from gameplay footage relative to the pooled daytime footage of all the games sampled, so only the difference from typical footage is kept. Casts disagree between videos, so they cancel out; muted highlights are what they share. (6 videos.)
    name: "2035",
    game: "Black Ops 7",
    note: "Black Ops 7 Multiplayer: neutral, muted highlights",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_781_100_200_960_885_90_0_920_709_30_-20_960_0_0_0_1000",
    // twice the footage difference, for a look that reads clearly in game
    cranked: "0_1_30_300_1000_1500_855_230_580_700_923_90_-120_1160_564_260_100_1200_0_0_0_1000",
    image: "/looks/2035.webp",
  },
  {
    // Re-derived for the calibrated preview (docs/AFTER-MERGE.md, section 8): the
    // code whose in-game result matches what the earlier preview showed for the
    // footage. Previous code: 0_1_30_300_1000_1500_0_0_0_1000_231_80_0_1080_125_30_0_1260_153_20_-20_1040.
    // Black Ops Royale on Avalon. Derived from gameplay footage relative to the pooled daytime footage of all the games sampled, so only the difference from typical footage is kept. (4 videos.)
    name: "Avalon",
    game: "Black Ops 7",
    note: "Black Ops 7 Warzone: warm gold shadows, rich mids",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_40_1000_140_80_0_1220_135_110_0_1120_0_0_0_1000",
    // twice the footage difference, for a look that reads clearly in game
    cranked: "0_1_30_300_1000_1500_250_10_80_960_132_150_0_1500_125_210_0_1380_0_0_0_1000",
    image: "/looks/avalon.webp",
  },
  {
    // Re-derived for the calibrated preview (docs/AFTER-MERGE.md, section 8): the
    // code whose in-game result matches what the earlier preview showed for the
    // footage. Previous code: 0_1_30_300_1000_1500_0_0_0_1000_819_30_40_1020_142_10_0_1020_175_100_0_1060.
    // Haven's Hollow by day. Derived from gameplay footage relative to the pooled daytime footage of all the games sampled, so only the difference from typical footage is kept. (2 videos.)
    name: "Haven's Hollow",
    game: "Black Ops 7",
    note: "Black Ops 7 Warzone Resurgence: warm sunlit highlights",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_819_30_40_1000_215_30_0_1000_0_0_0_1000",
    // twice the footage difference, for a look that reads clearly in game
    cranked: "0_1_30_300_1000_1500_250_30_0_1000_819_30_40_1000_127_70_40_1020_0_0_0_1000",
    image: "/looks/havens-hollow.webp",
  },
  {
    // Re-derived for the calibrated preview (docs/AFTER-MERGE.md, section 8): the
    // code whose in-game result matches what the earlier preview showed for the
    // footage. Previous code: 0_1_30_300_1000_1500_0_0_0_1000_653_190_-60_1180_656_110_-120_1080_697_10_0_800.
    // Haunted Hollow (The Haunting) at night. Derived from gameplay footage relative to the pooled daytime footage of all the games sampled, so only the difference from typical footage is kept. (2 videos.)
    name: "Haven's Hollow (Night)",
    game: "Black Ops 7",
    note: "Haunted Hollow, Black Ops 7 Warzone: deep blue shadows, darker mids",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_646_680_1000_2000_729_140_300_480_723_180_720_380_0_0_0_1000",
    // twice the footage difference, for a look that reads clearly in game
    cranked: "0_1_30_300_1000_1500_635_850_1000_2000_723_280_1000_460_868_210_1000_160_0_0_0_1000",
    image: "/looks/havens-hollow-night.webp",
  },
  {
    // Re-derived for the calibrated preview (docs/AFTER-MERGE.md, section 8): the
    // code whose in-game result matches what the earlier preview showed for the
    // footage. Previous code: 0_1_30_300_1000_1500_0_0_0_1000_642_20_-120_1160_644_30_0_980_689_30_0_640.
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
    code: "0_1_30_300_1000_1500_539_160_420_1280_779_100_-60_820_769_180_120_760_0_0_0_1000",
    // twice the footage difference, for a look that reads clearly in game
    cranked: "0_1_30_300_1000_1500_683_360_720_1680_420_70_-80_600_589_140_160_520_0_0_0_1000",
    image: "/looks/black-ops-6.webp",
  },
  {
    // Re-derived for the calibrated preview (docs/AFTER-MERGE.md, section 8): the
    // code whose in-game result matches what the earlier preview showed for the
    // footage. Previous code: 0_1_30_300_1000_1500_0_0_0_1000_547_50_-80_920_656_30_0_920_683_30_20_700.
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
    code: "0_1_30_300_1000_1500_756_260_640_860_473_150_-100_1020_520_200_0_980_0_0_0_1000",
    // twice the footage difference, for a look that reads clearly in game
    cranked: "0_1_30_300_1000_1500_650_360_560_2000_649_130_120_360_664_170_440_360_0_0_0_1000",
    image: "/looks/mwiii.webp",
  },
  {
    // Re-derived for the calibrated preview (docs/AFTER-MERGE.md, section 8): the
    // code whose in-game result matches what the earlier preview showed for the
    // footage. Previous code: 0_1_30_300_1000_1500_0_0_0_1000_542_20_100_680_661_10_0_900_175_20_0_1040.
    // Warzone 2.0 on Al Mazrah. Derived from gameplay footage relative to the pooled daytime footage of all the games sampled, so only the difference from typical footage is kept. (3 videos.)
    name: "Al Mazrah",
    game: "MWII",
    note: "MWII Warzone: dusty, desaturated, lifted shadows",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_574_20_20_1020_544_90_100_800_580_20_20_880_0_0_0_1000",
    // twice the footage difference, for a look that reads clearly in game
    cranked: "0_1_30_300_1000_1500_761_140_240_880_583_170_160_700_513_110_0_900_0_0_0_1000",
    image: "/looks/al-mazrah.webp",
  },
  {
    // Re-derived for the calibrated preview (docs/AFTER-MERGE.md, section 8): the
    // code whose in-game result matches what the earlier preview showed for the
    // footage. Previous code: 0_1_30_300_1000_1500_0_0_0_1000_994_60_-20_1040_614_30_-120_1060_522_60_0_880.
    // MWII Warzone Zombie Royale (The Haunting) on Vondel at night. Derived from
    // gameplay footage relative to the pooled daytime footage of all the games
    // sampled. Videos disagree on cast (red vs blue) and agree on darker mids. (3 videos.)
    name: "Vondead",
    game: "MWII",
    note: "MWII Warzone Zombie Royale: dark mids, reddish shadows, cool muted highlights",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_516_100_0_1200_854_70_-20_860_614_30_-120_780_0_0_0_1000",
    // twice the footage difference, for a look that reads clearly in game
    cranked: "0_1_30_300_1000_1500_716_140_20_740_727_140_-40_1300_500_320_-120_1200_0_0_0_1000",
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
    // Range handles at the right end. As posted, the highlights handle reads
    // 1084. The game accepts that on import (a later owner recording shows
    // "Successfully applied."), but Customize Color snaps it to the bar end; its
    // falloff is 1094 and the game writes handle + 100, so the handle was 994
    // and 1084 is a typo. The site owner's in-game remake of the zone values
    // reads identically. Warzone ran on Black Ops 7 then (Season 05;
    // Activision's Season 06 announcement, Sep 2026). The card is a frame from
    // the video, cropped clear of the HUD. The map is Black Ops 6's Nuketown,
    // identified by its house; the minimap's "Special Forces Base" is CODM's
    // callout for a team spawn.
    name: "Warzone",
    game: "Black Ops 7",
    note: "DisasterNinja's Warzone look: bright, warm and saturated, with lime-lifted shadows",
    mode: "Advanced",
    code: "0_1_974_1074_994_1094_0_232_403_1531_250_169_552_1175_0_0_0_1000_0_0_0_1000",
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
    // Re-derived for the calibrated preview (docs/AFTER-MERGE.md, section 8): the
    // code whose in-game result matches what the earlier preview showed for the
    // footage. Previous code: 0_1_30_300_1000_1500_0_0_0_1000_244_80_40_1040_147_30_40_1060_136_30_20_900.
    // Warzone Pacific on Caldera. Derived from gameplay footage relative to the pooled daytime footage of all the games sampled, so only the difference from typical footage is kept. (2 videos.)
    name: "Caldera",
    game: "Vanguard",
    note: "Vanguard Warzone Pacific: olive shadows, warm mids",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_156_70_0_1040_0_0_40_1000_34_20_160_1000_0_0_0_1000",
    // twice the footage difference, for a look that reads clearly in game
    cranked: "0_1_30_300_1000_1500_125_40_240_1000_186_160_0_1060_136_150_60_1060_0_0_0_1000",
    image: "/looks/caldera.webp",
  },
  {
    // Re-derived for the calibrated preview (docs/AFTER-MERGE.md, section 8): the
    // code whose in-game result matches what the earlier preview showed for the
    // footage. Previous code: 0_1_30_300_1000_1500_0_0_0_1000_117_30_0_900_94_30_0_1120_203_10_40_1020.
    // Re-tuned from six MW 2019 Warzone videos on Verdansk, relative to the
    // pooled daytime footage. All six show warm (not cool) shadows and richer
    // mids; highlights sit close to typical footage. The earlier hand-made
    // version (cool shadows, strong warm highlights) is PRESETS[1].
    name: "Verdansk",
    game: "MW 2019",
    note: "MW 2019: warm, richer mids",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_125_110_0_1060_634_30_60_1000_841_30_120_1000_0_0_0_1000",
    // twice the footage difference, for a look that reads clearly in game
    cranked: "0_1_30_300_1000_1500_116_120_120_1020_121_70_-20_1060_104_40_20_1100_0_0_0_1000",
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
    // Hue 94, Tint 12, Saturation 51, Brightness 44, Preset #1. The creator's
    // long video (youtu.be/Daevpv9sPao) shows the same panel at 4:58 and stays
    // in Simple mode; the rest of it is gameplay with the setting on. The card
    // is the filtered half of the Short, cropped clear of HUD and watermark.
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
    // (youtu.be/FpxFdjQg5bg, 7 Feb 2025). The code is the site owner's own
    // in-game replication of the settings the video shows: Shadows Cyan 90 /
    // Tint 5 / Sat 65 / Bri 100, Midtones Red 10 / Tint 1 / 65 / 80 (he raises
    // the tint only to show the reddish cast it gives, and says to keep it at
    // 1), Highlights Orange 0 / Tint 1 / 30 / 50. His narration (the video's
    // hardcoded subtitles) states each of these values and calls the
    // highlights swatch "yellow", the game's Orange, with the hue slider and
    // tint untouched. A code a viewer (@WisdomSlaps) posted under the video
    // shows the same numbers apart from a Red highlights swatch; the owner
    // tested both in game and kept this one.
    // The card is a "Setting: ON" frame from the video.
    name: "Kith",
    game: "CODM",
    note: "Kith's visibility settings: lifted cyan shadows, more saturated mids, softer highlights",
    mode: "Advanced",
    code: "0_1_30_300_1000_1500_0_0_0_1000_612_50_1000_1300_12_9_592_1298_125_9_0_598",
    image: "/looks/kith.webp",
    inGame: true,
  },
  {
    // Serotonin, "Best Color Settings for CODM to Spot Enemies Faster!"
    // (youtu.be/MvEatDU4eiE, 30 Jun 2026). His own code, posted in reply to a
    // viewer under the video. It matches the settings he saves in the video
    // (Simple Blue 98 / 25 / 25 / 70, Shadows Green 96 / 25 / 90 / 95,
    // Midtones Red / 15 / 80 / 70, Highlights Red 0 / 25 / 70 / 100) and puts
    // both Range handles at the ends. No card: the video is 360p.
    name: "Serotonin",
    game: "CODM",
    note: "Serotonin's spotting settings: bright green-tinted shadows, warm saturated mids, very bright highlights",
    mode: "Advanced",
    code: "0_1_0_100_1000_1100_747_252_403_505_495_252_900_1802_121_149_406_1594_0_253_1000_1400",
  },
  {
    name: "Default",
    note: "The in-game reset state",
    mode: "Simple",
    code: DEFAULT_CODE,
  },
];

/** Looks with a page at /look/<slug>: all but the in-game default, which is the reset code. */
export const PAGE_LOOKS = LOOKS.filter((l) => l.code !== DEFAULT_CODE);
