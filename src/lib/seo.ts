import type { Metadata } from "next";

export const SITE_NAME = "SAKSI";
export const SITE_DESCRIPTION =
  "Telusuri paket pekerjaan jalan, sebaran wilayah, dan rekam kontrak publik di Kota Tangerang.";

export function getSiteOrigin(): URL {
  const vercelProductionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const vercelUrl = process.env.VERCEL_URL;
  const configuredUrl =
    process.env.SITE_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    (vercelProductionUrl ? `https://${vercelProductionUrl}` : undefined) ||
    (vercelUrl ? `https://${vercelUrl}` : undefined) ||
    "https://saksi.repyh.my.id";
  const siteUrl = new URL(configuredUrl);

  if (siteUrl.protocol !== "https:" && siteUrl.protocol !== "http:") {
    throw new Error("SITE_URL must use HTTP or HTTPS.");
  }
  if (siteUrl.username || siteUrl.password) {
    throw new Error("SITE_URL must not include credentials.");
  }

  return new URL(siteUrl.origin);
}

export function getRobotsMetadata(index = true): NonNullable<Metadata["robots"]> {
  if (!index || process.env.VERCEL_ENV === "preview") {
    return { index: false, follow: false };
  }

  return {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  };
}

interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;
  index?: boolean;
  /** Pakai `summary` untuk kartu tanpa gambar; `summary_large_image` hanya bila ada gambar. */
  shareImage?: boolean;
}

export function createPageMetadata({
  title,
  description,
  path,
  index = true,
  shareImage = false,
}: PageMetadataOptions): Metadata {
  const canonicalUrl = path;
  const shareTitle = `${title} | ${SITE_NAME}`;
  // OG image config, retained for later: { url: "/opengraph-image", width: 1200, height: 630 }.

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    robots: getRobotsMetadata(index),
    openGraph: {
      type: "website",
      locale: "id_ID",
      siteName: SITE_NAME,
      title: shareTitle,
      description,
      url: canonicalUrl,
      // images: [image],
    },
    twitter: {
      card: shareImage ? "summary_large_image" : "summary",
      title: shareTitle,
      description,
      // images: [image],
    },
  };
}

export function absoluteSiteUrl(path: string): string {
  return new URL(path, getSiteOrigin()).toString();
}
