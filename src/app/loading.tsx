export default function HomeLoading() {
  return (
    <main aria-busy="true" aria-label="Memuat beranda" className="min-h-screen bg-white text-foreground">
      <section className="border-b border-border bg-muted/20">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="h-3 w-40 animate-pulse bg-muted" />
          <div className="mt-4 h-10 max-w-2xl animate-pulse bg-muted" />
          <div className="mt-4 h-5 max-w-xl animate-pulse bg-muted/80" />
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse border border-border bg-white p-4" />
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-7 w-72 animate-pulse bg-muted" />
        <div className="mt-6 h-72 animate-pulse border border-border bg-muted/30" />
      </section>
    </main>
  );
}
