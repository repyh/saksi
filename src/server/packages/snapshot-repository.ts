import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import { prisma } from "@/lib/prisma";
import { DEFAULT_REGION_ID, getRegion } from "@/server/regions/region-registry";
import type { RoadPackageRepository } from "./repository";
import { isDatabaseEnabled } from "./data-source";
import { getIndeksKontrak } from "./lpse-repository";

const ROAD_SECTOR = "Jalan, Jembatan & Drainase";
const PRECISION_TYPES = new Set(["RW", "Kelurahan", "Kecamatan", "Kabupaten"]);

interface SnapshotFile {
  snapshot: string;
  sumber: string;
  paket: unknown;
}

const AKAR = process.cwd();
const cache = new Map<string, SnapshotFile>();

function bacaSnapshot(regionId: string): SnapshotFile {
  const tersimpan = cache.get(regionId);
  if (tersimpan) return tersimpan;
  const region = getRegion(regionId);
  const snapshot = JSON.parse(
    readFileSync(path.resolve(AKAR, region.keluaran), "utf8"),
  ) as SnapshotFile;
  cache.set(regionId, snapshot);
  return snapshot;
}

const SUMBER_DATABASE: Record<string, string> = {
  "RUP data.inaproc.id": "data.inaproc.id/rup",
};

/** Provenance of the active package source for one region, used by audit metrics. */
export async function snapshotMeta(regionId: string = DEFAULT_REGION_ID) {
  if (isDatabaseEnabled()) {
    const baris = await prisma.roadPackage.findFirst({
      where: { regionId },
      orderBy: { sourceRetrievedAt: "desc" },
      select: { datasetVersion: true, sourceName: true },
    });
    return {
      snapshot: baris?.datasetVersion ?? "-",
      sumber: baris ? (SUMBER_DATABASE[baris.sourceName] ?? baris.sourceName) : "-",
    };
  }

  const snapshot = bacaSnapshot(regionId);
  return { snapshot: snapshot.snapshot, sumber: snapshot.sumber };
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableCoordinate(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isRoadPackageItem(value: unknown): value is RoadPackageItem {
  if (typeof value !== "object" || value === null) return false;

  const item = value as Record<string, unknown>;
  return (
    typeof item.kode_rup === "string" &&
    typeof item.tahun === "number" &&
    typeof item.satker === "string" &&
    typeof item.nama === "string" &&
    typeof item.pagu === "number" &&
    typeof item.sektor === "string" &&
    isNullableString(item.metode) &&
    isNullableString(item.sumber) &&
    isNullableString(item.bulan) &&
    isNullableString(item.lokasi_mikro) &&
    isNullableString(item.desa_resmi) &&
    isNullableString(item.rw) &&
    isNullableString(item.unit_id) &&
    isNullableString(item.kecamatan_resmi) &&
    isNullableCoordinate(item.lat) &&
    isNullableCoordinate(item.lon) &&
    typeof item.presisi_peta === "string" &&
    PRECISION_TYPES.has(item.presisi_peta)
  );
}

export function createSnapshotRoadPackageRepository(
  regionId: string = DEFAULT_REGION_ID,
): RoadPackageRepository {
  function bacaPaket(): RoadPackageItem[] {
    const region = getRegion(regionId);
    const packageRows = bacaSnapshot(regionId).paket;
    if (!Array.isArray(packageRows)) {
      throw new Error(`Snapshot paket ${region.label} memiliki format yang tidak sah.`);
    }
    return (packageRows as unknown[]).filter(
      (item): item is RoadPackageItem =>
        isRoadPackageItem(item) && item.sektor === ROAD_SECTOR,
    );
  }

  return {
    async listRoadPackageBases() {
      return bacaPaket().map((item) => ({ ...item, kontrak: null }));
    },

    async listRoadPackages() {
      const indeks = await getIndeksKontrak(regionId);
      return bacaPaket().map((item) => ({
        ...item,
        kontrak: indeks.kontrakPerRup.get(String(item.kode_rup)) ?? null,
      }));
    },
  };
}

/** Repository region bawaan; dipakai jalur yang belum membawa parameter region (mis. laporan). */
export const snapshotRoadPackageRepository = createSnapshotRoadPackageRepository(DEFAULT_REGION_ID);
