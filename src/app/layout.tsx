import type { Metadata, Viewport } from "next";
import "./globals.css";

/**
 * Canonical origin. The site is a static export served from a Cloudflare Worker,
 * so there is no request host to derive this from at build time. Change it here
 * if the deployment moves; `openGraph.url` and the OG image URL depend on it.
 */
const SITE_URL = "https://codm.kuletxcore.workers.dev";

const DESCRIPTION =
  "Fan-made colour filter share-code generator for Call of Duty: Mobile. Build a filter with sliders, preview it, or turn a reference screenshot into a starting code.";

const TITLE = "CODM Filter Lab";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: TITLE,
  // The tool is shared as links (look codes, QR hand-off, look cards), so every
  // surface that expands a URL needs a card, not just the browser tab.
  openGraph: {
    type: "website",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "CODM Filter Lab: colour filter share codes for Call of Duty: Mobile",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
