/**
 * Codec tests for the share letter format.
 *
 * Run with `npm test`. Uses node:test + node:assert so there is no test-runner
 * dependency; Node strips the TypeScript types itself (>=22.6).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CODE_LENGTH,
  DEFAULT_CODE,
  LOOKS,
  PRESETS,
  SEGMENT_RANGES,
  analyse,
  decode,
  defaultSettings,
  encode,
  hueFrom,
  hueParts,
} from "./codm.ts";

const DEFAULT_SEGMENTS = DEFAULT_CODE.split("_");

/** Build a code from DEFAULT_CODE with some segments replaced. */
function withSegments(replacements: Record<number, string | number>): string {
  const segs = [...DEFAULT_SEGMENTS];
  for (const [i, v] of Object.entries(replacements)) segs[Number(i)] = String(v);
  return segs.join("_");
}

test("segment table covers every position", () => {
  assert.equal(CODE_LENGTH, 22);
  assert.equal(SEGMENT_RANGES.length, CODE_LENGTH);
});

test("DEFAULT_CODE is exactly what defaultSettings() encodes to", () => {
  // Guards against the constant and the factory drifting apart.
  assert.equal(encode(defaultSettings()), DEFAULT_CODE);
});

test("default round-trips", () => {
  const s = decode(DEFAULT_CODE);
  assert.ok(s);
  assert.equal(encode(s), DEFAULT_CODE);
});

test("every shipped look and preset round-trips byte-for-byte", () => {
  // A shipped code that does not round-trip means the gallery shows one grade
  // and copies a different one.
  const shipped = [
    ...LOOKS.map((l) => [l.name, l.code] as const),
    ...PRESETS.map((p) => [p.name, p.code] as const),
  ];
  for (const [name, code] of shipped) {
    const s = decode(code);
    assert.ok(s, `${name}: shipped code was rejected`);
    assert.equal(encode(s), code, `${name}: round-trip changed the code`);
  }
});

test("shipped looks exercise negative brightness", () => {
  // Regression guard: an early strictness pass rejected signed segments and
  // would have broken 9 of the 15 shipped codes.
  const anyNegative = [...LOOKS, ...PRESETS].some((l) => l.code.includes("_-"));
  assert.ok(anyNegative, "expected at least one code with negative brightness");
  for (const look of LOOKS) {
    assert.ok(decode(look.code), `${look.name} rejected`);
  }
});

test("rejects malformed counts and characters", () => {
  const rejected = [
    "",
    "0",
    DEFAULT_SEGMENTS.slice(0, 21).join("_"),
    `${DEFAULT_CODE}_0`,
    // whitespace / empty segments
    withSegments({ 21: "" }),
    withSegments({ 21: " " }),
    withSegments({ 0: "" }),
    // numeric formats the game never writes
    withSegments({ 10: "0x10" }),
    withSegments({ 10: "1e3" }),
    withSegments({ 10: "+500" }),
    withSegments({ 8: "--5" }),
    withSegments({ 10: "1.5" }),
    withSegments({ 10: "NaN" }),
    withSegments({ 10: "Infinity" }),
  ];
  for (const code of rejected) {
    assert.equal(decode(code), null, `should have rejected: ${JSON.stringify(code)}`);
  }
});

test("rejects out-of-range segments", () => {
  const rejected = [
    withSegments({ 0: 5 }), // preset slot is 0-4
    withSegments({ 0: -1 }),
    withSegments({ 1: 2 }), // enabled is 0-1
    withSegments({ 2: 99999 }), // shadows handle beyond the bar
    withSegments({ 3: -1 }), // falloff cannot be negative
    withSegments({ 10: -1 }), // a hue cannot be negative
    withSegments({ 11: 1001 }), // tint is 0-1000
    withSegments({ 8: -1001 }), // brightness is -1000..1000
    withSegments({ 9: 2001 }), // saturation is 0-2000
  ];
  for (const code of rejected) {
    assert.equal(decode(code), null, `should have rejected: ${code}`);
  }
});

test("accepts the boundaries of every segment", () => {
  assert.ok(decode(withSegments({ 0: 0, 1: 0 })));
  assert.ok(decode(withSegments({ 0: 4, 1: 1 })));
  assert.ok(decode(withSegments({ 2: 1000, 4: 0 })));
  assert.ok(decode(withSegments({ 3: 0, 5: 0 })));
  assert.ok(decode(withSegments({ 3: 1500, 5: 1500 })));
  // brightness is the only signed segment
  assert.ok(decode(withSegments({ 8: -1000 })));
  assert.ok(decode(withSegments({ 8: 1000 })));
  assert.ok(decode(withSegments({ 12: -1000 })));
  assert.ok(decode(withSegments({ 16: -1000 })));
  assert.ok(decode(withSegments({ 20: -1000 })));
  assert.ok(decode(withSegments({ 9: 2000, 21: 2000 })));
});

