import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="grid min-h-[calc(100dvh-4rem)] place-items-center bg-background px-4 py-16 text-foreground">
      <section className="w-full max-w-md border border-border bg-card p-6 text-center sm:p-8">
        <p className="font-heading text-sm font-black uppercase tracking-[0.28em] text-primary">SAKSI</p>
        <h1 className="mt-3 font-heading text-3xl font-bold tracking-[-0.03em]">Anda sedang offline</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Peta dan pengiriman laporan memerlukan koneksi. Draf di perangkat tidak hilang; kirim setelah koneksi kembali.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Coba lagi
        </Link>
      </section>
    </main>
  );
}
