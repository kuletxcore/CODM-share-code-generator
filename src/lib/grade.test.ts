/**
 * The CPU grade runs whenever WebGL is unavailable and renders the gallery
 * thumbnails and the share card. These
 * tests pin the behaviour that the fast path is allowed to optimise.
 *
 * Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LOOKS,
  PRESETS,
  acesForward,
  acesInverse,
  applyGrade,
  briGain,
  decode,
  defaultSettings,
  gameHue,
  gradePlan,
  hsvToRgb,
  packedKeys,
  paintGrade,
  satGain,
  tintWeight,
  zoneDim,
  type Settings,
  rangeKeys,
} from "./codm.ts";

/**
 * The grade written out plainly, kept as the oracle.
 *
 * `applyGrade` hoists per-zone constants out of the pixel loop and skips
 * neutral zones. That is only safe if it produces bit-identical pixels, so the
 * reference lives here rather than in a comment. It follows the in-game
 * game model (docs/GAME_MODEL_NOTES.md): one interpolated key per pixel,
 * Rec.709 luma ramps in linear light, saturation then colour, then the
 * standard Narkowicz ACES tone map (floored at 1e-4) and a 2.2 gamma.
 */
function referenceGrade(data: Uint8ClampedArray, s: Settings) {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const luma601 = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
  const luma709 = (r: number, g: number, b: number) => 0.2125 * r + 0.7154 * g + 0.0721 * b;
  const hsv = (h: number, s: number, v: number) => {
    const x = (((h % 360) + 360) % 360) / 60;
    const f = (n: number) => v - v * s * Math.max(0, Math.min((n + x) % 6, 4 - ((n + x) % 6), 1));
    return [f(5), f(3), f(1)] as [number, number, number];
  };
  const AA = 2.51,
    BB = 0.03,
    CC = 2.43,
    DD = 0.59,
    EE = 0.14,
    FLOOR = 1e-4;
  const acesFwd = (x: number) => {
    if (x <= 0) return FLOOR;
    return Math.max((x * (AA * x + BB)) / (x * (CC * x + DD) + EE), FLOOR);
  };
  const acesInv = (y: number) => {
    if (y <= FLOOR) return 0;
    const cap = AA / CC;
    if (y >= cap) y = cap * (1 - 1e-6);
    const A = y * CC - AA;
    const B = y * DD - BB;
    const C = y * EE;
    const disc = Math.max(0, B * B - 4 * A * C);
    const rt = Math.sqrt(disc);
    const r1 = (-B + rt) / (2 * A);
    const r2 = (-B - rt) / (2 * A);
    const x = r1 > 0 ? r1 : r2;
    return x > 0 ? x : 0;
  };
  const toLight = (x: number) => acesInv(clamp(x, 0, 1) ** 2.2);
  const toDisplay = (v: number) => acesFwd(Math.max(0, v)) ** (1 / 2.2);
  const makeKey = (zone: Settings["zones"]["shadows"], darken: boolean) => {
    const t = clamp(zone.tint / 100, 0, 1);
    const c = hsv(zone.hue, t, 1);
    let r = c[0],
      g = c[1],
      b = c[2];
    if (darken) {
      const y = t === 0 ? 1 : luma601(r, g, b);
      r *= y;
      g *= y;
      b *= y;
    }
    const gain = clamp(zone.bri / 50, 0, 2);
    return { r: r * gain, g: g * gain, b: b * gain, s: clamp(zone.sat / 50, 0, 2) };
  };
  const fold = (
    zone: { r: number; g: number; b: number; s: number },
    simple: { r: number; g: number; b: number; s: number },
  ) => ({
    r: zone.r * simple.r,
    g: zone.g * simple.g,
    b: zone.b * simple.b,
    s: clamp(zone.s + simple.s - 1, 0, 2),
  });
  const simple = makeKey(s.zones.global, false);
  const shadows = fold(makeKey(s.zones.shadows, true), simple);
  const midtones = fold(makeKey(s.zones.midtones, true), simple);
  const highlights = fold(makeKey(s.zones.highlights, true), simple);
  const ident = (k: { r: number; g: number; b: number; s: number }) =>
    k.r === 1 && k.g === 1 && k.b === 1 && k.s === 1;
  if (ident(shadows) && ident(midtones) && ident(highlights)) return;
  const [s0, s1, h0, h1] = rangeKeys(s.shadowPos, s.shadowEdge, s.highlightPos, s.highlightEdge);
  const lx = 1 / (s1 - s0),
    ly = -s0 / (s1 - s0),
    lz = 1 / (h1 - h0),
    lw = -h0 / (h1 - h0);
  for (let i = 0; i < data.length; i += 4) {
    let r = toLight(data[i] / 255),
      g = toLight(data[i + 1] / 255),
      b = toLight(data[i + 2] / 255);
    const L = luma709(r, g, b);
    const w1 = clamp(L * lx + ly, 0, 1);
    const w2 = clamp(L * lz + lw, 0, 1);
    const kr = shadows.r + (midtones.r - shadows.r) * w1 + (highlights.r - midtones.r) * w2;
    const kg = shadows.g + (midtones.g - shadows.g) * w1 + (highlights.g - midtones.g) * w2;
    const kb = shadows.b + (midtones.b - shadows.b) * w1 + (highlights.b - midtones.b) * w2;
    const ks = shadows.s + (midtones.s - shadows.s) * w1 + (highlights.s - midtones.s) * w2;
    r = (L + (r - L) * ks) * kr;
    g = (L + (g - L) * ks) * kg;
    b = (L + (b - L) * ks) * kb;
    data[i] = toDisplay(r) * 255;
    data[i + 1] = toDisplay(g) * 255;
    data[i + 2] = toDisplay(b) * 255;
  }
}

