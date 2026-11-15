import { SWATCH_NAMES, applyGrade, decode, drawSample, hueParts, type Settings, type Zone } from "@/lib/codm";
import { drawQr } from "@/lib/qr";

const W = 1200;
const H = 675;

function zoneSummaryLine(z: Zone) {
  const hp = hueParts(z.hue);
  const tint = Math.round(z.tint);
  const swatch = tint >= 2 ? `${SWATCH_NAMES[hp.swatch]} ${Math.round(hp.pos)}` : "Neutral";
  return {
    color: tint >= 2 ? `hsl(${Math.round(z.hue)} 92% 55%)` : "#7c847a",
    swatch,
    tint,
    sat: Math.round(z.sat),
    bri: Math.round(z.bri),
  };
}

function drawCutRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut: number,
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w - cut, y);
  ctx.lineTo(x + w, y + cut);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + cut, y + h);
  ctx.lineTo(x, y + h - cut);
  ctx.closePath();
}

/**
 * Renders a high-DPI 1200x675 widescreen CODM Tactical Filter Card showing:
 * - Before/After split preview of the actual graded image
 * - Filter title & 3-zone colour DNA telemetry
 * - Exact in-game Swatch / Hue / Tint / Sat / Bri recipe
 * - Full share code + scannable QR code linking straight back to the filter
 */
