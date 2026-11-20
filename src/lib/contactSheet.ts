// One image with every visible look, for saving or sending to a squad.

import type { Look } from "@/lib/codm";
import { downloadBlob } from "@/lib/share";

const COLS = 4;
const CELL_W = 400;
const CELL_H = 225;
const CAP = 46;
const PAD = 12;

const load = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const drawCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
};

/** Renders a labelled grid of looks as a PNG download. */
export async function downloadLookSheet(looks: Look[]) {
  if (!looks.length) return false;
  await (document.fonts?.ready ?? Promise.resolve());
  const rows = Math.ceil(looks.length / COLS);
  const canvas = document.createElement("canvas");
  canvas.width = COLS * CELL_W + (COLS + 1) * PAD;
  canvas.height = rows * (CELL_H + CAP) + (rows + 1) * PAD + 54;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;

  ctx.fillStyle = "#0a0b0a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffea3b";
  ctx.font = '900 34px "Hitmarker Normal", sans-serif';
  ctx.fillText("CODM FILTER LAB · LOOK SHEET", PAD + 4, 46);
  ctx.fillStyle = "#8e948b";
  ctx.font = '500 14px "Obel Mono", monospace';
  ctx.fillText("Unofficial fan-made tool · preview is approximate", 470, 44);

  for (let i = 0; i < looks.length; i++) {
    const look = looks[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = PAD + col * (CELL_W + PAD);
    const y = 64 + PAD + row * (CELL_H + CAP + PAD);
    const img = look.image ? await load(look.image.replace("/looks/", "/looks/thumb/")) : null;
    ctx.fillStyle = "#121412";
    ctx.fillRect(x, y, CELL_W, CELL_H);
    if (img) drawCover(ctx, img, x, y, CELL_W, CELL_H);
    else {
      const g = ctx.createLinearGradient(x, y, x + CELL_W, y + CELL_H);
      g.addColorStop(0, "#1a1d1a");
      g.addColorStop(1, "#0a0b0a");
      ctx.fillStyle = g;
      ctx.fillRect(x, y, CELL_W, CELL_H);
    }
    const fade = ctx.createLinearGradient(0, y + CELL_H - 60, 0, y + CELL_H);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(1, "rgba(0,0,0,0.9)");
    ctx.fillStyle = fade;
    ctx.fillRect(x, y + CELL_H - 60, CELL_W, 60);
    ctx.fillStyle = "#e9ece6";
    ctx.font = '900 22px "Hitmarker Normal", sans-serif';
    ctx.fillText(look.name.toUpperCase(), x + 10, y + CELL_H - 14);
    ctx.fillStyle = "#a6e22e";
    ctx.fillRect(x, y + CELL_H, CELL_W, CAP - 6);
    ctx.fillStyle = "#0b0f05";
    ctx.font = '500 13px "Obel Mono", monospace';
    ctx.fillText(look.code.slice(0, 62) + (look.code.length > 62 ? "…" : ""), x + 8, y + CELL_H + 26);
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return false;
  downloadBlob(blob, "codm-look-sheet.png");
  return true;
}
