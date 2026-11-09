import "server-only";
import type {
  RoadPackageItem,
  RoadPrecisionType,
} from "@/contracts/packages/road-package.contract";
import { prisma } from "@/lib/prisma";
import { DEFAULT_REGION_ID } from "@/server/regions/region-registry";
import { getIndeksKontrak } from "./lpse-repository";
import type { RoadPackageRepository } from "./repository";

const ROAD_SECTOR = "Jalan, Jembatan & Drainase";

const PRECISION: Record<string, RoadPrecisionType> = {
  RW: "RW",
  KELURAHAN: "Kelurahan",
  KECAMATAN: "Kecamatan",
  KABUPATEN: "Kabupaten",
};

/** Normalisasi nama wilayah; harus sama dengan `norm` di scripts/lib/region.mjs. */
function norm(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\b(jl|jalan|gang|gg|komp|komplek|kp|kampung)\.?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unitIdFor(
  village: string | null,
  rw: string | null,
  precision: RoadPrecisionType,
): string | null {
  if (!village) return null;
  return `${norm(village)}|${precision === "RW" && rw ? rw : "*"}`;
}

function monthFor(value: string | null, year: number): string | null {
  return value && value.slice(-4) === String(year) ? value : null;
}

export function createDatabaseRoadPackageRepository(
  regionId: string = DEFAULT_REGION_ID,
): RoadPackageRepository {
  return {
    async listRoadPackages() {
      const [rows, indeks] = await Promise.all([
        prisma.roadPackage.findMany({
          where: { regionId },
          select: {
            rup: true,
            year: true,
            name: true,
            agencyName: true,
            budget: true,
            method: true,
            locationPrecision: true,
            officialDistrict: true,
            officialVillage: true,
            rwCode: true,
            microLocation: true,
            rupPackage: {
              select: {
                sumberDana: true,
                detail: { select: { jadwalPemilihanMulai: true } },
              },
            },
          },
        }),
        getIndeksKontrak(regionId),
      ]);

      const packages = rows.map((row): RoadPackageItem => {
        const precision = PRECISION[row.locationPrecision] ?? "Kabupaten";
        return {
          kode_rup: row.rup,
          tahun: row.year,
          satker: row.agencyName,
          nama: row.name,
          pagu: Number(row.budget),
          metode: row.method || null,
          sumber: row.rupPackage?.sumberDana ?? null,
          bulan: monthFor(row.rupPackage?.detail?.jadwalPemilihanMulai ?? null, row.year),
          sektor: ROAD_SECTOR,
          lokasi_mikro: row.microLocation,
          desa_resmi: row.officialVillage,
          rw: row.rwCode,
          unit_id: unitIdFor(row.officialVillage, row.rwCode, precision),
          kecamatan_resmi: row.officialDistrict,
          lat: null,
          lon: null,
          presisi_peta: precision,
          kontrak: indeks.kontrakPerRup.get(String(row.rup)) ?? null,
        };
      });

      return packages.sort(
        (a, b) =>
          b.tahun - a.tahun ||
          b.pagu - a.pagu ||
          (a.kode_rup < b.kode_rup ? -1 : a.kode_rup > b.kode_rup ? 1 : 0),
      );
    },
  };
}
