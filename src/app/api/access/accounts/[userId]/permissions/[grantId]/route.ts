import { accessApi } from "@/server/api/access/access.api";

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string; grantId: string }> }) {
  const { userId, grantId } = await params;
  return accessApi.revokeAccountPermission(request, userId, grantId);
}
