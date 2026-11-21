import type { MetadataRoute } from "next";
import { PAGE_LOOKS, lookSlug } from "@/lib/codm";

export const dynamic = "force-static";

const SITE = "https://codm.kuletxcore.workers.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE}/` }, ...PAGE_LOOKS.map((l) => ({ url: `${SITE}/look/${lookSlug(l)}` }))];
}
