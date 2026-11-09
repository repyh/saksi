import "server-only";
import { cache } from "react";
import type {
  RoadAreaAggregate,
  RoadPackageItem,
  RoadPackageMapData,
  RoadPackageSearchData,
  RoadPackageSearchFilters,
  VendorSummary,
} from "@/contracts/packages/road-package.contract";
import type { RoadPackageDetail } from "@/contracts/packages/road-package-detail.contract";
import { areaKeyForPackage, type RoadAreaLevel } from "@/contracts/packages/area-key";
import { selectBudgetDecile } from "@/contracts/packages/budget-decile";
import { classifyRoadWork } from "@/contracts/packages/road-work";
import {
  DEFAULT_REGION_ID,
  getRegion,
  regionSummary,
} from "@/server/regions/region-registry";
import {
  getVendorCatalogCached,
  listRoadPackagesCached,
  snapshotMetaCached,
} from "./catalog-cache";
import { visibleAreaKeys } from "./area-visibility";
import type { RoadPackageRepository } from "./repository";
import { emptyPlanDetail } from "./rup-detail";
import { bacaRupDetail } from "./rup-detail-repository";

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 300;

function matchesQuery(item: RoadPackageItem, query: string): boolean {
  const searchableText = [
    item.nama,
    item.kode_rup,
    item.desa_resmi ?? "",
    item.rw ?? "",
    item.kecamatan_resmi ?? "",
    item.kontrak?.penyedia ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("id-ID");

  return searchableText.includes(query);
}

interface PackageContext {
  region: ReturnType<typeof getRegion>;
  allPackages: RoadPackageItem[];
  filtered: RoadPackageItem[];
  districts: string[];
  villagesByDistrict: Record<string, string[]>;
  withContractCount: number;
  vendorCount: number;
}

/** Muat snapshot, terapkan filter yang sama untuk register dan agregat peta. */
async function buildPackageContext(
  filters: RoadPackageSearchFilters,
  repository?: RoadPackageRepository,
): Promise<PackageContext> {
  const regionId = filters.region ?? DEFAULT_REGION_ID;
  const region = getRegion(regionId);
  const allPackages = repository
    ? await repository.listRoadPackages()
    : await listRoadPackagesCached(regionId);
  const districts = Array.from(
    new Set(allPackages.flatMap((item) => (item.kecamatan_resmi ? [item.kecamatan_resmi] : []))),
  ).sort((a, b) => a.localeCompare(b, "id"));
  const query = filters.query?.trim().toLocaleLowerCase("id-ID") ?? "";
  const villages = filters.villages?.filter(Boolean) ?? [];
  const villagesTerpilih = villages.length ? new Set(villages) : null;

  if (filters.budgetDecile !== undefined && !filters.year) {
    throw new RangeError("Tahun anggaran wajib dipilih untuk filter desil.");
  }
  const cohort = filters.budgetDecile === undefined
    ? allPackages
    : selectBudgetDecile(allPackages, filters.year!, filters.budgetDecile);

  const filtered = cohort.filter((item) => {
    if (filters.year && String(item.tahun) !== filters.year) return false;
    if (filters.generalOnly && item.kecamatan_resmi) return false;
    if (filters.district && item.kecamatan_resmi !== filters.district) return false;
    if (villagesTerpilih && (!item.desa_resmi || !villagesTerpilih.has(item.desa_resmi))) return false;
    if (filters.locatedOnly && item.presisi_peta === "Kabupaten") return false;
    if (filters.work && filters.work !== "SEMUA" && classifyRoadWork(item.nama) !== filters.work) {
      return false;
    }
    if (filters.contract === "ADA" && !item.kontrak) return false;
    if (filters.contract === "TANPA" && item.kontrak) return false;
    if (query && !matchesQuery(item, query)) return false;
    return true;
  });

  const villagesByDistrict: Record<string, string[]> = {};
  for (const item of allPackages) {
    if (!item.kecamatan_resmi || !item.desa_resmi) continue;
    const daftar = villagesByDistrict[item.kecamatan_resmi] ?? [];
    if (!daftar.includes(item.desa_resmi)) daftar.push(item.desa_resmi);
    villagesByDistrict[item.kecamatan_resmi] = daftar;
  }
  for (const daftar of Object.values(villagesByDistrict)) {
    daftar.sort((a, b) => a.localeCompare(b, "id"));
  }

  const withContractCount = allPackages.filter((item) => item.kontrak).length;
  const vendorCount = new Set(
    allPackages.flatMap((item) =>
      item.kontrak
        ? [item.kontrak.penyedia, ...(item.kontrak.penyediaLain ?? [])].map((nama) =>
            nama.toLocaleUpperCase("id-ID"),
          )
        : [],
    ),
  ).size;

  return {
    region,
    allPackages,
    filtered,
    districts,
    villagesByDistrict,
    withContractCount,
    vendorCount,
  };
}

/**
 * Kunci stabil untuk konteks filter. `page`, `limit`, dan `bbox` sengaja tidak ikut:
 * register dan agregat peta memakai hasil filter yang sama, jadi keduanya berbagi
 * satu pembacaan/pengolahan per request.
 */
function contextSignature(filters: RoadPackageSearchFilters): string {
  const canonical: Record<string, unknown> = {
    region: filters.region ?? DEFAULT_REGION_ID,
    generalOnly: Boolean(filters.generalOnly),
    locatedOnly: Boolean(filters.locatedOnly),
    villages: [...(filters.villages ?? [])].filter(Boolean),
    query: filters.query?.trim() ?? "",
  };
  if (filters.year !== undefined) canonical.year = filters.year;
  if (filters.budgetDecile !== undefined) canonical.budgetDecile = filters.budgetDecile;
  if (filters.district !== undefined) canonical.district = filters.district;
  if (filters.work !== undefined) canonical.work = filters.work;
  if (filters.contract !== undefined) canonical.contract = filters.contract;
  return JSON.stringify(canonical);
}

const packageContextForRequest = cache(
  async (signature: string): Promise<PackageContext> =>
    buildPackageContext(JSON.parse(signature) as RoadPackageSearchFilters),
);

function packageContext(
  filters: RoadPackageSearchFilters,
  repository?: RoadPackageRepository,
): Promise<PackageContext> {
  return repository
    ? buildPackageContext(filters, repository)
    : packageContextForRequest(contextSignature(filters));
}

function normalizePage(value: number | undefined) {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.trunc(value as number));
}

