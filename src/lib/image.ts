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
