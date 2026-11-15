import { SWATCH_NAMES, applyGrade, hueParts, type Settings, type ZoneKey } from "@/lib/codm";
import { sampleFrame } from "@/lib/frame";

/**
 * The look card: a 1200x630 image of the graded frame with the look's name, its
 * three zone colours and the share code on it. This is the thing people post to
 * Discord or a group chat — a code alone can't show anyone what it does.
 */

const W = 1200;
const H = 630;
const PAD = 44;
const IMG_H = 430;

const TEXT = "#e9ece6";
const MUTE = "#8e948b";
const YELLOW = "#ffea3b";
const PLATE = "#0a0b0a";

const DISPLAY = '"Hitmarker Condensed", "Arial Narrow", sans-serif';
const SANS = '"Hitmarker Text", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

async function loadFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  const faces = [
    `900 92px ${DISPLAY}`,
    `700 22px ${DISPLAY}`,
    `500 22px ${SANS}`,
    `500 20px ${MONO}`,
  ];
  await Promise.all(
    faces.map((f) =>
      document.fonts.load(f).catch(() => {
        /* fall back to the system face */
      }),
    ),
  );
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  weight: number,
  family: string,
  start: number,
  min = 28,
) {
  let size = start;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxW && size > min) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
  maxLines: number,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxW && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines - 1) break;
    } else {
      line = next;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

/** Split the 22-number code onto as few lines as fit, keeping the underscores. */
function wrapCode(ctx: CanvasRenderingContext2D, code: string, maxW: number, maxLines: number) {
  const tokens = code.split("_");
  const lines: string[] = [];
  let line = "";
  for (const t of tokens) {
    const next = line ? `${line}_${t}` : t;
    if (ctx.measureText(next).width > maxW && line && lines.length < maxLines - 1) {
      lines.push(line);
      line = t;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function zoneColor(s: Settings, k: ZoneKey) {
  const z = s.zones[k];
  const global = s.zones.global;
  const tinted = z.tint > 3 || global.tint > 3;
  if (!tinted) return { fill: "rgba(255,255,255,0.16)", on: false };
  return { fill: `hsl(${Math.round(z.tint > 3 ? z.hue : global.hue)} 85% 55%)`, on: true };
}

export type CardInput = {
  frame: HTMLCanvasElement | null;
  settings: Settings;
  name: string;
  note?: string;
  code: string;
};

export async function renderLookCard({
  frame,
  settings,
  name,
  note,
  code,
}: CardInput): Promise<HTMLCanvasElement> {
  const src = frame ?? (await sampleFrame());
  await loadFonts();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  // the graded frame, cover-cropped to the art strip
  const crop = document.createElement("canvas");
  crop.width = W;
  crop.height = IMG_H;
  const cctx = crop.getContext("2d")!;
  const scale = Math.max(W / src.width, IMG_H / src.height);
  cctx.drawImage(
    src,
    (W - src.width * scale) / 2,
    (IMG_H - src.height * scale) / 2,
    src.width * scale,
    src.height * scale,
  );
  const img = cctx.getImageData(0, 0, W, IMG_H);
  applyGrade(img.data, settings);
  cctx.putImageData(img, 0, 0);
  ctx.drawImage(crop, 0, 0);

  // the art fades into the plate, so the seam never cuts a horizon in half
  const fade = ctx.createLinearGradient(0, IMG_H - 96, 0, IMG_H);
  fade.addColorStop(0, "rgba(10,11,10,0)");
  fade.addColorStop(1, "rgba(10,11,10,0.92)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, IMG_H - 96, W, 96);

  // information plate
  ctx.fillStyle = PLATE;
  ctx.fillRect(0, IMG_H, W, H - IMG_H);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fillRect(0, IMG_H, W, 1);

  // wordmark badge, legible over any frame
  ctx.font = `700 20px ${DISPLAY}`;
  const badgeW = 58 + ctx.measureText("CODM FILTER LAB").width;
  ctx.fillStyle = "rgba(7,8,7,0.82)";
  ctx.fillRect(36, 30, badgeW, 42);
  const cx = 56;
  const cy = 51;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 7);
  ctx.lineTo(cx + 7, cy);
  ctx.lineTo(cx, cy + 7);
  ctx.lineTo(cx - 7, cy);
  ctx.closePath();
  ctx.fillStyle = YELLOW;
  ctx.fill();
  ctx.fillStyle = YELLOW;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("CODM FILTER LAB", 76, 58);

  // left column — what the look is
  const nameText = name.toUpperCase();
  const nameSize = fitText(ctx, nameText, 620, 900, DISPLAY, 66, 30);
  ctx.font = `900 ${nameSize}px ${DISPLAY}`;
  ctx.fillStyle = TEXT;
  ctx.fillText(nameText, PAD, 512);

  ctx.font = `500 18px ${SANS}`;
  ctx.fillStyle = "rgba(233,236,230,0.66)";
  const lines = note ? wrapText(ctx, note, 620, 2) : [];
  lines.forEach((line, i) => ctx.fillText(line, PAD, 542 + i * 24));

  // the three tone colours, named — the look's fingerprint at a glance
  const chips: ZoneKey[] = ["shadows", "midtones", "highlights"];
  let chipX = PAD;
  chips.forEach((k) => {
    const { fill, on } = zoneColor(settings, k);
    ctx.fillStyle = fill;
    ctx.fillRect(chipX, 578, 20, 20);
    ctx.strokeStyle = on ? "rgba(0,0,0,0.4)" : "rgba(255,255,255,0.22)";
    ctx.lineWidth = 1;
    ctx.strokeRect(chipX + 0.5, 578.5, 19, 19);
    ctx.fillStyle = "rgba(233,236,230,0.55)";
    ctx.font = `500 12px ${SANS}`;
    const label = hueLabel(settings, k).toUpperCase();
    ctx.fillText(label, chipX + 28, 592);
    chipX += 34 + ctx.measureText(label).width + 20;
  });

  // right column — the code, as the thing you came for
  const rx = 712;
  const rw = W - rx - PAD;
  ctx.fillStyle = YELLOW;
  ctx.fillRect(rx, IMG_H + 22, 3, 132);

  ctx.fillStyle = MUTE;
  ctx.font = `700 12px ${DISPLAY}`;
  ctx.fillText("SHARE CODE", rx + 20, IMG_H + 42);

  ctx.font = `500 19px ${MONO}`;
  ctx.fillStyle = YELLOW;
  const codeLines = wrapCode(ctx, code, rw - 24, 3);
  codeLines.forEach((line, i) => ctx.fillText(line, rx + 20, IMG_H + 74 + i * 27));

  // where to paste it — the only call to action a card needs
  ctx.font = `500 13px ${MONO}`;
  ctx.fillStyle = "rgba(255,234,59,0.72)";
  ctx.fillText("codm.kuletxcore.workers.dev", rx + 20, IMG_H + 176);

  // a hairline frame, so the card reads as a plate
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  return canvas;
}

export function cardFileName(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `codm-${slug || "look"}-filter.png`;
}

export function hueLabel(settings: Settings, k: ZoneKey) {
  const z = settings.zones[k];
  if (z.tint < 3) return "neutral";
  const hp = hueParts(z.hue);
  return `${SWATCH_NAMES[hp.swatch]} ${Math.round(hp.pos)}`;
}
