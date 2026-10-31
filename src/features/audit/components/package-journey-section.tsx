const steps = [
  {
    title: "Temukan ruas",
    description: "Cari nama desa, jalan, atau nomor RUP di peta.",
  },
  {
    title: "Periksa paket",
    description: "Lihat pagu, satker, jadwal, dan tingkat presisi lokasinya.",
  },
  {
    title: "Rujuk nomor RUP",
    description: "Mulai laporan kerusakan dengan paket terkait sebagai rujukan.",
  },
];

export function PackageJourneySection() {
  return (
    <section aria-labelledby="package-journey-title" className="bg-muted/40">
      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <h2
          id="package-journey-title"
          className="max-w-3xl font-heading text-3xl leading-[1.15] font-extrabold tracking-[-0.035em] text-foreground sm:text-4xl"
        >
          Jalan rusak punya jejak anggaran.
        </h2>

        <ol className="mt-8 grid gap-7 border-t border-border pt-6 md:grid-cols-3 md:gap-8 lg:mt-10 lg:pt-7">
          {steps.map((step, index) => (
            <li key={step.title} className="grid grid-cols-[2rem_1fr] gap-3 sm:gap-4">
              <span aria-hidden="true" className="pt-0.5 font-sans text-sm font-bold tabular-nums text-primary">
                0{index + 1}
              </span>
              <div>
                <h3 className="text-base font-bold leading-6 text-foreground sm:text-lg">
                  {step.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

      </div>
    </section>
  );
}
