import type { RoadPackageItem } from "./road-package.contract";

type BudgetYear = "2025" | "2026";

/**
 * Pilih satu desil pagu dari seluruh paket jalan pada tahun tersebut.
 * Urutan kode RUP memecahkan pagu yang sama secara konsisten.
 */
export function selectBudgetDecile(
  rows: RoadPackageItem[],
  year: BudgetYear,
  decile: number,
): RoadPackageItem[] {
  if (year !== "2025" && year !== "2026") {
    throw new RangeError("Tahun desil anggaran harus 2025 atau 2026.");
  }
  if (!Number.isInteger(decile) || decile < 1 || decile > 10) {
    throw new RangeError("Desil anggaran harus bilangan bulat antara 1 dan 10.");
  }

  const ranked = rows
    .filter((item) => String(item.tahun) === year)
    .slice()
    .sort((a, b) => a.pagu - b.pagu || a.kode_rup.localeCompare(b.kode_rup));
  const start = Math.floor(((decile - 1) * ranked.length) / 10);
  const end = Math.floor((decile * ranked.length) / 10);
  return ranked.slice(start, end);
}
