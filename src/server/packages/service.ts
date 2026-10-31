import "server-only";
import type {
  RoadPackageItem,
  RoadPackageSearchData,
  RoadPackageSearchFilters,
  RoadWorkCategory,
} from "@/contracts/packages/road-package.contract";
import type { RoadPackageRepository } from "./repository";
import { snapshotRoadPackageRepository } from "./snapshot-repository";

function classifyRoadWork(name: string): Exclude<RoadWorkCategory, "SEMUA"> {
  const lower = name.toLowerCase();
  if (["jembatan", "gorong", "culvert"].some((term) => lower.includes(term))) {
    return "JEMBATAN";
  }
  if (
    ["drainase", "saluran", "u-ditch", "uditch", "spal", "turap", "talud", "tpt", "bronjong"].some(
      (term) => lower.includes(term),
    )
  ) {
    return "DRAINASE";
  }
  return "PERMUKAAN";
}

function matchesQuery(item: RoadPackageItem, query: string): boolean {
  const searchableText = [
    item.nama,
    item.kode_rup,
    item.desa_resmi ?? "",
    item.kecamatan_resmi ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("id-ID");

  return searchableText.includes(query);
}

export async function searchRoadPackages(
  filters: RoadPackageSearchFilters = {},
  repository: RoadPackageRepository = snapshotRoadPackageRepository,
): Promise<RoadPackageSearchData> {
  const allPackages = await repository.listRoadPackages();
  const districts = Array.from(
    new Set(allPackages.flatMap((item) => (item.kecamatan_resmi ? [item.kecamatan_resmi] : []))),
  ).sort((a, b) => a.localeCompare(b, "id"));
  const query = filters.query?.trim().toLocaleLowerCase("id-ID") ?? "";

  const items = allPackages.filter((item) => {
    if (filters.year && String(item.tahun) !== filters.year) return false;
    if (filters.district && item.kecamatan_resmi !== filters.district) return false;
    if (filters.work && filters.work !== "SEMUA" && classifyRoadWork(item.nama) !== filters.work) {
      return false;
    }
    if (query && !matchesQuery(item, query)) return false;
    return true;
  });

  return {
    items,
    districts,
    totalCount: allPackages.length,
    filteredCount: items.length,
  };
}
