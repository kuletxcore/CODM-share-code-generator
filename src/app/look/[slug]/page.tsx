import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LookPage from "@/components/LookPage";
import { PAGE_LOOKS, lookSlug } from "@/lib/codm";

// A static export has to know every page at build time; an unknown slug is a 404.
export const dynamicParams = false;

const bySlug = (slug: string) => PAGE_LOOKS.find((l) => lookSlug(l) === slug);

export function generateStaticParams() {
  return PAGE_LOOKS.map((l) => ({ slug: lookSlug(l) }));
}

export async function generateMetadata({ params }: PageProps<"/look/[slug]">): Promise<Metadata> {
  const look = bySlug((await params).slug);
  if (!look) return {};
  const title = `${look.name} · CODM filter share code`;
  const description = `${look.note} Copy the 22-number share code and import it in Call of Duty: Mobile. Unofficial fan-made tool.`;
  const url = `/look/${lookSlug(look)}`;
  // A look without its own still gets the site's card, never another look's image.
  const image = look.image
    ? { url: look.image, width: 960, height: 439, alt: `${look.name}` }
    : { url: "/og.jpg", width: 1200, height: 630, alt: "CODM Filter Lab, an unofficial fan-made filter tool" };
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "article", siteName: "CODM Filter Lab", title, description, url, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}

export default async function Page({ params }: PageProps<"/look/[slug]">) {
  const look = bySlug((await params).slug);
  if (!look) notFound();
  return <LookPage look={look} />;
}
