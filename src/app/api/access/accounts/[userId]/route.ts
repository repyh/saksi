import { accessApi } from "@/server/api/access/access.api";

export async function PATCH(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return accessApi.updateAccountProfile(request, userId);
}
