import { ROAD_WORK_TYPES, type SpecificRoadWorkCategory } from "@/contracts/packages/road-work";

export type WorkCounts = Record<SpecificRoadWorkCategory, number>;

/**
 * Warna jenis pekerjaan untuk koroplet. Sengaja tetap di keluarga biru/navy agar
 * tidak terbaca sebagai skala nilai atau peringatan (DESIGN.md, aturan indikator).
 */
export const WORK_COLORS: Record<SpecificRoadWorkCategory, string> = {
  PERMUKAAN: "#0058A3",
  DRAINASE: "#7FAEDC",
  JEMBATAN: "#FFDA1A",
};

/** Wilayah tanpa jenis yang benar-benar dominan (mis. 40/35/25). */
export const WORK_MIXED_COLOR = "#94A3B8";

/**
 * Jenis dominan hanya disebut bila lebih dari separuh paket di wilayah itu.
 * Di bawah itu, wilayah diberi warna campuran agar tidak mengarang pemenang.
 */
export function dominantWork(counts: WorkCounts, total: number): SpecificRoadWorkCategory | null {
  if (total <= 0) return null;
  let best: SpecificRoadWorkCategory | null = null;
  for (const category of ROAD_WORK_TYPES) {
    if (!best || counts[category] > counts[best]) best = category;
  }
  if (!best || counts[best] * 2 <= total) return null;
  return best;
}

export function workFill(counts: WorkCounts, total: number): string {
  const dominant = dominantWork(counts, total);
  return dominant ? WORK_COLORS[dominant] : WORK_MIXED_COLOR;
}
