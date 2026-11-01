import type { RoadPrecisionType } from "@/contracts/packages/road-package.contract";

export type {
  RoadPackageItem,
  RoadMapUnit,
  RoadPrecisionType,
  RoadWorkCategory,
} from "@/contracts/packages/road-package.contract";

export function formatPrecisionBadgeLabel(presisi: RoadPrecisionType): string {
  if (presisi === "RW") return "RW";
  if (presisi === "Kelurahan") return "Kelurahan";
  if (presisi === "Kecamatan") return "Kecamatan";
  return "Lokasi: Kota Tangerang (Umum)";
}

export function formatRupiahFull(amount: number): string {
  return `Rp${amount.toLocaleString("id-ID")}`;
}
