import { Metadata } from "next";

export function generateMeta({
  title,
  description,
  canonical
}: {
  title: string;
  description: string;
  canonical: string;
}): Metadata {
  const baseUrl = process.env.BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";

  return {
    title: `${title} - Dashboard`,
    description,
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical,
    },
    openGraph: {
      images: [`${baseUrl.replace(/\/$/, "")}/seo.png`],
    },
  };
}
