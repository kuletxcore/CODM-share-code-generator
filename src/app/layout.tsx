import type { Metadata, Viewport } from "next";
import "@fontsource/jetbrains-mono/latin-500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "CODM Filter Lab",
  description:
    "Fan-made colour filter share-code generator for Call of Duty: Mobile. Build a filter with sliders, preview it, or turn a reference screenshot into a starting code.",
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
