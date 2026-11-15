/**
 * Compact, zero-dependency ISO/IEC 18004 QR Code encoder (Byte mode, ECC Level L,
 * Versions 1–10: up to 271 UTF-8 bytes — plenty for CODM share URLs & codes).
 */

export type QrMatrix = { size: number; modules: Uint8Array };

// Version 1..10 Level L: [totalCodewords, ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsGroup1, numBlocksGroup2, dataCodewordsGroup2]
const VERSION_L: [number, number, number, number, number, number][] = [
  [0, 0, 0, 0, 0, 0], // placeholder 0
  [26, 7, 1, 19, 0, 0], // v1 (17 bytes)
  [44, 10, 1, 34, 0, 0], // v2 (32 bytes)
  [70, 15, 1, 55, 0, 0], // v3 (53 bytes)
  [100, 20, 1, 80, 0, 0], // v4 (78 bytes)
  [134, 26, 1, 108, 0, 0], // v5 (106 bytes)
  [172, 18, 2, 68, 0, 0], // v6 (134 bytes)
  [196, 20, 2, 78, 0, 0], // v7 (154 bytes)
  [242, 24, 2, 97, 0, 0], // v8 (192 bytes)
  [292, 30, 2, 116, 0, 0], // v9 (230 bytes)
  [346, 18, 2, 68, 2, 69], // v10 (271 bytes)
];

const ALIGN_POS: number[][] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

// Version information bitstrings for versions 7..10
const VERSION_BITS: Record<number, number> = {
  7: 0x07c94,
  8: 0x085bc,
  9: 0x09a99,
  10: 0x0a4d3,
};

// Format info strings for Level L (01) and masks 0..7 (already XOR'd with 0x5412)
const FORMAT_BITS_L = [0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976];

// GF(256) log/antilog tables with primitive poly 0x11d
const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
{
  let v = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = v;
    GF_LOG[v] = i;
    v <<= 1;
    if (v & 0x100) v ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255];
}

function gfMul(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function rsGenerator(degree: number): Uint8Array {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const factor = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], factor);
    }
    poly = next;
  }
  return poly;
}

function rsRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = rsGenerator(ecLen);
  const rem = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ rem[0];
    rem.copyWithin(0, 1);
    rem[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return rem;
}