function normalizeLimit(value: number | undefined) {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(value as number)));
}

export async function searchRoadPackages(
  filters: RoadPackageSearchFilters = {},
  repository?: RoadPackageRepository,
): Promise<RoadPackageSearchData> {
  const context = await packageContext(filters, repository);
  const limit = normalizeLimit(filters.limit);
  const totalPages = Math.max(1, Math.ceil(context.filtered.length / limit));
  const page = Math.min(normalizePage(filters.page), totalPages);
  const start = (page - 1) * limit;
  const items = context.filtered.slice(start, start + limit);

  return {
    region: regionSummary(context.region),
    items,
    districts: context.districts,
    villagesByDistrict: context.villagesByDistrict,
    totalCount: context.allPackages.length,
    filteredCount: context.filtered.length,
    withContractCount: context.withContractCount,
    vendorCount: context.vendorCount,
    page,
    limit,
    totalPages,
    hasMore: start + limit < context.filtered.length,
  };
}

function emptyAreaAggregate(): RoadAreaAggregate {
  return { count: 0, budget: 0, workCounts: { PERMUKAAN: 0, DRAINASE: 0, JEMBATAN: 0 }, sampleRup: null };
}

/**
 * Agregat koroplet per tingkat wilayah. Hasilnya harus identik dengan agregasi
 * lama yang menghitung langsung dari seluruh baris paket di browser.
 */
