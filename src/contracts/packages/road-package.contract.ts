import type { RegionSummary } from "@/contracts/regions/region.contract";

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
  /**
   * Nama pelaksana. Disebut "pemenang" hanya bila `jenis === "tender"` (lelang/seleksi);
   * untuk pengadaan langsung, e-purchasing, dan sejenisnya istilahnya "penyedia".
   */
  penyedia: string;
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
  /** Kode paket di Data INAPROC (dipakai halaman realisasi), bukan kode RUP. */
  kodePaket?: string | null;
  /** Berapa paket realisasi yang terhubung ke RUP ini (relasi bisa satu-ke-banyak). */
  jumlahPaket?: number;
  /**
   * Rincian tiap paket realisasi; `nilai` = realisasi per paket, bukan nilai kontrak.
   * `penyedia` adalah penyedia utama (pemegang nilai transaksi); `penyediaSemua`
   * memuat seluruh nama valid bila satu transaksi dicatat untuk beberapa penyedia.
   */
  paketRealisasi?: Array<{
    kodePaket: string;
    penyedia: string;
    penyediaSemua: string[];
    nilai: number;
    sumber: string | null;
  }>;
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
  /** `null` bila ekspor RUP tidak mencantumkan metode (mis. baris "-"). */
  metode: string | null;
  sumber: string | null;
  /** `null` bila detail RUP belum ditarik untuk paket ini. */
  bulan: string | null;
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
  /** Region (kabupaten/kota); bawaan region aktif di server. */
  region?: string;
  year?: "2025" | "2026";
  district?: string;
  /** Kelurahan terpilih; hanya dikirim bila bukan "semua kelurahan di kecamatan itu". */
  villages?: string[];
  /** true = sembunyikan paket tanpa anchor wilayah (presisi Kabupaten). */
  locatedOnly?: boolean;
  work?: RoadWorkCategory;
  contract?: RoadContractFilter;
  query?: string;
  /** Halaman register (1-based). */
  page?: number;
  /** Jumlah baris register per halaman. */
  limit?: number;
}

export interface RoadPackageSearchData {
  region: RegionSummary;
  /** Baris register pada halaman yang diminta, bukan seluruh hasil filter. */
  items: RoadPackageItem[];
  districts: string[];
  /** Kelurahan per kecamatan, untuk pemilih checkbox di UI. */
  villagesByDistrict: Record<string, string[]>;
  totalCount: number;
  /** Jumlah seluruh paket yang cocok sebelum paginasi. */
  filteredCount: number;
  withContractCount: number;
  vendorCount: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

/** Agregat koroplet untuk satu wilayah; cukup untuk mewarnai peta tanpa seluruh baris paket. */
export interface RoadAreaAggregate {
  count: number;
  budget: number;
  workCounts: Record<"PERMUKAAN" | "DRAINASE" | "JEMBATAN", number>;
  /** RUP contoh di wilayah ini; detailnya dimuat saat wilayah dipilih. */
  sampleRup: string | null;
}

/** Agregat peta per tingkat batas wilayah, memakai kunci yang dinormalisasi. */
export interface RoadPackageMapData {
  region: RegionSummary;
  rw: Record<string, RoadAreaAggregate>;
  kel: Record<string, RoadAreaAggregate>;
  kec: Record<string, RoadAreaAggregate>;
  totalCount: number;
  filteredCount: number;
}
