import type { RoadPackageSearchData, RoadPackageSearchFilters } from "@/contracts/packages/road-package.contract";
import type { ApiResult } from "@/contracts/shared/api.contract";

export async function fetchRoadPackages(
  filters: RoadPackageSearchFilters,
  signal: AbortSignal,
): Promise<RoadPackageSearchData> {
  const params = new URLSearchParams();
  if (filters.year) params.set("year", filters.year);
  if (filters.district) params.set("district", filters.district);
  if (filters.work) params.set("work", filters.work);
  if (filters.query) params.set("q", filters.query);

  const query = params.toString();
  const response = await fetch(`/api/packages${query ? `?${query}` : ""}`, { signal });
  const result = (await response.json()) as ApiResult<RoadPackageSearchData>;

  if (!response.ok || result.error) {
    throw new Error(result.error?.message ?? "Data paket jalan belum dapat dimuat.");
  }

  return result.data;
}
