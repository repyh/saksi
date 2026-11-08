import type { RoadPackageItem } from "./road-package.contract";

/**
 * Kunci wilayah yang dipakai bersama oleh agregasi server dan pewarnaan peta.
 * Normalisasi harus sama persis di kedua sisi agar koroplet tidak bergeser.
 */
export function normalizeAreaKey(value: unknown) {
  return String(value ?? "").toLocaleLowerCase("id-ID").replace(/[^a-z0-9]/g, "");
}

export type RoadAreaLevel = "rw" | "kel" | "kec";

/** Kunci agregat untuk satu paket pada satu tingkat batas wilayah. */
export function areaKeyForPackage(
  item: Pick<RoadPackageItem, "presisi_peta" | "unit_id" | "desa_resmi" | "kecamatan_resmi">,
  level: RoadAreaLevel,
): string | null {
  if (level === "rw") {
    return item.presisi_peta === "RW" && item.unit_id ? normalizeAreaKey(item.unit_id) : null;
  }
  if (level === "kel") {
    return item.desa_resmi ? normalizeAreaKey(item.desa_resmi) : null;
  }
  return item.kecamatan_resmi ? normalizeAreaKey(item.kecamatan_resmi) : null;
}
