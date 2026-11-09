import type { Metadata } from "next";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";
import { getLegalDoc } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan | SAKSI",
  description: "Ketentuan penggunaan SAKSI untuk menelusuri paket jalan dan membuat laporan kerusakan.",
};

export default async function TermsPage() {
  const content = await getLegalDoc("terms");

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">SAKSI · Informasi hukum</p>
      <MarkdownRenderer content={content} className="mt-4" />
    </main>
  );
}
