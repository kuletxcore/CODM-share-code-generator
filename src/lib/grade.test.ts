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
  applyGrade,
  briGain,
  decode,
  defaultSettings,
  gameHue,
  gradePlan,
  hsvToRgb,
  paintGrade,
  satGain,
  tintWeight,
  zoneDim,
  type Settings,
} from "./codm.ts";

/**
 * The grade written out plainly, kept as the oracle.
 *
 * `applyGrade` hoists per-zone constants out of the pixel loop and skips
 * neutral zones. That is only safe if it produces bit-identical pixels, so the
 * reference lives here rather than in a comment. It follows the in-game
 * game key model (docs/GAME_MODEL_NOTES.md): Rec.601 luma, a plain HSV
 * wheel, linear tint, a single 0–2× gain, 0–2 saturation with Simple
 * added into each zone, and linear ramps. The per-pixel path still
 * grades in linear HDR light before a Reinhard-style tone map.
 */
function referenceGrade(data: Uint8ClampedArray, s: Settings) {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;
  const mix = (a: number, b: number, x: number) => clamp((x - a) / (b - a || 1e-6), 0, 1);
  const toLight = (x: number) => {
    const l = clamp(x, 0, 0.999) ** 2.2;
    return l / (1 - l);
  };
  const toDisplay = (v: number) => (Math.max(0, v) / (1 + Math.max(0, v))) ** (1 / 2.2);
  const hsv = (h: number, s: number, v: number) => {
    const x = (((h % 360) + 360) % 360) / 60;
    const f = (n: number) => v - v * s * Math.max(0, Math.min((n + x) % 6, 4 - ((n + x) % 6), 1));
    return [f(5), f(3), f(1)];
  };
  const at = (v: number) => clamp(v / 1000, 0, 1.5);
  const s0 = at(s.shadowPos);
  const s1 = Math.max(at(s.shadowEdge), s0 + 1e-6);
  const h0 = at(s.highlightPos);
  const h1 = Math.max(at(s.highlightEdge), h0 + 1e-6);
  const zs = [s.zones.shadows, s.zones.midtones, s.zones.highlights, s.zones.global];
  const colour = zs.map((z) => hsv(z.hue, 1, 1).map((c) => c ** 2.2));
  const dim = zs.map((z, i) => {
    if (i === 3) return 1;
    const t = clamp(z.tint / 100, 0, 1);
    if (t === 0) return 1;
    const c = hsv(z.hue, t, 1);
    return luma(c[0], c[1], c[2]);
  });
  const weight = zs.map((z) => clamp(z.tint / 100, 0, 1));
  const masterSat = clamp(zs[3].sat / 50, 0, 2);
  const satGain = zs.map((z, i) => (i === 3 ? 1 : clamp(z.sat / 50, 0, 2) + masterSat - 1));
  const exposure = zs.map((z) => clamp(z.bri / 50, 0, 2));
  const neutral = weight.every((w, i) => w === 0 && satGain[i] === 1 && exposure[i] === 1);
  if (neutral) return;
  const w = [0, 0, 0, 1];
  for (let i = 0; i < data.length; i += 4) {
    const l0 = luma(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255);
    const ws = 1 - mix(s0, s1, l0);
    const wh = mix(h0, h1, l0) * (1 - ws);
    w[0] = ws;
    w[1] = Math.max(0, 1 - ws - wh);
    w[2] = wh;
    let v = [toLight(data[i] / 255), toLight(data[i + 1] / 255), toLight(data[i + 2] / 255)];
    for (let z = 0; z < 4; z++) {
      const k = w[z];
      if (k <= 0.001) continue;
      const sm = 1 + (satGain[z] - 1) * k;
      const l = luma(v[0], v[1], v[2]);
      v = v.map((c) => Math.max(0, l + (c - l) * sm));
      const t = weight[z] * k;
      const e = (1 + (exposure[z] - 1) * k) * (1 + (dim[z] - 1) * k);
      v = v.map((c, j) => c * (1 + (colour[z][j] - 1) * t) * e);
    }
    data[i] = toDisplay(v[0]) * 255;
    data[i + 1] = toDisplay(v[1]) * 255;
    data[i + 2] = toDisplay(v[2]) * 255;
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
  assert.ok(Math.abs(linear[1] - 0.75 ** 2.2) < 1e-12);
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
  const plan = gradePlan(s);
  assert.equal(plan.sat[1], 3);
  assert.equal(plan.sat[3], 1);
});

test("the default Range leaves the Highlights zone inert", () => {
  const s = defaultSettings();
  s.zones.highlights = { hue: 0, tint: 100, sat: 100, bri: 100 };
  const before = fixture();
  const after = new Uint8ClampedArray(before);
  applyGrade(after, s);
  assert.deepEqual(Array.from(after), Array.from(before));
});
