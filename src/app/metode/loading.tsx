export default function MetodeLoading() {
  return (
    <main aria-busy="true" aria-label="Memuat halaman metode" className="min-h-screen bg-white text-foreground">
      <section className="bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="h-3 w-36 animate-pulse bg-muted" />
          <div className="mt-3 h-11 max-w-2xl animate-pulse bg-muted" />
          <div className="mt-5 h-5 max-w-xl animate-pulse bg-muted/80" />
        </div>
      </section>
      <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-28 animate-pulse border-y border-border bg-muted/20" />
      </section>
    </main>
  );
}
