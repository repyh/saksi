import { reportsApi } from "@/server/api/reports/reports.api";

export function GET(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  return params.then(({ reportId }) => reportsApi.getReviewDetail(request, reportId));
}

export function PATCH(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  return params.then(({ reportId }) => reportsApi.changeStatus(request, reportId));
}
