import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import type {
  AuditSpatialBreakdown,
  AuditSummaryMetrics,
} from "@/contracts/audit/audit-summary.contract";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import type { RoadPackageRepository } from "./repository";
import {
  getRegion,
  DEFAULT_REGION_ID,
  regionSummary,
  type RegionConfig,
} from "@/server/regions/region-registry";
import { listRoadPackagesCached, snapshotMetaCached } from "./catalog-cache";
import {
  CATALOG_CACHE_TAGS,
  CATALOG_REVALIDATE_SECONDS,
  CATALOG_SOURCE,
} from "./catalog-cache-config";

interface BoundaryFeatureCollection {
  features?: Array<{ properties?: Record<string, unknown> }>;
}

const MONTHS: Record<string, string> = {
  jan: "Januari",
  feb: "Februari",
  mar: "Maret",
  apr: "April",
  mei: "Mei",
  may: "Mei",
  jun: "Juni",
  jul: "Juli",
  agu: "Agustus",
  aug: "Agustus",
  sep: "September",
  okt: "Oktober",
  oct: "Oktober",
  nov: "November",
  des: "Desember",
  dec: "Desember",
};

const idDecimal = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const idBudget = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function normalizeName(value: string | null | undefined) {
  return String(value ?? "").toUpperCase().replace(/\s+/g, " ").trim();
}

function normalizeRw(value: string | null | undefined) {
  return normalizeName(value).replace(/^0+(?=\d)/, "");
}

/** "5 Nov 2026" → "5 November 2026". Falls back to the raw manifest value. */
function formatSnapshotDate(value: string) {
  const match = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(value.trim());
  if (!match) return value;
  const [, day, month, year] = match;
  const monthName = MONTHS[month.slice(0, 3).toLocaleLowerCase("en-US")];
  return monthName ? `${day} ${monthName} ${year}` : value;
}

const AKAR = process.cwd();

function bacaBatas(berkas: string): BoundaryFeatureCollection {
  return JSON.parse(
    readFileSync(path.resolve(AKAR, berkas), "utf8"),
  ) as BoundaryFeatureCollection;
}

interface BoundaryIndex {
  rwKeys: Set<string>;
  totalKelurahan: number;
  totalRw: number;
  totalDistricts: number;
}

const boundaryCache = new Map<string, BoundaryIndex>();

function readBoundaries(region: RegionConfig): BoundaryIndex {
  const tersimpan = boundaryCache.get(region.id);
  if (tersimpan) return tersimpan;

  const kelurahan = bacaBatas(region.batas.kelurahan.berkas);
  const lingkungan = region.batas.lingkungan
    ? bacaBatas(region.batas.lingkungan.berkas)
    : null;

  const kelurahanNames = new Set<string>();
  const districtNames = new Set<string>();
  for (const feature of kelurahan.features ?? []) {
    const village = feature.properties?.[region.batas.kelurahan.nama];
    const district = feature.properties?.[region.batas.kelurahan.kecamatan];
    if (typeof village === "string" && village.trim()) kelurahanNames.add(normalizeName(village));
    if (typeof district === "string" && district.trim()) districtNames.add(normalizeName(district));
  }

  const rwKeys = new Set<string>();
  if (lingkungan && region.batas.lingkungan) {
    for (const feature of lingkungan.features ?? []) {
      const village = feature.properties?.[region.batas.lingkungan.nama];
      const code = feature.properties?.[region.batas.lingkungan.nomor];
      if (typeof village === "string" && village && typeof code === "string" && code) {
        rwKeys.add(`${normalizeName(village)}|${normalizeRw(code)}`);
      }
    }
  }

  const index: BoundaryIndex = {
    rwKeys,
    totalKelurahan: kelurahanNames.size,
    totalRw: lingkungan?.features?.length ?? 0,
    totalDistricts: districtNames.size,
  };
  boundaryCache.set(region.id, index);
  return index;
}

