import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";

export interface RoadPackageRepository {
  listRoadPackages(): Promise<RoadPackageItem[]>;
}
