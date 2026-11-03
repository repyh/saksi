import { accessApi } from "@/server/api/access/access.api";

export async function DELETE(request: Request, { params }: { params: Promise<{ inviteId: string }> }) {
  const { inviteId } = await params;
  return accessApi.revokeInvite(request, inviteId);
}
