import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE = "https://codm.kuletxcore.workers.dev";
const TITLE = "CODM Filter Lab — share code generator";
const DESC =
  "Fan-made colour filter share-code generator for Call of Duty: Mobile. Copy a ready-made look, build a filter, or turn a reference screenshot into a starting code — all in your browser.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: `%s · CODM Filter Lab` },
  description: DESC,
  applicationName: "CODM Filter Lab",
  keywords: ["CODM", "Call of Duty Mobile", "filter", "share code", "graphic style", "colour grade"],
  openGraph: {
    type: "website",
    url: "/",
    siteName: "CODM Filter Lab",
    title: TITLE,
    description: DESC,
    locale: "en_PH",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0a",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "CODM Filter Lab",
  description: DESC,
  url: SITE,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  offers: { "@type": "Offer", price: "0", priceCurrency: "PHP" },
  disclaimer: "Unofficial fan-made tool. Not affiliated with Activision, TiMi Studio Group or Tencent.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preload"
          href="/fonts/HitmarkerCondensed-Bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/HitmarkerText-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/ObelMono-VF.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
