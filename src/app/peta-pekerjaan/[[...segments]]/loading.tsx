export default function MapPageLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Memuat peta pekerjaan"
      className="min-h-[calc(100dvh-4rem)] w-full bg-white lg:flex lg:h-[calc(100dvh-4rem)] lg:flex-col lg:overflow-hidden"
    >
      <div className="h-14 shrink-0 border-b border-border bg-muted/20 px-4 py-3">
        <div className="h-7 max-w-4xl animate-pulse bg-muted/70" />
      </div>
      <div className="grid min-h-[580px] flex-1 grid-cols-1 lg:grid-cols-12">
        <div className="hidden border-r border-border bg-white p-4 lg:col-span-3 lg:block">
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse border border-border bg-muted/20" />
            ))}
          </div>
        </div>
        <div className="bg-muted/25 lg:col-span-9" />
      </div>
    </main>
  );
}
