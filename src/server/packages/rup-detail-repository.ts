import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { RoadPackagePlanDetail } from "@/contracts/packages/road-package-detail.contract";
import { DEFAULT_REGION_ID, getRegion } from "@/server/regions/region-registry";
import { indexRupDetail } from "./rup-detail";

export { normalizeRupDetailText } from "./rup-detail";

interface RupDetailFile {
  item?: unknown[];
}

const AKAR = process.cwd();
const cache = new Map<string, Map<string, RoadPackagePlanDetail> | null>();
const sudahPeringatan = new Set<string>();

/**
 * Muat detail RUP satu region sekali. File yang tidak ada atau tidak bisa dibaca
 * tidak melempar error: halaman tetap dirender dengan detail kosong.
 */
function muatDetail(regionId: string): Map<string, RoadPackagePlanDetail> | null {
  const tersimpan = cache.get(regionId);
  if (tersimpan !== undefined) return tersimpan;

  const region = getRegion(regionId);
  const berkas = region.sumber.detail;
  if (!berkas) {
    cache.set(regionId, null);
    return null;
  }

  try {
    const isi = JSON.parse(readFileSync(path.resolve(AKAR, berkas), "utf8")) as RupDetailFile;
    const index = indexRupDetail(Array.isArray(isi.item) ? isi.item : []);
    cache.set(regionId, index);
    return index;
  } catch (error) {
    if (!sudahPeringatan.has(regionId)) {
      const kode = (error as NodeJS.ErrnoException)?.code;
      console.warn(
        kode === "ENOENT"
          ? `Detail RUP region "${regionId}" belum tersedia di ${berkas}; halaman memakai detail kosong.`
          : `Detail RUP region "${regionId}" gagal dibaca dari ${berkas}; halaman memakai detail kosong.`,
      );
      sudahPeringatan.add(regionId);
    }
    cache.set(regionId, null);
    return null;
  }
}

/** Detail rencana satu paket; `null` bila tidak ada entri atau file detail tidak tersedia. */
export function bacaRupDetail(
  kodeRup: string,
  regionId: string = DEFAULT_REGION_ID,
): RoadPackagePlanDetail | null {
  const index = muatDetail(regionId);
  return index?.get(String(kodeRup).trim()) ?? null;
}
