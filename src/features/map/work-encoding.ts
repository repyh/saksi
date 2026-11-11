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
 * Jenis dengan paket terbanyak, dipakai untuk ikon wilayah. Selalu ada selama
 * wilayah punya paket; wilayah campuran tetap diberi ikon jenis teratasnya.
 */
export function topWork(counts: WorkCounts, total: number): SpecificRoadWorkCategory | null {
  if (total <= 0) return null;
  let best: SpecificRoadWorkCategory | null = null;
  for (const category of ROAD_WORK_TYPES) {
    if (!best || counts[category] > counts[best]) best = category;
  }
  return best;
}

/**
 * Jenis dominan hanya disebut bila lebih dari separuh paket di wilayah itu.
 * Di bawah itu, wilayah disebut campuran agar tidak mengarang pemenang.
 */
export function dominantWork(counts: WorkCounts, total: number): SpecificRoadWorkCategory | null {
  const best = topWork(counts, total);
  if (!best || counts[best] * 2 <= total) return null;
  return best;
}
