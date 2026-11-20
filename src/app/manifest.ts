import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CODM Filter Lab — share code generator",
    short_name: "Filter Lab",
    description:
      "Build, preview and copy colour filter share codes for Call of Duty: Mobile.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0b0a",
    theme_color: "#0a0b0a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
