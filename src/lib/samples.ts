"use client";

/**
 * Built-in preview scenes: stills from MorganPixy's "CODM Season 10 2026 - New
 * and Reworked Weapons Showcase" (YouTube), recorded on the default filter with
 * no HUD. Real CODM frames grade the way the game does far better than a drawn
 * scene, and each one covers deep shade, sky and saturated colour. Map names
 * and their source games are checked against Activision and press coverage.
 */
export const SAMPLES = [
  { id: "port", label: "Shipment 2019", game: "Modern Warfare (2019)" },
  { id: "lab", label: "Combine", game: "Black Ops III" },
  { id: "yacht", label: "Hijacked", game: "Black Ops II" },
  { id: "sea", label: "Armada Strike", game: "Black Ops Cold War" },
  { id: "desert", label: "Crossfire", game: "Call of Duty 4: Modern Warfare" },
] as const;

export type SampleId = (typeof SAMPLES)[number]["id"];
export const DEFAULT_SAMPLE: SampleId = "port";
export const SAMPLE_CREDIT = "MorganPixy";

const cache = new Map<string, Promise<HTMLCanvasElement>>();

/** The scene drawn cover-cropped into a `w`×`h` canvas; cached per scene and size. */
export function loadSample(id: SampleId, w = 960, h = 540): Promise<HTMLCanvasElement> {
  const key = `${id}|${w}x${h}`;
  let p = cache.get(key);
  if (!p) {
    p = new Promise<HTMLCanvasElement>((resolve, reject) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        const c = document.createElement("canvas");
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d");
        if (!ctx) return reject(new Error("2D canvas unavailable"));
        const sc = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const dw = img.naturalWidth * sc;
        const dh = img.naturalHeight * sc;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
        resolve(c);
      };
      img.onerror = () => reject(new Error(`Could not load the ${id} scene`));
      img.src = `/samples/${id}.webp`;
    });
    // a failed load may succeed later (flaky network), so don't cache the failure
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return p;
}
