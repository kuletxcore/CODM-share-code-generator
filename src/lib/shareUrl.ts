/** What the import guide needs to hand a grade to a phone or a look card. */
export type DeployPayload = {
  code: string;
  name?: string;
  note?: string;
  /** Reference image for the card (a look's still, or a snapshot of the preview). */
  image?: string;
};

/** Absolute link that restores this grade; the page reads `#c=<code>` on load. */
export function shareUrl(code: string, name?: string): string {
  if (typeof window === "undefined") return "";
  const label = name ? `&n=${encodeURIComponent(name)}` : "";
  return `${window.location.origin}${window.location.pathname}#c=${code}${label}`;
}
