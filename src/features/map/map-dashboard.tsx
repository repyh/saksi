"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatPrecisionBadgeLabel,
  formatRupiahFull,
} from "./road-types";
import { MapIntroSection } from "./map-intro-section";
import { fetchRoadPackages } from "./package-api";
import type {
  RoadPackageItem,
  RoadPackageSearchData,
  RoadWorkCategory,
} from "@/contracts/packages/road-package.contract";

const MapCanvas = dynamic(() => import("./map-canvas"), {
  ssr: false,
  loading: () => <div className="h-[580px] w-full bg-muted/40" />,
});

const WORK_OPTIONS: RoadWorkCategory[] = ["SEMUA", "PERMUKAAN", "DRAINASE", "JEMBATAN"];
const WORK_LABELS: Record<RoadWorkCategory, string> = {
  SEMUA: "Semua pekerjaan",
  PERMUKAAN: "Permukaan jalan",
  DRAINASE: "Drainase / penahan",
  JEMBATAN: "Jembatan",
};

interface MapDashboardProps {
  initialData: RoadPackageSearchData;
}

export default function MapDashboard({ initialData }: MapDashboardProps) {
  const [packageData, setPackageData] = useState<RoadPackageSearchData | null>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<"SEMUA" | "2025" | "2026">("SEMUA");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("SEMUA");
  const [selectedWork, setSelectedWork] = useState<RoadWorkCategory>("SEMUA");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPackage, setSelectedPackage] = useState<RoadPackageItem | null>(null);
  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedYear !== "SEMUA") params.set("year", selectedYear);
    if (selectedDistrict !== "SEMUA") params.set("district", selectedDistrict);
    if (selectedWork !== "SEMUA") params.set("work", selectedWork);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    return params.toString();
  }, [selectedYear, selectedDistrict, selectedWork, searchQuery]);

  const lastRequestedQuery = useRef(queryString);
  useEffect(() => {
    if (lastRequestedQuery.current === queryString) return;
    lastRequestedQuery.current = queryString;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      setLoadError(null);
      setSelectedPackage(null);

      fetchRoadPackages(
        {
          year: selectedYear === "SEMUA" ? undefined : selectedYear,
          district: selectedDistrict === "SEMUA" ? undefined : selectedDistrict,
          work: selectedWork,
          query: searchQuery.trim() || undefined,
        },
        controller.signal,
      )
        .then(setPackageData)
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setPackageData(null);
            setLoadError(error instanceof Error ? error.message : "Data paket jalan belum dapat dimuat.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setIsLoading(false);
        });
    }, searchQuery.trim() ? 180 : 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [queryString, searchQuery, selectedDistrict, selectedWork, selectedYear]);

  const districts = packageData?.districts ?? [];
  const filteredPackages = packageData?.items ?? [];
  const totalCount = packageData?.totalCount ?? 0;
  const filteredCount = packageData?.filteredCount ?? 0;

  const hasActiveFilter =
    selectedYear !== "SEMUA" ||
    selectedDistrict !== "SEMUA" ||
    selectedWork !== "SEMUA" ||
    searchQuery.trim().length > 0;

  return (
    <>
      <MapIntroSection searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      <section aria-label="Jelajahi paket jalan" className="bg-white pt-8 pb-12 sm:pt-10">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <Card className="overflow-hidden rounded-xs border-border bg-white shadow-none">
          <div className="grid gap-2 border-b border-border bg-muted/20 p-2.5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-3 sm:py-2">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 xl:grid-cols-[132px_220px_220px] xl:gap-2">
              <div className="flex min-w-0 flex-col gap-0.5 px-1 py-0.5">
                <span className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">TA</span>
                <Select value={selectedYear} onValueChange={(val) => setSelectedYear((val ?? "SEMUA") as "SEMUA" | "2025" | "2026")}>
                  <SelectTrigger aria-label="Tahun anggaran" className="h-7 w-full min-w-0 border-0 bg-transparent px-1 text-xs font-semibold shadow-none">
                    <SelectValue>{selectedYear === "SEMUA" ? "Semua tahun" : selectedYear}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEMUA">Semua tahun</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 px-1 py-0.5">
                <span className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Wilayah</span>
                <Select value={selectedDistrict} onValueChange={(val) => setSelectedDistrict(val ?? "SEMUA")}>
                  <SelectTrigger aria-label="Pilih kecamatan" className="h-7 w-full min-w-0 border-0 bg-transparent px-1 text-xs font-semibold shadow-none">
                    <SelectValue>{selectedDistrict === "SEMUA" ? "Semua kecamatan" : selectedDistrict}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEMUA">Semua kecamatan</SelectItem>
                    {districts.map((kec) => <SelectItem key={kec} value={kec}>{kec}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex min-w-0 flex-col gap-0.5 px-1 py-0.5 sm:col-span-1">
                <span className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jenis</span>
                <Select value={selectedWork} onValueChange={(val) => setSelectedWork((val ?? "SEMUA") as RoadWorkCategory)}>
                  <SelectTrigger aria-label="Jenis pekerjaan" className="h-7 w-full min-w-0 border-0 bg-transparent px-1 text-xs font-semibold shadow-none">
                    <SelectValue>{WORK_LABELS[selectedWork]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_OPTIONS.map((work) => <SelectItem key={work} value={work}>{WORK_LABELS[work]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div aria-live="polite" className="flex items-center justify-between gap-2 border-t border-border pt-1.5 font-sans text-[11px] text-muted-foreground sm:justify-end sm:border-t-0 sm:pt-0">
              {hasActiveFilter && <Button type="button" variant="ghost" size="xs" onClick={() => { setSelectedYear("SEMUA"); setSelectedDistrict("SEMUA"); setSelectedWork("SEMUA"); setSearchQuery(""); }} className="h-6 px-1.5 text-[10px] text-muted-foreground">Reset</Button>}
              <span>
                {isLoading
                  ? "Memuat paket…"
                  : <><strong className="font-sans text-sm font-extrabold tabular-nums text-primary">{filteredCount.toLocaleString("id-ID")}</strong> / {totalCount.toLocaleString("id-ID")} paket</>}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12">
            <aside className="order-1 flex h-[580px] flex-col border-r border-border bg-white lg:col-span-3">
              <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-3">
                <span className="font-sans text-[11px] font-bold uppercase tracking-[0.14em] text-primary">Daftar Paket ({isLoading ? "…" : filteredCount.toLocaleString("id-ID")})</span>
                {hasActiveFilter && <Button type="button" variant="ghost" size="xs" onClick={() => { setSelectedYear("SEMUA"); setSelectedDistrict("SEMUA"); setSelectedWork("SEMUA"); setSearchQuery(""); }} className="h-6 px-2 font-sans text-[10px] font-bold uppercase text-muted-foreground hover:text-primary">Reset filter</Button>}
              </div>
              <ScrollArea className="flex-1">
                <div className="divide-y divide-border">
                  {filteredPackages.slice(0, 120).map((pkg) => (
                    <article key={pkg.kode_rup} className="px-4 py-3 transition-colors hover:bg-muted/30">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-primary">{formatPrecisionBadgeLabel(pkg.presisi_peta)}</span>
                        <span className="font-sans text-xs font-extrabold tabular-nums text-primary">{formatRupiahFull(pkg.pagu)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 font-sans text-xs font-semibold text-foreground">{pkg.nama}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="min-w-0 font-sans text-[11px] text-muted-foreground">{pkg.desa_resmi ? `${pkg.desa_resmi}, ${pkg.kecamatan_resmi}` : pkg.kecamatan_resmi ?? "Lokasi: Kab. Tangerang (Umum)"} · {pkg.bulan}</p>
                        <Button type="button" variant="ghost" size="xs" onClick={() => setSelectedPackage(pkg)} aria-label={`Lihat paket ${pkg.nama}, RUP ${pkg.kode_rup}`} className="h-7 shrink-0 gap-1 px-2 text-[11px] font-bold text-primary hover:bg-primary/10 hover:text-primary">Lihat <FiArrowRight aria-hidden="true" /></Button>
                      </div>
                    </article>
                  ))}
                  {loadError && <div role="alert" className="p-6 text-sm text-destructive">{loadError}</div>}
                  {isLoading && !packageData && <div role="status" className="p-6 text-sm text-muted-foreground">Memuat daftar paket…</div>}
                  {!isLoading && !loadError && filteredPackages.length === 0 && <div className="p-6 text-sm text-muted-foreground">Tidak ada paket yang cocok. Ubah atau reset filter.</div>}
                </div>
              </ScrollArea>
            </aside>

            <div className={`relative order-2 border-b border-border lg:order-2 lg:border-b-0 ${selectedPackage ? "lg:col-span-6" : "lg:col-span-9"}`}>
              <MapCanvas
                packages={filteredPackages}
                selectedPackage={selectedPackage}
                onSelectPackage={(pkg) => setSelectedPackage(pkg)}
              />
            </div>

            {selectedPackage && <aside className="order-3 flex h-[580px] flex-col border-l border-border bg-white lg:col-span-3 lg:col-start-10 lg:order-3">
              {selectedPackage ? (
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPackage(null)}
                      className="-ml-2 h-7 gap-1.5 px-2 font-sans text-xs font-bold text-primary hover:bg-primary/10 hover:text-primary active:translate-y-0"
                    >
                      <FiArrowLeft className="size-3.5" aria-hidden="true" />
                      <span>Kembali ke daftar</span>
                    </Button>

                    <span className="font-mono text-[11px] font-bold tracking-wider text-muted-foreground">
                      RUP {selectedPackage.kode_rup}
                    </span>
                  </div>

                  <ScrollArea className="flex-1">
                    <div className="p-5">
                      <nav aria-label="Lokasi paket" className="min-w-0">
                        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-sans text-xs">
                          <li>
                            <button type="button" onClick={() => { setSelectedDistrict("SEMUA"); setSearchQuery(""); setSelectedPackage(null); }} className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              Kab. Tangerang
                            </button>
                          </li>
                          {selectedPackage.kecamatan_resmi && <>
                            <li aria-hidden="true" className="text-muted-foreground">/</li>
                            <li>
                              <button type="button" onClick={() => { setSelectedDistrict(selectedPackage.kecamatan_resmi ?? "SEMUA"); setSearchQuery(""); setSelectedPackage(null); }} className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                Kec. {selectedPackage.kecamatan_resmi}
                              </button>
                            </li>
                          </>}
                          {selectedPackage.desa_resmi && <>
                            <li aria-hidden="true" className="text-muted-foreground">/</li>
                            <li aria-current="location" className="font-semibold text-foreground">
                              {selectedPackage.desa_resmi}
                            </li>
                          </>}
                          {!selectedPackage.kecamatan_resmi && !selectedPackage.desa_resmi && <li aria-current="location" className="font-semibold text-foreground">Lokasi umum</li>}
                        </ol>
                      </nav>
                      <h2 className="mt-2 font-heading text-xl font-bold leading-snug tracking-tight text-foreground">
                        {selectedPackage.nama}
                      </h2>

                      <div className="mt-4 border-b border-border py-3">
                        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Pagu paket</p>
                        <p className="mt-1 font-heading text-2xl font-extrabold tabular-nums tracking-tight text-primary">{formatRupiahFull(selectedPackage.pagu)}</p>
                      </div>

                      <table className="mt-3 w-full border-collapse font-sans text-sm">
                        <tbody>
                          <tr>
                            <th scope="row" className="w-28 py-2 pr-3 text-left align-top font-semibold text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Satker</th>
                            <td className="py-2 font-medium leading-snug text-foreground">{selectedPackage.satker}</td>
                          </tr>
                          <tr>
                            <th scope="row" className="w-28 py-2 pr-3 text-left align-top font-semibold text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Jadwal</th>
                            <td className="py-2 font-medium text-foreground">{selectedPackage.bulan}</td>
                          </tr>
                          <tr>
                            <th scope="row" className="w-28 py-2 pr-3 text-left align-top font-semibold text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Metode & dana</th>
                            <td className="py-2 font-medium leading-snug text-foreground">{selectedPackage.metode} ({selectedPackage.sumber.replace(/,+$/, "")})</td>
                          </tr>
                        </tbody>
                      </table>

                      {selectedPackage.tahun === 2025 && (
                        <div className="mt-4 bg-secondary p-3.5 text-foreground">
                          <p className="font-heading text-xs font-extrabold uppercase tracking-[0.06em] text-primary">
                            Dalam Jendela Pemeliharaan (≤ 12 Bulan)
                          </p>
                          <p className="mt-1 font-sans text-[13px] leading-relaxed text-foreground/90">
                            Laporan kerusakan pada rentang ini menjadi dasar penagihan perbaikan
                            sebelum retensi 5% dicairkan.
                          </p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="border-t border-border bg-white p-4">
                    <Button
                      render={<Link href={`/lapor?rup=${selectedPackage.kode_rup}`} />}
                      nativeButton={false}
                      variant="default"
                      className="h-10 w-full rounded-xs bg-primary font-sans text-xs font-bold uppercase tracking-[0.12em] text-white hover:bg-[#004682]"
                    >
                      <span>Laporkan kerusakan</span>
                      <FiArrowRight className="size-4 text-secondary" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </aside>}
          </div>
        </Card>
      </div>
      </section>
    </>
  );
}
