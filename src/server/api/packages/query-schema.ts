import "server-only";
import type {
  RoadPackageSearchFilters,
  RoadWorkCategory,
} from "@/contracts/packages/road-package.contract";
import { ApiError } from "@/server/api/shared/api-error";
import { getRegionOrNull } from "@/server/regions/region-registry";

const WORK_CATEGORIES = new Set<RoadWorkCategory>([
  "SEMUA",
  "PERMUKAAN",
  "DRAINASE",
  "JEMBATAN",
]);

export function parsePackageFilters(url: URL): RoadPackageSearchFilters {
  const region = url.searchParams.get("region")?.trim() || undefined;
  const year = url.searchParams.get("year")?.trim() || undefined;
  const district = url.searchParams.get("district")?.trim() || undefined;
  const work = url.searchParams.get("work")?.trim() || undefined;
  const contract = url.searchParams.get("kontrak")?.trim() || undefined;
  const desa = url.searchParams
    .getAll("desa")
    .flatMap((nilai) => nilai.split(","))
    .map((nilai) => nilai.trim())
    .filter(Boolean);
  const lokasi = url.searchParams.get("lokasi")?.trim() || undefined;
  const query = url.searchParams.get("q")?.trim() || undefined;
  const pageParam = url.searchParams.get("page")?.trim() || undefined;
  const limitParam = url.searchParams.get("limit")?.trim() || undefined;
  const page = pageParam ? Number(pageParam) : undefined;
  const limit = limitParam ? Number(limitParam) : undefined;

  if (region && !getRegionOrNull(region)) {
    throw new ApiError(400, "INVALID_QUERY", "Region tidak dikenal.");
  }
  if (year && year !== "2025" && year !== "2026") {
    throw new ApiError(400, "INVALID_QUERY", "Tahun anggaran harus 2025 atau 2026.");
  }
  if (district && district.length > 100) {
    throw new ApiError(400, "INVALID_QUERY", "Nama kecamatan terlalu panjang.");
  }
  if (desa.length > 60) {
    throw new ApiError(400, "INVALID_QUERY", "Terlalu banyak kelurahan dipilih.");
  }
  if (lokasi && lokasi !== "0" && lokasi !== "1") {
    throw new ApiError(400, "INVALID_QUERY", "Filter lokasi harus 0 atau 1.");
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
  if (pageParam && (!Number.isInteger(page) || (page as number) < 1 || (page as number) > 10_000)) {
    throw new ApiError(400, "INVALID_QUERY", "Halaman harus bilangan bulat antara 1 dan 10000.");
  }
  if (limitParam && (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 300)) {
    throw new ApiError(400, "INVALID_QUERY", "Limit harus bilangan bulat antara 1 dan 300.");
  }

  return {
    region,
    year: year as RoadPackageSearchFilters["year"],
    district,
    villages: desa.length ? desa : undefined,
    locatedOnly: lokasi === "1",
    work: work as RoadWorkCategory | undefined,
    contract: contract as RoadPackageSearchFilters["contract"],
    query,
    page,
    limit,
  };
}
