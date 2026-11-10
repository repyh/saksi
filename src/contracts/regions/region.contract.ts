/** Kontrak lintas lapisan untuk pemilihan region (kabupaten/kota). */

export interface RegionBoundaryUrls {
  /** URL GeoJSON unit lingkungan (RW/dusun/banjar), `null` bila region tidak punya. */
  lingkungan: string | null;
  kelurahan: string;
  /** URL GeoJSON kecamatan, `null` bila tidak tersedia. */
  kecamatan: string | null;
}

/** Nama properti GeoJSON yang dipakai region ini; jangan diasumsikan sama antar daerah. */
export interface RegionBoundaryFields {
  kelurahan: string;
  kecamatan: string;
  /** Properti nomor unit lingkungan, `null` bila tidak ada. */
  lingkungan: string | null;
}

/** Properti layer GeoJSON jaringan jalan yang dipakai klien; `null` bila region tidak punya layer. */
export interface RegionRoadLayerFields {
  id: string;
  nama: string;
  kelas: string;
  panjang: string;
  lebar: string;
  kecamatan: string;
  kelurahan: string;
}

export interface RegionRoadLayer {
  url: string;
  label: string;
  attribution: string;
  license: string;
  sourceRelease: string | null;
  fields: RegionRoadLayerFields;
}

export interface RegionSummary {
  id: string;
  label: string;
  /** Label unit lingkungan terhalus: "RW", "Dusun", "Banjar", … */
  environmentLabel: string;
  boundaries: RegionBoundaryUrls;
  boundaryFields: RegionBoundaryFields;
  /** Layer jaringan jalan referensi; hanya untuk konteks peta, bukan sumber lokasi paket. */
  roadLayer: RegionRoadLayer | null;
  /** Pusat peta [lon, lat]. */
  center: [number, number];
  zoom: number;
}

export interface RegionOption {
  id: string;
  label: string;
}
