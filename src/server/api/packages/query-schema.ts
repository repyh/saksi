import "server-only";
import type {
  RoadPackageSearchFilters,
  RoadWorkCategory,
} from "@/contracts/packages/road-package.contract";
import { ApiError } from "@/server/api/shared/api-error";

const WORK_CATEGORIES = new Set<RoadWorkCategory>([
  "SEMUA",
  "PERMUKAAN",
  "DRAINASE",
  "JEMBATAN",
]);

export function parsePackageFilters(url: URL): RoadPackageSearchFilters {
  const year = url.searchParams.get("year")?.trim() || undefined;
  const district = url.searchParams.get("district")?.trim() || undefined;
  const work = url.searchParams.get("work")?.trim() || undefined;
  const contract = url.searchParams.get("kontrak")?.trim() || undefined;
  const query = url.searchParams.get("q")?.trim() || undefined;

  if (year && year !== "2025" && year !== "2026") {
    throw new ApiError(400, "INVALID_QUERY", "Tahun anggaran harus 2025 atau 2026.");
  }
  if (district && district.length > 100) {
    throw new ApiError(400, "INVALID_QUERY", "Nama kecamatan terlalu panjang.");
  }
  if (work && !WORK_CATEGORIES.has(work as RoadWorkCategory)) {
    throw new ApiError(400, "INVALID_QUERY", "Jenis pekerjaan tidak dikenal.");
  }
  if (contract && contract !== "ADA" && contract !== "TANPA") {
    throw new ApiError(400, "INVALID_QUERY", "Filter kontrak harus ADA atau TANPA.");
  }
  if (query && query.length > 120) {
    throw new ApiError(400, "INVALID_QUERY", "Pencarian maksimal 120 karakter.");
  }

  return {
    year: year as RoadPackageSearchFilters["year"],
    district,
    work: work as RoadWorkCategory | undefined,
    contract: contract as RoadPackageSearchFilters["contract"],
    query,
  };
}
