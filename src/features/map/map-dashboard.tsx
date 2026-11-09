"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FiArrowLeft, FiArrowRight, FiChevronDown, FiExternalLink, FiSearch } from "react-icons/fi";
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
import { fetchRoadPackage, fetchRoadPackageMap, fetchRoadPackages } from "./package-api";
import { buildPenyediaPanel, labelPenyediaLain } from "./penyedia-panel";
import { ROAD_WORK_LABELS } from "@/contracts/packages/road-work";
import { slugPenyedia } from "@/contracts/packages/vendor-slug";
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
  MapBounds,
  RoadContractFilter,
  RoadPackageItem,
  RoadPackageMapData,
  RoadPackageSearchData,
  RoadPackageSearchFilters,
  RoadWorkCategory,
} from "@/contracts/packages/road-package.contract";
import type { RegionOption } from "@/contracts/regions/region.contract";

const MapCanvas = dynamic(() => import("./map-canvas"), {
  ssr: false,
  loading: () => <div className="h-[580px] w-full bg-muted/40" />,
});

const WORK_OPTIONS: RoadWorkCategory[] = ["SEMUA", "PERMUKAAN", "DRAINASE", "JEMBATAN"];
const WORK_LABELS: Record<RoadWorkCategory, string> = {
  SEMUA: "Semua pekerjaan",
  ...ROAD_WORK_LABELS,
};

