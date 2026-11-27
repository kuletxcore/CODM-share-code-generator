// Run with `npm test` (Node's built-in runner; Node 22 strips the types).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_CODE,
  analyse,
  extractCode,
  checkCode,
  packedKeys,
  parseFields,
  rangeKeys,
  LOOKS,
  lookSlug,
  PRESETS,
  decode,
  defaultSettings,
  encode,
  hueFrom,
  hueParts,
  type Zone,
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

test("decode follows the game's field grammar", () => {
  const swap = (i: number, v: string) => {
    const p = DEFAULT_CODE.split("_");
    p[i] = v;
    return p.join("_");
  };
  const same = (code: string) => assert.equal(encode(decode(code)!), DEFAULT_CODE, JSON.stringify(code));
  same(swap(9, "+1000"));
  same(swap(9, "001000"));
  same(swap(9, " 1000\t"));
  same(swap(9, "\u180e1000\u3000"));
  same(swap(9, "\u00851000"));
  same(swap(9, "1000\u0000junk"));
  same(swap(8, "-0"));
});

test("parseFields keeps the full Int32 range and no range checks", () => {
  const p = DEFAULT_CODE.split("_");
  p[9] = "-2147483648";
  p[10] = "2147483647";
  const n = parseFields(p.join("_"));
  assert.ok(n);
  assert.equal(n[9], -2147483648);
  assert.equal(n[10], 2147483647);
});

test("decode imports what the game imports, clamped as the game renders it", () => {
  // A code the game accepted in game with "Successfully applied." (Range past 1000)
  const code = "0_1_974_1074_1084_1094_0_232_403_1531_250_169_552_1175_0_0_0_1000_0_0_0_1000";
  const r = checkCode(code);
  assert.ok(r.ok);
  assert.equal(encode(r.settings), code);
  assert.ok(r.notes.some((t) => t.includes("Customize Color")));
  const swap = (i: number, v: string) => {
    const q = DEFAULT_CODE.split("_");
    q[i] = v;
    return q.join("_");
  };
  const raw = (c: string) => encode(decode(c)!).split("_").map(Number);
  assert.equal(raw(swap(9, "2001"))[9], 2000);
  assert.equal(raw(swap(9, "-5"))[9], 0);
  assert.equal(raw(swap(8, "1500"))[8], 1000);
  assert.equal(raw(swap(8, "-1500"))[8], -1000);
  assert.equal(raw(swap(4, "9000"))[4], 5000);
  assert.equal(raw(swap(2, "-1"))[2], 0);
  assert.equal(raw(swap(1, "7"))[1], 1);
  // hue wraps on -166..1166 (period 1000)
  assert.equal(raw(swap(6, "1166"))[6], 166);
  assert.equal(raw(swap(6, "-166"))[6], 834);
  // far out of range but tint 0: no visible effect
  assert.equal(raw(swap(6, "5000"))[6], 0);
});

test("Range repair pushes out-of-order values 0.01 above the previous one", () => {
  const f = Math.fround;
  assert.deepEqual(rangeKeys(30, 300, 1000, 1500), [f(0.03), f(0.3), 1, 1.5]);
  const [d, m0, m1, b0] = rangeKeys(500, 500, 400, 9000);
  assert.equal(d, 0.5);
  assert.ok(Math.abs(m0 - 0.51) < 1e-6);
  assert.ok(Math.abs(m1 - 0.52) < 1e-6);
  assert.equal(b0, 5);
});

