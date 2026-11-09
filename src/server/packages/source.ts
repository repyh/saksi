import "server-only";
import { DEFAULT_REGION_ID } from "@/server/regions/region-registry";
import { createDatabaseRoadPackageRepository } from "./database-repository";
import { isDatabaseEnabled } from "./data-source";
import type { RoadPackageRepository } from "./repository";
import { createSnapshotRoadPackageRepository } from "./snapshot-repository";

/** Repository paket aktif: database bila tersedia, snapshot sebagai cadangan. */
export function createRoadPackageRepository(
  regionId: string = DEFAULT_REGION_ID,
): RoadPackageRepository {
  return isDatabaseEnabled()
    ? createDatabaseRoadPackageRepository(regionId)
    : createSnapshotRoadPackageRepository(regionId);
}
