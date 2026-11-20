import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const BASE = "https://codm.kuletxcore.workers.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
