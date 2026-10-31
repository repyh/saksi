import Link from "next/link";
import Image from "next/image";
import { FiArrowDownRight } from "react-icons/fi";
import { CoverageSection } from "./coverage-section";
import type { AuditSummaryMetrics } from "../audit-types";

interface AuditHeaderProps {
  metrics?: AuditSummaryMetrics;
}

export const DEFAULT_TANGERANG_METRICS: AuditSummaryMetrics = {
  regionName: "Kab. Tangerang",
  kldiCode: "D50",
  bpsCode: "3603",
  snapshotDate: "29 OKT 2026",
  fiscalYears: [2025, 2026],
  totalPackages: 3602,
  packagesByYear: { y2025: 2156, y2026: 1446 },
  totalBudgetBillionRp: "Rp848,60 Miliar",
  medianBudgetMillionRp: "Rp100,00 jt",
  coveredVillages: 251,
  totalVillages: 274,
  totalDistricts: 29,
  mappedCount: 3331,
  mappedPercent: "92,5%",
  spatial: {
    villagePoints: 3000,
    corridorLines: 102,
    districtCentroids: 229,
    unmappedPackages: 271,
  },
};

export function AuditHeader({ metrics = DEFAULT_TANGERANG_METRICS }: AuditHeaderProps) {
  const {
    regionName,
    fiscalYears,
    totalPackages,
    packagesByYear,
    totalBudgetBillionRp,
  } = metrics;

  const [budgetAmount, budgetUnit = ""] = totalBudgetBillionRp.split(/\s+([\s\S]*)/);

  return (
    <>
      <section aria-labelledby="audit-masthead-title" className="bg-white">
        <div className="w-full">
        <figure className="relative isolate flex min-h-[520px] items-center justify-center overflow-hidden bg-foreground px-5 py-20 text-center text-white sm:min-h-[600px] sm:px-8 lg:min-h-[680px]">
            <Image
              src="/images/saksi/hero-jakarta-road.jpg"
              alt="Jalan utama Jakarta dilihat dari atas, dengan kendaraan melintas di beberapa jalur."
              fill
              priority
              sizes="100vw"
              className="-z-20 object-cover object-[center_55%]"
            />
            <div aria-hidden="true" className="absolute inset-0 -z-10 bg-foreground/55" />
            <div className="mx-auto max-w-5xl">
              <h1 id="audit-masthead-title" className="font-heading text-4xl leading-[1.05] font-extrabold tracking-[-0.035em] text-white sm:text-6xl lg:text-[4.75rem]">
                Dana ini ke mana? Kok jalan di depan <span className="box-decoration-clone bg-primary px-2 text-secondary">masih rusak?</span>
              </h1>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-white/90 sm:text-lg sm:leading-8">
                Telusuri paket pekerjaan jalan di {regionName}, lalu cocokkan data anggaran dengan kondisi ruas yang Anda temui.
              </p>
              <Link
                href="#jelajahi"
                className="mt-7 inline-flex min-h-11 items-center gap-3 border-b-2 border-secondary pb-1 text-base font-bold text-white transition-colors hover:text-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                Telusuri paket jalan <FiArrowDownRight className="size-4 text-secondary" aria-hidden="true" />
              </Link>
            </div>
            <figcaption className="absolute right-4 bottom-4 left-4 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[11px] leading-4 text-white/80 sm:justify-between">
              <span>Foto ilustrasi · Jakarta</span>
              <a
                href="https://unsplash.com/photos/an-overhead-view-of-a-city-street-with-lots-of-traffic-vfg8CJZxSUs"
                target="_blank"
                rel="noreferrer"
                className="underline decoration-white/50 underline-offset-2 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                David Kristianto / Unsplash
              </a>
            </figcaption>
          </figure>

          <div className="border-t-[6px] border-secondary bg-primary text-white">
            <div className="mx-auto grid w-full max-w-6xl gap-7 px-5 py-7 sm:px-8 sm:py-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-12 lg:px-10 lg:py-9">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-secondary">Belanja jalan · {fiscalYears[0]}–{fiscalYears[1]}</p>
              <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-0 font-heading font-extrabold tracking-[-0.035em]">
                <span className="text-4xl leading-none sm:text-5xl lg:text-[3.5rem]">{budgetAmount}</span>
                {budgetUnit && <span className="text-xl leading-none text-white/85 sm:text-2xl">{budgetUnit}</span>}
              </p>
            </div>
            <div className="grid grid-cols-3 gap-x-3 sm:gap-x-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/65">Total</p>
                <p className="mt-1 font-sans text-xl font-bold tabular-nums sm:text-2xl">{totalPackages.toLocaleString("id-ID")}</p>
                <p className="text-sm text-white/75">paket</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/65">2025</p>
                <p className="mt-1 font-sans text-xl font-bold tabular-nums sm:text-2xl">{packagesByYear.y2025.toLocaleString("id-ID")}</p>
                <p className="text-sm text-white/75">paket</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/65">2026</p>
                <p className="mt-1 font-sans text-xl font-bold tabular-nums sm:text-2xl">{packagesByYear.y2026.toLocaleString("id-ID")}</p>
                <p className="text-sm text-white/75">paket</p>
              </div>
            </div>
            </div>
          </div>
        </div>
      </section>
      <CoverageSection metrics={metrics} />
    </>
  );
}
