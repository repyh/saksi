import "server-only";
import type {
  RoadPackageContract,
  RoadPackageItem,
  RoadPrecisionType,
} from "@/contracts/packages/road-package.contract";
import { prisma } from "@/lib/prisma";
import { DEFAULT_REGION_ID } from "@/server/regions/region-registry";
import { getIndeksKontrak } from "./lpse-repository";
import type { RoadPackageListOptions, RoadPackageRepository } from "./repository";

const ROAD_SECTOR = "Jalan, Jembatan & Drainase";

const PRECISION: Record<string, RoadPrecisionType> = {
  RW: "RW",
  KELURAHAN: "Kelurahan",
  KECAMATAN: "Kecamatan",
  KABUPATEN: "Kabupaten",
};

type RupPackageMetadata = {
  sumberDana: string | null;
  detail: { jadwalPemilihanMulai: string | null } | null;
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

const packageSelect = {
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
} as const;

async function muatBaris(regionId: string, includeRupMetadata = true) {
  return prisma.roadPackage.findMany({
    where: { regionId },
    select: includeRupMetadata
      ? {
          ...packageSelect,
          rupPackage: {
            select: {
              sumberDana: true,
              detail: { select: { jadwalPemilihanMulai: true } },
            },
          },
        }
      : packageSelect,
  });
}

type BarisPaket = Awaited<ReturnType<typeof muatBaris>>[number] & {
  rupPackage?: RupPackageMetadata | null;
};

function petakanBaris(
  row: BarisPaket,
  kontrak: RoadPackageContract | null,
): RoadPackageItem {
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
    kontrak,
  };
}

function urutkan(packages: RoadPackageItem[]): RoadPackageItem[] {
  return packages.sort(
    (a, b) =>
      b.tahun - a.tahun ||
      b.pagu - a.pagu ||
      (a.kode_rup < b.kode_rup ? -1 : a.kode_rup > b.kode_rup ? 1 : 0),
  );
}

export function createDatabaseRoadPackageRepository(
  regionId: string = DEFAULT_REGION_ID,
): RoadPackageRepository {
  return {
    async listRoadPackageBases() {
      const rows = await muatBaris(regionId);
      return urutkan(rows.map((row) => petakanBaris(row, null)));
    },

    async listRoadPackages(options: RoadPackageListOptions = {}) {
      const includeRupMetadata = options.includeRupMetadata !== false;
      const includeContracts = options.includeContracts !== false;
      const [rows, indeks] = await Promise.all([
        muatBaris(regionId, includeRupMetadata),
        includeContracts ? getIndeksKontrak(regionId) : Promise.resolve(null),
      ]);
      return urutkan(
        rows.map((row) => {
          const metadataRow = row as typeof row & { rupPackage?: RupPackageMetadata | null };
          return petakanBaris(
            { ...row, rupPackage: metadataRow.rupPackage ?? null } as BarisPaket,
            indeks?.kontrakPerRup.get(String(row.rup)) ?? null,
          );
        }),
      );
    },
  };
}
