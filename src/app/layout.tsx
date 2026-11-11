import type { Metadata } from "next";
import { Suspense } from "react";
import { Raleway, Open_Sans } from "next/font/google";
import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/navigation/site-footer";
import PwaRuntime from "@/features/pwa/components/pwa-runtime";
import { getRobotsMetadata, getSiteOrigin, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";
import "./globals.css";

const raleway = Raleway({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const openSans = Open_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: getSiteOrigin(),
  applicationName: SITE_NAME,
  title: {
    default: "SAKSI — Sistem Akuntabilitas & Komparasi Spasial Infrastruktur",
    template: "%s | SAKSI",
  },
  description: SITE_DESCRIPTION,
  alternates: { canonical: "/" },
  robots: getRobotsMetadata(),
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: SITE_NAME,
    title: "SAKSI — Sistem Akuntabilitas & Komparasi Spasial Infrastruktur",
    description: SITE_DESCRIPTION,
    url: "/",
    // images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "SAKSI — peta dan audit anggaran jalan Kota Tangerang" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SAKSI — Sistem Akuntabilitas & Komparasi Spasial Infrastruktur",
    description: SITE_DESCRIPTION,
    // images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${raleway.variable} ${openSans.variable} h-full antialiased`}>
      <body className="min-h-full font-sans bg-background text-foreground flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:bg-secondary focus:px-4 focus:py-3 focus:text-sm focus:font-bold focus:text-secondary-foreground focus:outline-2 focus:outline-offset-2 focus:outline-primary"
        >
          Lewati ke konten utama
        </a>
        <Suspense
          fallback={(
            <header aria-hidden="true" className="h-16 w-full border-b border-white/25 bg-primary">
              <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
                <span className="font-heading text-sm font-black uppercase tracking-[0.28em] text-white">SAKSI</span>
                <span className="h-9 w-20 animate-pulse bg-white/15" />
              </div>
            </header>
          )}
        >
          <Navbar />
        </Suspense>
        <div id="main-content" tabIndex={-1} className="flex-1 scroll-mt-16 focus:outline-none">
          {children}
        </div>
        <Suspense fallback={null}>
          <SiteFooter />
        </Suspense>
        <PwaRuntime />
      </body>
    </html>
  );
}
