// Run with `npm test` (Node's built-in runner; Node 22 strips the types).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CODE,
  analyse,
  extractCode,
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
    "negative shadow handle": swap(2, "-1"),
    "negative highlight handle": swap(4, "-5"),
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

test("hue 1000 reads as Magenta at slider 100, not Red at 0", () => {
  const s = decode("0_1_30_300_1000_1500_1000_100_0_1000_0_0_0_1000_0_0_0_1000_0_0_0_1000");
  assert.ok(s);
  assert.deepEqual(hueParts(s.zones.global.hue), { swatch: 7, pos: 100 });
  assert.equal(encode(s), "0_1_30_300_1000_1500_1000_100_0_1000_0_0_0_1000_0_0_0_1000_0_0_0_1000");
});

test("analyse grades a tonal range that holds a small share of the image", () => {
  // 99% bright neutral, a 1% strip of dark red: the shadows still get measured
  const n = 100 * 100;
  const px = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const dark = i < n / 100;
    px.set(dark ? [60, 8, 8, 255] : [230, 230, 230, 255], i * 4);
  }
  const s = analyse(px, null);
  assert.notDeepEqual(s.zones.shadows, defaultSettings().zones.shadows);
});

test("analyse leaves tonal ranges the image doesn't contain neutral", () => {
  const white = new Uint8ClampedArray(64 * 64 * 4).fill(255);
  const s = analyse(white, null);
  assert.deepEqual(s.zones.shadows, defaultSettings().zones.shadows);
  assert.deepEqual(s.zones.midtones, defaultSettings().zones.midtones);
});

test("extractCode finds a code inside pasted text", () => {
  const c = LOOKS[0].code;
  assert.equal(extractCode(c), c);
  assert.equal(extractCode(`  ${c}\n`), c);
  assert.equal(extractCode(`${LOOKS[0].name}: ${c}`), c);
  assert.equal(extractCode(`https://codm.kuletxcore.workers.dev/#c=${c}`), c);
  assert.equal(extractCode(c.replaceAll("_", " ")), c);
  assert.equal(extractCode("0_1_2"), null);
  assert.equal(extractCode(`${c}_5`), null, "23 numbers is not a code");
  assert.equal(extractCode(`${c} 5`), null, "a number after a space still touches the code");
  assert.equal(extractCode(`${c}, 7`), null);
  assert.equal(extractCode(`5 ${c.replaceAll("_", " ")}`), null, "a number before would shift every slot");
  assert.equal(extractCode(`Look 2: ${c}`), c, "a number separated by other text is fine");
});

test("MW2022 decodes to the settings shown in MorganPixy's video", () => {
  const look = LOOKS.find((l) => l.name === "MW2022");
  assert.ok(look);
  const s = decode(look.code);
  assert.ok(s);
  const sh = s.zones.shadows;
  assert.deepEqual(hueParts(sh.hue), { swatch: 1, pos: 0 }); // Orange, slider 0
  assert.equal(Math.round(sh.tint), 40);
  assert.equal(Math.round(sh.sat), 35);
  assert.equal(Math.round(sh.bri), 100);
  assert.equal(s.shadowPos, 189);
  assert.equal(s.shadowEdge, s.shadowPos + 100);
});

test("Warzone decodes to the settings shown in DisasterNinja's video", () => {
  const look = LOOKS.find((l) => l.name === "Warzone");
  assert.ok(look);
  const s = decode(look.code);
  assert.ok(s, "a game-written handle past 1000 must decode");
  const g = s.zones.global;
  const sh = s.zones.shadows;
  assert.deepEqual(hueParts(g.hue), { swatch: 0, pos: 0 }); // Red, slider 0
  assert.deepEqual([g.tint, g.sat, g.bri].map(Math.round), [23, 77, 70]);
  assert.deepEqual(hueParts(sh.hue), { swatch: 2, pos: 0 }); // Lime, slider 0
  assert.deepEqual([sh.tint, sh.sat, sh.bri].map(Math.round), [17, 59, 78]);
  assert.equal(s.highlightPos, 1084);
});

// Looks whose videos show the settings screens: each code must read back as
// the numbers on screen (the game rounds what it displays).
const shown = (code: string, zone: "global" | "shadows" | "midtones" | "highlights") => {
  const s = decode(code);
  assert.ok(s);
  const z = s.zones[zone];
  const hp = hueParts(z.hue);
  return [hp.swatch, Math.round(hp.pos), Math.round(z.tint), Math.round(z.sat), Math.round(z.bri)];
};
const look = (name: string) => {
  const l = LOOKS.find((x) => x.name === name);
  assert.ok(l, name);
  return l.code;
};

test("creator looks read back as the on-screen settings", () => {
  // [swatch index, hue slider, tint, saturation, brightness]
  assert.deepEqual(shown(look("Verdansk Low-End"), "global"), [5, 94, 12, 51, 44]);
  assert.deepEqual(shown(look("MW2019 (HunterRafi)"), "global"), [0, 98, 24, 42, 56]);
  assert.deepEqual(shown(look("MW2019 (HunterRafi)"), "shadows"), [1, 13, 18, 51, 60]);
  assert.deepEqual(shown(look("MW2019 (HunterRafi)"), "midtones"), [1, 14, 14, 47, 75]);
  assert.deepEqual(shown(look("MW2019 (HunterRafi)"), "highlights"), [0, 0, 0, 36, 70]);
  assert.deepEqual(shown(look("Kith"), "shadows"), [4, 90, 5, 65, 100]);
  assert.deepEqual(shown(look("Kith"), "midtones"), [0, 10, 1, 65, 80]);
  assert.deepEqual(shown(look("Kith"), "highlights"), [1, 0, 1, 30, 50]); // Orange, as in the video
  assert.deepEqual(shown(look("Serotonin"), "global"), [5, 98, 25, 25, 70]);
  assert.deepEqual(shown(look("Serotonin"), "shadows"), [3, 96, 25, 90, 95]);
  // the video shows hue 98; his own code reads 96.8, one display step off
  assert.deepEqual(shown(look("Serotonin"), "midtones"), [0, 97, 15, 80, 70]);
  assert.deepEqual(shown(look("Serotonin"), "highlights"), [0, 0, 25, 70, 100]);
});