/** A small, varied frame: every tonal band and every hue gets a pixel. */
function fixture(w = 24, h = 24) {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = (i * 37) % 256;
    d[i * 4] = v;
    d[i * 4 + 1] = (v * 1.7 + 40) % 256;
    d[i * 4 + 2] = (v * 0.6 + 120) % 256;
    d[i * 4 + 3] = 255;
  }
  return d;
}

function randomised(seed: number): Settings {
  const s = defaultSettings();
  let x = seed;
  const rnd = () => (x = (x * 16807) % 2147483647) / 2147483647;
  s.shadowPos = Math.round(rnd() * 1000);
  s.highlightPos = Math.round(rnd() * 1000);
  s.shadowEdge = Math.min(1500, s.shadowPos + Math.round(rnd() * 500));
  s.highlightEdge = Math.min(1500, s.highlightPos + Math.round(rnd() * 500));
  for (const k of ["global", "shadows", "midtones", "highlights"] as const) {
    s.zones[k] = {
      hue: Math.round(rnd() * 360),
      tint: Math.round(rnd() * 100),
      sat: Math.round(rnd() * 100),
      bri: Math.round(rnd() * 100),
    };
  }
  return s;
}

function assertSameGrade(s: Settings, label: string) {
  const a = fixture();
  const b = new Uint8ClampedArray(a);
  referenceGrade(a, s);
  applyGrade(b, s);
  for (let i = 0; i < a.length; i++) {
    assert.equal(b[i], a[i], `${label}: channel ${i} differs (${b[i]} vs ${a[i]})`);
  }
}

test("applyGrade is bit-identical to the unoptimised reference", () => {
  for (const look of LOOKS) {
    const s = decode(look.code);
    assert.ok(s, look.name);
    assertSameGrade(s, look.name);
  }
  for (const preset of PRESETS) {
    const s = decode(preset.code);
    assert.ok(s, preset.name);
    assertSameGrade(s, preset.name);
  }
  assertSameGrade(defaultSettings(), "default");
  for (let seed = 1; seed <= 25; seed++) assertSameGrade(randomised(seed), `random ${seed}`);
});

test("paintGrade with a prebuilt plan matches applyGrade", () => {
  const s = decode(LOOKS[0].code)!;
  const a = fixture();
  const b = new Uint8ClampedArray(a);
  applyGrade(a, s);
  paintGrade(b, gradePlan(s));
  assert.deepEqual(Array.from(b), Array.from(a));
});

test("the reset state is a no-op and skips the pixel loop", () => {
  const plan = gradePlan(defaultSettings());
  assert.equal(plan.neutral, true);
  const before = fixture();
  const after = new Uint8ClampedArray(before);
  applyGrade(after, defaultSettings());
  assert.deepEqual(Array.from(after), Array.from(before));
});

test("a neutral zone does not accumulate rounding error", () => {
  // Only the global zone does anything; the per-zone weights must still be
  // applied exactly as the reference does.
  const s = defaultSettings();
  s.zones.global = { hue: 120, tint: 35, sat: 65, bri: 45 };
  assert.equal(gradePlan(s).neutral, false);
  assertSameGrade(s, "global only");
});

test("alpha is never touched", () => {
  const d = fixture();
  const alpha = d.filter((_, i) => i % 4 === 3);
  for (const look of LOOKS) applyGrade(d, decode(look.code)!);
  assert.deepEqual(
    d.filter((_, i) => i % 4 === 3),
    alpha,
  );
});

