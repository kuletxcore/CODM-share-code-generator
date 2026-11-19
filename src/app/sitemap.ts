import type { MetadataRoute } from "next";
import { LOOKS } from "@/lib/codm";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  // Built at build time, so the deploy date doubles as the last change date.
  const lastModified = new Date();
  return [
    { url: `${SITE}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    ...LOOKS.map((look) => ({
      url: `${SITE}/look/${look.slug}`,
      lastModified,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
