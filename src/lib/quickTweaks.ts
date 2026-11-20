// One-tap grading moves that still write the same four in-game values.

import { defaultSettings, type Settings, type Zone, type ZoneKey } from "@/lib/codm";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const KEYS: ZoneKey[] = ["shadows", "midtones", "highlights", "global"];

const mapZones = (s: Settings, fn: (z: Zone, k: ZoneKey) => Zone): Settings => ({
  ...s,
  zones: Object.fromEntries(KEYS.map((k) => [k, fn(s.zones[k], k)])) as Settings["zones"],
});

const towards = (from: number, to: number, amount: number) => {
  const d = ((((to - from) % 360) + 540) % 360) - 180;
  return ((from + d * amount) % 360 + 360) % 360;
};

export type Tweak = {
  id: string;
  label: string;
  hint: string;
  run: (s: Settings) => Settings;
};

export const TWEAKS: Tweak[] = [
  {
    id: "warmer",
    label: "Warmer",
    hint: "Nudge every zone towards amber",
    run: (s) => mapZones(s, (z) => ({
      ...z,
      hue: towards(z.hue, 32, z.tint < 3 ? 0.2 : 0.35),
      tint: clamp(z.tint + 4, 0, 100),
    })),
  },
  {
    id: "cooler",
    label: "Cooler",
    hint: "Nudge every zone towards blue",
    run: (s) => mapZones(s, (z) => ({
      ...z,
      hue: towards(z.hue, 212, z.tint < 3 ? 0.2 : 0.35),
      tint: clamp(z.tint + 4, 0, 100),
    })),
  },
  {
    id: "punch",
    label: "Punchier",
    hint: "More saturation, deeper shadows",
    run: (s) => mapZones(s, (z, k) => ({
      ...z,
      sat: clamp(z.sat + 7, 0, 100),
      bri: clamp(z.bri + (k === "shadows" ? -3 : k === "highlights" ? 3 : 0), 0, 100),
    })),
  },
  {
    id: "soft",
    label: "Softer",
    hint: "Less saturation and tint",
    run: (s) => mapZones(s, (z) => ({
      ...z,
      sat: clamp(z.sat - 7, 0, 100),
      tint: clamp(z.tint - 5, 0, 100),
    })),
  },
  {
    id: "dark",
    label: "Darker",
    hint: "Lower brightness in every zone",
    run: (s) => mapZones(s, (z) => ({ ...z, bri: clamp(z.bri - 5, 0, 100) })),
  },
  {
    id: "bright",
    label: "Brighter",
    hint: "Raise brightness in every zone",
    run: (s) => mapZones(s, (z) => ({ ...z, bri: clamp(z.bri + 5, 0, 100) })),
  },
];

export const neutralize = (s: Settings): Settings => ({
  ...s,
  zones: {
    ...defaultSettings().zones,
    global: s.zones.global,
  },
});
