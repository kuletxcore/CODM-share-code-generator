import type { Metadata, Viewport } from "next";
import "./globals.css";

const title = "CODM Filter Lab";
const description =
  "Fan-made colour filter share codes for Call of Duty: Mobile. See each filter on a game frame, copy its code, tune your own, or turn a reference screenshot into a starting code.";

export const metadata: Metadata = {
  // links to a filter get passed around in chats, so they need a preview card (image: opengraph-image.jpg)
  metadataBase: new URL("https://codm.kuletxcore.workers.dev"),
  title,
  description,
  openGraph: { type: "website", url: "/", siteName: title, title, description },
  twitter: { card: "summary_large_image", title, description },
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
