import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CODM Filter Lab — share code generator",
    short_name: "Filter Lab",
    description:
      "Fan-made colour filter share-code generator for Call of Duty: Mobile. Copy a look, build a grade, or turn a screenshot into a code.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0a0b0a",
    theme_color: "#0a0b0a",
    categories: ["utilities", "games"],
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
    shortcuts: [
      { name: "Copy a look", short_name: "Looks", url: "/#look=Hajin" },
      { name: "Screenshot to code", short_name: "Convert", url: "/#editor" },
    ],
  };
}
