export type RoadPrecisionType =
  | "Desa/Kelurahan"
  | "Garis Koridor"
  | "Kecamatan"
  | "Kabupaten";

export type RoadWorkCategory = "SEMUA" | "PERMUKAAN" | "DRAINASE" | "JEMBATAN";

export interface RoadCorridorGeometry {
  dari: string;
  ke: string;
  kecamatan: string;
  lat_dari: number;
  lon_dari: number;
  lat_ke: number;
  lon_ke: number;
}

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
  kecamatan_resmi: string | null;
  id_desa: string | null;
  lat: number | null;
  lon: number | null;
  presisi_peta: RoadPrecisionType;
  koridor?: RoadCorridorGeometry;
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
