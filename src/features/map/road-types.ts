import type { RoadPrecisionType } from "@/contracts/packages/road-package.contract";

export type {
  RoadCorridorGeometry,
  RoadPackageItem,
  RoadPrecisionType,
  RoadWorkCategory,
} from "@/contracts/packages/road-package.contract";

export function formatPrecisionBadgeLabel(presisi: RoadPrecisionType): string {
  if (presisi === "Desa/Kelurahan") return "Titik Desa";
  if (presisi === "Garis Koridor") return "Garis Koridor";
  if (presisi === "Kecamatan") return "Kecamatan";
  return "Lokasi: Kab. Tangerang (Umum)";
}

export function formatRupiahFull(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}
