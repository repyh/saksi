import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PwaRuntime from "@/features/pwa/components/pwa-runtime";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  applicationName: "RUAS",
  title: "RUAS — Road condition reporting",
  description: "Community road reports compared with official road-condition data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <PwaRuntime />
      </body>
    </html>
  );
}
