"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  createMultiParser,
  createParser,
  debounce,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";
import { FiArrowLeft, FiArrowRight, FiCheck, FiChevronDown, FiChevronLeft, FiChevronRight, FiCopy, FiExternalLink, FiFilter, FiSearch } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatRupiahFull } from "./road-types";
import { MapIntroSection } from "./map-intro-section";
import { MAP_SEARCH_EVENT } from "./map-search-events";
import { fetchRoadPackage, fetchRoadPackageMap, fetchRoadPackages } from "./package-api";
import { ROAD_WORK_LABELS } from "@/contracts/packages/road-work";
import { normalizeAreaKey } from "@/contracts/packages/area-key";
import { slugPenyedia } from "@/contracts/packages/vendor-slug";
import { buildPenyediaPanel, labelPenyediaLain } from "./penyedia-panel";
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
  RoadContractFilter,
  RoadPackageItem,
  RoadPackageMapData,
  RoadPackageSearchData,
  RoadPackageSearchFilters,
  RoadPackageSort,
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

const SORT_OPTIONS: RoadPackageSort[] = ["pagu-desc", "pagu-asc", "nama"];
const SORT_LABELS: Record<RoadPackageSort, string> = {
  "pagu-desc": "Pagu terbesar",
  "pagu-asc": "Pagu terkecil",
  nama: "Nama A–Z",
};

const FILTER_TRIGGER_CLASS =
  "h-7 w-full min-w-0 border-0 bg-transparent px-1.5 text-xs font-semibold shadow-none hover:bg-primary/10 hover:text-primary data-[popup-open]:bg-primary/10 data-[popup-open]:text-primary";

const parseAsWorkCategory = createParser<RoadWorkCategory>({
  parse: (value) => {
    const upper = value.toLocaleUpperCase("id-ID");
    return upper === "PERMUKAAN" || upper === "DRAINASE" || upper === "JEMBATAN"
      ? upper
      : null;
  },
  serialize: (value) => value.toLocaleLowerCase("id-ID"),
});

const parseAsVillages = createMultiParser<string[]>({
  parse: (values) => {
    const clean = values.filter(Boolean);
    return clean.length > 0 ? clean : null;
  },
  serialize: (values) => values,
  eq: (a, b) => a.length === b.length && a.every((item, index) => item === b[index]),
});

