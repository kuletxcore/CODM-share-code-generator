/** What the import guide needs to hand a grade to a phone or a look card. */
export type DeployPayload = {
  code: string;
  name?: string;
  note?: string;
  /** Reference image for the card (a look's still, or a snapshot of the preview). */
  image?: string;
  /** "screen-test" marks a card made from the visitor's own graded frame. */
  source?: "screen-test";
};

/**
 * The URL hash carries the grade, and optionally a second grade pinned beside
 * it for comparison: `#c=<code>` or `#c=<code>&p=<code>`. Only the shape is
 * checked here; the strict codec decides whether each code is valid.
 */
export function readHash(hash: string): { code: string | null; pin: string | null } {
  const m = hash.match(/^#c=([-\d_]+)(?:&p=([-\d_]+))?$/);
  return { code: m?.[1] ?? null, pin: m?.[2] ?? null };
}

export function hashFor(code: string, pin?: string | null): string {
  return pin ? `#c=${code}&p=${pin}` : `#c=${code}`;
}

/** Absolute link that restores this grade (and the pinned one, if any). */
export function shareUrl(code: string, pin?: string | null): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/${hashFor(code, pin)}`;
}
