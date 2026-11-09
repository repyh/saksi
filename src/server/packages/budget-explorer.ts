import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import type { BudgetExplorerNode } from "@/contracts/audit/budget-explorer.contract";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import { classifyRoadWork, ROAD_WORK_LABELS, ROAD_WORK_TYPES } from "@/contracts/packages/road-work";
import { districtSlug, routeForAddress, routeForPackage } from "@/features/map/report-routes";
import { listRoadPackagesCached } from "./catalog-cache";
import {
  CATALOG_CACHE_TAGS,
  CATALOG_REVALIDATE_SECONDS,
  CATALOG_SOURCE,
} from "./catalog-cache-config";

function summarize(label: string, rows: RoadPackageItem[]): BudgetExplorerNode {
  return { label, count: rows.length, locatedCount: rows.filter((row) => row.presisi_peta !== "Kabupaten").length, budget: rows.reduce((sum, row) => sum + row.pagu, 0) };
}

export async function susunBudgetExplorer(region: string): Promise<BudgetExplorerNode[]> {
  const rows = await listRoadPackagesCached(region);
  function mapLink(year: number, decile?: number, work?: string, district?: string) {
    const params = new URLSearchParams({ region, tahun: String(year) });
    if (decile) params.set("kelompok", String(decile));
    if (work) params.set("jenis", work.toLowerCase());
    if (district === "Lokasi umum / belum terpetakan") { params.set("lokasi", "0"); params.set("umum", "1"); }
    const path = district && district !== "Lokasi umum / belum terpetakan"
      ? routeForAddress({ districtSlug: districtSlug(district) }) : "/peta-pekerjaan";
    return `${path}?${params}`;
  }
  return [...new Set(rows.map((row) => row.tahun))].sort().map((year) => {
    const yearly = rows.filter((row) => row.tahun === year)
      .sort((a, b) => a.pagu - b.pagu || a.kode_rup.localeCompare(b.kode_rup));
    const middle = Math.floor(yearly.length / 2);
    const median = yearly.length % 2 ? yearly[middle].pagu : (yearly[middle - 1].pagu + yearly[middle].pagu) / 2;
    return {
      ...summarize(String(year), yearly),
      mapHref: mapLink(year),
      median,
      children: Array.from({ length: 10 }, (_, decile) => {
        const group = yearly.slice(Math.floor(decile * yearly.length / 10), Math.floor((decile + 1) * yearly.length / 10));
        return {
          ...summarize(`D${decile + 1} · peringkat ${decile * 10}–${(decile + 1) * 10}%`, group),
          mapHref: mapLink(year, decile + 1),
          minBudget: group[0]?.pagu ?? 0,
          maxBudget: group.at(-1)?.pagu ?? 0,
          children: ROAD_WORK_TYPES.map((work) => {
            const selected = group.filter((row) => classifyRoadWork(row.nama) === work);
            const districts = [...new Set(selected.map((row) => row.kecamatan_resmi || "Lokasi umum / belum terpetakan"))].sort((a, b) => a.localeCompare(b, "id"));
            return {
              ...summarize(ROAD_WORK_LABELS[work], selected),
              mapHref: mapLink(year, decile + 1, work),
              children: districts.map((district) => {
                const local = selected.filter((row) => (row.kecamatan_resmi || "Lokasi umum / belum terpetakan") === district);
                return {
                  ...summarize(district, local),
                  mapHref: mapLink(year, decile + 1, work, district),
                  records: local.sort((a, b) => b.pagu - a.pagu).map((row) => ({
                    rup: row.kode_rup, name: row.nama, budget: row.pagu,
                    precision: row.presisi_peta === "Kabupaten" ? "Lokasi umum" : row.presisi_peta,
                    href: `${routeForPackage(row)}?${new URL(mapLink(year, decile + 1, work, district), "https://saksi.invalid").searchParams}`,
                  })),
                };
              }),
            };
          }),
        };
      }),
    };
  });
}

const loadBudgetExplorer = unstable_cache(
  susunBudgetExplorer,
  ["catalog-budget-explorer", CATALOG_SOURCE],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: CATALOG_CACHE_TAGS },
);

const budgetExplorerForRequest = cache(
  async (region: string): Promise<BudgetExplorerNode[]> => loadBudgetExplorer(region),
);

/** Pohon eksplorasi anggaran landing; turunan murni katalog, aman di-cache. */
export function buildBudgetExplorer(region: string): Promise<BudgetExplorerNode[]> {
  return budgetExplorerForRequest(region);
}
