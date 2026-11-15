import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static HTML/JS export, served as Cloudflare Worker static assets.
  output: "export",
  images: { unoptimized: true },
  allowedDevOrigins: ["*.e2b.app"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