export async function aggregateRoadPackages(
  filters: RoadPackageSearchFilters = {},
  repository?: RoadPackageRepository,
): Promise<RoadPackageMapData> {
  const context = await packageContext(filters, repository);
  const levels: RoadAreaLevel[] = ["rw", "kel", "kec"];
  const maps: Record<RoadAreaLevel, Map<string, RoadAreaAggregate>> = {
    rw: new Map(),
    kel: new Map(),
    kec: new Map(),
  };
  const bbox = filters.bbox ?? null;
  const visible: Record<RoadAreaLevel, Set<string> | null> = {
    rw: visibleAreaKeys(context.region.id, "rw", bbox),
    kel: visibleAreaKeys(context.region.id, "kel", bbox),
    kec: visibleAreaKeys(context.region.id, "kec", bbox),
  };

  for (const item of context.filtered) {
    for (const level of levels) {
      const key = areaKeyForPackage(item, level);
      if (!key) continue;
      if (visible[level] && !visible[level].has(key)) continue;
      const aggregate = maps[level].get(key) ?? emptyAreaAggregate();
      aggregate.count += 1;
      aggregate.budget += item.pagu;
      aggregate.workCounts[classifyRoadWork(item.nama)] += 1;
      if (!aggregate.sampleRup) aggregate.sampleRup = item.kode_rup;
      maps[level].set(key, aggregate);
    }
  }

  return {
    region: regionSummary(context.region),
    rw: Object.fromEntries(maps.rw),
    kel: Object.fromEntries(maps.kel),
    kec: Object.fromEntries(maps.kec),
    totalCount: context.allPackages.length,
    filteredCount: context.filtered.length,
    bbox,
  };
}

/** Satu paket untuk panel detail; dimuat saat paket dipilih, bukan dari daftar halaman. */
export async function getRoadPackage(
  rup: string,
  regionId: string = DEFAULT_REGION_ID,
  repository?: RoadPackageRepository,
): Promise<RoadPackageItem | null> {
  const rows = repository
    ? await repository.listRoadPackages()
    : await listRoadPackagesCached(regionId);
  return rows.find((item) => item.kode_rup === rup) ?? null;
}

/** Seluruh paket jalan untuk direktori server-rendered dan pencarian lokal halaman. */
export async function listRoadPackages(
  regionId: string = DEFAULT_REGION_ID,
): Promise<RoadPackageItem[]> {
  return listRoadPackagesCached(regionId);
}

/**
 * Detail satu paket untuk halaman bacaan: item snapshot + rincian rencana RUP
 * + metadata region/snapshot. `null` bila kode RUP tidak ada di region ini.
 *
 * Dibungkus `cache()` agar `generateMetadata` dan page pada request yang sama
 * memakai hasil yang sama, bukan membaca katalog dua kali.
 */
export const getRoadPackageDetail = cache(
  async (
    rup: string,
    regionId: string = DEFAULT_REGION_ID,
    repository?: RoadPackageRepository,
  ): Promise<RoadPackageDetail | null> => {
    const item = await getRoadPackage(rup, regionId, repository);
    if (!item) return null;

    return {
      item,
      plan: bacaRupDetail(rup, regionId) ?? emptyPlanDetail(),
      region: regionSummary(getRegion(regionId)),
      snapshot: await snapshotMetaCached(regionId),
    };
  },
);

/** Ringkasan penyedia dari rekam kontrak LPSE + Data INAPROC, dibatasi ke paket jalan region. */
export async function listVendors(
  query?: string,
  regionId: string = DEFAULT_REGION_ID,
): Promise<VendorSummary[]> {
  const cari = query?.trim().toLocaleLowerCase("id-ID");
  const { vendors } = await getVendorCatalogCached(regionId);
  return cari
    ? vendors.filter((vendor) => vendor.nama.toLocaleLowerCase("id-ID").includes(cari))
    : vendors;
}

/**
 * Detail penyedia; ringkasan, peta RUP, dan daftar paket berasal dari cache katalog
 * yang sama. Dibungkus `cache()` untuk deduplikasi metadata + page per request.
 */
export const getVendor = cache(
  async (slug: string, regionId: string = DEFAULT_REGION_ID) => {
    const catalog = await getVendorCatalogCached(regionId);
    const summary = catalog.vendors.find((vendor) => vendor.slug === slug);
    if (!summary) return null;

    const daftarRup = new Set((catalog.rupBySlug[slug] ?? []).map(String));
    const items = (await listRoadPackagesCached(regionId))
      .filter((item) => daftarRup.has(String(item.kode_rup)))
      .sort((a, b) => (b.kontrak?.nilai_kontrak ?? 0) - (a.kontrak?.nilai_kontrak ?? 0));

    return {
      summary,
      items,
      totalNilai: items.reduce((n, item) => n + (item.kontrak?.nilai_kontrak ?? 0), 0),
    };
  },
);
