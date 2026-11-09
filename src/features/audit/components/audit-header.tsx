"use client";

import Image from "next/image";
import { CoverageSection } from "./coverage-section";
import { PackageSearchForm } from "./package-search-form";
import type { AuditSummaryMetrics } from "@/contracts/audit/audit-summary.contract";

interface AuditHeaderProps {
  metrics: AuditSummaryMetrics;
}

export function AuditHeader({ metrics }: AuditHeaderProps) {
  const {
    regionName,
    snapshotDate,
    snapshotSource,
    fiscalYears,
    totalPackages,
    packagesByYear,
    totalBudgetDisplay,
  } = metrics;

  const [budgetAmount, budgetUnit = ""] = totalBudgetDisplay.split(/\s+([\s\S]*)/);

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
              <div className="mt-7">
                <PackageSearchForm inputId="hero-package-search" />
              </div>
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
              <p className="mt-2 text-xs leading-5 text-white/70">
                Snapshot {snapshotDate} · {snapshotSource}
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