const MAP_FILTER_PARSERS = {
  tahun: parseAsStringLiteral(["2025", "2026"] as const),
  kelompok: parseAsNumberLiteral([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const),
  umum: parseAsStringLiteral(["1"] as const),
  lokasi: parseAsStringLiteral(["0"] as const),
  jenis: parseAsWorkCategory,
  kontrak: parseAsStringLiteral(["ADA", "TANPA"] as const),
  desa: parseAsVillages,
  urut: parseAsStringLiteral(["pagu-asc", "nama"] as const),
  tampilan: parseAsStringLiteral(["budget"] as const),
  q: parseAsString.withDefault("").withOptions({ limitUrlUpdates: debounce(180) }),
};

function normalizeDistrictName(value: string) {
  return value
    .toLocaleLowerCase("id-ID")
    .replace(/^(kecamatan|kec\.?)[\s-]*/u, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function currentAddressUrl(regionId: string) {
  const segments = window.location.pathname.split("/").filter(Boolean).slice(1);
  const selection = parseReportSegments(segments, regionId);
  const path = routeForAddress({
    districtSlug: selection.districtSlug,
    villageSlug: selection.villageSlug,
    rwSlug: selection.rwSlug,
  }, regionId);
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
    budgetDecile?: number;
    generalOnly?: boolean;
    locatedOnly?: boolean;
    selectedDistrict?: string;
    selectedRegion?: ReportAddress | null;
    selectedPackage?: RoadPackageItem | null;
    selectedYear?: "SEMUA" | "2025" | "2026";
    selectedWork?: RoadWorkCategory;
    selectedContract?: RoadContractFilter;
    selectedVillages?: string[] | null;
    selectedSort?: RoadPackageSort;
    mapView?: ReportViewMode;
    searchQuery?: string;
  };
}

const PAGE_SIZE = 50;

export default function MapDashboard({ initialData, initialAggregate, regionId, availableRegions, showIntro = true, fillViewport = false, addressRouting = false, initialRouteState }: MapDashboardProps) {
  const router = useRouter();
  const [packageData, setPackageData] = useState<RoadPackageSearchData | null>(initialData);
  const [mapData, setMapData] = useState<RoadPackageMapData | null>(initialAggregate);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filters, setFilters] = useQueryStates(MAP_FILTER_PARSERS, {
    history: "replace",
    shallow: true,
  });
  const selectedYear: "SEMUA" | "2025" | "2026" = filters.tahun ?? "SEMUA";
  const [selectedDistrict, setSelectedDistrict] = useState<string>(initialRouteState?.selectedDistrict ?? "SEMUA");
  const [allVillagesUnchecked, setAllVillagesUnchecked] = useState(false);
  const selectedVillages = useMemo(
    () => (allVillagesUnchecked ? [] : filters.desa),
    [allVillagesUnchecked, filters.desa],
  );
  const [openVillages, setOpenVillages] = useState(false);
  const villagesRef = useRef<HTMLDivElement | null>(null);
  const locatedOnly = filters.lokasi !== "0";
  const budgetDecile = filters.kelompok ?? undefined;
  const generalOnly = filters.umum === "1";
  const activeDecile = selectedYear !== "SEMUA" ? budgetDecile : undefined;

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
  const selectedWork: RoadWorkCategory = filters.jenis ?? "SEMUA";
  const selectedContract: RoadContractFilter = filters.kontrak ?? "SEMUA";
  const selectedSort: RoadPackageSort = filters.urut ?? "pagu-desc";
  const searchQuery = filters.q;
  const [selectedPackage, setSelectedPackage] = useState<RoadPackageItem | null>(initialRouteState?.selectedPackage ?? null);
  const selectedPackageRef = useRef<RoadPackageItem | null>(initialRouteState?.selectedPackage ?? null);
  const [selectedRegion, setSelectedRegion] = useState<ReportAddress | null>(initialRouteState?.selectedRegion ?? null);
  const mapView: ReportViewMode = filters.tampilan ?? "packages";
  // Di layar kecil peta tampil lebih dulu; daftar dan panel dibuka lewat segmented control.
  const [mobilePane, setMobilePane] = useState<"map" | "list">("map");
  const [listOpen, setListOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [copiedRup, setCopiedRup] = useState(false);

  const updateSelectedPackage = (pkg: RoadPackageItem | null) => {
    selectedPackageRef.current = pkg;
    setSelectedPackage(pkg);
    setCopiedRup(false);
  };

  useEffect(() => {
    if (!copiedRup) return;
    const timer = window.setTimeout(() => setCopiedRup(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copiedRup]);

  useEffect(() => {
    function handleMapSearch(event: Event) {
      const query = (event as CustomEvent<string>).detail;
      void setFilters({ q: query || null });
      document.getElementById("jelajahi")?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => document.getElementById("map-package-search")?.focus({ preventScroll: true }), 350);
    }

    window.addEventListener(MAP_SEARCH_EVENT, handleMapSearch);
    return () => window.removeEventListener(MAP_SEARCH_EVENT, handleMapSearch);
  }, [setFilters]);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    if (generalOnly) params.set("umum", "1");
    if (activeDecile) params.set("kelompok", String(activeDecile));
    if (selectedYear !== "SEMUA") params.set("year", selectedYear);
    if (selectedDistrict !== "SEMUA") params.set("district", selectedDistrict);
    for (const desa of selectedVillages ?? []) params.append("desa", desa);
    if (locatedOnly) params.set("lokasi", "1");
    if (selectedWork !== "SEMUA") params.set("work", selectedWork);
    if (selectedContract !== "SEMUA") params.set("kontrak", selectedContract);
    if (selectedSort !== "pagu-desc") params.set("sort", selectedSort);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    return params.toString();
  }, [generalOnly, activeDecile, selectedYear, selectedDistrict, selectedVillages, locatedOnly, selectedWork, selectedContract, selectedSort, searchQuery]);

  const lastRequestedQuery = useRef(queryString);
  const currentFilters = useMemo<RoadPackageSearchFilters>(() => ({
    region: regionId,
    generalOnly,
    budgetDecile: activeDecile,
    year: selectedYear === "SEMUA" ? undefined : selectedYear,
    district: selectedDistrict === "SEMUA" ? undefined : selectedDistrict,
    villages: selectedVillages ?? undefined,
    locatedOnly,
    work: selectedWork,
    contract: selectedContract,
    query: searchQuery.trim() || undefined,
  }), [generalOnly, activeDecile, locatedOnly, regionId, searchQuery, selectedContract, selectedDistrict, selectedVillages, selectedWork, selectedYear]);

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
            window.history.replaceState(null, "", currentAddressUrl(regionId));
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setPackageData(null);
            updateSelectedPackage(null);
            if (addressRouting) {
              window.history.replaceState(null, "", currentAddressUrl(regionId));
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
  }, [addressRouting, currentFilters, queryString, regionId, searchQuery, selectedVillages]);

  // Agregat peta tidak menyaring kecamatan/kelurahan agar klik wilayah hanya menyorot
  // area terpilih tanpa menyembunyikan wilayah lain di sekitarnya.
  const mapQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (generalOnly) params.set("umum", "1");
    if (activeDecile) params.set("kelompok", String(activeDecile));
    if (selectedYear !== "SEMUA") params.set("year", selectedYear);
    if (locatedOnly) params.set("lokasi", "1");
    if (selectedWork !== "SEMUA") params.set("work", selectedWork);
    if (selectedContract !== "SEMUA") params.set("kontrak", selectedContract);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    return params.toString();
  }, [generalOnly, activeDecile, selectedYear, locatedOnly, selectedWork, selectedContract, searchQuery]);

  const mapFilters = useMemo<RoadPackageSearchFilters>(() => ({
    ...currentFilters,
    district: undefined,
    villages: undefined,
  }), [currentFilters]);

  const lastMapQuery = useRef(mapQueryString);
  useEffect(() => {
    if (lastMapQuery.current === mapQueryString) return;
    lastMapQuery.current = mapQueryString;

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      fetchRoadPackageMap(mapFilters, controller.signal)
        .then((aggregate) => setMapData(aggregate))
        .catch(() => {
          // Pertahankan agregat terakhir; daftar register punya pesan galat sendiri.
        });
    }, searchQuery.trim() ? 180 : 0);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [mapFilters, mapQueryString, searchQuery]);

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
    if (berikut.length === 0) {
      setAllVillagesUnchecked(true);
      void setFilters({ desa: null });
      return;
    }
    setAllVillagesUnchecked(false);
    void setFilters({ desa: berikut.length === villageOptions.length ? null : berikut });
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
      totals: {
        count: 0,
        budget: 0,
        withContract: 0,
        vendors: 0,
        located: 0,
        workCounts: { PERMUKAAN: 0, DRAINASE: 0, JEMBATAN: 0 },
      },
      bbox: null,
    };
    if (kelurahanKosong) return kosong;
    return mapData ?? { ...kosong, filteredCount };
  }, [filteredCount, initialData.region, kelurahanKosong, mapData, totalCount]);

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

  const writeReportPath = (
    path: string,
    overrides?: Partial<Parameters<typeof routeForFilters>[1]>,
  ) => {
    if (!addressRouting) return;
    const nextUrl = routeForFilters(path, {
      region: regionId,
      generalOnly,
      budgetDecile: activeDecile,
      locatedOnly,
      year: selectedYear,
      work: selectedWork,
      contract: selectedContract,
      villages: selectedVillages ?? undefined,
      sort: selectedSort,
      view: mapView,
      query: searchQuery,
      ...overrides,
    });
    window.history.pushState(null, "", nextUrl);
  };

  const addressPath = (address: ReportAddress) => routeForAddress(address, regionId);
  const packagePath = (pkg: RoadPackageItem) => routeForPackage(pkg, regionId);

  const pilihKecamatan = (district: string) => {
    const address = district === "SEMUA" ? null : { districtSlug: districtSlug(district) };
    setSelectedDistrict(district);
    setAllVillagesUnchecked(false);
    setOpenVillages(false);
    setSelectedRegion(address);
    updateSelectedPackage(null);
    writeReportPath(address ? addressPath(address) : "/peta-pekerjaan", {
      generalOnly: false,
      villages: undefined,
    });
    void setFilters({ umum: null, desa: null });
  };

  /** Kembalikan seluruh filter ke keadaan awal; urutan register dan tema peta tidak diubah. */
  const clearFilters = () => {
    setAllVillagesUnchecked(false);
    setOpenVillages(false);
    setSelectedDistrict("SEMUA");
    setSelectedRegion(null);
    updateSelectedPackage(null);
    writeReportPath("/peta-pekerjaan", {
      year: "SEMUA",
      budgetDecile: undefined,
      generalOnly: false,
      villages: undefined,
      work: "SEMUA",
      contract: "SEMUA",
      locatedOnly: true,
      query: "",
    });
    void setFilters({
      tahun: null,
      kelompok: null,
      umum: null,
      desa: null,
      lokasi: null,
      jenis: null,
      kontrak: null,
      q: null,
    });
  };

  const selectPackage = (pkg: RoadPackageItem) => {
    const address = addressForPackage(pkg);
    updateSelectedPackage(pkg);
    setSelectedRegion(address);
    writeReportPath(packagePath(pkg));
  };

  const panelPenyedia = useMemo(
    () => buildPenyediaPanel(selectedPackage?.kontrak),
    [selectedPackage],
  );
  const penyediaPanel = panelPenyedia.baris;
  const labelPenyediaTersembunyi = labelPenyediaLain(penyediaPanel.length);
  const nilaiKontrak = selectedPackage?.kontrak?.nilai_kontrak ?? null;
  const selisihPagu = nilaiKontrak !== null && selectedPackage ? selectedPackage.pagu - nilaiKontrak : null;
  const selisihPersen = selisihPagu !== null && selectedPackage?.pagu
    ? (selisihPagu / selectedPackage.pagu) * 100
    : null;

  // Klik poligon = pilih wilayah: filter register ke kecamatan/kelurahan itu, sorot wilayah,
  // dan jangan membuka paket contoh. Paket hanya dibuka dari klik baris register.
  const selectRegion = (region: { district: string | null; village: string | null; rw: string | null; precision: "RW" | "Kelurahan" | "Kecamatan" } | null) => {
    if (!region) {
      setSelectedDistrict("SEMUA");
      setAllVillagesUnchecked(false);
      setSelectedRegion(null);
      updateSelectedPackage(null);
      writeReportPath("/peta-pekerjaan", { villages: undefined });
      void setFilters({ desa: null });
      return;
    }
    const requestedDistrict = region.district ?? "";
    const matchedDistrict = districts.find((name) => normalizeDistrictName(name) === normalizeDistrictName(requestedDistrict));
    const daftarKelurahan = matchedDistrict ? villagesByDistrict[matchedDistrict] ?? [] : [];
    const namaKelurahan = region.village
      ? daftarKelurahan.find((nama) => normalizeAreaKey(nama) === normalizeAreaKey(region.village))
      : undefined;
    const address: ReportAddress = {
      districtSlug: matchedDistrict ? districtSlug(matchedDistrict) : requestedDistrict ? districtSlug(requestedDistrict) : undefined,
      villageSlug: region.village ? addressSlug(region.village) : undefined,
      rwSlug: region.precision === "RW" && region.rw ? `rw-${addressSlug(region.rw.replace(/^rw-?/i, ""))}` : undefined,
    };
    const nextVillages = region.precision === "Kecamatan" || !namaKelurahan ? null : [namaKelurahan];
    setAllVillagesUnchecked(false);
    setSelectedDistrict(matchedDistrict ?? "SEMUA");
    setSelectedRegion(address);
    updateSelectedPackage(null);
    writeReportPath(addressPath(address), {
      generalOnly: false,
      villages: nextVillages ?? undefined,
    });
    void setFilters({ umum: null, desa: nextVillages });
  };

  const closeSelectedPackage = () => {
    updateSelectedPackage(null);
    const address = selectedRegion ?? (selectedDistrict !== "SEMUA" ? { districtSlug: districtSlug(selectedDistrict) } : null);
    writeReportPath(address ? addressPath(address) : "/peta-pekerjaan");
  };

  useEffect(() => {
    if (!addressRouting) return;
    const restoreFromLocation = () => {
      const segments = window.location.pathname.split("/").filter(Boolean).slice(1);
      const selection = parseReportSegments(segments, regionId);
      const district = districts.find((name) => districtSlug(name) === selection.districtSlug);
      const rupPackage = selection.rupCode
        ? initialData.items.find((item) => item.kode_rup === selection.rupCode)
        : null;
      setAllVillagesUnchecked(false);
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

  // Badge sumber lokasi (AGENTS.md aturan 9). Paket tanpa anchor wilayah tidak diberi badge;
  // baris lokasinya sudah berbunyi "Lokasi umum".
  const labelPresisi = (pkg: RoadPackageItem) => {
    if (pkg.presisi_peta === "RW" && pkg.rw) return `${environmentLabel} ${pkg.rw}`;
    if (pkg.presisi_peta === "Kelurahan") return "Kelurahan";
    if (pkg.presisi_peta === "Kecamatan") return "Kecamatan";
    return null;
  };

  const activeFilterLabels = [
    selectedYear !== "SEMUA" ? `TA ${selectedYear}` : null,
    selectedDistrict !== "SEMUA" ? selectedDistrict : null,
    selectedVillages?.length
      ? selectedVillages.length === 1
        ? selectedVillages[0]
        : `${selectedVillages.length} kelurahan`
      : null,
    selectedWork !== "SEMUA" ? WORK_LABELS[selectedWork] : null,
    selectedContract !== "SEMUA" ? CONTRACT_LABELS[selectedContract] : null,
    !locatedOnly ? "termasuk lokasi umum" : null,
    generalOnly ? "lokasi umum saja" : null,
    searchQuery.trim() ? `“${searchQuery.trim()}”` : null,
  ].filter((label): label is string => Boolean(label));
  const filterCount = [
    selectedYear !== "SEMUA",
    selectedDistrict !== "SEMUA",
    Boolean(selectedVillages?.length),
    selectedWork !== "SEMUA",
    selectedContract !== "SEMUA",
    !locatedOnly,
  ].filter(Boolean).length;

  const pindahRegion = (id: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set("region", id);
      router.push(`${addressRouting ? "/peta-pekerjaan" : "/"}?${params.toString()}`);
  };

  return (
    <>
      {showIntro && <MapIntroSection searchQuery={searchQuery} onSearchChange={(query) => void setFilters({ q: query })} />}
      <section aria-label="Jelajahi paket jalan" className={fillViewport ? "min-h-[calc(100dvh-4rem)] bg-white max-lg:flex max-lg:flex-col lg:h-full" : "bg-white pt-8 pb-12 sm:pt-10"}>
      <div className={fillViewport ? "h-full w-full px-0 max-lg:flex max-lg:flex-1 max-lg:flex-col" : "w-full px-4 sm:px-6 lg:px-8"}>
        <TooltipProvider>
        <Card className={`overflow-hidden rounded-xs border-border bg-white shadow-none ${fillViewport ? "max-lg:flex max-lg:min-h-0 max-lg:flex-1 max-lg:flex-col lg:flex lg:h-full lg:min-h-0 lg:flex-col" : ""}`}>
          {(activeDecile || generalOnly) && <div role="status" className="flex flex-wrap items-center justify-between gap-2 bg-secondary/20 px-4 py-1.5 text-sm"><p><strong>{activeDecile ? `Kelompok D${activeDecile} · ${selectedYear}` : "Pilihan dari analisis"}{generalOnly ? " · Lokasi umum" : ""}</strong> · dari analisis konsentrasi pagu. {locatedOnly ? "Menampilkan paket berlokasi; paket lokasi umum tersedia lewat filter lokasi." : "Termasuk paket lokasi umum di daftar."}</p><button type="button" onClick={() => void setFilters({ kelompok: null, umum: null })} className="min-h-9 font-bold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-primary">Lepas kelompok</button></div>}
          {availableRegions.length > 1 && (
            <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-3 py-2">
              <span className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Wilayah kerja</span>
              <Select value={regionId} onValueChange={(value) => value && pindahRegion(value)}>
                <SelectTrigger aria-label="Pilih wilayah kerja" className="h-7 w-56 border-0 bg-transparent px-1.5 text-xs font-semibold shadow-none hover:bg-primary/10 hover:text-primary data-[popup-open]:bg-primary/10 data-[popup-open]:text-primary">
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
          <div className="relative grid gap-2 border-b border-border bg-muted/20 p-2.5 sm:grid-cols-[minmax(0,2.5fr)_minmax(220px,1fr)] lg:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3 sm:py-2">
            <div className={`${filtersOpen ? "grid" : "hidden lg:grid"} grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.05fr)_minmax(0,0.95fr)] xl:gap-2`}>
              <div className="flex min-w-0 flex-col gap-0.5 px-1 py-0.5">
                <span className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">TA</span>
                <Select value={selectedYear} onValueChange={(val) => void setFilters({ tahun: val === "2025" || val === "2026" ? val : null, kelompok: null })}>
                  <SelectTrigger aria-label="Tahun anggaran" className={FILTER_TRIGGER_CLASS}>
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
                <Select value={selectedDistrict} onValueChange={(val) => pilihKecamatan(val ?? "SEMUA")}>
                  <SelectTrigger aria-label="Pilih kecamatan" className={FILTER_TRIGGER_CLASS}>
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
                  className={`group flex h-7 w-full min-w-0 items-center justify-between gap-1 rounded-xs px-1.5 text-left text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
                    selectedDistrict === "SEMUA"
                      ? "cursor-not-allowed text-muted-foreground/60"
                      : kelurahanKosong
                        ? "cursor-pointer bg-destructive/10 text-destructive underline decoration-destructive/40 decoration-wavy underline-offset-2 hover:bg-destructive/15"
                        : openVillages
                          ? "cursor-pointer bg-primary/10 text-primary"
                          : "cursor-pointer text-foreground hover:bg-primary/10 hover:text-primary"
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
                  <FiChevronDown
                    className={`size-3.5 shrink-0 transition-transform duration-150 ${
                      selectedDistrict === "SEMUA"
                        ? "opacity-60"
                        : openVillages
                          ? "rotate-180 text-primary"
                          : "opacity-60 group-hover:text-primary group-hover:opacity-100"
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {(openVillages || kelurahanKosong) && selectedDistrict !== "SEMUA" && (
                  <div className="absolute top-full left-0 z-50 mt-1 w-60 border border-border bg-white shadow-md">
                    <div className="flex items-center justify-between gap-2 border-b border-border px-2 py-1.5">
                      <span className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                        {villageOptions.length} kelurahan
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAllVillagesUnchecked(false);
                          void setFilters({ desa: null });
                        }}
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
                <Select value={selectedWork} onValueChange={(val) => void setFilters({ jenis: val && val !== "SEMUA" ? (val as RoadWorkCategory) : null })}>
                  <SelectTrigger aria-label="Jenis pekerjaan" className={FILTER_TRIGGER_CLASS}>
                    <SelectValue>{WORK_LABELS[selectedWork]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_OPTIONS.map((work) => <SelectItem key={work} value={work}>{WORK_LABELS[work]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 px-1 py-0.5">
                <span className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Kontrak</span>
                <Select value={selectedContract} onValueChange={(val) => void setFilters({ kontrak: val === "ADA" || val === "TANPA" ? val : null })}>
                  <SelectTrigger aria-label="Status rekam kontrak LPSE" className={FILTER_TRIGGER_CLASS}>
                    <SelectValue>{CONTRACT_LABELS[selectedContract]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_OPTIONS.map((kontrak) => <SelectItem key={kontrak} value={kontrak}>{CONTRACT_LABELS[kontrak]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex min-w-0 flex-col gap-0.5 px-1 py-0.5">
                <span className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Urutkan</span>
                <Select value={selectedSort} onValueChange={(value) => void setFilters({ urut: value === "pagu-asc" || value === "nama" ? value : null })}>
                  <SelectTrigger aria-label="Urutan register paket" className={FILTER_TRIGGER_CLASS}>
                    <SelectValue>{SORT_LABELS[selectedSort]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((sort) => <SelectItem key={sort} value={sort}>{SORT_LABELS[sort]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex w-full min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1 border-t border-border pt-1.5 font-sans text-[11px] text-muted-foreground sm:border-t-0 sm:pt-0">
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                aria-expanded={filtersOpen}
                className="mr-auto flex min-h-7 items-center gap-1.5 px-1 font-sans text-[11px] font-bold text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:hidden"
              >
                <FiFilter className="size-3.5" aria-hidden="true" />
                Filter{filterCount > 0 ? ` (${filterCount})` : ""}
              </button>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5" title="Sembunyikan paket yang hanya punya lokasi umum (presisi kabupaten)">
                <input
                  type="checkbox"
                  checked={locatedOnly}
                  onChange={(event) => void setFilters({
                    lokasi: event.target.checked ? null : "0",
                    ...(event.target.checked ? { umum: null } : {}),
                  })}
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
                  onChange={(event) => void setFilters({ q: event.target.value })}
                  placeholder="Cari kelurahan, jalan, atau RUP"
                  className="h-8 pl-8 pr-2 text-[11px]"
                />
              </label>}
              <span role="status" aria-live="polite" className="sr-only">
                {isLoading ? "Memuat paket…" : ""}
              </span>
            </div>
            {isLoading && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-primary/20"
              >
                <div className="h-full w-full animate-pulse bg-primary" />
              </div>
            )}
          </div>

          {activeFilterLabels.length > 0 && (
            <div className="flex items-start justify-between gap-3 border-b border-border bg-white px-3 py-1.5">
              <p className="min-w-0 font-sans text-[11px] leading-snug text-muted-foreground">
                <span className="mr-1 font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-foreground/70">Filter aktif</span>
                {activeFilterLabels.join(" · ")}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 font-sans text-[11px] font-bold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Hapus filter
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 border-b border-border lg:hidden" role="group" aria-label="Tampilan peta atau daftar">
            {(["map", "list"] as const).map((pane) => (
              <button
                key={pane}
                type="button"
                onClick={() => {
                  setMobilePane(pane);
                  if (selectedPackage) closeSelectedPackage();
                }}
                aria-pressed={mobilePane === pane}
                className={`min-h-10 font-sans text-[11px] font-bold uppercase tracking-[0.08em] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                  mobilePane === pane ? "bg-primary text-white" : "bg-white text-foreground/70 hover:bg-muted"
                }`}
              >
                {pane === "map" ? "Peta" : "Daftar"}
              </button>
            ))}
          </div>

          <div className={`grid grid-cols-1 lg:grid-cols-12 ${fillViewport ? "max-lg:min-h-0 max-lg:flex-1 max-lg:grid-rows-[minmax(0,1fr)] lg:min-h-0 lg:flex-1" : ""}`}>
            <aside
              id="saksi-package-list"
              aria-label="Daftar paket jalan"
              className={`order-1 flex min-w-0 flex-col border-r border-border bg-white lg:col-span-3 ${fillViewport ? "h-full max-lg:min-h-[360px] lg:min-h-0" : "h-[580px]"} ${listOpen ? "" : "lg:hidden"} ${mobilePane === "list" && !selectedPackage ? "" : "max-lg:hidden"}`}
            >
              <ScrollArea className="min-h-0 flex-1">
                <div className={`divide-y divide-border transition-opacity duration-150 ${isLoading && packageData ? "opacity-60" : ""}`}>
                  {filteredPackages.map((pkg) => (
                    <article key={pkg.kode_rup} className={`transition-colors hover:bg-muted/30 ${selectedPackage?.kode_rup === pkg.kode_rup ? "bg-primary/5" : ""}`}>
                      <button
                        type="button"
                        onClick={() => selectPackage(pkg)}
                        aria-label={`Lihat ringkasan paket ${pkg.nama}, RUP ${pkg.kode_rup}`}
                        aria-current={selectedPackage?.kode_rup === pkg.kode_rup ? "true" : undefined}
                        className="block w-full px-4 py-3 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                      >
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
                          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                            {labelPresisi(pkg) ? (
                              <Badge variant="outline" className="shrink-0 px-1 py-0 text-[9px] tracking-[0.08em]">{labelPresisi(pkg)}</Badge>
                            ) : null}
                            <p className="min-w-0 font-sans text-[11px] text-muted-foreground">{pkg.desa_resmi ? `${pkg.desa_resmi}${pkg.presisi_peta === "RW" && pkg.rw ? `, ${environmentLabel} ${pkg.rw}` : ""}, ${pkg.kecamatan_resmi}` : pkg.kecamatan_resmi ?? `Lokasi umum · ${regionLabel}`} · {pkg.bulan ?? "jadwal belum tersedia"}</p>
                          </div>
                          <span className="flex shrink-0 items-center gap-1 px-1 font-sans text-[11px] font-bold text-primary">Lihat <FiArrowRight aria-hidden="true" /></span>
                        </div>
                      </button>
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
                                onClick={() => void setFilters({ lokasi: "0" })}
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

            <div className={`relative order-2 min-w-0 border-b border-border lg:order-2 lg:border-b-0 ${listOpen ? (selectedPackage ? "lg:col-span-6" : "lg:col-span-9") : (selectedPackage ? "lg:col-span-9" : "lg:col-span-12")} ${fillViewport ? "h-full max-lg:min-h-[360px] lg:min-h-0" : ""} ${mobilePane === "map" && !selectedPackage ? "" : "max-lg:hidden"}`}>
              <MapCanvas
                areaStats={mapAggregate}
                region={activeRegion}
                selectedPackage={selectedPackage}
                selectedRegion={selectedRegion}
                onSelectRegion={selectRegion}
                viewMode={mapView}
                onViewModeChange={(mode) => void setFilters({ tampilan: mode === "budget" ? "budget" : null })}
                packageCount={isLoading || kelurahanKosong ? undefined : filteredCount}
                mapHeightClassName={fillViewport ? "h-full min-h-0" : undefined}
              />
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={() => setListOpen((open) => !open)}
                  aria-expanded={listOpen}
                  aria-controls="saksi-package-list"
                  aria-label={listOpen ? "Sembunyikan daftar paket" : "Tampilkan daftar paket"}
                  className="absolute top-1/2 left-0 z-20 hidden h-14 w-6 -translate-y-1/2 items-center justify-center rounded-r-xs border border-l-0 border-border bg-white/95 text-foreground shadow-sm transition-colors duration-150 hover:border-primary hover:bg-primary hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary lg:flex"
                >
                  {listOpen ? (
                    <FiChevronLeft className="size-4" aria-hidden="true" />
                  ) : (
                    <FiChevronRight className="size-4" aria-hidden="true" />
                  )}
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10}>
                  {listOpen ? "Sembunyikan daftar" : "Tampilkan daftar"}
                </TooltipContent>
              </Tooltip>
            </div>

            {selectedPackage && <aside className={`order-3 flex min-w-0 flex-col border-l border-border bg-white lg:col-span-3 lg:col-start-10 lg:order-3 ${fillViewport ? "h-full max-lg:min-h-[360px] lg:min-h-0" : "h-[580px]"}`}>
              {selectedPackage ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-muted/20 px-4 py-2.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => { setListOpen(true); closeSelectedPackage(); }}
                      className="-ml-2 h-7 gap-1.5 px-2 font-sans text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary active:translate-y-0"
                    >
                      <FiArrowLeft className="size-3.5" aria-hidden="true" />
                      <span>Kembali ke daftar</span>
                    </Button>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard?.writeText(selectedPackage.kode_rup).then(() => setCopiedRup(true)).catch(() => undefined);
                      }}
                      title="Salin kode RUP"
                      className="inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <span>{copiedRup ? "Tersalin" : `RUP ${selectedPackage.kode_rup}`}</span>
                      {copiedRup ? <FiCheck className="size-3 text-primary" aria-hidden="true" /> : <FiCopy className="size-3 opacity-70" aria-hidden="true" />}
                    </button>
                  </div>

                  <ScrollArea className="min-h-0 flex-1">
                    <div className="p-4">
                      <nav aria-label="Lokasi paket" className="min-w-0">
                        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1 font-sans text-xs">
                          <li>
                            <button type="button" onClick={() => { setSelectedDistrict("SEMUA"); setAllVillagesUnchecked(false); setSelectedRegion(null); updateSelectedPackage(null); writeReportPath("/peta-pekerjaan", { villages: undefined, query: "" }); void setFilters({ desa: null, q: null }); }} className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              {regionLabel}
                            </button>
                          </li>
                          {selectedPackage.kecamatan_resmi && <>
                            <li aria-hidden="true" className="text-muted-foreground">/</li>
                            <li>
                              <button type="button" onClick={() => { const district = selectedPackage.kecamatan_resmi ?? "SEMUA"; const address = district === "SEMUA" ? null : { districtSlug: districtSlug(district) }; setSelectedDistrict(district); setAllVillagesUnchecked(false); setSelectedRegion(address); updateSelectedPackage(null); writeReportPath(address ? addressPath(address) : "/peta-pekerjaan", { villages: undefined, query: "" }); void setFilters({ desa: null, q: null }); }} className="font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
                                  writeReportPath(addressPath(address));
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
                      <h2 className="mt-2 font-heading text-[17px] font-bold leading-snug tracking-tight text-foreground">
                        {selectedPackage.nama}
                      </h2>

                      <div className="mt-3">
                        <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Pagu paket · TA {selectedPackage.tahun}
                        </p>
                        <p className="mt-0.5 font-heading text-[22px] font-extrabold tabular-nums leading-tight tracking-tight text-primary">
                          {formatRupiahFull(selectedPackage.pagu)}
                        </p>
                      </div>

                      <dl className="mt-4 space-y-1.5 font-sans text-[13px]">
                        <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] gap-x-3 py-0.5">
                          <dt className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Satker</dt>
                          <dd className="font-medium leading-snug text-foreground">{selectedPackage.satker}</dd>
                        </div>
                        <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] gap-x-3 py-0.5">
                          <dt className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Jadwal</dt>
                          <dd className="font-medium text-foreground">{selectedPackage.bulan ?? "Belum tersedia"}</dd>
                        </div>
                        <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] gap-x-3 py-0.5">
                          <dt className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Metode & dana</dt>
                          <dd className="font-medium leading-snug text-foreground">{selectedPackage.metode ?? "Tidak dicantumkan"}{selectedPackage.sumber ? ` (${selectedPackage.sumber.replace(/,+$/, "")})` : ""}</dd>
                        </div>
                      </dl>

                      {selectedPackage.kontrak && !selectedPackage.kontrak.paketRealisasi?.length ? (
                        <div className="mt-4 border border-dashed border-border/80 bg-muted/10 p-3">
                          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Rincian realisasi belum tersedia</p>
                          <p className="mt-1 font-sans text-xs leading-relaxed text-foreground/80">
                            {selectedPackage.kontrak.sumber === "LPSE"
                              ? "Pengumuman SPSE paket ini sudah tercatat (penyedia, nilai kontrak, dan HPS di bawah). Data INAPROC belum memuat transaksi realisasinya, jadi kode paket realisasi belum bisa ditampilkan."
                              : "Rincian kode paket dan nilai transaksi realisasi untuk paket ini belum tersedia."}
                          </p>
                        </div>
                      ) : null}

                      {selectedPackage.kontrak ? (
                        <div className="mt-4 overflow-hidden rounded-xs border border-border">
                          <div className="flex items-center justify-between gap-2 bg-muted/30 px-3.5 py-2">
                            <p className="font-sans text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Sumber</p>
                            <span className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-primary">Data resmi ({selectedPackage.kontrak.sumber === "LPSE" ? "LPSE" : "INAPROC"})</span>
                          </div>
                          <div className="space-y-2 px-3.5 py-3 text-[13px] leading-snug text-foreground">
                            <div>
                              <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                                {selectedPackage.kontrak.jenis === "tender" ? "Pemenang" : "Penyedia"}
                              </p>
                              <ul className="mt-1 space-y-1">
                                {penyediaPanel.slice(0, 2).map((baris) => {
                                  const tampilkanNilaiBaris =
                                    penyediaPanel.length > 1 ||
                                    baris.nilaiBersama ||
                                    (baris.nilai > 0 && baris.nilai !== nilaiKontrak);
                                  return (
                                    <li key={baris.nama} className="flex items-baseline justify-between gap-2">
                                      <Link href={`/penyedia/${slugPenyedia(baris.nama)}?region=${encodeURIComponent(regionId)}`} className="font-semibold text-primary underline-offset-2 hover:underline">
                                        {baris.nama}
                                      </Link>
                                      {tampilkanNilaiBaris ? (
                                        baris.nilai ? (
                                          <span className="shrink-0 font-sans text-[11px] tabular-nums text-muted-foreground">{formatRupiahFull(baris.nilai)}</span>
                                        ) : baris.nilaiBersama ? (
                                          <span className="shrink-0 font-sans text-[10px] italic text-muted-foreground" title="Nilai transaksi dicatat bersama untuk beberapa penyedia dan tidak dibagi.">nilai bersama</span>
                                        ) : null
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ul>
                              {labelPenyediaTersembunyi ? (
                                <Link
                                  href={`/paket/${encodeURIComponent(selectedPackage.kode_rup)}?region=${encodeURIComponent(regionId)}`}
                                  className="mt-1 inline-block font-sans text-[11px] font-bold text-primary underline-offset-2 hover:underline"
                                >
                                  {labelPenyediaTersembunyi}
                                </Link>
                              ) : null}
                              {panelPenyedia.adaPenyediaBersama ? (
                                <p className="mt-1 font-sans text-[10px] leading-snug text-muted-foreground">
                                  Nilai transaksi dicatat bersama untuk penyedia dalam satu paket dan tidak dibagi.
                                </p>
                              ) : null}
                            </div>
                            <dl className="space-y-1.5 font-sans text-[13px]">
                              <div className="flex items-baseline justify-between gap-3">
                                <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Nilai kontrak</dt>
                                <dd className="text-right font-semibold tabular-nums text-foreground">
                                  {selectedPackage.kontrak.nilai_kontrak ? formatRupiahFull(selectedPackage.kontrak.nilai_kontrak) : "Tidak tercatat"}
                                </dd>
                              </div>
                              {selisihPagu !== null ? (
                                <div className="flex items-baseline justify-between gap-3">
                                  <dt className="text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">Selisih pagu</dt>
                                  <dd className="text-right tabular-nums text-foreground">
                                    {formatRupiahFull(selisihPagu)}
                                    {selisihPersen !== null ? (
                                      <span className="ml-1 font-sans text-[11px] text-muted-foreground">
                                        ({selisihPersen.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%)
                                      </span>
                                    ) : null}
                                  </dd>
                                </div>
                              ) : null}
                            </dl>
                            {selectedPackage.kontrak.paketRealisasi?.length ? (
                              <p className="font-sans text-[10px] leading-snug text-muted-foreground">
                                Tercatat di Data INAPROC
                                {selectedPackage.kontrak.transaksi && selectedPackage.kontrak.transaksi > 1
                                  ? ` · ${selectedPackage.kontrak.transaksi} transaksi`
                                  : ""}
                                . Rincian kode paket ada di halaman detail.
                              </p>
                            ) : null}
                          </div>
                          {selectedPackage.kontrak.url ? (
                            <a
                              href={selectedPackage.kontrak.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center justify-between gap-2 border-t border-border/50 px-3.5 py-2 font-sans text-[11px] font-semibold text-primary transition-colors hover:bg-primary/5 hover:underline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                            >
                              {selectedPackage.kontrak.sumber === "LPSE" ? "Bukti halaman LPSE" : "Bukti paket di Data INAPROC"}
                              <FiExternalLink className="size-3 shrink-0" aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-3.5 border border-dashed border-border/80 bg-muted/10 p-3 font-sans text-xs leading-relaxed text-muted-foreground">
                          Belum ditemukan rekam kontrak yang cocok pada LPSE/SPSE atau Data INAPROC.
                        </p>
                      )}
                    </div>
                  </ScrollArea>

                  <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-white px-4 py-3">
                    <Button
                      render={<Link href={`/laporan/paket/${selectedPackage.kode_rup}?region=${encodeURIComponent(regionId)}`} />}
                      nativeButton={false}
                      variant="default"
                      className="h-9 w-full gap-1.5 rounded-xs bg-primary px-3 font-sans text-xs font-semibold text-white hover:bg-[#004682]"
                    >
                      <span className="truncate">Laporkan kerusakan</span>
                      <FiArrowRight className="size-3.5 shrink-0 text-secondary" aria-hidden="true" />
                    </Button>
                    <Button
                      render={<Link href={`/paket/${encodeURIComponent(selectedPackage.kode_rup)}?region=${encodeURIComponent(regionId)}`} />}
                      nativeButton={false}
                      variant="outline"
                      className="h-9 w-full gap-1.5 rounded-xs border-border px-3 font-sans text-xs font-semibold text-primary hover:bg-primary/5"
                    >
                      <span className="truncate">Buka detail</span>
                      <FiArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </aside>}
          </div>
        </Card>
        </TooltipProvider>
      </div>
      </section>
    </>
  );
}
