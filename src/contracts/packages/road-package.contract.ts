export type RoadPrecisionType =
  | "RW"
  | "Kelurahan"
  | "Kecamatan"
  | "Kabupaten";

export type RoadWorkCategory = "SEMUA" | "PERMUKAAN" | "DRAINASE" | "JEMBATAN";

export interface RoadPackageItem {
  kode_rup: string;
  tahun: number;
  satker: string;
  nama: string;
  pagu: number;
  metode: string;
  sumber: string;
  bulan: string;
  sektor: string;
  lokasi_mikro: string | null;
  desa_resmi: string | null;
  rw: string | null;
  unit_id: string | null;
  kecamatan_resmi: string | null;
  lat: number | null;
  lon: number | null;
  presisi_peta: RoadPrecisionType;
}

/** Administrative map unit keyed by the package's unit_id. */
export interface RoadMapUnit {
  id: string;
  desa: string;
  kelurahan: string;
  rw: string;
  kecamatan: string;
  lat: number;
  lon: number;
}

export interface RoadPackageSearchFilters {
  year?: "2025" | "2026";
  district?: string;
  work?: RoadWorkCategory;
  query?: string;
}

export interface RoadPackageSearchData {
  items: RoadPackageItem[];
  districts: string[];
  totalCount: number;
  filteredCount: number;
}
