import { MarkdownRenderer } from "@/components/markdown/markdown-renderer";
import { getLegalDoc } from "@/lib/legal-content";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Syarat & Ketentuan",
  description: "Ketentuan penggunaan SAKSI untuk menelusuri paket jalan dan mengirim laporan kerusakan.",
  path: "/syarat-ketentuan",
});

export default async function TermsPage() {
  const content = await getLegalDoc("terms");

  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">SAKSI · Informasi hukum</p>
      <MarkdownRenderer content={content} className="mt-4" />
    </main>
  );
}
