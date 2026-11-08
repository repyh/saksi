import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  AuditSpatialBreakdown,
  AuditSummaryMetrics,
} from "@/contracts/audit/audit-summary.contract";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import type { RoadPackageRepository } from "./repository";
import { snapshotMeta, snapshotRoadPackageRepository } from "./snapshot-repository";

interface BoundaryFeatureCollection {
  features?: Array<{
    properties?: { wadmkc?: string; wadmkd?: string; rw?: string };
  }>;
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

let boundariesPromise: Promise<{
  rwKeys: Set<string>;
  totalKelurahan: number;
  totalRw: number;
  totalDistricts: number;
}> | undefined;

function readBoundaries() {
  boundariesPromise ??= (async () => {
    const read = (file: string) =>
      JSON.parse(
        readFileSync(path.join(process.cwd(), "public", "data", file), "utf8"),
      ) as BoundaryFeatureCollection;
    const [rw, kelurahan, kecamatan] = [read("rw.geojson"), read("kel.geojson"), read("kec.geojson")];
    const rwKeys = new Set<string>();
    for (const feature of rw.features ?? []) {
      const village = feature.properties?.wadmkd;
      const code = feature.properties?.rw;
      if (village && code) rwKeys.add(`${normalizeName(village)}|${normalizeRw(code)}`);
    }
    const kelurahanNames = new Set(
      (kelurahan.features ?? [])
        .map((feature) => normalizeName(feature.properties?.wadmkd))
        .filter(Boolean),
    );
    return {
      rwKeys,
      totalKelurahan: kelurahanNames.size,
      totalRw: rw.features?.length ?? 0,
      totalDistricts: kecamatan.features?.length ?? 0,
    };
  })();
  return boundariesPromise;
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
export async function buildAuditSummaryMetrics(
  repository: RoadPackageRepository = snapshotRoadPackageRepository,
): Promise<AuditSummaryMetrics> {
  const [packages, boundaries] = await Promise.all([repository.listRoadPackages(), readBoundaries()]);

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
    regionName: "Kota Tangerang",
    snapshotDate: formatSnapshotDate(snapshotMeta.snapshot),
    snapshotSource: snapshotMeta.sumber,
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
