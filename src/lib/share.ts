"use client";

import { decode, type Zone } from "@/lib/codm";
import { shareUrl, type DeployPayload } from "@/lib/shareUrl";

// QR hand-off and look card. Only loaded through `await import()`, so the
// QR encoder and the card renderer stay off the page's critical path.

export type QrMatrix = { count: number; cells: Uint8Array };

/** Module matrix for `data`, level M (about 15% recoverable). */
export async function qrMatrix(data: string): Promise<QrMatrix> {
  const mod = await import("qrcode-generator");
  const make = mod.default;
  const qr = make(0, "M");
  qr.addData(data, "Byte");
  qr.make();
  const count = qr.getModuleCount();
  const cells = new Uint8Array(count * count);
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      cells[r * count + c] = qr.isDark(r, c) ? 1 : 0;
    }
  }
  return { count, cells };
}

/** Dark modules on a light panel, with the quiet zone scanners need. */
export function drawQr(
  ctx: CanvasRenderingContext2D,
  qr: QrMatrix,
  x: number,
  y: number,
  size: number,
  opts: { fg?: string; bg?: string; quiet?: number } = {},
) {
  const fg = opts.fg ?? "#0a0b0a";
  const bg = opts.bg ?? "#e9ece6";
  const quiet = opts.quiet ?? 3;
  const total = qr.count + quiet * 2;
  const cell = size / total;
  const at = (i: number) => Math.round(i * cell);
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = fg;
  for (let r = 0; r < qr.count; r++) {
    for (let c = 0; c < qr.count; c++) {
      if (!qr.cells[r * qr.count + c]) continue;
      const x0 = at(c + quiet);
      const y0 = at(r + quiet);
      ctx.fillRect(x + x0, y + y0, at(c + quiet + 1) - x0, at(r + quiet + 1) - y0);
    }
  }
}

// Canvas helpers

function hsla(h: number, s: number, l: number, a: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g] = [c, x];
  else if (h < 120) [r, g] = [x, c];
  else if (h < 180) [g, b] = [c, x];
  else if (h < 240) [g, b] = [x, c];
  else if (h < 300) [r, b] = [x, c];
  else [r, b] = [c, x];
  const q = (v: number) => Math.round((v + m) * 255);
  return `rgba(${q(r)}, ${q(g)}, ${q(b)}, ${a})`;
}

function spaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: "left" | "right" = "left",
) {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let cx = align === "right" ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((ch, i) => {
    ctx.fillText(ch, cx, y);
    cx += widths[i] + spacing;
  });
  ctx.textAlign = prev;
  return total;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines) {
    // ellipsis if we ran out of room
    const joined = lines.join(" ");
    if (joined.length < text.replace(/\s+/g, " ").length) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last.trimEnd()}…`;
    }
  }
  return lines;
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxSize: number,
  minSize: number,
  build: (size: number) => string,
): number {
  let size = maxSize;
  while (size > minSize) {
    ctx.font = build(size);
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  ctx.font = build(size);
  return size;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

async function ensureFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  const faces = [
    '900 60px "Hitmarker Normal"',
    '900 60px "Hitmarker Condensed"',
    '700 30px "Hitmarker Condensed"',
    '500 20px "Obel Mono"',
    '400 18px "Hitmarker Text"',
    '500 18px "Hitmarker Text"',
  ];
  try {
    await Promise.all(faces.map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  } catch {
    /* a missing face just falls back */
  }
}

// The look card

const CARD_W = 1200;
const CARD_H = 630;
/** Art column width; the panel gets the rest (a shade under a third of the card). */
const ART_W = 700;
/** Left edge of the panel's text column and how much room it has. */
const PX = 728;
const PW = 424;

/** For grades with no reference still: a plate built from the grade itself. */
function drawPlate(ctx: CanvasRenderingContext2D, code: string, w: number, h: number) {
  const s = decode(code);
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, "#12160f");
  base.addColorStop(0.6, "#0d0f0c");
  base.addColorStop(1, "#0a0b0a");
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);

  // the grade's own casts, as three soft pools of light
  const zones: [Zone, number, number][] = s
    ? [
        [s.zones.shadows, 0.2, 0.62],
        [s.zones.midtones, 0.52, 0.5],
        [s.zones.highlights, 0.84, 0.4],
      ]
    : [];
  for (const [z, tx, ty] of zones) {
    const strength = Math.min(1, z.tint / 40);
    const cx = tx * w;
    const cy = ty * h;
    const r = w * 0.62;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, hsla(z.hue, 0.85, 0.55, 0.1 + 0.42 * strength));
    g.addColorStop(1, hsla(z.hue, 0.85, 0.55, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // the code itself, as a quiet data texture
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#ffffff";
  ctx.font = '500 74px "Obel Mono", monospace';
  const lines = wrapText(ctx, code.replace(/_/g, " "), w * 0.92, 5);
  lines.forEach((line, i) => ctx.fillText(line, 44, 150 + i * 86));
  ctx.restore();

  // vignette so the type in the panel always has something to sit on
  const vig = ctx.createRadialGradient(w * 0.35, h * 0.5, h * 0.2, w * 0.35, h * 0.5, h * 0.95);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.75)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, w, h);
}

function scanlines(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#ffffff";
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1);
  ctx.restore();
}

/** True when the payload is a graded screen-test shot, not a look still. */
export const isOwnFrame = (p: DeployPayload) => p.source === "screen-test";

/** 1200×630 card: the look, its share code and a QR back to this page. */
export async function renderShareCard(p: DeployPayload): Promise<Blob | null> {
  await ensureFonts();
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#0a0b0a";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const img = p.image ? await loadImage(p.image).catch(() => null) : null;
  if (img) drawCover(ctx, img, 0, 0, ART_W, CARD_H);
  else drawPlate(ctx, p.code, ART_W, CARD_H);

  // let the art fall away into the panel
  const fade = ctx.createLinearGradient(ART_W * 0.52, 0, CARD_W, 0);
  fade.addColorStop(0, "rgba(10,11,10,0)");
  fade.addColorStop(0.52, "rgba(10,11,10,0.86)");
  fade.addColorStop(0.78, "rgba(10,11,10,0.98)");
  fade.addColorStop(1, "#0a0b0a");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, CARD_W, CARD_H);
  scanlines(ctx, ART_W, CARD_H);

  ctx.strokeStyle = "rgba(255,234,59,0.55)";
  ctx.lineWidth = 2;
  const b = 26;
  const L = 120;
  const corner = (x: number, y: number, sx: number, sy: number) => {
    ctx.beginPath();
    ctx.moveTo(x + sx * L, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + sy * L);
    ctx.stroke();
  };
  corner(b, b, 1, 1);
  corner(b, CARD_H - b, 1, -1);

  ctx.save();
  ctx.translate(824, 62);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "#ffea3b";
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
  ctx.fillStyle = "#ffea3b";
  ctx.font = '500 15px "Obel Mono", monospace';
  // always the fan-made marker: DESIGN.md requires it on every card
  spaced(ctx, "FAN-MADE FILTER LAB", 848, 68, 3.4);

  const name = (p.name ?? "Custom grade").toUpperCase();
  ctx.fillStyle = "#f2f4ef";
  fitFont(
    ctx,
    name,
    PW,
    58,
    30,
    (s) => `900 ${s}px "Hitmarker Normal", "Hitmarker Condensed", sans-serif`,
  );
  const size = Number(ctx.font.match(/(\d+)px/)?.[1] ?? 58);
  const titleLines = wrapText(ctx, name, PW, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, PX, 128 + i * (size * 0.94)));

  const noteY = 128 + titleLines.length * (size * 0.94) + 10;
  if (p.note) {
    ctx.fillStyle = "#a8aea4";
    ctx.font = '400 17px "Hitmarker Text", system-ui, sans-serif';
    wrapText(ctx, p.note, PW, 2).forEach((line, i) => ctx.fillText(line, PX, noteY + i * 23));
  }

  // share code block: two lines split on a character budget so neither runs long
  const codeY = 322;
  ctx.fillStyle = "#8e948b";
  ctx.font = '500 11px "Obel Mono", monospace';
  spaced(ctx, "SHARE CODE", PX, codeY, 2.6);
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.fillRect(PX, codeY + 12, PW, 64);
  ctx.fillStyle = "#ffea3b";
  ctx.fillRect(PX, codeY + 12, 3, 64);
  const nums = p.code.split("_");
  const mid = p.code.length / 2;
  let used = 0;
  let cut = nums.length;
  for (let i = 0; i < nums.length - 1; i++) {
    used += nums[i].length + 1;
    if (used >= mid) {
      cut = i + 1;
      break;
    }
  }
  const lineA = nums.slice(0, cut).join("_");
  const lineB = nums.slice(cut).join("_");
  ctx.fillStyle = "#f4f6f0";
  fitFont(
    ctx,
    lineA.length > lineB.length ? lineA : lineB,
    PW - 16,
    18,
    12,
    (s) => `500 ${s}px "Obel Mono", monospace`,
  );
  ctx.fillText(lineA, PX + 16, codeY + 38);
  ctx.fillText(lineB, PX + 16, codeY + 64);

  const qr = await qrMatrix(shareUrl(p.code));
  const qrSize = 150;
  const qrX = PX;
  const qrY = CARD_H - 40 - qrSize;
  ctx.fillStyle = "rgba(255,234,59,0.9)";
  ctx.fillRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12);
  drawQr(ctx, qr, qrX, qrY, qrSize, { quiet: 2 });
  ctx.fillStyle = "#ffea3b";
  ctx.font = '500 12px "Obel Mono", monospace';
  spaced(ctx, "SCAN TO LOAD", qrX + 170, qrY + 22, 2.2);
  ctx.fillStyle = "#9aa094";
  ctx.font = '400 15px "Hitmarker Text", system-ui, sans-serif';
  wrapText(
    ctx,
    isOwnFrame(p)
      ? "Scan to open this grade, then try it on your own screen."
      : "Point your camera here to open this grade on your phone.",
    200,
    3,
  ).forEach(
    (line, i) => ctx.fillText(line, qrX + 170, qrY + 52 + i * 20),
  );

  const host = typeof window === "undefined" ? "" : window.location.host;
  if (host) {
    ctx.fillStyle = "#8e948b";
    ctx.font = '500 10px "Obel Mono", monospace';
    spaced(ctx, host.toUpperCase(), PX + 170, CARD_H - 48, 1.6);
  }

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function cardFilename(p: DeployPayload) {
  const slug = (p.name ?? "custom-grade")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  return `codm-${slug || "grade"}.png`;
}
