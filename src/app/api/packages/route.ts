import { packagesApi } from "@/server/api/packages/packages.api";

export function GET(request: Request) {
  return packagesApi.search(request);
}
