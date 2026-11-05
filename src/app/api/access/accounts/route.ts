import { accessApi } from "@/server/api/access/access.api";

export function GET(request: Request) {
  return accessApi.listAccounts(request);
}
