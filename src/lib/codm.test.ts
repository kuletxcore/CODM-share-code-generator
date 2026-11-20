// Run with `npm test` (Node's built-in runner; Node 22 strips the types).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CODE,
  LOOKS,
  PRESETS,
  decode,
  defaultSettings,
  encode,
  hueFrom,
  hueParts,
} from "./codm.ts";

test("default settings encode to the default code", () => {
  assert.equal(encode(defaultSettings()), DEFAULT_CODE);
});

test("every look and preset decodes and round-trips unchanged", () => {
  for (const { name, code } of [...LOOKS, ...PRESETS]) {
    const s = decode(code);
    assert.ok(s, `${name} did not decode`);
    assert.equal(encode(s), code, `${name} changed on round-trip`);
  }
});

test("look names are unique", () => {
  const names = LOOKS.map((l) => l.name);
  assert.equal(new Set(names).size, names.length);
});

test("decode maps raw values to panel units", () => {
  const s = decode("2_1_30_300_1000_1500_250_500_-1000_2000_0_0_0_1000_0_0_0_1000_0_0_0_1000");
  assert.ok(s);
  assert.equal(s.preset, 2);
  assert.equal(s.zones.global.hue, 90);
  assert.equal(s.zones.global.tint, 50);
  assert.equal(s.zones.global.bri, 0);
  assert.equal(s.zones.global.sat, 100);
});

test("decode tolerates surrounding whitespace", () => {
  assert.ok(decode(`  ${DEFAULT_CODE}\n`));
});

test("decode rejects malformed codes", () => {
  const swap = (i: number, v: string) => {
    const p = DEFAULT_CODE.split("_");
    p[i] = v;
    return p.join("_");
  };
  const bad = {
    "too few numbers": DEFAULT_CODE.split("_").slice(0, 21).join("_"),
    "truncated paste": DEFAULT_CODE.replace(/1000$/, ""),
    hex: swap(0, "0x1"),
    exponent: swap(21, "1e3"),
    decimal: swap(7, "1.5"),
    "preset out of range": swap(0, "5"),
    "enabled out of range": swap(1, "2"),
    "hue out of range": swap(6, "1001"),
    "negative tint": swap(7, "-1"),
    "brightness out of range": swap(8, "1001"),
    "saturation out of range": swap(9, "2001"),
    "shadow handle out of range": swap(2, "1001"),
    "negative falloff": swap(3, "-1"),
    empty: "",
  };
  for (const [why, code] of Object.entries(bad)) assert.equal(decode(code), null, why);
});

test("hue swatch and slider match the game (raw = swatch*125 + slider*1.25)", () => {
  for (let swatch = 0; swatch < 8; swatch++) {
    for (const pos of [0, 40, 99]) {
      const deg = hueFrom(swatch, pos);
      const raw = Math.round((deg / 360) * 1000);
      assert.equal(raw, Math.round(swatch * 125 + pos * 1.25));
      const back = hueParts(deg);
      assert.equal(back.swatch, swatch);
      assert.ok(Math.abs(back.pos - pos) < 1e-6);
    }
  }
});

test("slider at 100 stays on the chosen swatch", () => {
  assert.deepEqual(hueParts(hueFrom(3, 100), 3), { swatch: 3, pos: 100 });
  assert.equal(hueParts(hueFrom(3, 100)).swatch, 4);
});
