#!/usr/bin/env node
/**
 * Perkaya snapshot paket dengan detail RUP dari data.inaproc.id:
 *
 *  1. `bulan`  → `jadwal_pemilihan_mulai` (mis. "November 2025" → "Maret 2025", bahasa Indonesia).
 *  2. Paket yang masih `presisi_peta: "Kabupaten"` (tanpa lokus) dan detailnya menyebut **tepat satu**
 *     kecamatan → diberi `kecamatan_resmi` resmi + `presisi_peta: "Kecamatan"`.
 *
 * Tidak pernah menimpa anchor RW/kelurahan yang sudah ada, dan tidak mengubah jumlah paket.
 * Input : data/saksi_kota_tangerang_2025_2026.json, data/rup_detail_kota_tangerang.json
 * Output: data/saksi_kota_tangerang_2025_2026.json (ditimpa), ringkasan di stdout
 *
 * Pakai: node scripts/enrich-rup.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = dirname(dirname(fileURLToPath(import.meta.url)));
const DRY = process.argv.includes("--dry");

const jalurSnapshot = join(AKAR, "data", "saksi_kota_tangerang_2025_2026.json");
const jalurDetail = join(AKAR, "data", "rup_detail_kota_tangerang.json");
if (!existsSync(jalurDetail)) {
  throw new Error("data/rup_detail_kota_tangerang.json belum ada — jalankan `npm run data:rup-detail`");
}

const snapshot = JSON.parse(readFileSync(jalurSnapshot, "utf8"));
const detail = JSON.parse(readFileSync(jalurDetail, "utf8"));
const perKode = new Map((detail.item ?? []).map((d) => [String(d.kode_rup), d]));

const paket = snapshot.paket ?? [];
/** Nama kecamatan resmi yang sudah dipakai snapshot (13 untuk Kota Tangerang). */
const resmi = [...new Set(paket.map((p) => p.kecamatan_resmi).filter(Boolean))];
const normal = (s) =>
  s
    .toLocaleLowerCase("id-ID")
    .replace(/^(kecamatan|kec\.?)\s*/u, "")
    .replace(/[^a-z ]/g, "")
    .trim();
const resmiNormal = new Map(resmi.map((r) => [normal(r), r]));

/** Ambil nama kecamatan dari satu entri `detail_lokasi`. */
function kecamatanDari(teks) {
  if (!teks) return [];
  const bagian = String(teks)
    .split(/,|\bdan\b/gi)
    .map((s) => s.trim())
    .filter(Boolean);
  const hasil = [];
  for (const b of bagian) {
    const n = normal(b);
    if (resmiNormal.has(n)) hasil.push(resmiNormal.get(n));
  }
  return [...new Set(hasil)];
}

let bulanDiperbarui = 0;
let anchorBaru = 0;
const perKecamatan = {};
const contoh = [];

const baru = paket.map((p) => {
  const d = perKode.get(String(p.kode_rup));
  let bulan = p.bulan;
  let kecamatan = p.kecamatan_resmi ?? null;
  let presisi = p.presisi_peta;

  if (d?.jadwal_pemilihan_mulai && d.jadwal_pemilihan_mulai !== bulan) {
    bulan = d.jadwal_pemilihan_mulai;
    bulanDiperbarui += 1;
  }

  if (!kecamatan && (presisi === "Kabupaten" || !presisi)) {
    const kandidat = [...new Set((d?.lokasi_raw ?? []).flatMap(kecamatanDari))];
    if (kandidat.length === 1) {
      kecamatan = kandidat[0];
      presisi = "Kecamatan";
      anchorBaru += 1;
      perKecamatan[kecamatan] = (perKecamatan[kecamatan] ?? 0) + 1;
      if (contoh.length < 8) contoh.push({ kode_rup: p.kode_rup, kecamatan, lokasi_raw: d.lokasi_raw });
    }
  }

  return {
    kode_rup: p.kode_rup,
    tahun: p.tahun,
    satker: p.satker,
    nama: p.nama,
    pagu: p.pagu,
    metode: p.metode,
    sumber: p.sumber,
    bulan,
    sektor: p.sektor,
    desa_resmi: p.desa_resmi,
    rw: p.rw,
    unit_id: p.unit_id,
    kecamatan_resmi: kecamatan,
    lat: p.lat,
    lon: p.lon,
    presisi_peta: presisi,
    lokasi_mikro: p.lokasi_mikro,
  };
});

const hitung = (arr, kunci) => {
  const m = {};
  for (const r of arr) m[r[kunci] ?? "-"] = (m[r[kunci] ?? "-"] ?? 0) + 1;
  return m;
};

console.log(`bulan diperbarui      : ${bulanDiperbarui}/${paket.length}`);
console.log(`anchor kecamatan baru : ${anchorBaru}`);
console.log(`presisi sesudah       : ${JSON.stringify(hitung(baru, "presisi_peta"))}`);
console.log(`sebaran anchor baru   : ${JSON.stringify(perKecamatan)}`);
for (const c of contoh) console.log(`  ${c.kode_rup} → ${c.kecamatan}  (dari ${JSON.stringify(c.lokasi_raw)})`);

if (DRY) {
  console.log("\n(dry run — berkas tidak diubah)");
} else {
  writeFileSync(jalurSnapshot, JSON.stringify({ paket: baru }));
  console.log(`\n→ ${jalurSnapshot} diperbarui`);
}
