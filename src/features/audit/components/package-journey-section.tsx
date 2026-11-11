import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";

const steps = [
  {
    title: "Temukan ruas",
    description: "Cari nama kelurahan, jalan, atau nomor RUP di peta.",
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

export function PackageJourneySection({ regionId }: { regionId: string }) {
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
                  {index === 0 ? (
                    <Link
                      href={`/peta-pekerjaan?region=${encodeURIComponent(regionId)}`}
                      className="inline-flex min-h-8 items-center gap-2 text-primary underline decoration-primary/35 underline-offset-4 transition-colors hover:decoration-current focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {step.title}<FiArrowRight aria-hidden="true" className="size-4 shrink-0" />
                    </Link>
                  ) : (
                    step.title
                  )}
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                  {step.description}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-xl text-sm leading-6 text-muted-foreground">
            Menemukan jalan rusak di sekitar Anda? Laporkan dengan foto dan titik lokasi; laporan masuk antrean tinjauan sebelum tampil publik.
          </p>
          <Link
            href="/laporan"
            className="inline-flex min-h-12 shrink-0 items-center gap-3 bg-primary px-5 font-sans text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            Laporkan kerusakan jalan
            <FiArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
