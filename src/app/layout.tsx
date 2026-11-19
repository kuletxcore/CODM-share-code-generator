import type { Metadata, Viewport } from "next";
import { SITE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "CODM Filter Lab — colour filter share codes",
  description:
    "Fan-made colour filter share-code generator for Call of Duty: Mobile. Copy a ready-made look, build your own with a live preview, or turn a reference screenshot into a starting code. Free, no account, nothing uploaded.",
  applicationName: "CODM Filter Lab",
  keywords: [
    "CODM filter code",
    "Call of Duty Mobile filter share code",
    "CODM colour filter",
    "graphic style import code",
    "Warzone Mobile filter",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "CODM Filter Lab",
    title: "CODM Filter Lab — colour filter share codes",
    description:
      "Copy a ready-made look, build your own, or turn a screenshot into a share code. Everything runs in your browser.",
    images: [{ url: "/looks/verdansk.webp", width: 960, height: 439, alt: "A graded Call of Duty: Mobile scene" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CODM Filter Lab — colour filter share codes",
    description: "Copy a ready-made look, build your own, or turn a screenshot into a share code.",
  },
  robots: { index: true, follow: true },
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
