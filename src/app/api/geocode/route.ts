import { ApiError } from "@/server/api/shared/api-error";
import { apiFailure, apiSuccess } from "@/server/api/shared/api-response";
import { DEFAULT_REGION_ID, getRegionOrNull } from "@/server/regions/region-registry";
import { geocodeAddress } from "@/server/geocoding/photon";
import { geocodeQuerySchema } from "@/contracts/reports/geocode.contract";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = geocodeQuerySchema.safeParse({
    q: url.searchParams.get("q")?.trim() ?? "",
    region: url.searchParams.get("region")?.trim() || undefined,
  });
  if (!parsed.success) {
    return apiFailure("INVALID_GEOCODE_QUERY", "Masukkan minimal 3 karakter alamat.", 400);
  }
  const regionId = parsed.data.region ?? DEFAULT_REGION_ID;
  if (!getRegionOrNull(regionId)) {
    return apiFailure("INVALID_REGION", "Region tidak dikenal.", 400);
  }
  try {
    const response = apiSuccess(await geocodeAddress(parsed.data.q, regionId));
    response.headers.set("Cache-Control", "public, max-age=300");
    return response;
  } catch (error) {
    if (error instanceof ApiError) return apiFailure(error.code, error.message, error.status);
    return apiFailure("GEOCODE_UNAVAILABLE", "Pencarian alamat belum dapat dimuat.", 502);
  }
}
