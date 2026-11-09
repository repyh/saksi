import type { RoadPackagePlanDetail } from "@/contracts/packages/road-package-detail.contract";

/** Baris mentah detail RUP; nilai boleh kosong atau tidak ada. */
export interface RupDetailRow {
  kode_rup?: unknown;
  jadwal_pemilihan_mulai?: unknown;
  jadwal_pemilihan_akhir?: unknown;
  jadwal_kontrak_mulai?: unknown;
  jadwal_kontrak_akhir?: unknown;
  uraian?: unknown;
  volume?: unknown;
  spesifikasi?: unknown;
  mak?: unknown;
}

const NILAI_KOSONG = new Set(["-", "tidak ada", "tidak ada data"]);

/**
 * Normalisasi teks detail RUP: CRLF menjadi LF, trim, dan nilai kosong
 * (`""`, `"-"`, `"tidak ada"`) menjadi `null`. Teks asli tidak diubah isinya.
 */
export function normalizeRupDetailText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return null;
  if (NILAI_KOSONG.has(normalized.toLocaleLowerCase("id-ID"))) return null;
  return normalized;
}

export function emptyPlanDetail(): RoadPackagePlanDetail {
  return {
    jadwalPemilihanMulai: null,
    jadwalPemilihanAkhir: null,
    jadwalKontrakMulai: null,
    jadwalKontrakAkhir: null,
    uraian: null,
    volume: null,
    spesifikasi: null,
    mak: null,
  };
}

/** Ubah satu baris detail RUP menjadi detail rencana yang siap dirender. */
export function normalizeRupDetailRow(row: RupDetailRow): RoadPackagePlanDetail {
  return {
    jadwalPemilihanMulai: normalizeRupDetailText(row.jadwal_pemilihan_mulai),
    jadwalPemilihanAkhir: normalizeRupDetailText(row.jadwal_pemilihan_akhir),
    jadwalKontrakMulai: normalizeRupDetailText(row.jadwal_kontrak_mulai),
    jadwalKontrakAkhir: normalizeRupDetailText(row.jadwal_kontrak_akhir),
    uraian: normalizeRupDetailText(row.uraian),
    volume: normalizeRupDetailText(row.volume),
    spesifikasi: normalizeRupDetailText(row.spesifikasi),
    mak: normalizeRupDetailText(row.mak),
  };
}

/**
 * Indeks detail per kode RUP. Baris tanpa `kode_rup` atau tanpa field yang bisa
 * dipakai tetap dicatat sebagai detail kosong; kunci duplikat memakai baris pertama.
 */
export function indexRupDetail(rows: unknown[]): Map<string, RoadPackagePlanDetail> {
  const index = new Map<string, RoadPackagePlanDetail>();
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const kode = (row as RupDetailRow).kode_rup;
    if (typeof kode !== "string" || !kode.trim()) continue;
    const kunci = kode.trim();
    if (index.has(kunci)) continue;
    index.set(kunci, normalizeRupDetailRow(row as RupDetailRow));
  }
  return index;
}