test("decode keeps a far out-of-range hue with tint; its zone key is black", () => {
  const code = DEFAULT_CODE.replace(/^((?:[^_]+_){6})0_0/, "$11167_500");
  const r = checkCode(code);
  assert.ok(r.ok);
  assert.ok(r.notes.some((n) => n.includes("black")));
  const k = packedKeys(r.settings);
  assert.deepEqual([k.shadows.r, k.shadows.g, k.shadows.b], [0, 0, 0]);
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
    "preset out of range (game shows no filter)": swap(0, "5"),
    "negative preset": swap(0, "-1"),
    "negative tint (game renders it unclamped)": swap(7, "-1"),
    "tint past 1000": swap(7, "1001"),
    "past Int32": swap(9, "2147483648"),
    "below Int32": swap(9, "-2147483649"),
    "two signs": swap(9, "+-1"),
    "Arabic-Indic digits": swap(9, "\u0661"),
    "fullwidth digits": swap(9, "\uff11"),
    "zero-width no-break space": swap(9, "\ufeff1000"),
    "space inside a number": swap(9, "10 00"),
    "trailing underscore": DEFAULT_CODE + "_",
    "empty field": swap(9, ""),
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
  // All white: no shadows, and on the default range the game's Highlights
  // start above white (in-game tests), so everything is midtones.
  const white = new Uint8ClampedArray(64 * 64 * 4).fill(255);
  const s = analyse(white, null);
  assert.deepEqual(s.zones.shadows, defaultSettings().zones.shadows);
  assert.deepEqual(s.zones.highlights, defaultSettings().zones.highlights);
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
  assert.ok(s);
  const g = s.zones.global;
  const sh = s.zones.shadows;
  assert.deepEqual(hueParts(g.hue), { swatch: 0, pos: 0 }); // Red, slider 0
  assert.deepEqual([g.tint, g.sat, g.bri].map(Math.round), [23, 77, 70]);
  assert.deepEqual(hueParts(sh.hue), { swatch: 2, pos: 0 }); // Lime, slider 0
  assert.deepEqual([sh.tint, sh.sat, sh.bri].map(Math.round), [17, 59, 78]);
  assert.deepEqual([s.shadowPos, s.shadowEdge, s.highlightPos, s.highlightEdge], [974, 1074, 994, 1094]);
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

test("an in-game code with every slider at 100 decodes to the top of each range", () => {
  // Owner's export with every Customize Color slider and both Range handles
  // pushed to the end. It pins the maxima: tint 1000, brightness 1000,
  // saturation 2000; Red at slider 100 writes hue 125 (the same raw value as
  // Orange at 0); Range handles at the ends write 0 and 1000, each falloff
  // being the handle + 100.
  const code = "0_1_0_100_1000_1100_125_1000_1000_2000_125_1000_1000_2000_125_1000_1000_2000_125_1000_1000_2000";
  const max = decode(code);
  assert.ok(max);
  assert.equal(encode(max), code);
  assert.deepEqual([max.shadowPos, max.shadowEdge, max.highlightPos, max.highlightEdge], [0, 100, 1000, 1100]);
  for (const k of ["global", "shadows", "midtones", "highlights"] as const) {
    const zone: Zone = max.zones[k];
    assert.deepEqual(hueParts(zone.hue, 0), { swatch: 0, pos: 100 }, k);
    assert.deepEqual([zone.tint, zone.sat, zone.bri], [100, 100, 100], k);
  }
});

test("every look has its own non-empty slug", () => {
  const slugs = LOOKS.map(lookSlug);
  assert.ok(slugs.every((s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)), slugs.join(" "));
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(lookSlug({ name: "MW2019 (HunterRafi)" }), "mw2019-hunterrafi");
  assert.equal(lookSlug({ name: "Haven's Hollow" }), "havens-hollow");
});

test("every Cranked code is a valid code that differs from its look", () => {
  const cranked = LOOKS.filter((l) => l.cranked);
  assert.ok(cranked.length > 0);
  for (const l of cranked) {
    const s = decode(l.cranked!);
    assert.ok(s, `${l.name} (Cranked) decodes`);
    assert.equal(encode(s), l.cranked, `${l.name} (Cranked) round-trips`);
    assert.notEqual(l.cranked, l.code, `${l.name} (Cranked) is its own code`);
  }
});