function encodeBytes(text: string): Uint8Array {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(text);
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

function maskBit(mask: number, r: number, c: number): boolean {
  switch (mask) {
    case 0:
      return (r + c) % 2 === 0;
    case 1:
      return r % 2 === 0;
    case 2:
      return c % 3 === 0;
    case 3:
      return (r + c) % 3 === 0;
    case 4:
      return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
    case 5:
      return ((r * c) % 2) + ((r * c) % 3) === 0;
    case 6:
      return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
    default:
      return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
  }
}

function penalty(mods: Uint8Array, size: number): number {
  let score = 0;
  // Rule 1: adjacent runs of same colour (rows & cols)
  for (let r = 0; r < size; r++) {
    let run = 1;
    for (let c = 1; c < size; c++) {
      if (mods[r * size + c] === mods[r * size + c - 1]) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }
  }
  for (let c = 0; c < size; c++) {
    let run = 1;
    for (let r = 1; r < size; r++) {
      if (mods[r * size + c] === mods[(r - 1) * size + c]) {
        run++;
        if (run === 5) score += 3;
        else if (run > 5) score += 1;
      } else {
        run = 1;
      }
    }
  }
  // Rule 2: 2x2 blocks
  for (let r = 0; r < size - 1; r++) {
    for (let c = 0; c < size - 1; c++) {
      const v = mods[r * size + c];
      if (
        v === mods[r * size + c + 1] &&
        v === mods[(r + 1) * size + c] &&
        v === mods[(r + 1) * size + c + 1]
      ) {
        score += 3;
      }
    }
  }
  // Rule 4: dark/light balance
  let dark = 0;
  for (let i = 0; i < mods.length; i++) if (mods[i]) dark++;
  const pct = (dark * 100) / mods.length;
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

export function generateQr(text: string): QrMatrix {
  const bytes = encodeBytes(text);

  // Pick smallest version 1..10 that fits in Byte mode (4-bit mode + 8/16-bit count + bytes)
  let version = 1;
  for (; version <= 10; version++) {
    const [, , b1, d1, b2, d2] = VERSION_L[version];
    const totalData = b1 * d1 + b2 * d2;
    const countBits = version < 10 ? 8 : 16;
    const neededBits = 4 + countBits + bytes.length * 8;
    if (neededBits <= totalData * 8) break;
  }
  if (version > 10) {
    throw new Error("QR payload exceeds version 10 capacity");
  }

  const [, ecPerBlock, b1, d1, b2, d2] = VERSION_L[version];
  const totalData = b1 * d1 + b2 * d2;
  const countBits = version < 10 ? 8 : 16;

  // Build data bit stream
  const bits: number[] = [];
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  pushBits(0b0100, 4); // Byte mode
  pushBits(bytes.length, countBits);
  for (let i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);
  // Terminator (up to 4 zeros)
  const capBits = totalData * 8;
  for (let i = 0; i < 4 && bits.length < capBits; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data = new Uint8Array(totalData);
  for (let i = 0; i < bits.length / 8; i++) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i * 8 + b];
    data[i] = byte;
  }
  // Pad bytes 0xEC, 0x11
  for (let i = bits.length / 8, k = 0; i < totalData; i++, k++) {
    data[i] = k % 2 === 0 ? 0xec : 0x11;
  }

  // Split into RS blocks & interleave
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  let offset = 0;
  for (let i = 0; i < b1; i++) {
    const blk = data.subarray(offset, offset + d1);
    dataBlocks.push(blk);
    ecBlocks.push(rsRemainder(blk, ecPerBlock));
    offset += d1;
  }
  for (let i = 0; i < b2; i++) {
    const blk = data.subarray(offset, offset + d2);
    dataBlocks.push(blk);
    ecBlocks.push(rsRemainder(blk, ecPerBlock));
    offset += d2;
  }

  const codewords: number[] = [];
  const maxDataLen = Math.max(d1, d2);
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of dataBlocks) if (i < blk.length) codewords.push(blk[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const blk of ecBlocks) codewords.push(blk[i]);
  }

  const size = version * 4 + 17;
  const base = new Uint8Array(size * size);
  const func = new Uint8Array(size * size);

  const setFunc = (r: number, c: number, dark: boolean) => {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    func[r * size + c] = 1;
    base[r * size + c] = dark ? 1 : 0;
  };

  // Finder patterns + separators
  const drawFinder = (tr: number, tc: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const rr = tr + dr;
        const cc = tc + dc;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inBox = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6;
        const dark =
          inBox &&
          (dr === 0 ||
            dr === 6 ||
            dc === 0 ||
            dc === 6 ||
            (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
        setFunc(rr, cc, dark);
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunc(6, i, i % 2 === 0);
    setFunc(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const aligns = ALIGN_POS[version];
  for (const ar of aligns) {
    for (const ac of aligns) {
      if (func[ar * size + ac]) continue;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
          setFunc(ar + dr, ac + dc, dark);
        }
      }
    }
  }

  // Reserve format info cells + dark module
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      setFunc(8, i, false);
      setFunc(i, 8, false);
    }
  }
  for (let i = 0; i < 8; i++) {
    setFunc(8, size - 1 - i, false);
    setFunc(size - 1 - i, 8, false);
  }
  setFunc(size - 8, 8, true); // mandatory dark module

  // Version info blocks (v7..10)
  if (version >= 7) {
    const vbits = VERSION_BITS[version];
    for (let i = 0; i < 18; i++) {
      const bit = ((vbits >>> i) & 1) === 1;
      const a = Math.floor(i / 3);
      const b = size - 11 + (i % 3);
      setFunc(a, b, bit);
      setFunc(b, a, bit);
    }
  }

  // Place data bits in upward/downward 2-column zig-zag
  let bitIdx = 0;
  const totalBits = codewords.length * 8;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    const upward = ((right + 1) & 2) === 0;
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (func[r * size + c]) continue;
        let bit = 0;
        if (bitIdx < totalBits) {
          bit = (codewords[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1;
          bitIdx++;
        }
        base[r * size + c] = bit;
      }
    }
  }

  const writeFormat = (mods: Uint8Array, mask: number) => {
    const fb = FORMAT_BITS_L[mask];
    for (let i = 0; i < 6; i++) mods[8 * size + i] = (fb >>> (14 - i)) & 1;
    mods[8 * size + 7] = (fb >>> 8) & 1;
    mods[8 * size + 8] = (fb >>> 7) & 1;
    mods[7 * size + 8] = (fb >>> 6) & 1;
    for (let i = 9; i < 15; i++) mods[(14 - i) * size + 8] = (fb >>> (14 - i)) & 1;

    for (let i = 0; i < 8; i++) mods[8 * size + (size - 1 - i)] = (fb >>> i) & 1;
    for (let i = 0; i < 7; i++) mods[(size - 1 - i) * size + 8] = (fb >>> (14 - i)) & 1;
    mods[(size - 8) * size + 8] = 1;
  };

  // Evaluate all 8 masks and pick the lowest penalty
  let bestMask = 0;
  let bestPenalty = Infinity;
  let bestMods = base;

  for (let m = 0; m < 8; m++) {
    const cand = new Uint8Array(base);
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!func[r * size + c] && maskBit(m, r, c)) {
          cand[r * size + c] ^= 1;
        }
      }
    }
    writeFormat(cand, m);
    const p = penalty(cand, size);
    if (p < bestPenalty) {
      bestPenalty = p;
      bestMask = m;
      bestMods = cand;
    }
  }
  void bestMask;

  return { size, modules: bestMods };
}

/** Render a crisp QR matrix directly onto any 2D canvas context. */
export function drawQr(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  boxSize: number,
  fg = "#0a0b0a",
  bg = "#ffffff",
) {
  const qr = generateQr(text);
  const quiet = 2;
  const total = qr.size + quiet * 2;
  const cell = boxSize / total;
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, boxSize, boxSize);
  ctx.fillStyle = fg;
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.modules[r * qr.size + c]) {
        ctx.fillRect(
          x + Math.floor((c + quiet) * cell),
          y + Math.floor((r + quiet) * cell),
          Math.ceil(cell),
          Math.ceil(cell),
        );
      }
    }
  }
}
