import "server-only";
import type {
  MapBounds,
  RoadPackageSearchFilters,
  RoadPackageSort,
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
  const rawBudgetDecile = url.searchParams.get("kelompok");
  const budgetDecileParam = rawBudgetDecile?.trim();
  const budgetDecile = rawBudgetDecile === null ? undefined : Number(budgetDecileParam);
  const rawGeneral = url.searchParams.get("umum");
  const general = rawGeneral?.trim();
  const district = url.searchParams.get("district")?.trim() || undefined;
  const work = url.searchParams.get("work")?.trim() || undefined;
  const contract = url.searchParams.get("kontrak")?.trim() || undefined;
  const sortParam = url.searchParams.get("sort")?.trim() || undefined;
  const desa = url.searchParams
    .getAll("desa")
    .flatMap((nilai) => nilai.split(","))
    .map((nilai) => nilai.trim())
    .filter(Boolean);
  const lokasi = url.searchParams.get("lokasi")?.trim() || undefined;
  const query = url.searchParams.get("q")?.trim() || undefined;
  const pageParam = url.searchParams.get("page")?.trim() || undefined;
  const limitParam = url.searchParams.get("limit")?.trim() || undefined;
  const bboxParam = url.searchParams.get("bbox")?.trim() || undefined;
  const page = pageParam ? Number(pageParam) : undefined;
  const limit = limitParam ? Number(limitParam) : undefined;
  let bbox: MapBounds | undefined;

  if (region && !getRegionOrNull(region)) {
    throw new ApiError(400, "INVALID_QUERY", "Region tidak dikenal.");
  }
  if (year && year !== "2025" && year !== "2026") {
    throw new ApiError(400, "INVALID_QUERY", "Tahun anggaran harus 2025 atau 2026.");
  }
  if (
    rawBudgetDecile !== null &&
    (!Number.isInteger(budgetDecile) || (budgetDecile as number) < 1 || (budgetDecile as number) > 10)
  ) {
    throw new ApiError(400, "INVALID_QUERY", "Kelompok anggaran harus bilangan bulat antara 1 dan 10.");
  }
  if (rawBudgetDecile !== null && !year) {
    throw new ApiError(400, "INVALID_QUERY", "Tahun anggaran wajib dipilih untuk filter kelompok anggaran.");
  }
  if (rawGeneral !== null && general !== "0" && general !== "1") {
    throw new ApiError(400, "INVALID_QUERY", "Filter lokasi umum harus 0 atau 1.");
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
  if (sortParam && sortParam !== "pagu-desc" && sortParam !== "pagu-asc" && sortParam !== "nama") {
    throw new ApiError(400, "INVALID_QUERY", "Urutan harus pagu-desc, pagu-asc, atau nama.");
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
  if (bboxParam) {
    const parts = bboxParam.split(",").map((value) => Number(value.trim()));
    if (parts.length !== 4 || parts.some((value) => !Number.isFinite(value))) {
      throw new ApiError(400, "INVALID_QUERY", "Bbox harus berisi empat angka: minLon,minLat,maxLon,maxLat.");
    }
    const [minLon, minLat, maxLon, maxLat] = parts;
    if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90 || minLon >= maxLon || minLat >= maxLat) {
      throw new ApiError(400, "INVALID_QUERY", "Bbox berada di luar rentang koordinat yang sah.");
    }
    bbox = [minLon, minLat, maxLon, maxLat];
  }

  return {
    region,
    year: year as RoadPackageSearchFilters["year"],
    budgetDecile,
    generalOnly: general === "1",
    district,
    villages: desa.length ? desa : undefined,
    locatedOnly: lokasi === "1",
    work: work as RoadWorkCategory | undefined,
    contract: contract as RoadPackageSearchFilters["contract"],
    sort: sortParam as RoadPackageSort | undefined,
    query,
    page,
    limit,
    bbox,
  };
}
