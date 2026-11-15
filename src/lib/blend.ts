import type { Settings, Zone, ZoneKey } from "@/lib/codm";

export type ZoneRoute = "a" | "mix" | "b";
export type BlendRoutes = {
  shadows: ZoneRoute;
  midtones: ZoneRoute;
  highlights: ZoneRoute;
  global: ZoneRoute;
  range: ZoneRoute;
};

export const DEFAULT_ROUTES: BlendRoutes = {
  shadows: "mix",
  midtones: "mix",
  highlights: "mix",
  global: "mix",
  range: "mix",
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Vector-space colour-tint interpolation: converts (hue, tint) of A and B into
 * 2D chromatic vectors, lerps smoothly through neutral when hues oppose, then
 * converts back to polar (hue, tint). Avoids rainbow artifacts when crossing
 * opposite sides of the colour wheel.
 */
function blendZone(a: Zone, b: Zone, t: number): Zone {
  const radA = (a.hue * Math.PI) / 180;
  const radB = (b.hue * Math.PI) / 180;
  const ax = Math.cos(radA) * a.tint;
  const ay = Math.sin(radA) * a.tint;
  const bx = Math.cos(radB) * b.tint;
  const by = Math.sin(radB) * b.tint;

  const rx = lerp(ax, bx, t);
  const ry = lerp(ay, by, t);
  const tint = clamp(Math.hypot(rx, ry), 0, 100);

  let hue: number;
  if (tint < 0.5) {
    hue = t < 0.5 ? a.hue : b.hue;
  } else {
    hue = ((Math.atan2(ry, rx) * 180) / Math.PI + 360) % 360;
  }

  return {
    hue: Math.round(hue) % 360,
    tint: Math.round(tint),
    sat: Math.round(clamp(lerp(a.sat, b.sat, t), 0, 100)),
    bri: Math.round(clamp(lerp(a.bri, b.bri, t), 0, 100)),
  };
}

function pickZone(a: Zone, b: Zone, route: ZoneRoute, t: number): Zone {
  if (route === "a") return { ...a };
  if (route === "b") return { ...b };
  return blendZone(a, b, t);
}

/** Fuse two Settings objects with crossfade `mix` (0 = A, 1 = B) and per-zone routing. */
export function blendSettings(
  a: Settings,
  b: Settings,
  mix: number,
  routes: BlendRoutes = DEFAULT_ROUTES,
): Settings {
  const t = clamp(mix, 0, 1);
  const rT = routes.range === "a" ? 0 : routes.range === "b" ? 1 : t;

  const shadowPos = Math.round(lerp(a.shadowPos, b.shadowPos, rT));
  const shadowEdge = Math.round(lerp(a.shadowEdge, b.shadowEdge, rT));
  const highlightPos = Math.round(Math.max(shadowPos, lerp(a.highlightPos, b.highlightPos, rT)));
  const highlightEdge = Math.round(Math.max(highlightPos + 20, lerp(a.highlightEdge, b.highlightEdge, rT)));

  const zones: Record<ZoneKey, Zone> = {
    global: pickZone(a.zones.global, b.zones.global, routes.global, t),
    shadows: pickZone(a.zones.shadows, b.zones.shadows, routes.shadows, t),
    midtones: pickZone(a.zones.midtones, b.zones.midtones, routes.midtones, t),
    highlights: pickZone(a.zones.highlights, b.zones.highlights, routes.highlights, t),
  };

  return {
    preset: t < 0.5 ? a.preset : b.preset,
    enabled: 1,
    shadowPos,
    shadowEdge,
    highlightPos,
    highlightEdge,
    zones,
  };
}
