/**
 * lib/paket.ts — muat, saring, format, dan tautkan paket jalan.
 *
 * Semua angka berasal dari data; tidak ada angka paket yang di-hardcode.
 * Aturan produk: sektor jalan saja, tidak memaksa titik, tanpa klaim presisi palsu.
 */

export const SEKTOR_JALAN = "Jalan, Jembatan & Drainase";

export type Presisi = "Desa/Kelurahan" | "Garis Koridor" | "Kecamatan" | "Kabupaten";

export type Koridor = {
  dari: string;
  ke: string;
  kecamatan: string;
  lat_dari: number;
  lon_dari: number;
  lat_ke: number;
  lon_ke: number;
};

export type Paket = {
  kode_rup: string;
  tahun: number;
  satker: string;
  nama: string;
  pagu: number;
  metode: string;
  sumber: string;
  bulan: string;
  sektor: string;
  desa_resmi: string | null;
  kecamatan_resmi: string | null;
  lat: number | null;
  lon: number | null;
  presisi_peta: Presisi;
  koridor?: Koridor;
  lokasi_mikro: string | null;
};

export type Desa = {
  id_desa: string;
  desa: string;
  kecamatan: string;
  id_kec: string;
  lat: number;
  lon: number;
  presisi: string;
  label: string;
};

export type Dataset = {
  paket: Paket[];
  desa: Desa[];
};

export type JenisPekerjaan = "semua" | "permukaan" | "drainase" | "jembatan";

export type Filter = {
  tahun: "semua" | 2025 | 2026;
  kecamatan: string;
  jenis: JenisPekerjaan;
};

/* ── Muat data ──────────────────────────────────────────────── */

async function ambilJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`${url} — HTTP ${res.status}`);
  return res.json();
}

export async function muatData(signal?: AbortSignal): Promise<Dataset> {
  const [mentahPaket, mentahDesa] = await Promise.all([
    ambilJson("/data/paket.json", signal),
    ambilJson("/data/desa.json", signal),
  ]);

  const daftar = Array.isArray(mentahPaket)
    ? mentahPaket
    : ((mentahPaket as { paket?: unknown[] }).paket ?? []);

  const paket = (daftar as Paket[]).filter((p) => p.sektor === SEKTOR_JALAN);
  if (paket.length === 0) throw new Error("Dataset jalan kosong.");

  return { paket, desa: mentahDesa as Desa[] };
}

/* ── Klasifikasi jenis pekerjaan (kata kunci, urutan penting) ─ */

const RE_JEMBATAN = /jembatan|gorong[\s-]?gorong|box[-\s]?culvert/i;
const RE_DRAINASE =
  /drainase|saluran|u[-\s]?ditch|siring|turap|talud|\btpt\b|bronjong|penahan/i;

export function kelasPekerjaan(nama: string): Exclude<JenisPekerjaan, "semua"> {
  if (RE_JEMBATAN.test(nama)) return "jembatan";
  if (RE_DRAINASE.test(nama)) return "drainase";
  return "permukaan";
}

export function terapkanFilter(paket: Paket[], f: Filter): Paket[] {
  return paket.filter((p) => {
    if (f.tahun !== "semua" && p.tahun !== f.tahun) return false;
    if (f.kecamatan !== "semua" && p.kecamatan_resmi !== f.kecamatan) return false;
    if (f.jenis !== "semua" && kelasPekerjaan(p.nama) !== f.jenis) return false;
    return true;
  });
}

/* ── Format angka Indonesia ─────────────────────────────────── */

const NF = new Intl.NumberFormat("id-ID");
const NF1 = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const NF2 = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const angka = (n: number): string => NF.format(n);
export const angka1 = (n: number): string => NF1.format(n);
export const persen = (n: number): string => `${NF1.format(n)}%`;

/** Rp848,60 M · Rp115,17 jt · Rp681.000 */
export function rupiahRingkas(n: number): string {
  if (n >= 1e12) return `Rp${NF2.format(n / 1e12)} T`;
  if (n >= 1e9) return `Rp${NF2.format(n / 1e9)} M`;
  if (n >= 1e6) return `Rp${NF2.format(n / 1e6)} jt`;
  return `Rp${NF.format(n)}`;
}

/** Nilai penuh untuk panel detail: Rp115.166.348 */
export const rupiahPenuh = (n: number): string => `Rp${NF.format(n)}`;

