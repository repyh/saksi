// Utilitas worker: hashing, retry/backoff, rate limit, normalisasi nama penyedia.
import { createHash } from "node:crypto";

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");

export const checksumJson = (nilai) => sha256(JSON.stringify(nilai));

export const tidur = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Jeda minimum antar panggilan sumber (rate limit sederhana, bukan burst). */
export function buatRateLimit(jedaMs) {
  let terakhir = 0;
  return async () => {
    const selisih = Date.now() - terakhir;
    if (selisih < jedaMs) await tidur(jedaMs - selisih);
    terakhir = Date.now();
  };
}

/** Retry dengan exponential backoff + jitter. */
export async function denganRetry(fn, { percobaan = 3, dasarMs = 500, log, label = "operasi" } = {}) {
  let terakhir;
  for (let i = 1; i <= percobaan; i += 1) {
    try {
      return await fn(i);
    } catch (error) {
      terakhir = error;
      if (i === percobaan) break;
      const jeda = dasarMs * 2 ** (i - 1) + Math.floor(Math.random() * 200);
      log?.("warn", `${label} gagal (percobaan ${i}/${percobaan}), ulang dalam ${jeda} ms`, {
        error: error.message,
      });
      await tidur(jeda);
    }
  }
  throw terakhir;
}

export const potong = (daftar, ukuran) => {
  const hasil = [];
  for (let i = 0; i < daftar.length; i += ukuran) hasil.push(daftar.slice(i, i + ukuran));
  return hasil;
};

/**
 * Kunci penyedia untuk deduplikasi. Sengaja hanya uppercase + rapatkan spasi:
 * varian "CV"/"PT" tidak dilebur supaya penyebut penyedia tetap apa adanya.
 */
export const normalisasiPenyedia = (nama) => {
  const bersih = String(nama ?? "").normalize("NFKC").toUpperCase().trim();
  // Sebagian baris realisasi memuat daftar nama sangat panjang; kunci hash menjaga
  // indeks unik tetap kecil tanpa menggabungkan penyedia yang berbeda.
  if (Buffer.byteLength(bersih, "utf8") <= 240) return bersih;
  return `#sha256:${sha256(bersih)}`;
};

const BUKAN_PENYEDIA =
  /^\s*(dinas|pegawai|opd|pemerintah|badan|kantor|uptd|kecamatan|kelurahan|unsur)\b/i;

/** Aturan yang sama dengan scripts/check-region.mjs dan server. */
export function penyediaSah(baris) {
  const nama = String(baris?.penyedia ?? "").trim();
  if (!nama) return false;
  if (String(baris?.metode ?? "").toLowerCase() === "swakelola") return false;
  if (BUKAN_PENYEDIA.test(nama)) return false;
  return true;
}

export const kunciArea = (regionId, level, { kecamatan, kelurahan, rw } = {}) => {
  const n = (nilai) => String(nilai ?? "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
  if (level === "KECAMATAN") return `${regionId}|kec|${n(kecamatan)}`;
  if (level === "KELURAHAN") return `${regionId}|kel|${n(kecamatan)}|${n(kelurahan)}`;
  return `${regionId}|rw|${n(kecamatan)}|${n(kelurahan)}|${n(rw)}`;
};

export const rupiah = (nilai) =>
  `Rp${(Number(nilai ?? 0) / 1e9).toFixed(2).replace(".", ",")} M`;

export function ringkasError(error) {
  return {
    nama: error?.name ?? "Error",
    pesan: error?.message ?? String(error),
    kode: error?.code ?? null,
  };
}
