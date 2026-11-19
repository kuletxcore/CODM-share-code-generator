import { describe, expect, it } from "vitest";
import {
  DEFAULT_CODE,
  LOOKS,
  PRESETS,
  analyse,
  applyGrade,
  decode,
  describeCode,
  fitReference,
  hueToRgb,
  defaultSettings,
  encode,
  hueFrom,
  hueParts,
  neutralZone,
  readReference,
  scoreReference,
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

describe("analyse", () => {
  /** A flat RGBA image of one colour. */
  const flat = (r: number, g: number, b: number, px = 64) => {
    const data = new Uint8ClampedArray(px * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
    return data;
  };

  it("asks for nothing when the reference is the screen", () => {
    const shot = flat(90, 110, 140);
    const s = analyse(shot, shot);
    for (const z of Object.values(s.zones)) {
      expect(z.tint).toBe(0);
      expect(z.sat).toBe(50);
      expect(z.bri).toBe(50);
    }
  });

  it("finds the hue of a red cast and asks for tint", () => {
    const s = analyse(flat(140, 90, 90), flat(110, 110, 110));
    const z = s.zones.midtones;
    expect(z.tint).toBeGreaterThan(5);
    // red / orange, not cyan
    expect(z.hue < 60 || z.hue > 300).toBe(true);
  });

  it("dampens itself when there is no baseline", () => {
    const target = flat(140, 90, 90);
    const alone = analyse(target, null);
    const paired = analyse(target, flat(110, 110, 110));
    expect(alone.zones.midtones.tint).toBeLessThan(paired.zones.midtones.tint);
  });

  it("survives an empty or degenerate upload", () => {
    expect(analyse(new Uint8ClampedArray(0), null)).toEqual(defaultSettings());
    const s = analyse(flat(0, 0, 0, 4), flat(0, 0, 0, 4));
    for (const z of Object.values(s.zones)) {
      expect(Number.isFinite(z.hue)).toBe(true);
      expect(Number.isFinite(z.sat)).toBe(true);
      expect(Number.isFinite(z.bri)).toBe(true);
    }
  });
});

describe("hueToRgb", () => {
  it("wraps hue at 360 to the same colour as 0", () => {
    expect(hueToRgb(360)).toEqual(hueToRgb(0));
    expect(hueToRgb(-120)).toEqual(hueToRgb(240));
  });

  it("returns full-strength primaries on the swatch points", () => {
    expect(hueToRgb(120).map((v) => Math.round(v))).toEqual([0, 1, 0]);
  });
});

describe("describeCode", () => {
  it("explains all 22 numbers in order", () => {
    const cells = describeCode(DEFAULT_CODE)!;
    expect(cells).toHaveLength(22);
    expect(cells.map((c) => c.index)).toEqual([...Array(22).keys()]);
    expect(cells.every((c) => !c.active)).toBe(true);
  });

  it("marks only the values that do something", () => {
    const hajin = LOOKS.find((l) => l.name === "Hajin")!.code;
    const cells = describeCode(hajin)!;
    const active = cells.filter((c) => c.active);
    expect(active.map((c) => c.label)).toContain("Shadows · Tint");
    // the range bar is untouched in this look
    expect(cells.filter((c) => c.group === "header" && c.active)).toHaveLength(0);
  });

  it("reads hue back as the swatch a player sees in game", () => {
    const s = defaultSettings();
    s.zones.shadows = { hue: 207, tint: 40, sat: 50, bri: 50 }; // Cyan, 60 along
    const cells = describeCode(encode(s))!;
    expect(cells.find((c) => c.index === 10)!.text).toBe("Cyan +60");
    // the same number read as raw 575 in the game
    expect(cells.find((c) => c.index === 10)!.raw).toBe(575);
  });

  it("returns null for a code it cannot read", () => {
    expect(describeCode("1_2_3")).toBeNull();
  });
});

describe("scoring and fitting", () => {
  /** A screenshot with a gradient of tones, tinted by `cast`. */
  const shot = (cast: [number, number, number], px = 16) => {
    const data = new Uint8ClampedArray(px * px * 4);
    for (let i = 0; i < data.length; i += 4) {
      const l = ((i / 4) % px) / px; // a column per luminance step
      data[i] = Math.min(255, 40 + l * 200 + cast[0]);
      data[i + 1] = Math.min(255, 40 + l * 200 + cast[1]);
      data[i + 2] = Math.min(255, 40 + l * 200 + cast[2]);
      data[i + 3] = 255;
    }
    return data;
  };

  it("scores a perfect reference against itself at the top", () => {
    const img = shot([0, 0, 0]);
    expect(scoreReference(readReference(img, img)!, defaultSettings())).toBe(100);
  });

  it("scores a warm reference below a neutral one", () => {
    const ref = readReference(shot([40, 4, -30]), shot([0, 0, 0]))!;
    expect(scoreReference(ref, defaultSettings())).toBeLessThan(
      scoreReference(ref, fitReference(ref, defaultSettings())),
    );
  });

  it("does better than the analyser's first guess", () => {
    const target = shot([40, 4, -30]);
    const base = shot([0, 0, 0]);
    const ref = readReference(target, base)!;
    const first = analyse(target, base);
    const fitted = fitReference(ref, first);
    expect(scoreReference(ref, fitted)).toBeGreaterThanOrEqual(scoreReference(ref, first));
    // and the fit actually found something: a warm tint in the mids
    expect(fitted.zones.midtones.tint).toBeGreaterThan(0);
    expect(fitted.zones.midtones.hue < 90 || fitted.zones.midtones.hue > 300).toBe(true);
  });

  it("is deterministic", () => {
    const ref = readReference(shot([30, 0, -20]), shot([0, 0, 0]))!;
    expect(fitReference(ref, defaultSettings())).toEqual(fitReference(ref, defaultSettings()));
  });

  it("leaves the starting grade alone when it is already the reference", () => {
    const img = shot([0, 0, 0]);
    const ref = readReference(img, img)!;
    expect(fitReference(ref, defaultSettings())).toEqual(defaultSettings());
  });

  it("returns 0 when there is nothing to compare", () => {
    expect(readReference(new Uint8ClampedArray(0), null)).toBeNull();
  });
});
