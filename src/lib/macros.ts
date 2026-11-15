import { defaultSettings, neutralZone, type Settings, type Zone, type ZoneKey, ZONES } from "@/lib/codm";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function scaleZone(z: Zone, factor: number): Zone {
  return {
    hue: z.hue,
    tint: clamp(Math.round(z.tint * factor), 0, 100),
    sat: clamp(Math.round(50 + (z.sat - 50) * factor), 0, 100),
    bri: clamp(Math.round(50 + (z.bri - 50) * factor), 0, 100),
  };
}

/**
 * Scales all tonal deviations (tint, saturation offset, brightness offset) around
 * CODM's neutral baseline by `pct / 100` (e.g. 0 = neutral, 100 = exact, 160 = punchy).
 */
export function scaleIntensity(base: Settings, pct: number): Settings {
  const f = clamp(pct / 100, 0, 2);
  const nextZones = { ...base.zones };
  for (const k of ZONES) {
    nextZones[k] = scaleZone(base.zones[k], f);
  }
  return { ...base, zones: nextZones };
}

export type MacroId =
  | "visibility"
  | "cinema"
  | "steel"
  | "oled"
  | "dehaze"
  | "shuffle";

export const TACTICAL_MACROS: {
  id: MacroId;
  label: string;
  badge: string;
  desc: string;
}[] = [
  {
    id: "visibility",
    label: "Enemy Pop",
    badge: "COMP",
    desc: "Lifts dark corners and sharpens midtone separation for spotting operators",
  },
  {
    id: "cinema",
    label: "Teal & Gold",
    badge: "FILM",
    desc: "Nudges shadows toward cool cyan and highlights toward sunlit amber",
  },
  {
    id: "steel",
    label: "Cool Steel",
    badge: "TAC",
    desc: "Crisp slate-blue tactical shadows with clean muted midtones",
  },
  {
    id: "oled",
    label: "Vivid OLED",
    badge: "POP",
    desc: "Boosts colour vibrancy and contrast without crushing shadows",
  },
  {
    id: "dehaze",
    label: "De-Haze",
    badge: "CLEAR",
    desc: "Cuts dusty daylight haze and recovers midtone depth",
  },
  {
    id: "shuffle",
    label: "Inspire Me",
    badge: "MIX",
    desc: "Generates a balanced, playable pro colour palette from harmonious pairings",
  },
];

function blendHue(a: number, b: number, t: number): number {
  let diff = ((b - a + 540) % 360) - 180;
  if (diff < -180) diff += 360;
  return (((a + diff * t) % 360) + 360) % 360;
}

function nudgeZone(z: Zone, targetHue: number, addTint: number, addSat: number, addBri: number): Zone {
  const nextTint = clamp(z.tint + addTint, 0, 100);
  const hue = z.tint < 4 ? targetHue : blendHue(z.hue, targetHue, 0.55);
  return {
    hue: Math.round(hue),
    tint: Math.round(nextTint),
    sat: clamp(Math.round(z.sat + addSat), 0, 100),
    bri: clamp(Math.round(z.bri + addBri), 0, 100),
  };
}

const HARMONIOUS_SEEDS: { sh: number; mid: number; hi: number; mood: [number, number, number] }[] = [
  { sh: 205, mid: 34, hi: 40, mood: [14, 7, 15] }, // Teal & Amber
  { sh: 228, mid: 200, hi: 48, mood: [18, 6, 12] }, // Spec Ops Arctic Dawn
  { sh: 165, mid: 82, hi: 42, mood: [12, 8, 10] }, // Jungle Recon
  { sh: 262, mid: 210, hi: 28, mood: [16, 8, 14] }, // Dusk Neon Raid
  { sh: 192, mid: 22, hi: 32, mood: [10, 10, 16] }, // Desert Sunset
  { sh: 220, mid: 215, hi: 195, mood: [16, 9, 8] }, // Overcast Steel
  { sh: 350, mid: 28, hi: 44, mood: [12, 7, 14] }, // Crimson Autumn
];

