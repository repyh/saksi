import "server-only";
import { revalidateTag, unstable_cache } from "next/cache";
import { cache } from "react";
import type {
  RoadPackageContract,
  RoadPackageItem,
  VendorSummary,
} from "@/contracts/packages/road-package.contract";
import { classifyRoadWork } from "@/contracts/packages/road-work";
import { DEFAULT_REGION_ID } from "@/server/regions/region-registry";
import {
  CATALOG_CACHE_TAGS,
  CATALOG_REVALIDATE_SECONDS,
  CATALOG_SOURCE,
} from "./catalog-cache-config";
import { getIndeksKontrak, resetIndeksKontrakCache, ringkasanPenyedia, slugPenyedia } from "./lpse-repository";
import { snapshotMeta } from "./snapshot-repository";
import { createRoadPackageRepository } from "./source";

/**
 * Cache baca katalog berlapis:
 * - `unstable_cache` (Data Cache Next) menyimpan hasil lintas request/proses dengan
 *   `revalidate` detik, sehingga biaya baca database tidak dibayar per request.
 * - `cache()` React mendeduplikasi panggilan dalam satu request (generateMetadata +
 *   page, search + aggregate) tanpa menambah entri cache lintas request.
 *
 * Laporan warga tidak pernah masuk ke modul ini; laporan tetap dibaca langsung
 * pada setiap request di halaman yang membutuhkannya.
 */

const loadRoadPackageBases = unstable_cache(
  async (regionId: string): Promise<RoadPackageItem[]> => {
    const repository = createRoadPackageRepository(regionId);
    return repository.listRoadPackageBases
      ? repository.listRoadPackageBases()
      : repository.listRoadPackages();
  },
  ["catalog-road-package-bases", CATALOG_SOURCE],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: CATALOG_CACHE_TAGS },
);

/** Package rows without contract joins, cached across requests for map and summary views. */
export const listRoadPackageBasesCached = cache(
  async (regionId: string = DEFAULT_REGION_ID): Promise<RoadPackageItem[]> =>
    loadRoadPackageBases(regionId),
);

const loadContractsPerRup = unstable_cache(
  async (regionId: string): Promise<Record<string, RoadPackageContract>> => {
    const [bases, indeks] = await Promise.all([
      loadRoadPackageBases(regionId),
      getIndeksKontrak(regionId),
    ]);
    // Snapshot memuat kontrak seluruh sektor; simpan hanya RUP paket jalan agar
    // entri Data Cache tetap jauh di bawah batas 2 MB per entri.
    const rupJalan = new Set(bases.map((item) => String(item.kode_rup)));
    const hasil: Record<string, RoadPackageContract> = {};
    for (const [rup, kontrak] of indeks.kontrakPerRup) {
      if (rupJalan.has(rup)) hasil[rup] = kontrak;
    }
    return hasil;
  },
  // Kunci versi dinaikkan saat bentuk rekam kontrak berubah (mis. rincian realisasi
  // Data INAPROC kini ikut ditempelkan ke rekam LPSE, lalu nama penyedia dibandingkan
  // tanpa tanda baca) agar entri lama tidak dipakai sampai siklus revalidasi berikutnya.
  ["catalog-contracts-per-rup-v3", CATALOG_SOURCE],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: CATALOG_CACHE_TAGS },
);

/**
 * Seluruh paket jalan satu region. Baris paket dan rekam kontrak disimpan sebagai
 * dua entri Data Cache (masing-masing di bawah batas 2 MB), lalu digabung per
 * request. Penggabungan seluruh baris katalog jauh lebih murah daripada query berulang.
 */
export const listRoadPackagesCached = cache(
  async (regionId: string = DEFAULT_REGION_ID): Promise<RoadPackageItem[]> => {
    const [bases, contracts] = await Promise.all([
      listRoadPackageBasesCached(regionId),
      loadContractsPerRup(regionId),
    ]);
    return bases.map((item) => ({
      ...item,
      kontrak: contracts[String(item.kode_rup)] ?? null,
    }));
  },
);

const loadSnapshotMeta = unstable_cache(
  async (regionId: string) => snapshotMeta(regionId),
  ["catalog-snapshot-meta", CATALOG_SOURCE],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: CATALOG_CACHE_TAGS },
);

/** Tanggal/provenance snapshot aktif; ikut di-cache karena hanya berubah saat ingest. */
export const snapshotMetaCached = cache(
  async (regionId: string = DEFAULT_REGION_ID) => loadSnapshotMeta(regionId),
);

export interface VendorCatalog {
  vendors: VendorSummary[];
  /** Slug penyedia → kode RUP yang dikontrakkan; dibangun dari indeks kontrak yang sama. */
  rupBySlug: Record<string, string[]>;
}

async function buildVendorCatalog(regionId: string): Promise<VendorCatalog> {
  const [semuaPaket, indeks] = await Promise.all([
    listRoadPackagesCached(regionId),
    getIndeksKontrak(regionId),
  ]);
  const rupJalan = new Set(semuaPaket.map((item) => String(item.kode_rup)));
  const semua = await ringkasanPenyedia(regionId, rupJalan);

  const kategori = new Map<string, Set<string>>();
  for (const item of semuaPaket) {
    if (!item.kontrak) continue;
    for (const nama of [item.kontrak.penyedia, ...(item.kontrak.penyediaLain ?? [])]) {
      const kunci = slugPenyedia(nama);
      const isi = kategori.get(kunci) ?? new Set<string>();
      isi.add(classifyRoadWork(item.nama));
      kategori.set(kunci, isi);
    }
  }

  const rupBySlug: Record<string, string[]> = Object.create(null);
  for (const [kunci, daftarRup] of indeks.rupPerPenyedia) {
    const slug = slugPenyedia(kunci);
    // Pertahankan perilaku lama: slug pertama yang ditemukan menang.
    if (!Object.hasOwn(rupBySlug, slug)) rupBySlug[slug] = [...daftarRup];
  }

  return {
    vendors: semua.map((vendor) => ({
      ...vendor,
      tahun: [...vendor.tahun].sort(),
      kategori: [...(kategori.get(vendor.slug) ?? [])] as VendorSummary["kategori"],
    })),
    rupBySlug,
  };
}

const loadVendorCatalog = unstable_cache(
  buildVendorCatalog,
  ["catalog-vendors-v2", CATALOG_SOURCE],
  { revalidate: CATALOG_REVALIDATE_SECONDS, tags: CATALOG_CACHE_TAGS },
);

/** Register penyedia lengkap satu region, tanpa filter pencarian. */
export const getVendorCatalogCached = cache(
  async (regionId: string = DEFAULT_REGION_ID): Promise<VendorCatalog> =>
    loadVendorCatalog(regionId),
);

/**
 * Buang seluruh cache katalog setelah ingestion selesai. TTL harian membuat data
 * baru bisa tertinggal hingga sehari tanpa langkah ini; pemanggilnya adalah
 * `POST /api/internal/catalog/revalidate` yang dijalankan worker ingestion.
 *
 * `revalidateTag` hanya mengosongkan Data Cache; indeks kontrak per proses punya
 * masa hidup sendiri dan harus direset eksplisit.
 */
export async function revalidateCatalogCache(): Promise<void> {
  revalidateTag(CATALOG_CACHE_TAGS[0], { expire: 0 });
  resetIndeksKontrakCache();
}