test("the game key model uses a plain HSV wheel, linear 0–2 gains and additive saturation", () => {
  const orange = hsvToRgb(45, 1, 1);
  assert.equal(orange[0], 1);
  assert.ok(Math.abs(orange[1] - 0.75) < 1e-12);
  assert.equal(orange[2], 0);
  const linear = gameHue(45);
  assert.equal(linear[0], 1);
  assert.ok(Math.abs(linear[1] - 0.75) < 1e-12);
  assert.equal(linear[2], 0);

  assert.equal(tintWeight(0), 0);
  assert.equal(tintWeight(25), 0.25);
  assert.equal(tintWeight(50), 0.5);
  assert.equal(tintWeight(100), 1);

  assert.equal(satGain(0), 0);
  assert.equal(satGain(50), 1);
  assert.equal(satGain(100), 2);
  assert.equal(briGain(0), 0);
  assert.equal(briGain(50), 1);
  assert.equal(briGain(100), 2);
  assert.equal(briGain(25), 0.5);
  // same gain for Shadows as for every other zone
  assert.equal(briGain(100, 3.3), 2);

  assert.ok(Math.abs(zoneDim(100, 0) - 0.299) < 1e-12);
  assert.ok(Math.abs(zoneDim(100, 45) - (0.299 + 0.587 * 0.75)) < 1e-12);
  assert.equal(zoneDim(0, 0), 1);

  const s = defaultSettings();
  s.zones.midtones.sat = 100;
  s.zones.global.sat = 100;
  const packed = packedKeys(s);
  // zone + simple − 1 would be 3, but saturation is capped at 2.
  assert.equal(packed.midtones.s, 2);
  assert.equal(packed.simple.s, 2);
});

test("the ACES inverse is the unique non-negative root and respects the floor", () => {
  const floor = 1e-4;
  assert.equal(acesForward(0), floor);
  assert.equal(acesInverse(floor), 0);
  assert.equal(acesInverse(0), 0);
  // Display white inverts to a finite scene-linear value, about 7.24.
  assert.ok(Math.abs(acesInverse(1) - 7.241657386773973) < 1e-9);
  let worst = 0;
  for (let i = 1; i <= 2000; i++) {
    const y = i / 2000;
    if (y <= floor) continue;
    worst = Math.max(worst, Math.abs(acesForward(acesInverse(y)) - y));
  }
  assert.ok(worst < 1e-12, `round-trip error ${worst}`);
  // The plus root at y = 0.5 is negative; the preview must not use it.
  const a = 2.51,
    b = 0.03,
    c = 2.43,
    d = 0.59,
    e = 0.14,
    y = 0.5;
  const A = y * c - a,
    B = y * d - b,
    C = y * e;
  const disc = B * B - 4 * A * C;
  const plus = (-B + Math.sqrt(disc)) / (2 * A);
  assert.ok(plus < 0);
  assert.ok(acesInverse(0.5) > 0);
});

test("Apex (Cranked) packs to the published default-range keys", () => {
  const look = LOOKS.find((l) => l.name === "Apex");
  assert.ok(look?.cranked);
  const packed = packedKeys(decode(look.cranked)!);
  const close = (got: number, want: number) =>
    assert.ok(Math.abs(got - want) < 5e-3, `${got} vs ${want}`);
  close(packed.key0.r, 1.137);
  close(packed.key0.g, 1.166);
  close(packed.key0.b, 0.883);
  close(packed.key0.s, 0.98);
  close(packed.key1Delta.r, 0.254);
  close(packed.key1Delta.g, 0.141);
  close(packed.key1Delta.b, -0.042);
  close(packed.key1Delta.s, 0.04);
  close(packed.key2Delta.r, -0.159);
  close(packed.key2Delta.g, -0.068);
  close(packed.key2Delta.b, 0.238);
  close(packed.key2Delta.s, -0.02);
  close(packed.ramp[0], 3.704);
  close(packed.ramp[1], -0.111);
  close(packed.ramp[2], 2);
  close(packed.ramp[3], -2);
});

test("on the default Range, Highlights stay off mid-greys but can reach near-white after the inverse tone map", () => {
  const s = defaultSettings();
  s.zones.highlights = { hue: 0, tint: 100, sat: 50, bri: 50 };
  const mid = new Uint8ClampedArray([128, 128, 128, 255]);
  const midAfter = new Uint8ClampedArray(mid);
  applyGrade(midAfter, s);
  assert.deepEqual(Array.from(midAfter), Array.from(mid));
  const bright = new Uint8ClampedArray([250, 250, 250, 255]);
  const brightAfter = new Uint8ClampedArray(bright);
  applyGrade(brightAfter, s);
  assert.notDeepEqual(Array.from(brightAfter), Array.from(bright));
});
