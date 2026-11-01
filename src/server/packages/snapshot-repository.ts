import "server-only";
import snapshot from "../../../data/saksi_kota_tangerang_2025_2026.json";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import type { RoadPackageRepository } from "./repository";

const ROAD_SECTOR = "Jalan, Jembatan & Drainase";
const PRECISION_TYPES = new Set(["RW", "Kelurahan", "Kecamatan", "Kabupaten"]);

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
    typeof item.metode === "string" &&
    typeof item.sumber === "string" &&
    typeof item.bulan === "string" &&
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

export const snapshotRoadPackageRepository: RoadPackageRepository = {
  async listRoadPackages() {
    const packageRows: unknown = snapshot.paket;
    if (!Array.isArray(packageRows)) {
      throw new Error("The Kota Tangerang road package snapshot has an invalid format.");
    }

    return (packageRows as unknown[]).filter(
      (item): item is RoadPackageItem =>
        isRoadPackageItem(item) && item.sektor === ROAD_SECTOR,
    );
  },
};