export function renderShareCard({
  title,
  code,
  shareUrl,
  sourceCanvas,
  split = 0.36,
}: {
  title: string;
  code: string;
  shareUrl: string;
  sourceCanvas: HTMLCanvasElement | null;
  split?: number;
}): HTMLCanvasElement {
  const settings: Settings | null = decode(code);
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d")!;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0b0d0b");
  bg.addColorStop(0.6, "#111411");
  bg.addColorStop(1, "#090a09");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle tactical glow
  const glow = ctx.createRadialGradient(140, 620, 20, 140, 620, 420);
  glow.addColorStop(0, "rgba(255, 234, 59, 0.14)");
  glow.addColorStop(1, "rgba(255, 234, 59, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Subtle scanlines
  ctx.fillStyle = "rgba(255,255,255,0.02)";
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

  // Outer tactical frame
  ctx.strokeStyle = "#2c302b";
  ctx.lineWidth = 2;
  drawCutRect(ctx, 20, 20, W - 40, H - 40, 20);
  ctx.stroke();

  // Top yellow accent bar
  ctx.fillStyle = "#ffea3b";
  ctx.fillRect(42, 42, 72, 4);

  // Header brand + title
  ctx.fillStyle = "#ffea3b";
  ctx.font = '700 15px "Hitmarker Condensed", "Arial Narrow", sans-serif';
  ctx.fillText("CODM FILTER LAB  //  TACTICAL COLOUR LOADOUT", 126, 49);

  ctx.fillStyle = "#e9ece6";
  ctx.font = '900 44px "Hitmarker Normal", "Hitmarker Condensed", sans-serif';
  ctx.fillText((title.trim() || "CUSTOM FILTER").toUpperCase().slice(0, 28), 42, 102);

  // Preview pane (left side: 740x416, 16:9)
  const px = 42;
  const py = 126;
  const pw = 740;
  const ph = 416;

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = pw;
  srcCanvas.height = ph;
  const sctx = srcCanvas.getContext("2d")!;
  if (sourceCanvas) {
    // Cover-crop into 16:9
    const scale = Math.max(pw / sourceCanvas.width, ph / sourceCanvas.height);
    const dw = sourceCanvas.width * scale;
    const dh = sourceCanvas.height * scale;
    sctx.drawImage(sourceCanvas, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
  } else {
    drawSample(sctx, pw, ph);
  }

  const rawImg = sctx.getImageData(0, 0, pw, ph);
  const gradedData = new Uint8ClampedArray(rawImg.data);
  if (settings) applyGrade(gradedData, settings);

  const splitX = Math.round(pw * split);
  const comp = new ImageData(gradedData, pw, ph);
  for (let y = 0; y < ph; y++) {
    const row = y * pw * 4;
    comp.data.set(rawImg.data.subarray(row, row + splitX * 4), row);
  }

  const compCanvas = document.createElement("canvas");
  compCanvas.width = pw;
  compCanvas.height = ph;
  compCanvas.getContext("2d")!.putImageData(comp, 0, 0);

  ctx.save();
  drawCutRect(ctx, px, py, pw, ph, 14);
  ctx.clip();
  ctx.drawImage(compCanvas, px, py);

  // Split line
  ctx.fillStyle = "#ffea3b";
  ctx.fillRect(px + splitX - 1, py, 3, ph);

  // Corner preview badges
  ctx.fillStyle = "rgba(10,11,10,0.82)";
  ctx.fillRect(px + 14, py + 14, 118, 28);
  ctx.fillStyle = "#b5bcb2";
  ctx.font = '700 14px "Hitmarker Condensed", sans-serif';
  ctx.fillText("DEFAULT CODM", px + 26, py + 33);

  ctx.fillStyle = "#ffea3b";
  ctx.fillRect(px + pw - 114, py + 14, 100, 28);
  ctx.fillStyle = "#0a0b0a";
  ctx.fillText("FILTERED", px + pw - 96, py + 33);
  ctx.restore();

  ctx.strokeStyle = "#3a4039";
  ctx.lineWidth = 1.5;
  drawCutRect(ctx, px, py, pw, ph, 14);
  ctx.stroke();

  // Right column: 3-zone DNA Recipe + QR Handoff (x=806, w=352)
  const rx = 806;
  const rw = 352;
  let cy = 126;

  ctx.fillStyle = "#8e948b";
  ctx.font = '700 14px "Hitmarker Condensed", sans-serif';
  ctx.fillText("TONAL GRADE RECIPE", rx, cy + 12);
  cy += 26;

  if (settings) {
    const rows: [string, Zone][] = [
      ["SHADOWS", settings.zones.shadows],
      ["MIDTONES", settings.zones.midtones],
      ["HIGHLIGHTS", settings.zones.highlights],
    ];
    for (const [label, z] of rows) {
      const info = zoneSummaryLine(z);
      ctx.fillStyle = "rgba(26, 29, 26, 0.9)";
      ctx.fillRect(rx, cy, rw, 66);
      ctx.strokeStyle = "#2c302b";
      ctx.lineWidth = 1;
      ctx.strokeRect(rx, cy, rw, 66);

      // Colour bar accent on left edge
      ctx.fillStyle = info.color;
      ctx.fillRect(rx, cy, 6, 66);

      ctx.fillStyle = "#8e948b";
      ctx.font = '700 13px "Hitmarker Condensed", sans-serif';
      ctx.fillText(label, rx + 18, cy + 23);

      ctx.fillStyle = "#e9ece6";
      ctx.font = '700 20px "Hitmarker Condensed", sans-serif';
      ctx.fillText(info.swatch.toUpperCase(), rx + 18, cy + 49);

      ctx.fillStyle = "#ffea3b";
      ctx.font = '500 13px "JetBrains Mono", monospace';
      ctx.textAlign = "right";
      ctx.fillText(`T:${info.tint}  S:${info.sat}  B:${info.bri}`, rx + rw - 14, cy + 44);
      ctx.textAlign = "left";

      cy += 76;
    }
  }

  // QR Code Handoff box in bottom-right
  const qrBoxY = 390;
  const qrBoxH = 152;
  ctx.fillStyle = "rgba(18, 20, 18, 0.95)";
  ctx.fillRect(rx, qrBoxY, rw, qrBoxH);
  ctx.strokeStyle = "#ffea3b";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(rx, qrBoxY, rw, qrBoxH);

  const qrSize = 128;
  try {
    drawQr(ctx, shareUrl, rx + 12, qrBoxY + 12, qrSize, "#0a0b0a", "#ffffff");
  } catch {
    // Fallback if URL is unusually long: encode the raw code directly
    drawQr(ctx, code, rx + 12, qrBoxY + 12, qrSize, "#0a0b0a", "#ffffff");
  }

  ctx.fillStyle = "#ffea3b";
  ctx.font = '800 18px "Hitmarker Condensed", sans-serif';
  ctx.fillText("SCAN ON PHONE", rx + 156, qrBoxY + 42);

  ctx.fillStyle = "#e9ece6";
  ctx.font = '400 14px "Hitmarker Text", sans-serif';
  ctx.fillText("Open this exact filter", rx + 156, qrBoxY + 68);
  ctx.fillText("on mobile & tap Copy", rx + 156, qrBoxY + 88);
  ctx.fillText("to paste into CODM.", rx + 156, qrBoxY + 108);

  ctx.fillStyle = "#8e948b";
  ctx.font = '500 11px "JetBrains Mono", monospace';
  ctx.fillText("MP · BR · DMZ: RECON", rx + 156, qrBoxY + 134);

  // Bottom full Share Code strip
  const codeY = 562;
  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.fillRect(42, codeY, W - 84, 68);
  ctx.strokeStyle = "#2c302b";
  ctx.lineWidth = 1;
  ctx.strokeRect(42, codeY, W - 84, 68);

  ctx.fillStyle = "#8e948b";
  ctx.font = '700 12px "Hitmarker Condensed", sans-serif';
  ctx.fillText("IN-GAME SHARE CODE  ·  SETTINGS → AUDIO & GRAPHICS → GRAPHIC STYLE → IMPORT", 58, codeY + 22);

  ctx.fillStyle = "#ffea3b";
  ctx.font = '500 17px "JetBrains Mono", monospace';
  ctx.fillText(code, 58, codeY + 50, W - 116);

  return out;
}
