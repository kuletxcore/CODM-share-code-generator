import type { MetadataRoute } from "next";

// Static export: the manifest is generated at build time, like every other page.
export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CODM Filter Lab",
    short_name: "Filter Lab",
    description:
      "Colour filter share codes for Call of Duty: Mobile: pick a look, build your own, or turn a screenshot into a code. Works offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a0b0a",
    theme_color: "#0a0b0a",
    orientation: "any",
    categories: ["utilities", "games"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Build a filter", url: "/#editor" },
      { name: "Screenshot → Code", url: "/#editor" },
    ],
  };
}
