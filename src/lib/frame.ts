import { drawSample } from "@/lib/codm";

/**
 * The sample frame, rendered once for the whole page. The lit three.js scene is
 * expensive (its own WebGL context), so the preview and every look tile share
 * this single render instead of asking for one each.
 */

let pending: Promise<HTMLCanvasElement> | null = null;

/** Instant flat stand-in, so the preview has something to show before three.js is in. */
export function flatSample() {
  const c = document.createElement("canvas");
  c.width = 960;
  c.height = 540;
  drawSample(c.getContext("2d")!, c.width, c.height);
  return c;
}

export function sampleFrame(): Promise<HTMLCanvasElement> {
  pending ??= import("@/lib/scene")
    .then((m) => m.renderScene(960, 540))
    .catch(() => null)
    .then((c) => c ?? flatSample());
  return pending;
}
