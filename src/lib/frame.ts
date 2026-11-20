/**
 * The aspect a screenshot is held at: between 4:3 and 16:9, so a portrait shot
 * or a photo of a screen still frames well in the 21:9 stage, the filmstrip and
 * the preview. Returns the largest box of that aspect inside `w`×`h`.
 */
export function fitFrame(w: number, h: number): { w: number; h: number } {
  if (!(w > 0) || !(h > 0)) return { w: 1, h: 1 };
  const ratio = Math.min(16 / 9, Math.max(4 / 3, w / h));
  return w / h > ratio
    ? { w: Math.round(h * ratio), h: Math.round(h) }
    : { w: Math.round(w), h: Math.round(w / ratio) };
}
