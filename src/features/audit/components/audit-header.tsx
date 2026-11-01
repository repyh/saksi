"use client";

import Image from "next/image";
import { type FormEvent, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { CoverageSection } from "./coverage-section";
import type { AuditSummaryMetrics } from "../audit-types";
import { dispatchMapSearch } from "@/features/map/map-search-events";

interface AuditHeaderProps {
  metrics?: AuditSummaryMetrics;
}

export const DEFAULT_KOTA_TANGERANG_METRICS: AuditSummaryMetrics = {
  regionName: "Kota Tangerang",
  snapshotDate: "31 OKT 2026",
  fiscalYears: [2025, 2026],
  totalPackages: 1557,
  packagesByYear: { y2025: 939, y2026: 618 },
  totalBudgetDisplay: "Rp650,18 M",
  coveredKelurahan: 80,
  totalKelurahan: 104,
  totalDistricts: 13,
  mappedCount: 1155,
  mappedPercent: "74,2%",
  spatial: {
    rwPackages: 818,
    kelurahanPackages: 337,
    unmappedPackages: 402,
  },
};

export function AuditHeader({ metrics = DEFAULT_KOTA_TANGERANG_METRICS }: AuditHeaderProps) {
  const [heroQuery, setHeroQuery] = useState("");
  const {
    regionName,
    fiscalYears,
    totalPackages,
    packagesByYear,
    totalBudgetDisplay,
  } = metrics;

  const [budgetAmount, budgetUnit = ""] = totalBudgetDisplay.split(/\s+([\s\S]*)/);

  function handleHeroSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    dispatchMapSearch(heroQuery.trim());
  }

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
              <form
                onSubmit={handleHeroSearch}
                role="search"
                className="mx-auto mt-7 flex min-h-14 w-full max-w-2xl items-center gap-3 border border-white/80 bg-white/95 px-4 text-left text-foreground transition-colors focus-within:border-secondary sm:gap-4 sm:px-5"
              >
                <FiSearch className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <input
                  type="search"
                  value={heroQuery}
                  onChange={(event) => setHeroQuery(event.target.value)}
                  aria-label="Cari paket berdasarkan desa, ruas jalan, atau nomor RUP"
                  placeholder="Cari desa, ruas jalan, atau nomor RUP"
                  className="h-12 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground sm:text-base"
                />
                <button
                  type="submit"
                  aria-label="Cari di peta"
                  className="flex h-10 shrink-0 items-center justify-center bg-primary px-4 text-sm font-bold text-white transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  Cari
                </button>
              </form>
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