test("encode survives out-of-gamut settings by clamping", () => {
  const s = defaultSettings();
  s.preset = 9;
  s.shadowPos = 99999;
  s.zones.global = { hue: 900, tint: 500, bri: -200, sat: 900 };
  const code = encode(s);
  // Whatever it produced must at least be readable back.
  assert.ok(decode(code), `encode produced an unreadable code: ${code}`);
  assert.equal(code.split("_").length, CODE_LENGTH);
});

test("rounded hue never leaves the representable range", () => {
  // hue of exactly 360 is a real 1000 in the code (see hueParts), so encode must
  // not wrap it to 0 and turn Magenta@100 into Red@0.
  const magenta = defaultSettings();
  magenta.zones.global = { hue: 360, tint: 40, sat: 50, bri: 50 };
  const decoded = decode(encode(magenta));
  assert.ok(decoded);
  assert.equal(decoded.zones.global.hue, 360);
});

test("hue 1000 is Magenta at slider 100, not Red at 0", () => {
  // The regression this guards: `hueParts` used to wrap 360 -> 0, so a loaded
  // code displayed the wrong swatch and the next drag silently recoloured it.
  const s = decode(withSegments({ 6: 1000, 7: 40 }));
  assert.ok(s);
  assert.equal(s.zones.global.hue, 360);
  assert.deepEqual(hueParts(s.zones.global.hue), { swatch: 7, pos: 100 });
});

test("hueParts round-trips the swatch grid when the swatch is known", () => {
  // Slider 100 and the next swatch's 0 share one raw value (hueFrom(0, 100) ===
  // hueFrom(1, 0) === 45), so the swatch hint is what disambiguates a live edit.
  for (let swatch = 0; swatch < 8; swatch++) {
    for (const pos of [0, 25, 50, 100]) {
      const deg = hueFrom(swatch, pos);
      const parts = hueParts(deg, swatch);
      assert.equal(parts.swatch, swatch, `hueFrom(${swatch}, ${pos}) -> ${deg}`);
      assert.equal(Math.round(parts.pos), pos, `hueFrom(${swatch}, ${pos}) slider`);
    }
  }
});

test("hueParts without a hint keeps the colour a loaded code encodes", () => {
  // This is the property a restored #c= code depends on: reading a stored hue
  // must not invent a different colour, and re-encoding must not change it.
  for (let raw = 0; raw <= 1000; raw += 5) {
    const deg = (raw / 1000) * 360;
    const { swatch, pos } = hueParts(deg);
    const back = Math.round((hueFrom(swatch, pos) / 360) * 1000);
    assert.ok(
      Math.abs(back - raw) <= 1,
      `raw ${raw} -> swatch ${swatch} @ ${pos} -> raw ${back}`,
    );
  }
});

test("hueParts clamps rather than wrapping out-of-range input", () => {
  assert.deepEqual(hueParts(-45), { swatch: 0, pos: 0 });
  assert.deepEqual(hueParts(400), { swatch: 7, pos: 100 });
});

test("analyse leaves zones neutral when the image has no pixels in them", () => {
  // A pure white frame has nothing in the shadows band. It used to report a
  // confidently non-neutral saturation/brightness for that band.
  const white = new Uint8ClampedArray(32 * 32 * 4).fill(255);
  const s = analyse(white, null);
  assert.deepEqual(s.zones.shadows, { hue: 0, tint: 0, sat: 50, bri: 50 });

  const black = new Uint8ClampedArray(32 * 32 * 4);
  for (let i = 3; i < black.length; i += 4) black[i] = 255;
  const sb = analyse(black, null);
  assert.deepEqual(sb.zones.highlights, { hue: 0, tint: 0, sat: 50, bri: 50 });
});

test("analyse always produces a code that decodes", () => {
  // Whatever a screenshot measures, the result has to be a legal code.
  const ramp = new Uint8ClampedArray(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    const v = Math.round((i / (64 * 64 - 1)) * 255);
    ramp[i * 4] = v;
    ramp[i * 4 + 1] = v;
    ramp[i * 4 + 2] = v;
    ramp[i * 4 + 3] = 255;
  }
  assert.ok(decode(encode(analyse(ramp, null))));
});
