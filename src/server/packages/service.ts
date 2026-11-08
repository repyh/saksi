import "server-only";
import type {
  RoadPackageItem,
  RoadPackageSearchData,
  RoadPackageSearchFilters,
  VendorSummary,
} from "@/contracts/packages/road-package.contract";
import { classifyRoadWork } from "@/contracts/packages/road-work";
import {
  DEFAULT_REGION_ID,
  getRegion,
  regionSummary,
} from "@/server/regions/region-registry";
import { ringkasanPenyedia, rupMilikPenyedia, slugPenyedia } from "./lpse-repository";
import type { RoadPackageRepository } from "./repository";
import { createSnapshotRoadPackageRepository } from "./snapshot-repository";

function matchesQuery(item: RoadPackageItem, query: string): boolean {
  const searchableText = [
    item.nama,
    item.kode_rup,
    item.desa_resmi ?? "",
    item.rw ?? "",
    item.kecamatan_resmi ?? "",
    item.kontrak?.penyedia ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("id-ID");

  return searchableText.includes(query);
}

export async function searchRoadPackages(
  filters: RoadPackageSearchFilters = {},
  repository?: RoadPackageRepository,
): Promise<RoadPackageSearchData> {
  const regionId = filters.region ?? DEFAULT_REGION_ID;
  const region = getRegion(regionId);
  const paketRepository = repository ?? createSnapshotRoadPackageRepository(regionId);
  const allPackages = await paketRepository.listRoadPackages();
  const districts = Array.from(
    new Set(allPackages.flatMap((item) => (item.kecamatan_resmi ? [item.kecamatan_resmi] : []))),
  ).sort((a, b) => a.localeCompare(b, "id"));
  const query = filters.query?.trim().toLocaleLowerCase("id-ID") ?? "";
  const villages = filters.villages?.filter(Boolean) ?? [];
  const villagesTerpilih = villages.length ? new Set(villages) : null;

  const items = allPackages.filter((item) => {
    if (filters.year && String(item.tahun) !== filters.year) return false;
    if (filters.district && item.kecamatan_resmi !== filters.district) return false;
    if (villagesTerpilih && (!item.desa_resmi || !villagesTerpilih.has(item.desa_resmi))) return false;
    if (filters.locatedOnly && item.presisi_peta === "Kabupaten") return false;
    if (filters.work && filters.work !== "SEMUA" && classifyRoadWork(item.nama) !== filters.work) {
      return false;
    }
    if (filters.contract === "ADA" && !item.kontrak) return false;
    if (filters.contract === "TANPA" && item.kontrak) return false;
    if (query && !matchesQuery(item, query)) return false;
    return true;
  });

  const villagesByDistrict: Record<string, string[]> = {};
  for (const item of allPackages) {
    if (!item.kecamatan_resmi || !item.desa_resmi) continue;
    const daftar = villagesByDistrict[item.kecamatan_resmi] ?? [];
    if (!daftar.includes(item.desa_resmi)) daftar.push(item.desa_resmi);
    villagesByDistrict[item.kecamatan_resmi] = daftar;
  }
  for (const daftar of Object.values(villagesByDistrict)) {
    daftar.sort((a, b) => a.localeCompare(b, "id"));
  }

  const withContractCount = allPackages.filter((item) => item.kontrak).length;
  const vendorCount = new Set(
    allPackages.flatMap((item) =>
      item.kontrak
        ? [item.kontrak.penyedia, ...(item.kontrak.penyediaLain ?? [])].map((nama) =>
            nama.toLocaleUpperCase("id-ID"),
          )
        : [],
    ),
  ).size;

  return {
    region: regionSummary(region),
    items,
    districts,
    villagesByDistrict,
    totalCount: allPackages.length,
    filteredCount: items.length,
    withContractCount,
    vendorCount,
  };
}

/** Ringkasan penyedia dari rekam kontrak LPSE + Data INAPROC, dibatasi ke paket jalan region. */
export async function listVendors(
  query?: string,
  regionId: string = DEFAULT_REGION_ID,
): Promise<VendorSummary[]> {
  const cari = query?.trim().toLocaleLowerCase("id-ID");
  const paket = await searchRoadPackages({ region: regionId });
  const rupJalan = new Set(paket.items.map((item) => String(item.kode_rup)));
  const semua = ringkasanPenyedia(regionId, rupJalan);

  const kategori = new Map<string, Set<string>>();
  for (const item of paket.items) {
    if (!item.kontrak) continue;
    for (const nama of [item.kontrak.penyedia, ...(item.kontrak.penyediaLain ?? [])]) {
      const kunci = slugPenyedia(nama);
      const isi = kategori.get(kunci) ?? new Set<string>();
      isi.add(classifyRoadWork(item.nama));
      kategori.set(kunci, isi);
    }
  }

  return semua
    .filter((vendor) => !cari || vendor.nama.toLocaleLowerCase("id-ID").includes(cari))
    .map((vendor) => ({
      ...vendor,
      tahun: [...vendor.tahun].sort(),
      kategori: [...(kategori.get(vendor.slug) ?? [])] as VendorSummary["kategori"],
    }));
}

export async function getVendor(slug: string, regionId: string = DEFAULT_REGION_ID) {
  const semua = await listVendors(undefined, regionId);
  const summary = semua.find((vendor) => vendor.slug === slug);
  if (!summary) return null;

  const daftarRup = new Set(rupMilikPenyedia(regionId, slug).map(String));
  const paket = await searchRoadPackages({ region: regionId });
  const items = paket.items
    .filter((item) => daftarRup.has(String(item.kode_rup)))
    .sort((a, b) => (b.kontrak?.nilai_kontrak ?? 0) - (a.kontrak?.nilai_kontrak ?? 0));

  return {
    summary,
    items,
    totalNilai: items.reduce((n, item) => n + (item.kontrak?.nilai_kontrak ?? 0), 0),
  };
}