const CONTRACT_OPTIONS: RoadContractFilter[] = ["SEMUA", "ADA", "TANPA"];
const CONTRACT_LABELS: Record<RoadContractFilter, string> = {
  SEMUA: "Semua kontrak",
  ADA: "Ada rekam penyedia",
  TANPA: "Tanpa rekam penyedia",
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
  initialAggregate: RoadPackageMapData;
  regionId: string;
  availableRegions: RegionOption[];
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

const PAGE_SIZE = 50;

export default function MapDashboard({ initialData, initialAggregate, regionId, availableRegions, showIntro = true, fillViewport = false, addressRouting = false, initialRouteState }: MapDashboardProps) {
  const router = useRouter();
  const [packageData, setPackageData] = useState<RoadPackageSearchData | null>(initialData);
  const [mapData, setMapData] = useState<RoadPackageMapData | null>(initialAggregate);
  const [mapBbox, setMapBbox] = useState<MapBounds | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<"SEMUA" | "2025" | "2026">(initialRouteState?.selectedYear ?? "SEMUA");
  const [selectedDistrict, setSelectedDistrict] = useState<string>(initialRouteState?.selectedDistrict ?? "SEMUA");
  const [selectedVillages, setSelectedVillages] = useState<string[] | null>(null);
  const [openVillages, setOpenVillages] = useState(false);
  const [tampilSemuaPenyedia, setTampilSemuaPenyedia] = useState(false);
  const villagesRef = useRef<HTMLDivElement | null>(null);
  const [locatedOnly, setLocatedOnly] = useState(true);

  useEffect(() => {
    if (!openVillages) return;
    function handlePointerDown(event: PointerEvent) {
      if (!villagesRef.current?.contains(event.target as Node)) setOpenVillages(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenVillages(false);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openVillages]);
  const [selectedWork, setSelectedWork] = useState<RoadWorkCategory>(initialRouteState?.selectedWork ?? "SEMUA");
  const [selectedContract, setSelectedContract] = useState<RoadContractFilter>("SEMUA");
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
    for (const desa of selectedVillages ?? []) params.append("desa", desa);
    if (locatedOnly) params.set("lokasi", "1");
    if (selectedWork !== "SEMUA") params.set("work", selectedWork);
    if (selectedContract !== "SEMUA") params.set("kontrak", selectedContract);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    return params.toString();
  }, [selectedYear, selectedDistrict, selectedVillages, locatedOnly, selectedWork, selectedContract, searchQuery]);

  const lastRequestedQuery = useRef(addressRouting ? "" : queryString);
  const currentFilters = useMemo<RoadPackageSearchFilters>(() => ({
    region: regionId,
    year: selectedYear === "SEMUA" ? undefined : selectedYear,
    district: selectedDistrict === "SEMUA" ? undefined : selectedDistrict,
    villages: selectedVillages ?? undefined,
    locatedOnly,
    work: selectedWork,
    contract: selectedContract,
    query: searchQuery.trim() || undefined,
  }), [locatedOnly, regionId, searchQuery, selectedContract, selectedDistrict, selectedVillages, selectedWork, selectedYear]);

  useEffect(() => {
    if (selectedVillages !== null && selectedVillages.length === 0) return;
    if (lastRequestedQuery.current === queryString) return;
    lastRequestedQuery.current = queryString;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setIsLoading(true);
      setLoadError(null);

      fetchRoadPackages({ ...currentFilters, page: 1, limit: PAGE_SIZE }, controller.signal)
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
  }, [addressRouting, currentFilters, queryString, searchQuery, selectedVillages]);

  // Agregat peta dimuat terpisah agar perubahan viewport tidak memicu ulang register.
  const mapQueryKey = `${queryString}|${mapBbox?.map((value) => value.toFixed(5)).join(",") ?? ""}`;
  const lastMapQuery = useRef(addressRouting ? "" : mapQueryKey);
  useEffect(() => {
    if (selectedVillages !== null && selectedVillages.length === 0) return;
    if (lastMapQuery.current === mapQueryKey) return;
    lastMapQuery.current = mapQueryKey;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetchRoadPackageMap({ ...currentFilters, bbox: mapBbox ?? undefined }, controller.signal)
        .then((aggregate) => setMapData(aggregate))
        .catch(() => {
          // Pertahankan agregat terakhir; daftar register punya pesan galat sendiri.
        });
    }, mapBbox ? 180 : 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [currentFilters, mapBbox, mapQueryKey, selectedVillages]);

  const districts = useMemo(() => packageData?.districts ?? [], [packageData]);
  const villagesByDistrict = useMemo(() => packageData?.villagesByDistrict ?? {}, [packageData]);
  const villageOptions = useMemo(
    () => (selectedDistrict === "SEMUA" ? [] : villagesByDistrict[selectedDistrict] ?? []),
    [selectedDistrict, villagesByDistrict],
  );
  const activeVillages = selectedVillages ?? villageOptions;
  const kelurahanKosong = selectedVillages !== null && selectedVillages.length === 0;
  const toggleVillage = (desa: string) => {
    const aktif = new Set(activeVillages);
    if (aktif.has(desa)) aktif.delete(desa);
    else aktif.add(desa);
    const berikut = villageOptions.filter((opsi) => aktif.has(opsi));
    setSelectedVillages(berikut.length === villageOptions.length ? null : berikut);
  };
  const filteredPackages = kelurahanKosong ? [] : packageData?.items ?? [];
  const totalCount = packageData?.totalCount ?? 0;
  const filteredCount = kelurahanKosong ? 0 : packageData?.filteredCount ?? 0;

  const mapAggregate = useMemo<RoadPackageMapData>(() => {
    const kosong: RoadPackageMapData = {
      region: initialData.region,
      rw: {},
      kel: {},
      kec: {},
      totalCount,
      filteredCount: 0,
      bbox: mapBbox,
    };
    if (kelurahanKosong) return kosong;
    return mapData ?? { ...kosong, filteredCount };
  }, [filteredCount, initialData.region, kelurahanKosong, mapBbox, mapData, totalCount]);

  const loadMore = async () => {
    if (!packageData?.hasMore || isLoadingMore) return;
    const requestedQuery = queryString;
    setIsLoadingMore(true);
    setLoadError(null);
    try {
      const next = await fetchRoadPackages(
        { ...currentFilters, page: packageData.page + 1, limit: packageData.limit },
        new AbortController().signal,
      );
      if (lastRequestedQuery.current !== requestedQuery) return;
      setPackageData((previous) => previous
        ? { ...next, items: [...previous.items, ...next.items] }
        : next);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Data paket jalan belum dapat dimuat.");
    } finally {
      setIsLoadingMore(false);
    }
  };

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
    setTampilSemuaPenyedia(false);
    updateSelectedPackage(pkg);
    setSelectedRegion(address);
    writeReportPath(routeForPackage(pkg));
  };

  const panelPenyedia = useMemo(
    () => buildPenyediaPanel(selectedPackage?.kontrak),
    [selectedPackage],
  );
  const penyediaPanel = panelPenyedia.baris;
  const labelPenyediaTersembunyi = labelPenyediaLain(penyediaPanel.length);

  const paketPerPenyedia = useMemo(() => {
    const paket = selectedPackage?.kontrak?.paketRealisasi ?? [];
    const grup = new Map<string, Array<{ kodePaket: string; nilai: number; sumber: string | null }>>();
    for (const baris of paket) {
      const daftar = grup.get(baris.penyedia) ?? [];
      daftar.push({ kodePaket: baris.kodePaket, nilai: baris.nilai, sumber: baris.sumber });
      grup.set(baris.penyedia, daftar);
    }
    return [...grup.entries()]
      .map(([nama, daftar]) => ({
        nama,
        daftar: daftar.sort((a, b) => b.nilai - a.nilai),
        total: daftar.reduce((jumlah, item) => jumlah + item.nilai, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [selectedPackage]);

  const selectRegion = (region: { district: string | null; village: string | null; rw: string | null; precision: "RW" | "Kelurahan" | "Kecamatan" } | null, sampleRup: string | null) => {
    if (!region) {
      setSelectedDistrict("SEMUA");
      setSelectedRegion(null);
      updateSelectedPackage(null);
      writeReportPath("/project");
      return;
    }
    const requestedDistrict = region.district ?? "";
    const matchedDistrict = districts.find((name) => normalizeDistrictName(name) === normalizeDistrictName(requestedDistrict));
    const address: ReportAddress = {
      districtSlug: matchedDistrict ? districtSlug(matchedDistrict) : requestedDistrict ? districtSlug(requestedDistrict) : undefined,
      villageSlug: region.village ? addressSlug(region.village) : undefined,
      rwSlug: region.precision === "RW" && region.rw ? `rw-${addressSlug(region.rw.replace(/^rw-?/i, ""))}` : undefined,
    };
    setSelectedDistrict(matchedDistrict ?? "SEMUA");
    setSelectedRegion(address);
    updateSelectedPackage(null);
    writeReportPath(routeForAddress(address));

    if (sampleRup) {
      fetchRoadPackage(sampleRup, regionId)
        .then((pkg) => {
          updateSelectedPackage(pkg);
          setSelectedRegion(addressForPackage(pkg));
          writeReportPath(routeForPackage(pkg));
        })
        .catch(() => {
          // Wilayah tetap terpilih walau detail paket contoh gagal dimuat.
        });
    }
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
      if (selection.rupCode && !rupPackage) {
        fetchRoadPackage(selection.rupCode, regionId)
          .then((pkg) => {
            updateSelectedPackage(pkg);
            setSelectedRegion(addressForPackage(pkg));
          })
          .catch(() => undefined);
      }
    };
    window.addEventListener("popstate", restoreFromLocation);
    return () => window.removeEventListener("popstate", restoreFromLocation);
  }, [addressRouting, districts, initialData.items, regionId]);

  const activeRegion = initialData.region;
  const regionLabel = activeRegion.label;
  const environmentLabel = activeRegion.environmentLabel;

  const pindahRegion = (id: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("region", id);
    router.push(`${addressRouting ? "/project" : "/"}?${params.toString()}`);
  };

  return (
    <>
      {showIntro && <MapIntroSection searchQuery={searchQuery} onSearchChange={setSearchQuery} />}
      <section aria-label="Jelajahi paket jalan" className={fillViewport ? "min-h-[calc(100dvh-4rem)] bg-white lg:h-full" : "bg-white pt-8 pb-12 sm:pt-10"}>
      <div className={fillViewport ? "h-full w-full px-0" : "w-full px-4 sm:px-6 lg:px-8"}>
        <Card className={`overflow-hidden rounded-xs border-border bg-white shadow-none ${fillViewport ? "lg:flex lg:h-full lg:min-h-0 lg:flex-col" : ""}`}>
          {availableRegions.length > 1 && (
            <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-3 py-2">
              <span className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Wilayah kerja</span>
              <Select value={regionId} onValueChange={(value) => value && pindahRegion(value)}>
                <SelectTrigger aria-label="Pilih wilayah kerja" className="h-7 w-56 border-0 bg-transparent px-1 text-xs font-semibold shadow-none">
                  <SelectValue>{regionLabel}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {availableRegions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid gap-2 border-b border-border bg-muted/20 p-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(250px,1fr)] sm:items-center sm:px-3 sm:py-2">
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 xl:grid-cols-[100px_175px_165px_150px_150px_150px] xl:gap-2">
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
                  setSelectedVillages(null);
                  setOpenVillages(false);
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
              <div ref={villagesRef} className="relative flex min-w-0 flex-col gap-0.5 px-1 py-0.5">
                <span className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Kelurahan</span>
                <button
                  type="button"
                  disabled={selectedDistrict === "SEMUA"}
                  onClick={() => setOpenVillages((buka) => !buka)}
                  aria-expanded={openVillages}
                  aria-label="Pilih kelurahan"
                  className={`flex h-7 w-full min-w-0 items-center justify-between gap-1 rounded-xs px-1 text-left text-xs font-semibold transition-colors ${
                    selectedDistrict === "SEMUA"
                      ? "cursor-not-allowed text-muted-foreground/60"
                      : kelurahanKosong
                        ? "bg-destructive/10 text-destructive underline decoration-destructive/40 decoration-wavy underline-offset-2 hover:bg-destructive/15"
                        : "text-foreground hover:bg-muted"
                  }`}
                >
                  <span className="truncate">
                    {selectedDistrict === "SEMUA"
                      ? "Pilih kecamatan"
                      : kelurahanKosong
                        ? "Centang minimal 1"
                        : selectedVillages === null
                          ? "Semua kelurahan"
                          : `${selectedVillages.length} dari ${villageOptions.length}`}
                  </span>
                  <FiChevronDown className="size-3 shrink-0 opacity-60" aria-hidden="true" />
                </button>
                {(openVillages || kelurahanKosong) && selectedDistrict !== "SEMUA" && (
                  <div className="absolute top-full left-0 z-50 mt-1 w-60 border border-border bg-white shadow-md">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                        {villageOptions.length} kelurahan
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedVillages(null)}
                        className="font-sans text-[11px] font-bold text-primary hover:underline"
                      >
                        Pilih semua
                      </button>
                    </div>
                    {kelurahanKosong && (
                      <p role="alert" className="border-b border-destructive/30 bg-destructive/5 px-2 py-1.5 font-sans text-[11px] font-semibold leading-snug text-destructive">
                        Centang minimal satu kelurahan untuk menampilkan paket.
                      </p>
                    )}
                    <div className="max-h-56 overflow-auto py-1">
                      {villageOptions.map((desa) => {
                        const terpilih = selectedVillages === null || selectedVillages.includes(desa);
                        return (
                          <label key={desa} className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs hover:bg-muted">
                            <input
                              type="checkbox"
                              checked={terpilih}
                              onChange={() => toggleVillage(desa)}
                              className="size-3.5 accent-primary"
                            />
                            <span className="truncate">{desa}</span>
                          </label>
                        );
                      })}
                      {villageOptions.length === 0 && (
                        <p className="px-2 py-2 text-xs text-muted-foreground">
                          Belum ada kelurahan berlokasi di kecamatan ini.
                        </p>
                      )}
                    </div>
                  </div>
                )}
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
              <div className="flex min-w-0 flex-col gap-0.5 px-1 py-0.5">
                <span className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Kontrak</span>
                <Select value={selectedContract} onValueChange={(val) => setSelectedContract((val ?? "SEMUA") as RoadContractFilter)}>
                  <SelectTrigger aria-label="Status rekam kontrak LPSE" className="h-7 w-full min-w-0 border-0 bg-transparent px-1 text-xs font-semibold shadow-none">
                    <SelectValue>{CONTRACT_LABELS[selectedContract]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_OPTIONS.map((kontrak) => <SelectItem key={kontrak} value={kontrak}>{CONTRACT_LABELS[kontrak]}</SelectItem>)}
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
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5" title="Sembunyikan paket yang hanya punya lokasi umum (presisi kabupaten)">
                <input
                  type="checkbox"
                  checked={locatedOnly}
                  onChange={(event) => setLocatedOnly(event.target.checked)}
                  className="size-3.5 accent-primary"
                />
                <span className="font-sans text-[11px]">Hanya paket berlokasi</span>
              </label>
              {!showIntro && <label className="relative min-w-[150px] flex-1 sm:w-[260px] sm:flex-none">
                <span className="sr-only">Cari paket berdasarkan kelurahan, jalan, kecamatan, atau nomor RUP</span>
                <FiSearch aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="map-package-search"
                  aria-label="Cari paket berdasarkan kelurahan, jalan, kecamatan, atau nomor RUP"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Cari kelurahan, jalan, atau RUP"
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
                  {filteredPackages.map((pkg) => (
                    <article key={pkg.kode_rup} className="px-4 py-3 transition-colors hover:bg-muted/30">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-primary">RUP {pkg.kode_rup}</span>
                        <span className="font-sans text-xs font-extrabold tabular-nums text-primary">{formatRupiahFull(pkg.pagu)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 font-sans text-xs font-semibold text-foreground">{pkg.nama}</p>
                      {pkg.kontrak && (
                        <p className="mt-0.5 truncate font-sans text-[10px] text-muted-foreground">
                          {pkg.kontrak.jenis === "tender" ? "Pemenang" : "Penyedia"}: <span className="font-semibold text-foreground/80">{pkg.kontrak.penyedia}</span>
                          {pkg.kontrak.jumlahPaket && pkg.kontrak.jumlahPaket > 1 ? (
                            <span className="ml-1 text-[10px] text-muted-foreground">· {pkg.kontrak.jumlahPaket} paket</span>
                          ) : null}
                        </p>
                      )}
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="min-w-0 font-sans text-[11px] text-muted-foreground">{pkg.desa_resmi ? `${pkg.desa_resmi}${pkg.presisi_peta === "RW" && pkg.rw ? `, ${environmentLabel} ${pkg.rw}` : ""}, ${pkg.kecamatan_resmi}` : pkg.kecamatan_resmi ?? `Lokasi umum · ${regionLabel}`} · {pkg.bulan ?? "jadwal belum tersedia"}</p>
                        <Button type="button" variant="ghost" size="xs" onClick={() => selectPackage(pkg)} aria-label={`Lihat paket ${pkg.nama}, RUP ${pkg.kode_rup}`} className="h-7 shrink-0 gap-1 px-2 text-[11px] font-bold text-primary hover:bg-primary/10 hover:text-primary">Lihat <FiArrowRight aria-hidden="true" /></Button>
                      </div>
                    </article>
                  ))}
                  {packageData?.hasMore ? (
                    <div className="border-t border-border p-3">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={loadMore}
                        disabled={isLoadingMore}
                        className="w-full font-sans text-[11px] font-bold uppercase tracking-[0.08em]"
                      >
                        {isLoadingMore
                          ? "Memuat paket…"
                          : `Muat ${Math.min(packageData.limit, filteredCount - filteredPackages.length)} paket lagi`}
                      </Button>
                      <p className="mt-1.5 text-center font-sans text-[10px] tabular-nums text-muted-foreground">
                        {filteredPackages.length.toLocaleString("id-ID")} dari {filteredCount.toLocaleString("id-ID")} paket
                      </p>
                    </div>
                  ) : null}
                  {loadError && <div role="alert" className="p-6 text-sm text-destructive">{loadError}</div>}
                  {isLoading && !packageData && <div role="status" className="p-6 text-sm text-muted-foreground">Memuat daftar paket…</div>}
                  {!isLoading && !loadError && filteredPackages.length === 0 && (
                    <div className="p-6 text-sm text-muted-foreground">
                      {kelurahanKosong
                        ? "Belum ada kelurahan dipilih. Centang minimal satu kelurahan pada filter Kelurahan."
                        : searchQuery.trim() && locatedOnly
                          ? (
                            <span className="block">
                              Tidak ada paket <strong>berlokasi</strong> yang cocok dengan pencarian. Paket dengan
                              lokasi umum (presisi kabupaten) menyembunyikan hasil ini.
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={() => setLocatedOnly(false)}
                                className="mt-2 block h-7 px-2 text-[11px] font-bold text-primary hover:bg-primary/10 hover:text-primary"
                              >
                                Tampilkan paket berlokasi umum
                              </Button>
                            </span>
                          )
                          : "Tidak ada paket yang cocok dengan filter saat ini."}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </aside>

            <div className={`relative order-2 border-b border-border lg:order-2 lg:border-b-0 ${selectedPackage ? "lg:col-span-6" : "lg:col-span-9"} ${fillViewport ? "h-[580px] lg:h-full lg:min-h-0" : ""}`}>
              <MapCanvas
                areaStats={mapAggregate}
                region={activeRegion}
                selectedPackage={selectedPackage}
                selectedRegion={selectedRegion}
                onSelectRegion={selectRegion}
                onViewportChange={setMapBbox}
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
                              {regionLabel}
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
                              <li aria-current="location" className="font-semibold text-foreground">{environmentLabel} {selectedPackage.rw}</li>
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
                            <td className="py-2 font-medium text-foreground">{selectedPackage.bulan ?? "Belum tersedia"}</td>
                          </tr>
                          <tr>
                            <th scope="row" className="w-28 py-2 pr-3 text-left align-top font-semibold text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Metode & dana</th>
                            <td className="py-2 font-medium leading-snug text-foreground">{selectedPackage.metode ?? "Tidak dicantumkan"}{selectedPackage.sumber ? ` (${selectedPackage.sumber.replace(/,+$/, "")})` : ""}</td>
                          </tr>
                        </tbody>
                      </table>

                      {selectedPackage.kontrak ? (
                        <div className="mt-4 border border-border">
                          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/20 px-3 py-2">
                            <p className="font-sans text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{selectedPackage.kontrak.jenis === "tender" ? "Pemenang & kontrak" : "Penyedia & kontrak"}</p>
                            <span className="shrink-0 border border-primary/30 bg-primary/5 px-1.5 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-primary">
                              {selectedPackage.kontrak.sumber === "LPSE" ? "Data resmi (LPSE)" : "Data resmi (INAPROC)"}
                            </span>
                          </div>
                          <table className="w-full border-collapse font-sans text-sm">
                            <tbody>
                              <tr className="border-b border-border/60">
                                <th scope="row" className="w-24 py-2 pl-3 pr-2 text-left align-top font-semibold text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Penyedia</th>
                                <td className="py-2 pr-3 leading-snug text-foreground">
                                  <ul className="space-y-1">
                                    {penyediaPanel.slice(0, tampilSemuaPenyedia ? undefined : 2).map((baris) => (
                                      <li key={baris.nama} className="flex items-baseline justify-between gap-2">
                                        <Link href={`/penyedia/${slugPenyedia(baris.nama)}?region=${encodeURIComponent(regionId)}`} className="font-semibold text-primary underline-offset-2 hover:underline">
                                          {baris.nama}
                                        </Link>
                                        {baris.nilai ? (
                                          <span className="shrink-0 font-sans text-[11px] tabular-nums text-muted-foreground">{formatRupiahFull(baris.nilai)}</span>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                  {labelPenyediaTersembunyi && !tampilSemuaPenyedia ? (
                                    <button
                                      type="button"
                                      onClick={() => setTampilSemuaPenyedia(true)}
                                      className="mt-1 font-sans text-[11px] font-bold text-primary underline-offset-2 hover:underline"
                                    >
                                      {labelPenyediaTersembunyi}
                                    </button>
                                  ) : null}
                                  {panelPenyedia.adaPenyediaBersama ? (
                                    <p className="mt-1 font-sans text-[10px] leading-snug text-muted-foreground">
                                      Nilai transaksi dicatat bersama untuk penyedia dalam satu paket dan tidak dibagi.
                                    </p>
                                  ) : null}
                                </td>
                              </tr>
                              <tr className="border-b border-border/60">
                                <th scope="row" className="py-2 pl-3 pr-2 text-left align-top font-semibold text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Nilai kontrak</th>
                                <td className="py-2 pr-3 font-semibold tabular-nums text-foreground">
                                  {selectedPackage.kontrak.nilai_kontrak ? formatRupiahFull(selectedPackage.kontrak.nilai_kontrak) : "Tidak tercatat"}
                                </td>
                              </tr>
                              {selectedPackage.kontrak.hps ? (
                                <tr className="border-b border-border/60">
                                  <th scope="row" className="py-2 pl-3 pr-2 text-left align-top font-semibold text-[10px] uppercase tracking-[0.06em] text-muted-foreground">HPS</th>
                                  <td className="py-2 pr-3 tabular-nums text-foreground">{formatRupiahFull(selectedPackage.kontrak.hps)}</td>
                                </tr>
                              ) : null}
                              {selectedPackage.kontrak.nilai_kontrak ? (
                                <tr>
                                  <th scope="row" className="py-2 pl-3 pr-2 text-left align-top font-semibold text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Selisih pagu</th>
                                  <td className="py-2 pr-3 tabular-nums text-foreground">
                                    {formatRupiahFull(selectedPackage.pagu - selectedPackage.kontrak.nilai_kontrak)}
                                    <span className="ml-1 text-[11px] text-muted-foreground">
                                      ({(((selectedPackage.pagu - selectedPackage.kontrak.nilai_kontrak) / selectedPackage.pagu) * 100).toFixed(1)}% dari pagu)
                                    </span>
                                  </td>
                                </tr>
                              ) : null}
                              {selectedPackage.kontrak.sumberTransaksi ? (
                                <tr className="border-t border-border/60">
                                  <th scope="row" className="py-2 pl-3 pr-2 text-left align-top font-semibold text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Sumber</th>
                                  <td className="py-2 pr-3 text-foreground">
                                    {selectedPackage.kontrak.sumberTransaksi}
                                    {selectedPackage.kontrak.transaksi && selectedPackage.kontrak.transaksi > 1 ? (
                                      <span className="ml-1 text-[11px] text-muted-foreground">· {selectedPackage.kontrak.transaksi} transaksi</span>
                                    ) : null}
                                  </td>
                                </tr>
                              ) : null}
                              {selectedPackage.kontrak.jumlahPaket && selectedPackage.kontrak.jumlahPaket > 1 ? (
                                <tr className="border-t border-border/60">
                                  <th scope="row" className="py-2 pl-3 pr-2 text-left align-top font-semibold text-[10px] uppercase tracking-[0.06em] text-muted-foreground">Paket realisasi</th>
                                  <td className="py-2 pr-3 text-foreground">
                                    <span className="font-semibold">{selectedPackage.kontrak.jumlahPaket} paket</span>
                                    <details className="mt-1 border-t border-border/60 pt-1.5">
                                      <summary className="flex cursor-pointer items-center justify-between gap-2 font-sans text-[11px] font-bold text-primary">
                                        <span>Rincian {selectedPackage.kontrak.jumlahPaket} paket</span>
                                        <span className="tabular-nums text-muted-foreground">
                                          {selectedPackage.kontrak.nilai_kontrak ? formatRupiahFull(selectedPackage.kontrak.nilai_kontrak) : ""}
                                        </span>
                                      </summary>
                                      <div className="mt-2 space-y-2">
                                        {paketPerPenyedia.map((grup) => (
                                          <div key={grup.nama} className="border-l-2 border-primary/30 pl-2">
                                            <p className="flex items-baseline justify-between gap-2 font-sans text-[11px] font-semibold text-foreground">
                                              <span className="truncate">{grup.nama}</span>
                                              <span className="shrink-0 text-[10px] font-normal tabular-nums text-muted-foreground">
                                                {grup.daftar.length} paket · {formatRupiahFull(grup.total)}
                                              </span>
                                            </p>
                                            <ul className="mt-1 space-y-1">
                                              {grup.daftar.map((paket) => (
                                                <li key={paket.kodePaket} className="flex items-baseline justify-between gap-2">
                                                  <a
                                                    href={`https://data.inaproc.id/realisasi?kode=${encodeURIComponent(paket.kodePaket)}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="truncate font-mono text-[10px] text-primary underline-offset-2 hover:underline"
                                                    title={`${paket.kodePaket}${paket.sumber ? ` · ${paket.sumber}` : ""}`}
                                                  >
                                                    {paket.kodePaket.slice(0, 16)}{paket.kodePaket.length > 16 ? "…" : ""}
                                                  </a>
                                                  <span className="shrink-0 text-[10px] tabular-nums text-foreground/80">
                                                    {formatRupiahFull(paket.nilai)}
                                                  </span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        ))}
                                      </div>
                                      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
                                        Tiap nilai adalah realisasi paket itu sendiri, bukan nilai kontrak. Kode paket membuka halaman
                                        realisasi Data INAPROC.
                                      </p>
                                    </details>
                                  </td>
                                </tr>
                              ) : null}
                            </tbody>
                          </table>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-3 py-2">
                            <Link href={`/penyedia/${slugPenyedia(selectedPackage.kontrak.penyedia)}?region=${encodeURIComponent(regionId)}`} className="font-sans text-[11px] font-bold text-primary underline-offset-2 hover:underline">
                              Rekam jejak penyedia
                            </Link>
                            {selectedPackage.kontrak.url ? (
                              <a href={selectedPackage.kontrak.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-primary hover:underline">
                                {selectedPackage.kontrak.sumber === "LPSE" ? "Halaman LPSE" : "Detail paket di Data INAPROC"} <FiExternalLink aria-hidden="true" className="size-3" />
                              </a>
                            ) : null}
                          </div>
                          <p className="border-t border-border px-3 py-2 font-sans text-[10px] leading-relaxed text-muted-foreground">
                            {selectedPackage.kontrak.sumber === "LPSE"
                              ? "Nama penyedia dan nilai kontrak dari LPSE, ditampilkan sebagai fakta kontrak — bukan penilaian kinerja. NPWP disamarkan oleh LPSE."
                              : "Paket ini melalui e-purchasing/e-katalog, yang pencatatannya ada di Data INAPROC (bukan LPSE). Nama penyedia dan nilai transaksi ditampilkan sebagai fakta kontrak — bukan penilaian kinerja."}
                          </p>
                        </div>
                      ) : (
                        <div className="mt-4 border border-dashed border-border bg-muted/10 p-3">
                          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Tanpa rekam kontrak di LPSE</p>
                          <p className="mt-1 font-sans text-[12px] leading-relaxed text-foreground/80">
                            {(selectedPackage.metode ?? "").toLocaleLowerCase("id-ID").includes("e-purchasing")
                              ? "Paket ini melalui e-purchasing (e-katalog), yang tidak menerbitkan nama penyedia di LPSE."
                              : (selectedPackage.metode ?? "").toLocaleLowerCase("id-ID").includes("dikecualikan")
                                ? "Paket dikecualikan dari prosedur pengadaan LPSE."
                                : "Belum ada pencatatan tender atau pengadaan langsung yang cocok di LPSE untuk paket ini."}
                          </p>
                        </div>
                      )}

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
