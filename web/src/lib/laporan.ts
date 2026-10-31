/**
 * lib/laporan.ts — model laporan warga (SPEC §2.5) + penyimpanan lokal.
 * Laporan tidak pernah dikirim ke server pada FDS.
 */

import type { Desa, Paket } from "./paket";

export type JenisKerusakan =
  | "lubang"
  | "retak"
  | "amblas"
  | "genangan"
  | "drainase_mampet"
  | "jembatan_rusak"
  | "lainnya";

export type Penyebab =
  | "dilalui_kendaraan_berat"
  | "drainase_tidak_ada"
  | "genangan_berulang"
  | "kepadatan_lalu_lintas"
  | "bahan_tidak_sesuai"
  | "tidak_tahu";

export type UkuranKasar = "setelapak" | "sebesar_ban" | "lebih_1_m2";

export type StatusTautan = "tertaut" | "tidak_dapat_ditautkan" | "diduga_tidak_sesuai";

export type Laporan = {
  kode: string;
  waktu: string;
  desa: string;
  kecamatan: string;
  jenis: JenisKerusakan;
  penyebab: Penyebab[];
  ukuran: UkuranKasar | null;
  lat: number | null;
  lon: number | null;
  sumber_lokasi: "gps" | "desa";
  patokan: string;
  kode_rup: string | null;
  skor: number | null;
  status: StatusTautan;
  konfirmasi: number;
  foto: { lebar: number; tinggi: number; byte: number; thumb?: string } | null;
};

export const JENIS: Array<{ nilai: JenisKerusakan; label: string; petunjuk: string }> = [
  { nilai: "lubang", label: "Lubang", petunjuk: "Berlubang, kedalaman terlihat" },
  { nilai: "retak", label: "Retak", petunjuk: "Garis retak memanjang / melebar" },
  { nilai: "amblas", label: "Amblas", petunjuk: "Permukaan turun dari sekitarnya" },
  { nilai: "genangan", label: "Genangan", petunjuk: "Air menggenang di badan jalan" },
  { nilai: "drainase_mampet", label: "Drainase mampet", petunjuk: "Saluran tersumbat / tidak mengalir" },
  { nilai: "jembatan_rusak", label: "Jembatan rusak", petunjuk: "Gorong-gorong, box culvert, jembatan" },
  { nilai: "lainnya", label: "Lainnya", petunjuk: "Kerusakan lain yang terlihat" },
];

export const PENYEBAB: Array<{ nilai: Penyebab; label: string }> = [
  { nilai: "dilalui_kendaraan_berat", label: "Dilalui kendaraan berat" },
  { nilai: "drainase_tidak_ada", label: "Tidak ada drainase" },
  { nilai: "genangan_berulang", label: "Genangan berulang" },
  { nilai: "kepadatan_lalu_lintas", label: "Lalu lintas padat" },
  { nilai: "bahan_tidak_sesuai", label: "Bahan tidak sesuai" },
  { nilai: "tidak_tahu", label: "Tidak tahu" },
];

export const UKURAN: Array<{ nilai: UkuranKasar; label: string }> = [
  { nilai: "setelapak", label: "Setelapak tangan" },
  { nilai: "sebesar_ban", label: "Sebesar ban" },
  { nilai: "lebih_1_m2", label: "Lebih dari 1 m²" },
];

const JUDUL_JENIS = new Map(JENIS.map((j) => [j.nilai, j.label]));
const JUDUL_PENYEBAB = new Map(PENYEBAB.map((p) => [p.nilai, p.label]));
const JUDUL_UKURAN = new Map(UKURAN.map((u) => [u.nilai, u.label]));

export const labelJenis = (v: JenisKerusakan): string => JUDUL_JENIS.get(v) ?? v;
export const labelPenyebab = (v: Penyebab): string => JUDUL_PENYEBAB.get(v) ?? v;
export const labelUkuran = (v: UkuranKasar): string => JUDUL_UKURAN.get(v) ?? v;

export function statusLabel(v: StatusTautan): string {
  if (v === "tertaut") return "Tertaut paket";
  if (v === "diduga_tidak_sesuai") return "Diduga Tidak Sesuai";
  return "Tidak Dapat Ditautkan";
}

