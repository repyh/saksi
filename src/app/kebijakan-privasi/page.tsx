import type { Metadata } from "next";
import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";
import { getLegalDoc } from "@/lib/legal-content";

export const metadata: Metadata = {
  title: "Kebijakan Privasi | SAKSI",
  description: "Cara SAKSI menangani data akun, laporan kerusakan jalan, dan bukti foto.",
};

export default async function PrivacyPage() {
  const content = await getLegalDoc("privacy");

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">SAKSI · Informasi hukum</p>
      <MarkdownRenderer content={content} className="mt-4" />
    </main>
  );
}
