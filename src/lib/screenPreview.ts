"use client";

import { applyGrade, decode } from "@/lib/codm";
import { fitFrame } from "@/lib/frame";

/*
 * The visitor's own screenshot ("screen test"). Uploaded once, then graded for
 * every look, the stage, the filmstrip and the generator preview.
 *
 * A screenshot is downscaled to 1280px on the long edge and reused; each grade
 * is a cover-cropped copy of it at the size the caller asks for, cached so a
 * look that comes back around is instant. Results are keyed by the shot's id,
 * so replacing the screenshot can never hand back a grade of the old one.
 */

export type Shot = {
  /** Unique per upload; part of every cache key. */
  id: string;
  /** The prepared screenshot at up to 1280px wide. */
  canvas: HTMLCanvasElement;
  /** One 960px JPEG copy, for the ungraded compare plate and the header chip. */
  preview: string;
};

const MAX_W = 1280;
const PREVIEW_W = 960;
/**
 * Grades kept in memory, least recently used evicted first. A stage grade is at
 * most 960×439×4 ≈ 1.7 MB and a thumb about 0.2 MB, so the cap stays near 25 MB. A hit moves the
 * entry to the recent end; nothing is pinned, so a grade can be recomputed.
 */
// two sizes per look (filmstrip thumb and stage) for all twelve, plus slack
const CACHE_LIMIT = 28;

let seq = 0;
const bases = new Map<string, Promise<ImageData>>();
const grades = new Map<string, Promise<ImageData | null>>();

async function toCanvas(file: File): Promise<HTMLCanvasElement> {
  let src: CanvasImageSource | null = null;
  let w = 0;
  let h = 0;

  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      src = bmp;
      w = bmp.width;
      h = bmp.height;
    } catch {
      src = null;
    }
  }
  if (!src) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("Could not read that image."));
        el.src = url;
      });
      src = img;
      w = img.naturalWidth;
      h = img.naturalHeight;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  if (!w || !h) throw new Error("That image has no pixels to read.");

  ({ w, h } = fitFrame(w, h));

  const scale = Math.min(1, MAX_W / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that image.");
  const sw = src instanceof HTMLImageElement ? src.naturalWidth : (src as ImageBitmap).width;
  const sh = src instanceof HTMLImageElement ? src.naturalHeight : (src as ImageBitmap).height;
  // centred crop of the same aspect, then scale down
  const cropW = Math.min(sw, sh * (canvas.width / canvas.height));
  const cropH = Math.min(sh, sw * (canvas.height / canvas.width));
  ctx.drawImage(
    src,
    (sw - cropW) / 2,
    (sh - cropH) / 2,
    cropW,
    cropH,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  if (src instanceof ImageBitmap) src.close();
  return canvas;
}

/** Read a dropped / chosen file into a Shot. Throws with a readable message. */
export async function prepareShot(file: File): Promise<Shot> {
  if (file.type && !file.type.startsWith("image/")) {
    throw new Error("That file is not an image. Drop a screenshot.");
  }
  const canvas = await toCanvas(file);
  const id = `shot-${++seq}`;

  const p = document.createElement("canvas");
  const s = Math.min(1, PREVIEW_W / canvas.width);
  p.width = Math.max(1, Math.round(canvas.width * s));
  p.height = Math.max(1, Math.round(canvas.height * s));
  p.getContext("2d")?.drawImage(canvas, 0, 0, p.width, p.height);

  return { id, canvas, preview: p.toDataURL("image/jpeg", 0.82) };
}

/**
 * Free every cached pixel. One screenshot is active at a time, so the provider
 * calls this when it swaps or removes the shot; otherwise each old shot would
 * hold several MB per size it was shown at.
 */
export function dropCaches() {
  bases.clear();
  grades.clear();
}

/** The shot as-is (no look) at `w`×`h`. Backs the hold-to-compare wipe. */
export function shotBase(shot: Shot, w: number, h: number): Promise<ImageData> {
  return baseAt(shot, w, h);
}

/** Cover-cropped pixels of the shot at `w`×`h`, read once per size. */
function baseAt(shot: Shot, w: number, h: number): Promise<ImageData> {
  const key = `${shot.id}|${w}x${h}`;
  let p = bases.get(key);
  if (!p) {
    p = new Promise<ImageData>((resolve, reject) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      if (!ctx) return reject(new Error("2D canvas unavailable"));
      // same geometry as CSS object-cover, so the graded canvas lines up with
      // the ungraded plate underneath it
      const sc = Math.max(w / shot.canvas.width, h / shot.canvas.height);
      const dw = shot.canvas.width * sc;
      const dh = shot.canvas.height * sc;
      ctx.drawImage(shot.canvas, (w - dw) / 2, (h - dh) / 2, dw, dh);
      resolve(ctx.getImageData(0, 0, w, h));
    });
    bases.set(key, p);
  }
  return p;
}

/**
 * Grades run one at a time, each in its own task. Twelve thumbnails and the
 * stage at once would otherwise block the page for about a second on upload.
 */
let queue: Promise<unknown> = Promise.resolve();
function inTurn<T>(job: () => T): Promise<T> {
  const run = queue.then(() => new Promise<T>((resolve) => setTimeout(() => resolve(job()), 0)));
  queue = run.catch(() => undefined);
  return run;
}

function remember(key: string, value: Promise<ImageData | null>) {
  grades.set(key, value);
  while (grades.size > CACHE_LIMIT) {
    const oldest = grades.keys().next().value;
    if (oldest === undefined) break;
    grades.delete(oldest);
  }
}

/** The shot with `code` applied, at `w`×`h`. Cached; null if the code is bad. */
export function shotGraded(
  shot: Shot,
  code: string,
  w: number,
  h: number,
): Promise<ImageData | null> {
  const key = `${shot.id}|${code}|${w}x${h}`;
  const hit = grades.get(key);
  if (hit) {
    // touch: move to the most-recent end of the eviction order
    grades.delete(key);
    grades.set(key, hit);
    return hit;
  }
  const p = baseAt(shot, w, h)
    .then((base) =>
      inTurn(() => {
        const s = decode(code);
        if (!s) return null;
        const data = new Uint8ClampedArray(base.data);
        applyGrade(data, s);
        return new ImageData(data, w, h);
      }),
    )
    .catch(() => null);
  remember(key, p);
  return p;
}

/** A shareable JPEG of the graded shot, for the look card. */
export async function shotCardImage(
  shot: Shot,
  code: string,
  w = PREVIEW_W,
  h = 540,
): Promise<string | null> {
  const img = await shotGraded(shot, code, w, h);
  if (!img) return null;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")?.putImageData(img, 0, 0);
  try {
    return c.toDataURL("image/jpeg", 0.86);
  } catch {
    return null;
  }
}