/* ── Penyimpanan lokal ─────────────────────────────────────── */

const KUNCI = "saksi.laporan";

export function bacaLaporan(): Laporan[] {
  try {
    const mentah = window.localStorage.getItem(KUNCI);
    if (!mentah) return [];
    const data = JSON.parse(mentah) as unknown;
    return Array.isArray(data) ? (data as Laporan[]) : [];
  } catch {
    return [];
  }
}

export function simpanLaporan(laporan: Laporan): Laporan[] {
  const lama = bacaLaporan();
  const baru = [laporan, ...lama].slice(0, 24);
  try {
    window.localStorage.setItem(KUNCI, JSON.stringify(baru));
  } catch {
    /* kuota penuh: laporan tetap tampil di sesi ini */
  }
  return baru;
}

/** SAKSI-2026-7K2M */
export function kodeLaporan(acak = Math.random): string {
  const abjad = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let ekor = "";
  for (let i = 0; i < 4; i += 1) ekor += abjad[Math.floor(acak() * abjad.length)];
  return `SAKSI-${new Date().getFullYear()}-${ekor}`;
}

export function tanggalIndo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const bulan = [
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
  ][d.getMonth()];
  return `${d.getDate()} ${bulan} ${d.getFullYear()}`;
}

export function jamIndo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
}

/* ── State demo (?contoh=1) ────────────────────────────────── */

const ada = (paket: Paket[], kode: string) => paket.some((p) => p.kode_rup === kode);

export function contohLaporan(desa: Desa[], paket: Paket[]): Laporan[] {
  const berpaket = new Set(paket.map((p) => p.desa_resmi));
  const desaKosong = desa.find((d) => !berpaket.has(d.desa));
  const tanpaPaket = desaKosong?.desa ?? "Cibodas RW 04";
  const kecTanpaPaket = desaKosong?.kecamatan ?? "Cibodas";

  const daftar: Laporan[] = [
    {
      kode: "SAKSI-2026-7K2M",
      waktu: "2026-10-24T08:42:00+07:00",
      desa: "Karawaci RW 03",
      kecamatan: "Pasar Kemis",
      jenis: "lubang",
      penyebab: ["dilalui_kendaraan_berat", "genangan_berulang"],
      ukuran: "sebesar_ban",
      lat: -6.1631,
      lon: 106.5834,
      sumber_lokasi: "gps",
      patokan: "Jl. Arjuna III, Bumi Asri RT 04/16",
      kode_rup: ada(paket, "66611291") ? "66611291" : null,
      skor: 94,
      status: "diduga_tidak_sesuai",
      konfirmasi: 2,
      foto: { lebar: 1024, tinggi: 768, byte: 187_904 },
    },
    {
      kode: "SAKSI-2026-4QDY",
      waktu: "2026-10-22T15:10:00+07:00",
      desa: "Ciledug RW 05",
      kecamatan: "Ciledug",
      jenis: "retak",
      penyebab: ["kepadatan_lalu_lintas"],
      ukuran: "lebih_1_m2",
      lat: -6.1312,
      lon: 106.3808,
      sumber_lokasi: "gps",
      patokan: "Jl. Ciledug Raya, dekat jembatan",
      kode_rup: ada(paket, "61312211") ? "61312211" : null,
      skor: 81,
      status: "tertaut",
      konfirmasi: 0,
      foto: { lebar: 1024, tinggi: 1024, byte: 241_664 },
    },
    {
      kode: "SAKSI-2026-9BTF",
      waktu: "2026-10-19T06:55:00+07:00",
      desa: tanpaPaket,
      kecamatan: kecTanpaPaket,
      jenis: "genangan",
      penyebab: ["drainase_tidak_ada", "genangan_berulang"],
      ukuran: null,
      lat: null,
      lon: null,
      sumber_lokasi: "desa",
      patokan: "",
      kode_rup: null,
      skor: null,
      status: "tidak_dapat_ditautkan",
      konfirmasi: 0,
      foto: { lebar: 768, tinggi: 1024, byte: 158_720 },
    },
  ];

  return daftar.filter((l) => l.kode_rup !== null || l.status !== "tertaut");
}
