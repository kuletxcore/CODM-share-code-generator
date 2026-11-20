import type { Metadata, Viewport } from "next";
import "./globals.css";

const TITLE = "CODM Filter Lab";
const DESCRIPTION =
  "Fan-made colour filter share-code generator for Call of Duty: Mobile. Build a filter with sliders, preview it, or turn a reference screenshot into a starting code.";
const OG = { url: "/og.jpg", width: 1200, height: 630, alt: "CODM Filter Lab, an unofficial fan-made filter tool" };

// Codes travel as links in chats and the QR hand-off, so the page needs a
// preview card. A static export has no request host, hence the fixed origin.
export const metadata: Metadata = {
  metadataBase: new URL("https://codm.kuletxcore.workers.dev"),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: TITLE, title: TITLE, description: DESCRIPTION, url: "/", images: [OG] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [OG.url] },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
