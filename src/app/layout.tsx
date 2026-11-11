import type { Metadata } from "next";
import { Suspense } from "react";
import { Raleway, Open_Sans } from "next/font/google";
import { Navbar } from "@/components/navbar";
import { SiteFooter } from "@/components/navigation/site-footer";
import PwaRuntime from "@/features/pwa/components/pwa-runtime";
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
  applicationName: "SAKSI",
  title: "SAKSI — Sistem Akuntabilitas & Komparasi Spasial Infrastruktur",
  description: "Platform pelaporan warga dan audit silang anggaran jalan Kota Tangerang.",
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
        <Suspense fallback={<header aria-hidden="true" className="h-16 w-full bg-primary/90" />}>
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
