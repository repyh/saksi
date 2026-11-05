import { reportsApi } from "@/server/api/reports/reports.api";

export function GET(request: Request) {
  return reportsApi.listReviewQueue(request);
}
