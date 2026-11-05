import { accessApi } from "@/server/api/access/access.api";

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return accessApi.listAccountPermissionGrants(request, userId);
}

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return accessApi.grantAccountPermissions(request, userId);
}
