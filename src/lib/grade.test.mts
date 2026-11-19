/**
 * The grade maths is the one thing every surface depends on: the preview, the
 * contact sheet, the gallery thumbnails and the share card all call it. These
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
  decode,
  defaultSettings,
  gradePlan,
  paintGrade,
  type Settings,
} from "./codm.ts";

/**
 * The pre-optimisation implementation, kept verbatim as the oracle.
 *
 * `applyGrade` now hoists per-zone constants out of the pixel loop and skips
 * neutral zones. That is only safe if it produces bit-identical pixels, so the
 * reference lives here rather than in a comment.
 */
function referenceGrade(data: Uint8ClampedArray, s: Settings) {
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const smooth = (a: number, b: number, x: number) => {
    const t = clamp((x - a) / (b - a || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const hueToRgb = (h: number): [number, number, number] => {
    const x = (((h % 360) + 360) % 360) / 60;
    const f = (n: number) => {
      const k = (n + x) % 6;
      return 1 - Math.max(0, Math.min(k, 4 - k, 1));
    };
    return [f(5), f(3), f(1)];
  };
  const s0 = clamp(s.shadowPos / 1000, 0, 1);
  const s1 = Math.max(clamp(s.shadowEdge / 1000, 0, 1.5), s0 + 0.02);
  const h1 = clamp(s.highlightPos / 1000, 0, 1);
  const width = Math.max((s.highlightEdge - s.highlightPos) / 1000, 0.02);
  const h0 = h1 - width;
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
    const ws = 1 - smooth(s0, s1, l0);
    const wh = smooth(h0, h1, l0) * (1 - ws);
    const wm = Math.max(0, 1 - ws - wh);
    w[0] = ws;
    w[1] = wm;
    w[2] = wh;
    for (let z = 0; z < 4; z++) {
      const k = w[z];
      if (k <= 0.001) continue;
      const l = luma(r, g, b);
      const t = tintAmt[z] * k;
      const c = tintRgb[z];
      const cl = luma(c[0], c[1], c[2]) || 1;
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
