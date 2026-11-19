import { describe, expect, it } from "vitest";
import {
  DEFAULT_CODE,
  LOOKS,
  PRESETS,
  applyGrade,
  decode,
  defaultSettings,
  encode,
  hueFrom,
  hueParts,
  neutralZone,
  thresholds,
  zoneShares,
  zoneWeights,
  type Settings,
} from "./codm";

/** Every code the site ships, so a codec change can't silently corrupt them. */
const SHIPPED = [
  ...new Set([
    DEFAULT_CODE,
    ...PRESETS.map((p) => p.code),
    ...LOOKS.map((l) => l.code),
  ]),
];

describe("decode", () => {
  it("reads the documented default code", () => {
    const s = decode(DEFAULT_CODE);
    expect(s).not.toBeNull();
    expect(s).toEqual(defaultSettings());
  });

  it("rejects anything that is not 22 underscore-separated numbers", () => {
    expect(decode("")).toBeNull();
    expect(decode("nope")).toBeNull();
    expect(decode(DEFAULT_CODE.replace("_1_", "_1__"))).toBeNull();
    expect(decode(`${DEFAULT_CODE}_0`)).toBeNull();
    expect(decode(DEFAULT_CODE.replace("0_1_", "0_x_"))).toBeNull();
  });

  it("tolerates the whitespace and newlines a paste picks up", () => {
    expect(decode(`  ${DEFAULT_CODE}\n`)).not.toBeNull();
  });

  it("clamps values outside the ranges the game can produce", () => {
    const wild = DEFAULT_CODE.replace(/^0_1_30_300_1000_1500/, "99_7_5000_-200_9999_-50");
    const s = decode(wild);
    expect(s).not.toBeNull();
    expect(s!.preset).toBe(4);
    expect(s!.enabled).toBe(1);
    expect(s!.shadowPos).toBe(1000);
    expect(s!.shadowEdge).toBe(0);
    expect(s!.highlightPos).toBe(1000);
    expect(s!.highlightEdge).toBe(0);
    for (const z of Object.values(s!.zones)) {
      expect(z.tint).toBeGreaterThanOrEqual(0);
      expect(z.tint).toBeLessThanOrEqual(100);
      expect(z.sat).toBeGreaterThanOrEqual(0);
      expect(z.sat).toBeLessThanOrEqual(100);
      expect(z.bri).toBeGreaterThanOrEqual(0);
      expect(z.bri).toBeLessThanOrEqual(100);
      expect(z.hue).toBeGreaterThanOrEqual(0);
      expect(z.hue).toBeLessThanOrEqual(360);
    }
  });
});

describe("encode", () => {
  it("writes 22 integers", () => {
    const parts = encode(defaultSettings()).split("_");
    expect(parts).toHaveLength(22);
    for (const p of parts) expect(p).toMatch(/^-?\d+$/);
  });

  it("round-trips every shipped code unchanged", () => {
    for (const code of SHIPPED) {
      const s = decode(code);
      expect(s, code).not.toBeNull();
      expect(encode(s!), code).toBe(code);
    }
  });

  it("round-trips an arbitrary in-range settings object", () => {
    const s: Settings = {
      ...defaultSettings(),
      preset: 3,
      shadowPos: 123,
      shadowEdge: 223,
      highlightPos: 456,
      highlightEdge: 556,
      zones: {
        shadows: { hue: 190, tint: 24, sat: 41, bri: 47 },
        midtones: { hue: 33, tint: 9, sat: 56, bri: 52 },
        highlights: { hue: 41, tint: 13, sat: 60, bri: 54 },
        global: neutralZone(),
      },
    };
    const back = decode(encode(s))!;
    expect(back.preset).toBe(3);
    expect(back.shadowPos).toBe(123);
    expect(back.zones.shadows.hue).toBeCloseTo(190, 0);
    expect(back.zones.shadows.tint).toBeCloseTo(24, 0);
    expect(back.zones.midtones.sat).toBeCloseTo(56, 0);
    expect(back.zones.highlights.bri).toBeCloseTo(54, 0);
  });
});