let shuffleIdx = 0;

export function applyMacro(current: Settings, id: MacroId): Settings {
  const z = current.zones;
  const clone = (zones: Record<ZoneKey, Zone>): Settings => ({
    ...current,
    zones,
  });

  switch (id) {
    case "visibility":
      return clone({
        ...z,
        shadows: {
          ...z.shadows,
          bri: clamp(Math.round(z.shadows.bri + 7), 0, 72),
          tint: clamp(Math.round(z.shadows.tint * 0.75), 0, 30),
          sat: clamp(Math.round(z.shadows.sat - 2), 30, 70),
        },
        midtones: {
          ...z.midtones,
          sat: clamp(Math.round(z.midtones.sat + 6), 0, 82),
          bri: clamp(Math.round(z.midtones.bri + 2), 0, 68),
        },
        highlights: {
          ...z.highlights,
          bri: clamp(Math.round(z.highlights.bri - 2), 35, 65),
        },
      });

    case "cinema":
      return clone({
        ...z,
        shadows: nudgeZone(z.shadows, 198, 10, -2, -2),
        midtones: nudgeZone(z.midtones, 36, 4, 3, 0),
        highlights: nudgeZone(z.highlights, 40, 11, 2, 3),
      });

    case "steel":
      return clone({
        ...z,
        shadows: nudgeZone(z.shadows, 218, 12, -5, -2),
        midtones: nudgeZone(z.midtones, 205, 5, -6, 0),
        highlights: nudgeZone(z.highlights, 196, 6, -4, 2),
      });

    case "oled":
      return clone({
        ...z,
        shadows: { ...z.shadows, sat: clamp(Math.round(z.shadows.sat + 4), 0, 80) },
        midtones: { ...z.midtones, sat: clamp(Math.round(z.midtones.sat + 10), 0, 88), bri: clamp(Math.round(z.midtones.bri + 2), 0, 66) },
        highlights: { ...z.highlights, sat: clamp(Math.round(z.highlights.sat + 6), 0, 82), bri: clamp(Math.round(z.highlights.bri + 3), 0, 68) },
      });

    case "dehaze":
      return clone({
        ...z,
        shadows: { ...z.shadows, bri: clamp(Math.round(z.shadows.bri - 4), 28, 70), sat: clamp(Math.round(z.shadows.sat + 4), 0, 80) },
        midtones: { ...z.midtones, bri: clamp(Math.round(z.midtones.bri - 3), 32, 70), sat: clamp(Math.round(z.midtones.sat + 7), 0, 85) },
        highlights: { ...z.highlights, bri: clamp(Math.round(z.highlights.bri + 3), 35, 72) },
      });

    case "shuffle": {
      const seed = HARMONIOUS_SEEDS[shuffleIdx % HARMONIOUS_SEEDS.length];
      shuffleIdx++;
      const jitter = (amt: number) => Math.round((Math.random() - 0.5) * amt);
      const base = defaultSettings();
      return {
        ...base,
        preset: current.preset,
        zones: {
          global: neutralZone(),
          shadows: {
            hue: (seed.sh + jitter(16) + 360) % 360,
            tint: clamp(seed.mood[0] + jitter(6), 6, 26),
            sat: clamp(48 + jitter(12), 36, 60),
            bri: clamp(47 + jitter(8), 40, 56),
          },
          midtones: {
            hue: (seed.mid + jitter(16) + 360) % 360,
            tint: clamp(seed.mood[1] + jitter(4), 2, 16),
            sat: clamp(54 + jitter(14), 42, 68),
            bri: clamp(50 + jitter(6), 44, 56),
          },
          highlights: {
            hue: (seed.hi + jitter(16) + 360) % 360,
            tint: clamp(seed.mood[2] + jitter(6), 4, 24),
            sat: clamp(52 + jitter(12), 40, 64),
            bri: clamp(53 + jitter(8), 46, 62),
          },
        },
      };
    }
  }
}
