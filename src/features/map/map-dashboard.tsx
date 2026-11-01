"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { FiArrowLeft, FiArrowRight, FiSearch } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatRupiahFull } from "./road-types";
import { MapIntroSection } from "./map-intro-section";
import { MAP_SEARCH_EVENT } from "./map-search-events";
import { fetchRoadPackages } from "./package-api";
import { ROAD_WORK_LABELS } from "@/contracts/packages/road-work";
import {
  addressForPackage,
  addressSlug,
  districtSlug,
  parseReportSegments,
  routeForAddress,
  routeForFilters,
  routeForPackage,
  type ReportAddress,
  type ReportViewMode,
} from "./report-routes";
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
  ...ROAD_WORK_LABELS,
};

function normalizeDistrictName(value: string) {
  return value
    .toLocaleLowerCase("id-ID")
    .replace(/^(kecamatan|kec\.?)[\s-]*/u, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function currentAddressUrl() {
  const segments = window.location.pathname.split("/").filter(Boolean).slice(1);
  const selection = parseReportSegments(segments);
  const path = routeForAddress({
    districtSlug: selection.districtSlug,
    villageSlug: selection.villageSlug,
    rwSlug: selection.rwSlug,
  });
  return `${path}${window.location.search}`;
}

interface MapDashboardProps {
  initialData: RoadPackageSearchData;
  showIntro?: boolean;
  fillViewport?: boolean;
  addressRouting?: boolean;
  initialRouteState?: {
    selectedDistrict?: string;
    selectedRegion?: ReportAddress | null;
    selectedPackage?: RoadPackageItem | null;
    selectedYear?: "SEMUA" | "2025" | "2026";
    selectedWork?: RoadWorkCategory;
    mapView?: ReportViewMode;
    searchQuery?: string;
  };
}

export default function MapDashboard({ initialData, showIntro = true, fillViewport = false, addressRouting = false, initialRouteState }: MapDashboardProps) {
  const [packageData, setPackageData] = useState<RoadPackageSearchData | null>(initialData);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<"SEMUA" | "2025" | "2026">(initialRouteState?.selectedYear ?? "SEMUA");
  const [selectedDistrict, setSelectedDistrict] = useState<string>(initialRouteState?.selectedDistrict ?? "SEMUA");
  const [selectedWork, setSelectedWork] = useState<RoadWorkCategory>(initialRouteState?.selectedWork ?? "SEMUA");
  const [searchQuery, setSearchQuery] = useState<string>(initialRouteState?.searchQuery ?? "");
  const [selectedPackage, setSelectedPackage] = useState<RoadPackageItem | null>(initialRouteState?.selectedPackage ?? null);
  const selectedPackageRef = useRef<RoadPackageItem | null>(initialRouteState?.selectedPackage ?? null);
  const [selectedRegion, setSelectedRegion] = useState<ReportAddress | null>(initialRouteState?.selectedRegion ?? null);
  const [mapView, setMapView] = useState<ReportViewMode>(initialRouteState?.mapView ?? "packages");

  const updateSelectedPackage = (pkg: RoadPackageItem | null) => {
    selectedPackageRef.current = pkg;
    setSelectedPackage(pkg);
  };

  useEffect(() => {
    function handleMapSearch(event: Event) {
      const query = (event as CustomEvent<string>).detail;
      setSearchQuery(query);
      document.getElementById("jelajahi")?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => document.getElementById("map-package-search")?.focus({ preventScroll: true }), 350);
    }

    window.addEventListener(MAP_SEARCH_EVENT, handleMapSearch);
    return () => window.removeEventListener(MAP_SEARCH_EVENT, handleMapSearch);
  }, []);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedYear !== "SEMUA") params.set("year", selectedYear);
    if (selectedDistrict !== "SEMUA") params.set("district", selectedDistrict);
    if (selectedWork !== "SEMUA") params.set("work", selectedWork);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    return params.toString();
  }, [selectedYear, selectedDistrict, selectedWork, searchQuery]);

  const lastRequestedQuery = useRef(addressRouting ? "" : queryString);
  useEffect(() => {
    if (lastRequestedQuery.current === queryString) return;
    lastRequestedQuery.current = queryString;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      setLoadError(null);

      fetchRoadPackages(
        {
          year: selectedYear === "SEMUA" ? undefined : selectedYear,
          district: selectedDistrict === "SEMUA" ? undefined : selectedDistrict,
          work: selectedWork,
          query: searchQuery.trim() || undefined,
        },
        controller.signal,
      )
        .then((result) => {
          setPackageData(result);
          const selected = selectedPackageRef.current;
          if (addressRouting && selected && !result.items.some((item) => item.kode_rup === selected.kode_rup)) {
            updateSelectedPackage(null);
            window.history.replaceState(null, "", currentAddressUrl());
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setPackageData(null);
            updateSelectedPackage(null);
            if (addressRouting) {
              window.history.replaceState(null, "", currentAddressUrl());
            }
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
  }, [addressRouting, queryString, searchQuery, selectedDistrict, selectedWork, selectedYear]);

  const districts = useMemo(() => packageData?.districts ?? [], [packageData]);
  const filteredPackages = packageData?.items ?? [];
  const totalCount = packageData?.totalCount ?? 0;
  const filteredCount = packageData?.filteredCount ?? 0;

  const writeReportPath = (path: string) => {
    if (!addressRouting) return;
    const nextUrl = routeForFilters(path, {
      year: selectedYear,
      work: selectedWork,
      view: mapView,
      query: searchQuery,
    });
    window.history.pushState(null, "", nextUrl);
  };

  const selectPackage = (pkg: RoadPackageItem) => {
    const address = addressForPackage(pkg);
    updateSelectedPackage(pkg);
    setSelectedRegion(address);
    writeReportPath(routeForPackage(pkg));
  };

  const selectRegion = (region: { district: string | null; village: string | null; rw: string | null; precision: "RW" | "Kelurahan" } | null, pkg: RoadPackageItem | null) => {
    if (!region) {
      setSelectedDistrict("SEMUA");
      setSelectedRegion(null);
      updateSelectedPackage(null);
      writeReportPath("/project");
      return;
    }
    const requestedDistrict = pkg?.kecamatan_resmi ?? region.district ?? "";
    const matchedDistrict = districts.find((name) => normalizeDistrictName(name) === normalizeDistrictName(requestedDistrict));
    const packageAddress = pkg ? addressForPackage(pkg) : null;
    const address: ReportAddress = packageAddress ?? {
      districtSlug: matchedDistrict ? districtSlug(matchedDistrict) : requestedDistrict ? districtSlug(requestedDistrict) : undefined,
      villageSlug: region.village ? addressSlug(region.village) : undefined,
      rwSlug: region.precision === "RW" && region.rw ? `rw-${addressSlug(region.rw.replace(/^rw-?/i, ""))}` : undefined,
    };
    setSelectedDistrict(matchedDistrict ?? "SEMUA");
    setSelectedRegion(address);
    updateSelectedPackage(pkg);
    writeReportPath(pkg ? routeForPackage(pkg) : routeForAddress(address));
  };

  const closeSelectedPackage = () => {
    updateSelectedPackage(null);
    const address = selectedRegion ?? (selectedDistrict !== "SEMUA" ? { districtSlug: districtSlug(selectedDistrict) } : null);
    writeReportPath(address ? routeForAddress(address) : "/project");
  };

  useEffect(() => {
    if (!addressRouting) return;
    const url = routeForFilters(window.location.pathname, {
      year: selectedYear,
      work: selectedWork,
      view: mapView,
      query: searchQuery,
    });
    if (`${window.location.pathname}${window.location.search}` !== url) {
      window.history.replaceState(null, "", url);
    }
  }, [addressRouting, mapView, searchQuery, selectedWork, selectedYear]);

  useEffect(() => {
    if (!addressRouting) return;
    const restoreFromLocation = () => {
      const segments = window.location.pathname.split("/").filter(Boolean).slice(1);
      const selection = parseReportSegments(segments);
      const params = new URLSearchParams(window.location.search);
      const district = districts.find((name) => districtSlug(name) === selection.districtSlug);
      const rupPackage = selection.rupCode
        ? initialData.items.find((item) => item.kode_rup === selection.rupCode)
        : null;
      const year = params.get("tahun");
      const work = params.get("jenis")?.toLocaleUpperCase("id-ID");
      const view = params.get("tampilan");
      setSelectedYear(year === "2025" || year === "2026" ? year : "SEMUA");
      setSelectedWork(WORK_OPTIONS.includes(work as RoadWorkCategory) ? work as RoadWorkCategory : "SEMUA");
      setMapView(view === "budget" || view === "work" ? view : "packages");
      setSearchQuery(params.get("q") ?? "");
      setSelectedDistrict(district ?? "SEMUA");
      setSelectedRegion(selection.districtSlug || selection.villageSlug || selection.rwSlug ? {
        districtSlug: selection.districtSlug,
        villageSlug: selection.villageSlug,
        rwSlug: selection.rwSlug,
      } : rupPackage ? addressForPackage(rupPackage) : null);
      updateSelectedPackage(rupPackage ?? null);
    };
    window.addEventListener("popstate", restoreFromLocation);
    return () => window.removeEventListener("popstate", restoreFromLocation);
  }, [addressRouting, districts, initialData.items]);

  return (
    <>
      {showIntro && <MapIntroSection searchQuery={searchQuery} onSearchChange={setSearchQuery} />}
      <section aria-label="Jelajahi paket jalan" className={fillViewport ? "min-h-[calc(100dvh-4rem)] bg-white lg:h-full" : "bg-white pt-8 pb-12 sm:pt-10"}>
      <div className={fillViewport ? "h-full w-full px-0" : "w-full px-4 sm:px-6 lg:px-8"}>
        <Card className={`overflow-hidden rounded-xs border-border bg-white shadow-none ${fillViewport ? "lg:flex lg:h-full lg:min-h-0 lg:flex-col" : ""}`}>
          <div className="grid gap-2 border-b border-border bg-muted/20 p-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(250px,1fr)] sm:items-center sm:px-3 sm:py-2">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 xl:grid-cols-[132px_220px_220px_180px] xl:gap-2">
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
                <Select value={selectedDistrict} onValueChange={(val) => {
                  const district = val ?? "SEMUA";
                  const address = district === "SEMUA" ? null : { districtSlug: districtSlug(district) };
                  setSelectedDistrict(district);
                  setSelectedRegion(address);
                  updateSelectedPackage(null);
                  writeReportPath(address ? routeForAddress(address) : "/project");
                }}>
                  <SelectTrigger aria-label="Pilih kecamatan" className="h-7 w-full min-w-0 border-0 bg-transparent px-1 text-xs font-semibold shadow-none">
                    <SelectValue>{selectedDistrict === "SEMUA" ? "Semua kecamatan" : selectedDistrict}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SEMUA">Semua kecamatan</SelectItem>
                    {districts.map((kec) => <SelectItem key={kec} value={kec}>{kec}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 px-1 py-0.5">
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
              <div className="col-span-2 flex min-w-0 flex-col gap-0.5 px-1 py-0.5 sm:col-span-1">
                <span className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Tampilan</span>
                <Select value={mapView} onValueChange={(value) => setMapView((value ?? "packages") as "packages" | "budget" | "work")}>
                  <SelectTrigger aria-label="Tampilan peta" className="h-7 w-full min-w-0 border-0 bg-transparent px-1 text-xs font-semibold shadow-none">
                    <SelectValue>{mapView === "budget" ? "Nilai anggaran" : mapView === "work" ? "Jenis pekerjaan" : "Jumlah paket"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="packages">Jumlah paket</SelectItem>
                    <SelectItem value="budget">Nilai anggaran</SelectItem>
                    <SelectItem value="work">Jenis pekerjaan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div aria-live="polite" className="flex w-full min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t border-border pt-1.5 font-sans text-[11px] text-muted-foreground sm:border-t-0 sm:pt-0">
              {!showIntro && <label className="relative min-w-[150px] flex-1 sm:w-[260px] sm:flex-none">
                <span className="sr-only">Cari paket berdasarkan desa, jalan, kecamatan, atau nomor RUP</span>
                <FiSearch aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="map-package-search"
                  aria-label="Cari paket berdasarkan desa, jalan, kecamatan, atau nomor RUP"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari desa, jalan, atau RUP"
                  className="h-8 pl-8 pr-2 text-[11px]"
                />
              </label>}
              <span className="whitespace-nowrap">
                {isLoading
                  ? "Memuat paket…"
                  : <><strong className="font-sans text-sm font-extrabold tabular-nums text-primary">{filteredCount.toLocaleString("id-ID")}</strong> / {totalCount.toLocaleString("id-ID")} paket</>}
              </span>
            </div>
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-12 ${fillViewport ? "lg:min-h-0 lg:flex-1" : ""}`}>
            <aside className={`order-1 flex h-[580px] flex-col border-r border-border bg-white lg:col-span-3 ${fillViewport ? "lg:h-full lg:min-h-0" : ""}`}>
              <ScrollArea className="flex-1">
                <div className="divide-y divide-border">
                  {filteredPackages.slice(0, 120).map((pkg) => (
                    <article key={pkg.kode_rup} className="px-4 py-3 transition-colors hover:bg-muted/30">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-primary">RUP {pkg.kode_rup}</span>
                        <span className="font-sans text-xs font-extrabold tabular-nums text-primary">{formatRupiahFull(pkg.pagu)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 font-sans text-xs font-semibold text-foreground">{pkg.nama}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="min-w-0 font-sans text-[11px] text-muted-foreground">{pkg.desa_resmi ? `${pkg.desa_resmi}${pkg.presisi_peta === "RW" && pkg.rw ? `, RW ${pkg.rw}` : ""}, ${pkg.kecamatan_resmi}` : pkg.kecamatan_resmi ?? "Lokasi umum · Kota Tangerang"} · {pkg.bulan}</p>
                        <Button type="button" variant="ghost" size="xs" onClick={() => selectPackage(pkg)} aria-label={`Lihat paket ${pkg.nama}, RUP ${pkg.kode_rup}`} className="h-7 shrink-0 gap-1 px-2 text-[11px] font-bold text-primary hover:bg-primary/10 hover:text-primary">Lihat <FiArrowRight aria-hidden="true" /></Button>
                      </div>
                    </article>
                  ))}
                  {loadError && <div role="alert" className="p-6 text-sm text-destructive">{loadError}</div>}
                  {isLoading && !packageData && <div role="status" className="p-6 text-sm text-muted-foreground">Memuat daftar paket…</div>}
                  {!isLoading && !loadError && filteredPackages.length === 0 && <div className="p-6 text-sm text-muted-foreground">Tidak ada paket yang cocok dengan filter saat ini.</div>}
                </div>
              </ScrollArea>
            </aside>

            <div className={`relative order-2 border-b border-border lg:order-2 lg:border-b-0 ${selectedPackage ? "lg:col-span-6" : "lg:col-span-9"} ${fillViewport ? "h-[580px] lg:h-full lg:min-h-0" : ""}`}>
              <MapCanvas
                packages={filteredPackages}
                selectedPackage={selectedPackage}
                selectedRegion={selectedRegion}
                onSelectRegion={selectRegion}
                viewMode={mapView}
                mapHeightClassName={fillViewport ? "h-full min-h-0" : undefined}
              />
            </div>

            {selectedPackage && <aside className={`order-3 flex h-[580px] flex-col border-l border-border bg-white lg:col-span-3 lg:col-start-10 lg:order-3 ${fillViewport ? "lg:h-full lg:min-h-0" : ""}`}>
              {selectedPackage ? (
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-border bg-muted/20 px-5 py-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={closeSelectedPackage}
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
                            <button type="button" onClick={() => { setSelectedDistrict("SEMUA"); setSelectedRegion(null); setSearchQuery(""); updateSelectedPackage(null); writeReportPath("/project"); }} className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              Kota Tangerang
                            </button>
                          </li>
                          {selectedPackage.kecamatan_resmi && <>
                            <li aria-hidden="true" className="text-muted-foreground">/</li>
                            <li>
                              <button type="button" onClick={() => { const district = selectedPackage.kecamatan_resmi ?? "SEMUA"; const address = district === "SEMUA" ? null : { districtSlug: districtSlug(district) }; setSelectedDistrict(district); setSelectedRegion(address); setSearchQuery(""); updateSelectedPackage(null); writeReportPath(address ? routeForAddress(address) : "/project"); }} className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                Kec. {selectedPackage.kecamatan_resmi}
                              </button>
                            </li>
                          </>}
                          {selectedPackage.desa_resmi && (selectedPackage.presisi_peta === "Kelurahan" || selectedPackage.presisi_peta === "RW") && <>
                            <li aria-hidden="true" className="text-muted-foreground">/</li>
                            {selectedPackage.presisi_peta === "RW" ? (
                              <li>
                                <button type="button" onClick={() => {
                                  const district = selectedPackage.kecamatan_resmi ?? "SEMUA";
                                  const address = {
                                    ...(district !== "SEMUA" ? { districtSlug: districtSlug(district) } : {}),
                                    villageSlug: addressSlug(selectedPackage.desa_resmi!),
                                  };
                                  setSelectedDistrict(district);
                                  setSelectedRegion(address);
                                  updateSelectedPackage(null);
                                  writeReportPath(routeForAddress(address));
                                }} className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                  {selectedPackage.desa_resmi}
                                </button>
                              </li>
                            ) : (
                              <li aria-current="location" className="font-semibold text-foreground">{selectedPackage.desa_resmi}</li>
                            )}
                            {selectedPackage.presisi_peta === "RW" && selectedPackage.rw && <>
                              <li aria-hidden="true" className="text-muted-foreground">/</li>
                              <li aria-current="location" className="font-semibold text-foreground">RW {selectedPackage.rw}</li>
                            </>}
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
                      render={<Link href={`/laporan/paket/${selectedPackage.kode_rup}`} />}
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
