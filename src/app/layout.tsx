import type { Metadata, Viewport } from "next";
import "./globals.css";

const BASE = "https://codm.kuletxcore.workers.dev";
const TITLE = "CODM Filter Lab — colour filter share codes";
const DESCRIPTION =
  "Copy ready-made Call of Duty: Mobile colour filter share codes, or build your own with a live preview. Turn a screenshot into a starting code. Free, fan-made, no sign-up.";

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "CODM Filter Lab",
  keywords: [
    "CODM filter code",
    "Call of Duty Mobile colour filter",
    "CODM share code",
    "CODM filter generator",
    "COD Mobile graphic style code",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: BASE,
    siteName: "CODM Filter Lab",
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/looks/og.png",
        width: 1424,
        height: 752,
        alt: "CODM Filter Lab — colour filter share codes for Call of Duty: Mobile",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/looks/og.png"],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
