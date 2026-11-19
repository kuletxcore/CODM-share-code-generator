import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LookDetail from "@/components/LookDetail";
import { LOOKS, lookBySlug } from "@/lib/codm";
import { SITE } from "@/lib/site";

// A static export needs every look known at build time, which also means each
// one is a real, indexable page rather than a client-side route.
export const dynamicParams = false;

export function generateStaticParams() {
  return LOOKS.map((look) => ({ slug: look.slug }));
}

export async function generateMetadata({ params }: PageProps<"/look/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const look = lookBySlug(slug);
  if (!look) return {};
  const title = `${look.name} — CODM colour filter share code`;
  const description = `${look.note}. ${look.game ? `${look.game}. ` : ""}Copy the 22-number share code and import it in Call of Duty: Mobile. Free, fan-made, no account.`;
  return {
    title,
    description,
    alternates: { canonical: `${SITE}/look/${look.slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `${SITE}/look/${look.slug}`,
      siteName: "CODM Filter Lab",
      images: look.image
        ? [{ url: `${SITE}${look.image}`, width: 960, height: 439, alt: `${look.name} reference still` }]
        : undefined,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function LookPage({ params }: PageProps<"/look/[slug]">) {
  const { slug } = await params;
  const look = lookBySlug(slug);
  if (!look) notFound();
  return <LookDetail look={look} />;
}
