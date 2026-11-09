import type { RegionSummary } from "@/contracts/regions/region.contract";
import type { RoadPackageItem } from "./road-package.contract";

/** Rincian rencana pengadaan dari detail RUP; semua field boleh kosong. */
export interface RoadPackagePlanDetail {
  jadwalPemilihanMulai: string | null;
  jadwalPemilihanAkhir: string | null;
  jadwalKontrakMulai: string | null;
  jadwalKontrakAkhir: string | null;
  uraian: string | null;
  volume: string | null;
  spesifikasi: string | null;
  mak: string | null;
}

export interface RoadPackageDetail {
  item: RoadPackageItem;
  /** Rincian detail RUP; field `null` berarti belum tersedia, bukan tidak ada. */
  plan: RoadPackagePlanDetail;
  region: RegionSummary;
  snapshot: { snapshot: string; sumber: string };
}
