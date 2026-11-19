// The frame every look is tried on, and helpers for turning images into frames.

/**
 * A neutral, ungraded gameplay-style frame: sky, foliage, painted walls, deep
 * shadows and a weapon, so each zone of a filter has something to act on.
 * It is an AI-generated stand-in, not a CODM capture.
 */
const FILES = [
  { src: "/sample/frame-800.webp", width: 800, height: 450 },
  { src: "/sample/frame.webp", width: 1280, height: 720 },
];

export const SAMPLE = {
  src: "/sample/frame.webp",
  srcSet: FILES.map((f) => `${f.src} ${f.width}w`).join(", "),
  thumb: "/sample/frame-thumb.webp",
  width: 1280,
  height: 720,
  /**
   * The pixel size of the file the browser picked. An <img> with srcset reports
   * its naturalWidth in CSS pixels, which on a phone is a third of the file's.
   */
  sizeOf(currentSrc: string) {
    return FILES.find((f) => currentSrc.endsWith(f.src)) ?? FILES[FILES.length - 1];
  },
};

/** Pure hues plus white, grey and black: shows what a filter does to colours the frame may not contain. */
const CHIPS = ["#e23b2e", "#f2a71b", "#8fd13f", "#27b36a", "#29b8d6", "#2f5fd0", "#7a3fd0", "#d93fa6", "#f2f2f2", "#8a8a8a", "#1e1e1e"];

/** Draws the chips along the bottom right, the side of the frame that starts out filtered. */
export function drawChips(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const size = Math.round(w * 0.034),
    gap = Math.round(w * 0.005),
    x0 = Math.round(w - w * 0.025 - CHIPS.length * (size + gap) + gap),
    y0 = Math.round(h - size - w * 0.025);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x0 - gap, y0 - gap, CHIPS.length * (size + gap) + gap, size + gap * 2);
  CHIPS.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(x0 + i * (size + gap), y0, size, size);
  });
}

/** Decodes an image file into a canvas no wider than `maxW`. */
export function fileToCanvas(file: File, maxW: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxW / img.naturalWidth);
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(img.naturalWidth * scale));
      c.height = Math.max(1, Math.round(img.naturalHeight * scale));
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

/** RGBA pixels of a canvas, downscaled to at most `maxW` wide. */
export function pixels(c: HTMLCanvasElement, maxW = 320) {
  const scale = Math.min(1, maxW / c.width);
  const t = document.createElement("canvas");
  t.width = Math.max(1, Math.round(c.width * scale));
  t.height = Math.max(1, Math.round(c.height * scale));
  const ctx = t.getContext("2d")!;
  ctx.drawImage(c, 0, 0, t.width, t.height);
  return ctx.getImageData(0, 0, t.width, t.height).data;
}