function spatialBreakdown(packages: RoadPackageItem[]): AuditSpatialBreakdown {
  return {
    rwPackages: packages.filter((item) => item.presisi_peta === "RW").length,
    kelurahanPackages: packages.filter((item) => item.presisi_peta === "Kelurahan").length,
    kecamatanPackages: packages.filter((item) => item.presisi_peta === "Kecamatan").length,
    unmappedPackages: packages.filter((item) => item.presisi_peta === "Kabupaten").length,
  };
}

/**
 * Audit/landing headline metrics derived from the active snapshot and checked-in
 * administrative boundaries. Never hard-code these figures in the UI.
 */
export async function susunAuditSummaryMetrics(
  regionId: string = DEFAULT_REGION_ID,
  repository?: RoadPackageRepository,
  packageRows?: RoadPackageItem[],
): Promise<AuditSummaryMetrics> {
  const region = getRegion(regionId);
  const paketRepository = packageRows ? null : repository;
  const [packages, boundaries, meta] = await Promise.all([
    packageRows
      ? Promise.resolve(packageRows)
      : paketRepository
        ? paketRepository.listRoadPackages()
        : listRoadPackagesCached(regionId),
    Promise.resolve(readBoundaries(region)),
    snapshotMetaCached(regionId),
  ]);

  const years = Array.from(new Set(packages.map((item) => item.tahun))).sort((a, b) => a - b);
  const packagesByYear = {
    y2025: packages.filter((item) => item.tahun === 2025).length,
    y2026: packages.filter((item) => item.tahun === 2026).length,
  };
  const totalBudget = packages.reduce((sum, item) => sum + item.pagu, 0);
  const spatial = spatialBreakdown(packages);
  const mappedCount =
    spatial.rwPackages + spatial.kelurahanPackages + spatial.kecamatanPackages;

  const touchedKelurahan = new Set(
    packages.map((item) => normalizeName(item.desa_resmi)).filter(Boolean),
  );
  const touchedRw = new Set<string>();
  for (const item of packages) {
    if (!item.desa_resmi || !item.rw) continue;
    const key = `${normalizeName(item.desa_resmi)}|${normalizeRw(item.rw)}`;
    if (boundaries.rwKeys.has(key)) touchedRw.add(key);
  }

  return {
    regionName: region.label,
    environmentLabel: regionSummary(region).environmentLabel,
    snapshotDate: formatSnapshotDate(meta.snapshot),
    snapshotSource: meta.sumber,
    fiscalYears: [years[0] ?? 2025, years.at(-1) ?? 2026],
    totalPackages: packages.length,
    packagesByYear,
    totalBudgetDisplay: `Rp${idBudget.format(totalBudget / 1_000_000_000)} M`,
    coveredKelurahan: touchedKelurahan.size,
    totalKelurahan: boundaries.totalKelurahan,
    totalDistricts: boundaries.totalDistricts || new Set(
      packages.map((item) => normalizeName(item.kecamatan_resmi)).filter(Boolean),
    ).size,
    coveredRw: touchedRw.size,
    totalRw: boundaries.totalRw,
    mappedCount,
    mappedPercent: `${idDecimal.format(
      packages.length > 0 ? (mappedCount / packages.length) * 100 : 0,
    )}%`,
    spatial,
  };
}

const loadAuditSummaryMetrics = unstable_cache(
  async (regionId: string) => susunAuditSummaryMetrics(regionId),
  ["catalog-audit-metrics", CATALOG_SOURCE],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: CATALOG_CACHE_TAGS },
);

const auditSummaryMetricsForRequest = cache(
  async (regionId: string): Promise<AuditSummaryMetrics> =>
    loadAuditSummaryMetrics(regionId),
);

/**
 * Metrik landing: cache Data Cache lintas request + `cache()` per request.
 * `repository` eksplisit (mis. uji) melewati cache agar perilaku lama tetap tersedia.
 */
export function buildAuditSummaryMetrics(
  regionId: string = DEFAULT_REGION_ID,
  repository?: RoadPackageRepository,
  packageRows?: RoadPackageItem[],
): Promise<AuditSummaryMetrics> {
  return repository || packageRows
    ? susunAuditSummaryMetrics(regionId, repository, packageRows)
    : auditSummaryMetricsForRequest(regionId);
}
