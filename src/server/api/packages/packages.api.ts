import "server-only";
import { ApiController } from "@/server/api/shared/api-controller";
import { ApiError } from "@/server/api/shared/api-error";
import { parsePackageFilters } from "./query-schema";
import { aggregateRoadPackages, getRoadPackage, searchRoadPackages } from "@/server/packages/service";
import { DEFAULT_REGION_ID, getRegionOrNull } from "@/server/regions/region-registry";

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

  map(request: Request): Promise<Response> {
    return this.respond(
      async () => aggregateRoadPackages(parsePackageFilters(new URL(request.url))),
      {
        code: "PACKAGE_MAP_UNAVAILABLE",
        message: "Agregat peta paket jalan belum dapat dimuat.",
      },
    );
  }

  detail(request: Request, rup: string): Promise<Response> {
    return this.respond(
      async () => {
        const url = new URL(request.url);
        const region = url.searchParams.get("region")?.trim() || DEFAULT_REGION_ID;
        if (!getRegionOrNull(region)) {
          throw new ApiError(400, "INVALID_QUERY", "Region tidak dikenal.");
        }
        const item = await getRoadPackage(rup, region);
        if (!item) {
          throw new ApiError(404, "PACKAGE_NOT_FOUND", "Paket jalan tidak ditemukan.");
        }
        return item;
      },
      {
        code: "PACKAGE_DETAIL_UNAVAILABLE",
        message: "Detail paket jalan belum dapat dimuat.",
      },
    );
  }
}

export const packagesApi = new PackagesApi();
