#!/usr/bin/env node
/**
 * Draws the install icons with no image library: a PNG is a header, a zlib
 * stream and a CRC, all of which Node ships.
 *
 * The mark is the one the site already uses everywhere else — a CODM-yellow
 * diamond (the rotated square beside every "unofficial fan-made" label) on the
 * page's ink, with the diamond hollowed out so the cut-corner motif reads at
 * small sizes.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const INK = [10, 11, 10];
const YELLOW = [255, 234, 59];

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // no filter
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y, size);
      const i = row + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Antialiased diamond test in pixel space. */
function diamond(x, y, size, half, inset = 0) {
  const cx = size / 2;
  const cy = size / 2;
  const d = Math.abs(x + 0.5 - cx) + Math.abs(y + 0.5 - cy);
  const outer = half - inset;
  return { inside: d <= outer, edge: Math.max(0, Math.min(1, outer - d + 0.5)) };
}

function mark(size, half) {
  return (x, y, s) => {
    const outer = diamond(x, y, s, half);
    const inner = diamond(x, y, s, half * 0.52);
    const hole = inner.edge;
    const alphaOuter = outer.edge * (1 - hole);
    // a hairline gap between the diamond and its core keeps the shape legible
    const gap = hole * 0.0;
    const mix = Math.max(0, alphaOuter - gap);
    return [
      Math.round(INK[0] + (YELLOW[0] - INK[0]) * mix),
      Math.round(INK[1] + (YELLOW[1] - INK[1]) * mix),
      Math.round(INK[2] + (YELLOW[2] - INK[2]) * mix),
      255,
    ];
  };
}

const files = [
  ["icon-192.png", 192, mark(192, 192 * 0.44)],
  ["icon-512.png", 512, mark(512, 512 * 0.44)],
  // maskable: the safe zone is the middle 80%, so the mark shrinks
  ["maskable-512.png", 512, mark(512, 512 * 0.34)],
];

for (const [name, size, pixel] of files) {
  writeFileSync(join(outDir, name), png(size, pixel));
  console.log(`wrote public/icons/${name}`);
}
