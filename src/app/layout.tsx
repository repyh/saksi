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
        <Suspense fallback={<header aria-hidden="true" className="h-16 w-full bg-primary/90" />}>
          <Navbar />
        </Suspense>
        <div className="flex-1">
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
