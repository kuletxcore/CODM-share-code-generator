/** Small canvas helpers shared by the preview and the screenshot matcher. */

/** Read a dropped image into a canvas, downscaled so its width is at most `maxW`. */
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

/** Downscaled RGBA pixels of a canvas, for measuring rather than displaying. */
export function pixels(c: HTMLCanvasElement, maxW = 320) {
  const scale = Math.min(1, maxW / c.width);
  const t = document.createElement("canvas");
  t.width = Math.max(1, Math.round(c.width * scale));
  t.height = Math.max(1, Math.round(c.height * scale));
  const ctx = t.getContext("2d")!;
  ctx.drawImage(c, 0, 0, t.width, t.height);
  return ctx.getImageData(0, 0, t.width, t.height).data;
}

/**
 * Luminance histogram, normalised so the tallest bin is 1. Used to draw the
 * tone map: the shape of the image tells you where its shadows, mids and
 * highlights actually sit.
 */
export function luminanceHistogram(data: Uint8ClampedArray, bins = 48) {
  const out = new Float32Array(bins);
  // sample every fourth pixel: plenty for a 48-bin shape
  for (let i = 0; i < data.length; i += 16) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    out[Math.min(bins - 1, Math.floor(l * bins))]++;
  }
  let max = 0;
  for (let b = 0; b < bins; b++) max = Math.max(max, out[b]);
  if (max > 0) for (let b = 0; b < bins; b++) out[b] /= max;
  return out;
}
