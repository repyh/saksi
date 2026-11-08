import type {
  RoadPackageItem,
  RoadPackageMapData,
  RoadPackageSearchData,
  RoadPackageSearchFilters,
} from "@/contracts/packages/road-package.contract";
import type { ApiResult } from "@/contracts/shared/api.contract";

function packageQuery(filters: RoadPackageSearchFilters) {
  const params = new URLSearchParams();
  if (filters.region) params.set("region", filters.region);
  if (filters.year) params.set("year", filters.year);
  if (filters.district) params.set("district", filters.district);
  for (const desa of filters.villages ?? []) params.append("desa", desa);
  if (filters.locatedOnly) params.set("lokasi", "1");
  if (filters.work) params.set("work", filters.work);
  if (filters.contract && filters.contract !== "SEMUA") params.set("kontrak", filters.contract);
  if (filters.query) params.set("q", filters.query);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  return params.toString();
}

async function readResult<T>(response: Response, fallback: string): Promise<T> {
  const result = (await response.json()) as ApiResult<T>;
  if (!response.ok || result.error) {
    throw new Error(result.error?.message ?? fallback);
  }
  return result.data;
}

export async function fetchRoadPackages(
  filters: RoadPackageSearchFilters,
  signal: AbortSignal,
): Promise<RoadPackageSearchData> {
  const query = packageQuery(filters);
  const response = await fetch(`/api/packages${query ? `?${query}` : ""}`, { signal });
  return readResult<RoadPackageSearchData>(response, "Data paket jalan belum dapat dimuat.");
}

/** Agregat koroplet tanpa mengunduh seluruh baris paket. */
export async function fetchRoadPackageMap(
  filters: RoadPackageSearchFilters,
  signal: AbortSignal,
): Promise<RoadPackageMapData> {
  const query = packageQuery(filters);
  const response = await fetch(`/api/packages/map${query ? `?${query}` : ""}`, { signal });
  return readResult<RoadPackageMapData>(response, "Agregat peta paket jalan belum dapat dimuat.");
}

/** Detail satu paket, dimuat saat paket dipilih. */
export async function fetchRoadPackage(
  rup: string,
  regionId: string,
  signal?: AbortSignal,
): Promise<RoadPackageItem> {
  const params = new URLSearchParams({ region: regionId });
  const response = await fetch(`/api/packages/${encodeURIComponent(rup)}?${params.toString()}`, { signal });
  return readResult<RoadPackageItem>(response, "Detail paket jalan belum dapat dimuat.");
}
