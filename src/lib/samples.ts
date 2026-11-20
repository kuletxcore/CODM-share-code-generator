"use client";

/**
 * Built-in preview scenes: real CODM frames on the default filter, each
 * covering deep shade, sky and saturated colour. Combine, Hijacked and
 * Crossfire are the site owner's own captures (default settings checked);
 * Shipment 2019 and Armada Strike are stills from MorganPixy's "CODM Season
 * 10 2026 - New and Reworked Weapons Showcase" (YouTube), with no HUD. Map
 * names and their source games are checked against Activision and press
 * coverage. `by` is the credit shown under the picker.
 */
export const SAMPLES = [
  { id: "port", label: "Shipment 2019", game: "Modern Warfare (2019)", by: "MorganPixy" },
  { id: "lab", label: "Combine", game: "Black Ops III", by: "owner" },
  { id: "yacht", label: "Hijacked", game: "Black Ops II", by: "owner" },
  { id: "sea", label: "Armada Strike", game: "Black Ops Cold War", by: "MorganPixy" },
  { id: "desert", label: "Crossfire", game: "Call of Duty 4: Modern Warfare", by: "owner" },
] as const;

export type SampleId = (typeof SAMPLES)[number]["id"];
export const DEFAULT_SAMPLE: SampleId = "port";

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
