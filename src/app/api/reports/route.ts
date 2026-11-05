import { reportsApi } from "@/server/api/reports/reports.api";
import { isAllowedCorsOrigin, reportPreflight, withCors } from "@/server/api/shared/cors";
import { apiFailure } from "@/server/api/shared/api-response";

export function OPTIONS(request: Request) {
  return reportPreflight(request.headers.get("origin"));
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && !isAllowedCorsOrigin(origin)) {
    return apiFailure("ORIGIN_NOT_ALLOWED", "Asal permintaan tidak diizinkan.", 403);
  }
  return withCors(await reportsApi.submit(request), origin);
}
