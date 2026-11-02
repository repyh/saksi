import "server-only";
import type {
  RoadPackageItem,
  RoadPackageSearchData,
  RoadPackageSearchFilters,
  VendorSummary,
} from "@/contracts/packages/road-package.contract";
import { classifyRoadWork } from "@/contracts/packages/road-work";
import { daftarPenyedia, rupMilikPenyedia, slugPenyedia } from "./lpse-repository";
import type { RoadPackageRepository } from "./repository";
import { snapshotRoadPackageRepository } from "./snapshot-repository";

function matchesQuery(item: RoadPackageItem, query: string): boolean {
  const searchableText = [
    item.nama,
    item.kode_rup,
    item.desa_resmi ?? "",
    item.rw ?? "",
    item.kecamatan_resmi ?? "",
    item.kontrak?.pemenang ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("id-ID");

  return searchableText.includes(query);
}

export async function searchRoadPackages(
  filters: RoadPackageSearchFilters = {},
  repository: RoadPackageRepository = snapshotRoadPackageRepository,
): Promise<RoadPackageSearchData> {
  const allPackages = await repository.listRoadPackages();
  const districts = Array.from(
    new Set(allPackages.flatMap((item) => (item.kecamatan_resmi ? [item.kecamatan_resmi] : []))),
  ).sort((a, b) => a.localeCompare(b, "id"));
  const query = filters.query?.trim().toLocaleLowerCase("id-ID") ?? "";

  const items = allPackages.filter((item) => {
    if (filters.year && String(item.tahun) !== filters.year) return false;
    if (filters.district && item.kecamatan_resmi !== filters.district) return false;
    if (filters.work && filters.work !== "SEMUA" && classifyRoadWork(item.nama) !== filters.work) {
      return false;
    }
    if (filters.contract === "ADA" && !item.kontrak) return false;
    if (filters.contract === "TANPA" && item.kontrak) return false;
    if (query && !matchesQuery(item, query)) return false;
    return true;
  });

  const withContractCount = allPackages.filter((item) => item.kontrak).length;
  const vendorCount = new Set(
    allPackages.flatMap((item) =>
      item.kontrak ? [item.kontrak.pemenang.toLocaleUpperCase("id-ID")] : [],
    ),
  ).size;

  return {
    items,
    districts,
    totalCount: allPackages.length,
    filteredCount: items.length,
    withContractCount,
    vendorCount,
  };
}

/** Ringkasan penyedia dari rekam kontrak LPSE. */
export async function listVendors(query?: string): Promise<VendorSummary[]> {
  const semua = daftarPenyedia();
  const cari = query?.trim().toLocaleLowerCase("id-ID");

  const kategori = new Map<string, Set<string>>();
  const paket = await searchRoadPackages();
  for (const item of paket.items) {
    if (!item.kontrak) continue;
    const kunci = slugPenyedia(item.kontrak.pemenang);
    const isi = kategori.get(kunci) ?? new Set<string>();
    isi.add(classifyRoadWork(item.nama));
    kategori.set(kunci, isi);
  }

  return semua
    .filter((vendor) => !cari || vendor.nama.toLocaleLowerCase("id-ID").includes(cari))
    .map((vendor) => ({
      ...vendor,
      kategori: [...(kategori.get(vendor.slug) ?? [])] as VendorSummary["kategori"],
    }));
}

export async function getVendor(slug: string) {
  const semua = await listVendors();
  const summary = semua.find((vendor) => vendor.slug === slug);
  if (!summary) return null;

  const daftarRup = new Set(rupMilikPenyedia(slug).map(String));
  const paket = await searchRoadPackages();
  const items = paket.items
    .filter((item) => daftarRup.has(String(item.kode_rup)))
    .sort((a, b) => (b.kontrak?.nilai_kontrak ?? 0) - (a.kontrak?.nilai_kontrak ?? 0));

  return {
    summary,
    items,
    totalNilai: items.reduce((n, item) => n + (item.kontrak?.nilai_kontrak ?? 0), 0),
  };
}
