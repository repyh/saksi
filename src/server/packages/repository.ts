import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";

export interface RoadPackageRepository {
  listRoadPackages(): Promise<RoadPackageItem[]>;
  /**
   * Baris paket tanpa rekam kontrak. Dipakai cache katalog berlapis: bagian paket
   * dan indeks kontrak disimpan sebagai dua entri Data Cache yang masing-masing
   * berada di bawah batas 2 MB per entri Next.
   */
  listRoadPackageBases?(): Promise<RoadPackageItem[]>;
}
