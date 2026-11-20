import { DEFAULT_CODE, LOOKS, decode } from "./codm.ts";

/*
 * A duel is two share codes compared on one frame, so `#d=<a>~<b>` in the URL
 * shares the match instead of a single grade. Codes are digits and underscores
 * only, so `~` can never appear inside one.
 */

export type Duel = { a: string; b: string };

const SEP = "~";

export function encodeDuel(d: Duel): string {
  return `#d=${d.a}${SEP}${d.b}`;
}

/** Reads a duel out of a location hash; null unless both sides are real codes. */
export function decodeDuel(hash: string): Duel | null {
  const m = hash.match(/(?:^#|&)d=([-_\d~]+)/);
  if (!m) return null;
  const parts = m[1].split(SEP);
  if (parts.length !== 2) return null;
  const [a, b] = parts;
  if (!a || !b) return null;
  if (!decode(a) || !decode(b)) return null;
  if (a === b) return null;
  return { a, b };
}

/** Index of `code` in LOOKS, or -1 when it is a custom grade. */
export function lookIndex(code: string): number {
  return LOOKS.findIndex((l) => l.code === code);
}

export function lookName(code: string): string {
  const i = lookIndex(code);
  return i >= 0 ? LOOKS[i].name : "Custom grade";
}

export function lookNote(code: string): string {
  const i = lookIndex(code);
  return i >= 0 ? LOOKS[i].note : "Your own grade";
}

export function lookImage(code: string): string | undefined {
  const i = lookIndex(code);
  return i >= 0 ? LOOKS[i].image : undefined;
}

/**
 * The rival for `code`: a fixed pairing so the same look always meets the same
 * opponent (comparing a look with itself teaches nothing). Falls back through
 * the list if the natural rival is the code itself.
 */
export function rivalOf(code: string): string {
  const i = lookIndex(code);
  if (i < 0) return LOOKS[0].code;
  const rival = (i + 5) % LOOKS.length;
  return LOOKS[rival === i ? (i + 1) % LOOKS.length : rival].code;
}

/** A random rival, avoiding `code` and anything else on screen. */
export function randomRival(code: string, avoid: string[] = []): string {
  const pool = LOOKS.filter((l) => l.code !== code && !avoid.includes(l.code));
  const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)] : LOOKS[0];
  return pick.code;
}

/**
 * A pairing chosen to be worth looking at: one graded look against the plain
 * screen. LOOKS share a tonal structure, so two random looks often read the
 * same; a duel against Default shows what the grade actually does.
 */
export function openingPair(): Duel {
  // Default is a look in its own right, but it is the wrong candidate for the
  // left side: pairing it with itself would show a duel that isn't one.
  const graded = LOOKS.filter((l) => l.code !== DEFAULT_CODE);
  const pick = graded[Math.floor(Math.random() * graded.length)];
  return { a: pick.code, b: DEFAULT_CODE };
}