describe("hue", () => {
  it("keeps the end of a swatch's slider on that swatch", () => {
    for (let swatch = 0; swatch < 8; swatch++) {
      expect(hueParts(hueFrom(swatch, 100), swatch)).toEqual({ swatch, pos: 100 });
    }
  });

  it("splits a hue into the swatch the game shows", () => {
    expect(hueParts(0)).toEqual({ swatch: 0, pos: 0 });
    expect(hueParts(45)).toEqual({ swatch: 1, pos: 0 });
    expect(hueParts(-45)).toEqual({ swatch: 7, pos: 0 });
    expect(hueParts(360)).toEqual({ swatch: 0, pos: 0 });
  });
});

describe("applyGrade", () => {
  const pixels = (r: number, g: number, b: number) =>
    new Uint8ClampedArray([r, g, b, 255, r, g, b, 255]);

  it("leaves the image alone at neutral settings", () => {
    const data = pixels(120, 90, 60);
    const before = [...data];
    applyGrade(data, defaultSettings());
    expect([...data]).toEqual(before);
  });

  it("keeps neutral pixels neutral", () => {
    const data = pixels(128, 128, 128);
    applyGrade(data, defaultSettings());
    expect(data[0]).toBe(128);
    expect(data[1]).toBe(128);
    expect(data[2]).toBe(128);
  });

  it("warms a cool cast towards the shadows hue", () => {
    const s = defaultSettings();
    s.zones.shadows = { hue: 30, tint: 60, sat: 50, bri: 50 };
    const data = pixels(20, 30, 60);
    applyGrade(data, s);
    // the tint pulls the blue shadow towards orange: more red, less blue
    expect(data[0]).toBeGreaterThan(20);
    expect(data[2]).toBeLessThan(60);
  });

  it("respects the range handles", () => {
    const s = defaultSettings();
    s.zones.shadows = { hue: 30, tint: 100, sat: 50, bri: 50 };
    s.zones.highlights = neutralZone();
    // with shadows ending at 100% everything counts as shadow
    s.shadowPos = 1000;
    s.shadowEdge = 1100;
    const dark = pixels(20, 30, 60);
    const bright = pixels(220, 230, 240);
    applyGrade(dark, s);
    applyGrade(bright, s);
    expect(dark[0] - dark[2]).toBeGreaterThan(0);
    expect(bright[0] - bright[2]).toBeGreaterThan(0);
  });

  it("never writes outside the byte range", () => {
    const s = defaultSettings();
    for (const k of ["shadows", "midtones", "highlights"] as const) {
      s.zones[k] = { hue: 200, tint: 100, sat: 100, bri: 100 };
    }
    const data = pixels(255, 255, 255);
    applyGrade(data, s);
    for (const v of [...data]) {
      expect(Number.isFinite(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(255);
    }
  });
});

describe("zone bands", () => {
  it("gives every luminance a full set of weights", () => {
    const t = thresholds(defaultSettings());
    for (let l = 0; l <= 1; l += 0.05) {
      const [ws, wm, wh] = zoneWeights(l, t);
      expect(ws).toBeGreaterThanOrEqual(0);
      expect(wm).toBeGreaterThanOrEqual(0);
      expect(wh).toBeGreaterThanOrEqual(0);
      expect(ws + wm + wh).toBeCloseTo(1, 6);
    }
  });

  it("folds a histogram into three percentages that add up", () => {
    const hist = Array.from({ length: 56 }, (_, i) => 1 + i);
    const [s, m, h] = zoneShares(hist, thresholds(defaultSettings()));
    expect(s + m + h).toBe(100);
  });

  it("reports nothing for an empty histogram", () => {
    expect(zoneShares(new Float32Array(56), thresholds(defaultSettings()))).toEqual([0, 0, 0]);
  });

  it("widens the shadow band when the handle is dragged right", () => {
    const base = defaultSettings();
    const wide = { ...base, shadowPos: 800, shadowEdge: 900 };
    expect(thresholds(wide).s1).toBeGreaterThan(thresholds(base).s1);
  });
});
