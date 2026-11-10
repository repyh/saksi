// Pemuat konfigurasi region: semua yang khas daerah (path sumber, kode instansi, properti batas,
// token lokasi, alias) berada di data/regions/<id>/, bukan di dalam skrip pembangun snapshot.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Kesalahan konfigurasi region, bukan bug pemrograman. */
export class RegionError extends Error {
  constructor(pesan) {
    super(pesan);
    this.name = "RegionError";
  }
}

export const AKAR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export const bacaJson = async (berkas, akar = AKAR) =>
  JSON.parse(await readFile(path.resolve(akar, berkas), "utf8"));

export const norm = (nilai) =>
  String(nilai ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/\b(jl|jalan|gang|gg|komp|komplek|kp|kampung)\.?\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const judul = (teks) => teks.toLowerCase().replace(/\b\w/g, (h) => h.toUpperCase());

const escapeRe = (teks) => teks.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const wajib = (nilai, pesan) => {
  if (!nilai) throw new RegionError(pesan);
};

/**
 * Validasi alias kelurahan. Setiap alias harus:
 * - menunjuk kelurahan resmi yang ada,
 * - tidak sama dengan nama resmi,
 * - tidak menunjuk target yang sama dengan alias lain.
 * Tidak ada pencocokan fuzzy; alias adalah data kurasi yang harus lulus aturan ini.
 */
export function validasiAlias(dokumen, kelurahanResmi, regionId = "?") {
  const daftar = dokumen?.aliases;
  if (!Array.isArray(daftar)) {
    throw new RegionError(`region ${regionId}: aliases.json harus memuat array "aliases"`);
  }

  const hasil = new Map();
  const target = new Set();
  for (const [indeks, alias] of daftar.entries()) {
    if (!alias || typeof alias.dari !== "string" || typeof alias.ke !== "string") {
      throw new RegionError(`region ${regionId}: alias #${indeks} harus punya "dari" dan "ke" berupa teks`);
    }
    const dari = norm(alias.dari);
    if (!dari) {
      throw new RegionError(`region ${regionId}: alias #${indeks} punya "dari" kosong`);
    }
    if (kelurahanResmi.has(dari)) {
      throw new RegionError(`region ${regionId}: alias "${alias.dari}" sama dengan nama kelurahan resmi`);
    }
    if (hasil.has(dari)) {
      throw new RegionError(`region ${regionId}: alias "${alias.dari}" ditulis lebih dari sekali`);
    }
    const resmi = kelurahanResmi.get(norm(alias.ke));
    if (!resmi) {
      throw new RegionError(
        `region ${regionId}: alias "${alias.dari}" menunjuk "${alias.ke}" yang bukan kelurahan resmi`,
      );
    }
    if (target.has(resmi.nama)) {
      throw new RegionError(
        `region ${regionId}: dua alias menunjuk kelurahan yang sama: "${resmi.nama}"`,
      );
    }
    target.add(resmi.nama);
    hasil.set(dari, resmi);
  }
  return hasil;
}

/**
 * Muat satu region lengkap: konfigurasi, indeks kelurahan resmi, unit lingkungan (RW/dusun/…),
 * alias tervalidasi, dan regex token lokasi yang dibangun dari konfigurasi.
 */
export async function muatRegion(id, akar = AKAR) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(String(id))) {
    throw new RegionError(`id region tidak valid: "${id}"`);
  }

  const dasar = path.join("data", "regions", id);
  let config;
  try {
    config = await bacaJson(path.join(dasar, "region.json"), akar);
  } catch {
    throw new RegionError(`region "${id}" tidak ditemukan di ${path.join(akar, dasar, "region.json")}`);
  }

  for (const [nilai, nama] of [
    [config.id, "id"],
    [config.label, "label"],
    [config.instansi, "instansi"],
    [config.keluaran, "keluaran"],
    [config.metadata?.snapshot, "metadata.snapshot"],
    [config.metadata?.sumber, "metadata.sumber"],
    [config.sumber?.rup, "sumber.rup"],
    [config.batas?.kelurahan?.berkas, "batas.kelurahan.berkas"],
    [config.batas?.kelurahan?.nama, "batas.kelurahan.nama"],
    [config.batas?.kelurahan?.kecamatan, "batas.kelurahan.kecamatan"],
    [config.lokasi?.penanda_kelurahan?.length, "lokasi.penanda_kelurahan"],
  ]) {
    wajib(nilai, `region ${id}: "${nama}" wajib diisi`);
  }
  if (config.id !== id) {
    throw new RegionError(`region ${id}: "id" di region.json harus sama dengan nama direktori (${config.id})`);
  }
  if (!Array.isArray(config.tahun) || !config.tahun.length || !config.tahun.every(Number.isInteger)) {
    throw new RegionError(`region ${id}: "tahun" harus array bilangan bulat`);
  }

  const batasKelurahan = config.batas.kelurahan;
  const batasLingkungan = config.batas.lingkungan ?? null;
  const kelurahanGeojson = await bacaJson(batasKelurahan.berkas, akar);

  const kelurahanResmi = new Map();
  for (const f of kelurahanGeojson.features ?? []) {
    const nama = String(f.properties?.[batasKelurahan.nama] ?? "").trim();
    if (!nama) continue;
    kelurahanResmi.set(norm(nama), {
      nama,
      kecamatan: judul(String(f.properties?.[batasKelurahan.kecamatan] ?? "").trim()),
    });
  }
  if (!kelurahanResmi.size) {
    throw new RegionError(
      `region ${id}: "${batasKelurahan.berkas}" tidak menghasilkan kelurahan; periksa "batas.kelurahan.nama" (${batasKelurahan.nama})`,
    );
  }

  // Unit lingkungan (RW/dusun/banjar/RT) opsional: region tanpa poligon lingkungan tetap boleh
  // membangun snapshot, tetapi presisi tertinggi hanya sampai kelurahan.
  const unitLingkungan = new Map();
  let reLingkungan = null;
  if (batasLingkungan) {
    for (const [nilai, nama] of [
      [batasLingkungan.berkas, "batas.lingkungan.berkas"],
      [batasLingkungan.nama, "batas.lingkungan.nama"],
      [batasLingkungan.kecamatan, "batas.lingkungan.kecamatan"],
      [batasLingkungan.nomor, "batas.lingkungan.nomor"],
      [batasLingkungan.label, "batas.lingkungan.label"],
    ]) {
      wajib(nilai, `region ${id}: "${nama}" wajib diisi bila batas.lingkungan dipakai`);
    }
    const tokenLingkungan = config.lokasi?.token_lingkungan ?? [];
    if (!Array.isArray(tokenLingkungan) || !tokenLingkungan.length) {
      throw new RegionError(
        `region ${id}: "lokasi.token_lingkungan" wajib diisi bila batas.lingkungan dipakai`,
      );
    }
    const lingkunganGeojson = await bacaJson(batasLingkungan.berkas, akar);
    for (const f of lingkunganGeojson.features ?? []) {
      const kelurahan = String(f.properties?.[batasLingkungan.nama] ?? "").trim();
      const nomor = String(f.properties?.[batasLingkungan.nomor] ?? "").trim();
      if (!kelurahan || !nomor) continue;
      unitLingkungan.set(`${norm(kelurahan)}|${nomor}`, {
        kecamatan: judul(String(f.properties?.[batasLingkungan.kecamatan] ?? "").trim()),
      });
    }
    if (!unitLingkungan.size) {
      throw new RegionError(
        `region ${id}: "${batasLingkungan.berkas}" tidak menghasilkan unit lingkungan; periksa "batas.lingkungan.nama" (${batasLingkungan.nama}) dan "nomor" (${batasLingkungan.nomor})`,
      );
    }
    const token = tokenLingkungan.map(escapeRe).join("|");
    reLingkungan = new RegExp(`\\b(?:${token})\\.?\\s*[0o]*(\\d{1,3})\\b`, "i");
  }

  const penandaKelurahan = config.lokasi.penanda_kelurahan
    .map((penanda) => `${escapeRe(penanda)}\\.?`)
    .join("|");
  const reKelurahan = new RegExp(`\\b(?:${penandaKelurahan})\\s*([A-Za-z][\\w'\\- ]{2,28})`, "i");

  let dokumenAlias;
  try {
    dokumenAlias = await bacaJson(path.join(dasar, "aliases.json"), akar);
  } catch {
    throw new RegionError(`region ${id}: aliases.json tidak ditemukan atau bukan JSON yang sah`);
  }
  const aliasKelurahan = validasiAlias(dokumenAlias, kelurahanResmi, id);

  return {
    id: config.id,
    label: config.label,
    instansi: config.instansi,
    tahun: config.tahun,
    metadata: config.metadata,
    sumber: config.sumber,
    keluaran: config.keluaran,
    batas: config.batas,
    lpse: config.lpse ?? null,
    realisasi: config.realisasi ?? null,
    satkerPu: config.realisasi?.satker_pu ?? null,
    jalan: config.jalan ?? null,
    kelurahanResmi,
    unitLingkungan,
    aliasKelurahan,
    reLingkungan,
    reKelurahan,
    jumlahKelurahan: kelurahanResmi.size,
    jumlahUnitLingkungan: unitLingkungan.size,
  };
}
