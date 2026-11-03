import { accessApi } from "@/server/api/access/access.api";

export function POST(request: Request) {
  return accessApi.createInvite(request);
}
