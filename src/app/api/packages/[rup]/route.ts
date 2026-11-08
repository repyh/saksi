import { packagesApi } from "@/server/api/packages/packages.api";

export async function GET(request: Request, { params }: { params: Promise<{ rup: string }> }) {
  const { rup } = await params;
  return packagesApi.detail(request, rup);
}
