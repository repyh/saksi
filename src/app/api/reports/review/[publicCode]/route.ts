import { reportsApi } from "@/server/api/reports/reports.api";

export async function PATCH(request: Request, { params }: { params: Promise<{ publicCode: string }> }) {
  const { publicCode } = await params;
  return reportsApi.changeStatus(request, publicCode);
}
