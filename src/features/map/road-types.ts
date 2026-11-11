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

/** Nilai rupiah ringkas untuk legenda dan ringkasan: `Rp734,3 Miliar`. */
export function formatRupiahCompact(amount: number): string {
  const abs = Math.abs(amount);
  const ringkas = (value: number, satuan: string) =>
    `Rp${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })} ${satuan}`;
  if (abs >= 1e12) return ringkas(amount / 1e12, "Triliun");
  if (abs >= 1e9) return ringkas(amount / 1e9, "Miliar");
  if (abs >= 1e6) return ringkas(amount / 1e6, "Juta");
  if (abs >= 1e3) return ringkas(amount / 1e3, "Ribu");
  return formatRupiahFull(amount);
}