const NF5 = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 5,
  maximumFractionDigits: 5,
});

export const koordinat = (lat: number, lon: number): string =>
  `${NF5.format(lat)}°, ${NF5.format(lon)}°`;

/* ── Bulan pelaksanaan ("October 2025" → "Oktober 2025") ───── */

const BULAN_EN: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
};

const BULAN_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export function bulanKe(nama: string): Date | null {
  const cocok = /^([A-Za-z]+)\s+(\d{4})$/.exec(nama.trim());
  if (!cocok) return null;
  const bulan = BULAN_EN[cocok[1].toLowerCase()];
  if (bulan === undefined) return null;
  return new Date(Number(cocok[2]), bulan, 1);
}

export function bulanIndo(nama: string): string {
  const d = bulanKe(nama);
  if (!d) return nama;
  return `${BULAN_ID[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Jendela pasca-pelaksanaan: paket yang sedang berjalan (±6 bulan ke depan) atau
 * selesai ≤12 bulan lalu — periode saat retensi masih bisa ditagih.
 */
export function dalamJendela(namaBulan: string, sekarang = new Date()): boolean {
  const d = bulanKe(namaBulan);
  if (!d) return false;
  const selisih =
    (sekarang.getFullYear() - d.getFullYear()) * 12 + (sekarang.getMonth() - d.getMonth());
  return selisih >= -6 && selisih <= 12;
}

/* ── Jarak & MatchScore (SPEC §3) ───────────────────────────── */

const R_BUMI_KM = 6371;

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_BUMI_KM * Math.asin(Math.sqrt(a));
}

export function desaTerdekat(
  lat: number,
  lon: number,
  desa: Desa[],
): { desa: Desa; jarakKm: number } | null {
  let terbaik: { desa: Desa; jarakKm: number } | null = null;
  for (const d of desa) {
    const jarakKm = haversine(lat, lon, d.lat, d.lon);
    if (!terbaik || jarakKm < terbaik.jarakKm) terbaik = { desa: d, jarakKm };
  }
  return terbaik;
}

const STOP = new Set([
  "yang",
  "dan",
  "untuk",
  "dengan",
  "pada",
  "dari",
  "jalan",
  "desa",
  "kelurahan",
  "kecamatan",
  "kec",
  "kel",
  "ds",
  "rt",
  "rw",
]);

function token(s: string | null | undefined): Set<string> {
  return new Set(
    (s ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOP.has(t)),
  );
}

/** Kemiripan teks 0–1 antara patokan laporan dan lokasi mikro paket. */
export function kemiripan(patokan: string, lokasiMikro: string | null): number {
  if (!patokan.trim()) return 0;
  const a = token(patokan);
  const b = token(lokasiMikro);
  if (a.size === 0 || b.size === 0) return 0;
  let kena = 0;
  for (const t of a) if (b.has(t)) kena += 1;
  return kena / a.size;
}

export type Kandidat = {
  paket: Paket;
  skor: number;
  jarakKm: number;
  desaSama: boolean;
  jendela: boolean;
  kemiripan: number;
};

export type HasilTautan = {
  desa: { desa: Desa; jarakKm: number } | null;
  kandidat: Kandidat[];
  /** false = tidak ada kandidat di desa yang sama → "Tidak Dapat Ditautkan" */
  tertaut: boolean;
};

/**
 * MatchScore(p) = 50·max(0, 1 − d/2000) + 25·I(desa sama)
 *              + 15·I(jendela pasca-pelaksanaan) + 10·kemiripan(c_w, lokasi_mikro)
 */
export function cariKandidat(
  paket: Paket[],
  input: {
    lat: number;
    lon: number;
    desa: Desa[];
    patokan?: string;
    sekarang?: Date;
    batas?: number;
  },
): HasilTautan {
  const sekarang = input.sekarang ?? new Date();
  const dekat = desaTerdekat(input.lat, input.lon, input.desa);
  if (!dekat) return { desa: null, kandidat: [], tertaut: false };

  const patokan = input.patokan ?? "";
  const hasil: Kandidat[] = [];

  for (const p of paket) {
    if (p.lat == null || p.lon == null) continue; // 271 paket tanpa lokus tidak ditautkan
    const jarakKm = haversine(input.lat, input.lon, p.lat, p.lon);
    const desaSama = p.desa_resmi === dekat.desa.desa;
    if (jarakKm > 2 && !desaSama) continue;

    const jendela = dalamJendela(p.bulan, sekarang);
    const mirip = kemiripan(patokan, p.lokasi_mikro);
    const skor =
      50 * Math.max(0, 1 - jarakKm / 2) + (desaSama ? 25 : 0) + (jendela ? 15 : 0) + 10 * mirip;

    hasil.push({
      paket: p,
      skor: Math.max(0, Math.min(100, Math.round(skor))),
      jarakKm,
      desaSama,
      jendela,
      kemiripan: mirip,
    });
  }

  hasil.sort((a, b) => b.skor - a.skor || b.paket.pagu - a.paket.pagu);

  return {
    desa: dekat,
    kandidat: hasil.slice(0, input.batas ?? 3),
    tertaut: hasil.some((k) => k.desaSama),
  };
}

/* ── Ringkasan untuk strip metrik ───────────────────────────── */

export type Statistik = {
  paket: number;
  pagu: number;
  medianPagu: number;
  perTahun: Record<number, number>;
  desa: number;
  desaTotal: number;
  bertitik: number;
  persenTitik: number;
  koridor: number;
  kecamatan: number;
  tanpaLokus: number;
};

export function statistik(paket: Paket[], desa: Desa[]): Statistik {
  let pagu = 0;
  let bertitik = 0;
  let koridor = 0;
  let tanpaLokus = 0;
  const setDesa = new Set<string>();
  const setKec = new Set<string>();
  const perTahun: Record<number, number> = {};
  const nilai: number[] = [];

  for (const p of paket) {
    pagu += p.pagu;
    nilai.push(p.pagu);
    perTahun[p.tahun] = (perTahun[p.tahun] ?? 0) + 1;
    if (p.lat != null && p.lon != null) bertitik += 1;
    if (p.presisi_peta === "Garis Koridor") koridor += 1;
    if (p.presisi_peta === "Kabupaten" || p.lat == null) tanpaLokus += 1;
    if (p.desa_resmi) setDesa.add(p.desa_resmi);
    if (p.kecamatan_resmi) setKec.add(p.kecamatan_resmi);
  }

  nilai.sort((a, b) => a - b);
  const tengah = Math.floor(nilai.length / 2);
  const medianPagu = nilai.length
    ? nilai.length % 2
      ? nilai[tengah]
      : (nilai[tengah - 1] + nilai[tengah]) / 2
    : 0;

  return {
    paket: paket.length,
    pagu,
    medianPagu,
    perTahun,
    desa: setDesa.size,
    desaTotal: desa.length,
    bertitik,
    persenTitik: paket.length ? (bertitik / paket.length) * 100 : 0,
    koridor,
    kecamatan: setKec.size,
    tanpaLokus,
  };
}

/* ── Label presisi untuk UI ─────────────────────────────────── */

export function labelPresisi(p: Paket): string {
  if (p.presisi_peta === "Desa/Kelurahan") return "Titik Desa";
  if (p.presisi_peta === "Garis Koridor") return "Garis Koridor";
  if (p.presisi_peta === "Kecamatan") return "Kecamatan";
  return "Tanpa lokasi";
}

export function badgePresisi(p: Paket): Presisi {
  return p.presisi_peta;
}

export function lokasiPaket(p: Paket): string {
  if (p.presisi_peta === "Garis Koridor" && p.koridor) {
    return `${p.koridor.dari} – ${p.koridor.ke}`;
  }
  if (p.presisi_peta === "Kabupaten" || p.lat == null) {
    return "Kab. Tangerang (Umum)";
  }
  return p.desa_resmi ?? "Kab. Tangerang";
}

/** Kecamatan unik, terurut abjad Indonesia. */
export function daftarKecamatan(paket: Paket[]): string[] {
  const set = new Set<string>();
  for (const p of paket) if (p.kecamatan_resmi) set.add(p.kecamatan_resmi);
  return [...set].sort((a, b) => a.localeCompare(b, "id"));
}

/** Desa unik untuk dropdown alur lapor, terurut per kecamatan. */
export function daftarDesa(desa: Desa[]): Desa[] {
  return [...desa].sort(
    (a, b) => a.kecamatan.localeCompare(b.kecamatan, "id") || a.desa.localeCompare(b.desa, "id"),
  );
}
