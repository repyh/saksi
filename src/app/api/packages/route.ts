import type {
  RoadPackageSearchFilters,
  RoadWorkCategory,
} from "@/contracts/packages/road-package.contract";
import type { ApiResult } from "@/contracts/shared/api.contract";
import { searchRoadPackages } from "@/server/packages/service";

const WORK_CATEGORIES = new Set<RoadWorkCategory>([
  "SEMUA",
  "PERMUKAAN",
  "DRAINASE",
  "JEMBATAN",
]);

function parseFilters(url: URL): RoadPackageSearchFilters | string {
  const year = url.searchParams.get("year")?.trim() || undefined;
  const district = url.searchParams.get("district")?.trim() || undefined;
  const work = url.searchParams.get("work")?.trim() || undefined;
  const query = url.searchParams.get("q")?.trim() || undefined;

  if (year && year !== "2025" && year !== "2026") {
    return "Tahun anggaran harus 2025 atau 2026.";
  }
  if (district && district.length > 100) {
    return "Nama kecamatan terlalu panjang.";
  }
  if (work && !WORK_CATEGORIES.has(work as RoadWorkCategory)) {
    return "Jenis pekerjaan tidak dikenal.";
  }
  if (query && query.length > 120) {
    return "Pencarian maksimal 120 karakter.";
  }

  return {
    year: year as RoadPackageSearchFilters["year"],
    district,
    work: work as RoadWorkCategory | undefined,
    query,
  };
}

export async function GET(request: Request) {
  const filters = parseFilters(new URL(request.url));
  if (typeof filters === "string") {
    const result: ApiResult<never> = {
      data: null,
      error: { code: "INVALID_QUERY", message: filters },
    };
    return Response.json(result, { status: 400 });
  }

  try {
    const result: ApiResult<Awaited<ReturnType<typeof searchRoadPackages>>> = {
      data: await searchRoadPackages(filters),
      error: null,
    };
    return Response.json(result);
  } catch {
    const result: ApiResult<never> = {
      data: null,
      error: { code: "PACKAGE_DATA_UNAVAILABLE", message: "Data paket jalan belum dapat dimuat." },
    };
    return Response.json(result, { status: 500 });
  }
}
