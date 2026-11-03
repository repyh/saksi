import "server-only";
import { ApiController } from "@/server/api/shared/api-controller";
import { parsePackageFilters } from "./query-schema";
import { searchRoadPackages } from "@/server/packages/service";

export class PackagesApi extends ApiController {
  search(request: Request): Promise<Response> {
    return this.respond(
      async () => searchRoadPackages(parsePackageFilters(new URL(request.url))),
      {
        code: "PACKAGE_DATA_UNAVAILABLE",
        message: "Data paket jalan belum dapat dimuat.",
      },
    );
  }
}

export const packagesApi = new PackagesApi();
