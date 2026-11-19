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
  // the note usually names the game already; do not say it twice in a snippet
  const game = look.game && !look.note.includes(look.game) ? ` ${look.game}.` : "";
  const description = `${look.note}.${game} Copy the 22-number share code and import it in Call of Duty: Mobile. Free, fan-made, no account.`;
  // looks without a still still get a card image, so a shared link is never blank
  const image = look.image ?? "/looks/verdansk.webp";
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
      images: [{ url: `${SITE}${image}`, width: 960, height: 439, alt: `${look.name} look` }],
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
