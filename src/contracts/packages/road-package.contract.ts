export type RoadPrecisionType =
  | "RW"
  | "Kelurahan"
  | "Kecamatan"
  | "Kabupaten";

export type RoadWorkCategory = "SEMUA" | "PERMUKAAN" | "DRAINASE" | "JEMBATAN";

/** Rekam kontrak/pemenang: LPSE (tender & non-tender) atau Data INAPROC (realisasi e-purchasing). */
export interface RoadPackageContract {
  jenis: "tender" | "nontender" | "e-purchasing" | "lainnya";
  sumber: "LPSE" | "Data INAPROC";
  metode: string | null;
  pemenang: string;
  npwp: string | null;
  hps: number | null;
  nilai_kontrak: number | null;
  tahun: number;
  url: string | null;
  /** Jumlah transaksi/pesanan yang membentuk nilai (khas e-purchasing). */
  transaksi?: number;
  /** Penyedia lain bila satu paket punya beberapa transaksi. */
  penyediaLain?: string[];
  sumberTransaksi?: string | null;
}

export type RoadContractFilter = "SEMUA" | "ADA" | "TANPA";

export interface VendorSummary {
  slug: string;
  nama: string;
  paket: number;
  nilai: number;
  tahun: number[];
  kategori: RoadWorkCategory[];
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
  rw: string | null;
  unit_id: string | null;
  kecamatan_resmi: string | null;
  lat: number | null;
  lon: number | null;
  presisi_peta: RoadPrecisionType;
  /** Rekam kontrak LPSE; `null` berarti tidak ditemukan (mis. e-purchasing). */
  kontrak: RoadPackageContract | null;
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
  contract?: RoadContractFilter;
  query?: string;
}

export interface RoadPackageSearchData {
  items: RoadPackageItem[];
  districts: string[];
  totalCount: number;
  filteredCount: number;
  withContractCount: number;
  vendorCount: number;
}
