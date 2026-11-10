// Gerbang kualitas satu region: struktur snapshot, objek jalan, anchor lokasi, dan cakupan penyedia.
// Pemakaian: node scripts/check-region.mjs [--region <id>] [--manifest]
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AKAR, bacaJson, muatRegion, norm } from "./lib/region.mjs";
import { objekJalan, objekLain, namaNonFisik } from "./lib/road-filter.mjs";

const argv = process.argv.slice(2);
const arg = (nama, bawaan) => {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};
const REGION_ID = arg("region", "kota-tangerang");
const TULIS_MANIFEST = argv.includes("--manifest");
const SNAPSHOT_OVERRIDE = arg("snapshot", null);

const region = await muatRegion(REGION_ID).catch((error) => {
  console.error(`region: ${error.message}`);
  process.exit(1);
});

const snapshot = await bacaJson(SNAPSHOT_OVERRIDE ?? region.keluaran);
const paket = Array.isArray(snapshot.paket) ? snapshot.paket : [];
const masalah = [];
const tolak = (pesan) => {
  if (masalah.length < 20) masalah.push(pesan);
};

const PRECISION = new Set(["RW", "Kelurahan", "Kecamatan", "Kabupaten"]);
const SEKTOR = "Jalan, Jembatan & Drainase";
const terlihatKode = new Set();
const terlihatUnit = new Set();

for (const item of paket) {
  const kode = String(item?.kode_rup ?? "?");
  if (!item || typeof item !== "object") {
    tolak(`${kode}: bukan objek`);
    continue;
  }
  if (terlihatKode.has(kode)) tolak(`${kode}: kode_rup ganda`);
  terlihatKode.add(kode);
  if (!/^\d+$/.test(kode)) tolak(`${kode}: kode_rup bukan angka`);
  if (item.sektor !== SEKTOR) tolak(`${kode}: sektor "${item.sektor}" tidak dikenal`);
  if (typeof item.tahun !== "number") tolak(`${kode}: tahun bukan angka`);
  if (typeof item.pagu !== "number" || item.pagu < 0) tolak(`${kode}: pagu tidak sah`);
  if (typeof item.nama !== "string" || !item.nama.trim()) tolak(`${kode}: nama kosong`);
  if (!objekJalan(item.nama)) tolak(`${kode}: nama bukan objek jalan — ${item.nama}`);
  if (objekLain(item.nama)) tolak(`${kode}: nama memuat objek non-jalan — ${item.nama}`);
  if (namaNonFisik(item.nama)) tolak(`${kode}: nama memuat baris non-fisik — ${item.nama}`);
  if (item.lat !== null || item.lon !== null) tolak(`${kode}: lat/lon harus null`);
  if (!PRECISION.has(item.presisi_peta)) tolak(`${kode}: presisi "${item.presisi_peta}" tidak sah`);

  if (item.presisi_peta === "RW") {
    if (!item.desa_resmi) tolak(`${kode}: presisi RW tanpa kelurahan`);
    if (!item.rw) tolak(`${kode}: presisi RW tanpa nomor`);
    if (!item.kecamatan_resmi) tolak(`${kode}: presisi RW tanpa kecamatan`);
    const unitId = `${norm(item.desa_resmi)}|${item.rw}`;
    if (item.unit_id !== unitId) tolak(`${kode}: unit_id "${item.unit_id}" ≠ "${unitId}"`);
    if (!region.unitLingkungan.has(unitId)) tolak(`${kode}: unit ${unitId} tidak ada di batas wilayah`);
    else terlihatUnit.add(unitId);
  } else if (item.presisi_peta === "Kelurahan") {
    if (!item.desa_resmi) tolak(`${kode}: presisi kelurahan tanpa nama`);
    if (!item.kecamatan_resmi) tolak(`${kode}: presisi kelurahan tanpa kecamatan`);
    // `rw` boleh terisi walau unit RW tidak terpetakan; presisi tetap kelurahan.
    if (item.unit_id !== `${norm(item.desa_resmi)}|*`) {
      tolak(`${kode}: unit_id kelurahan tidak konsisten`);
    }
  } else if (item.presisi_peta === "Kecamatan") {
    if (!item.kecamatan_resmi) tolak(`${kode}: presisi kecamatan tanpa nama`);
    if (item.rw !== null || item.unit_id !== null || item.desa_resmi !== null) {
      tolak(`${kode}: presisi kecamatan tetapi ada anchor lebih dalam`);
    }
  } else if (item.presisi_peta === "Kabupaten") {
    if (item.rw !== null || item.unit_id !== null || item.desa_resmi !== null || item.kecamatan_resmi !== null) {
      tolak(`${kode}: presisi kabupaten tetapi ada anchor wilayah`);
    }
  }

  if (item.desa_resmi && !region.kelurahanResmi.has(norm(item.desa_resmi))) {
    tolak(`${kode}: kelurahan "${item.desa_resmi}" bukan nama resmi`);
  }
}

// Cakupan penyedia dihitung dengan aturan yang sama seperti server: LPSE lebih dulu,
// celahnya diisi realisasi non-swakelola dan bukan nama instansi.
function cakupanPenyedia() {
  const lpse = region.lpse?.keluaran && existsSync(path.resolve(AKAR, region.lpse.keluaran))
    ? JSON.parse(readFileSync(path.resolve(AKAR, region.lpse.keluaran), "utf8"))
    : { item: [] };
  const realisasi = region.sumber.realisasi && existsSync(path.resolve(AKAR, region.sumber.realisasi))
    ? JSON.parse(readFileSync(path.resolve(AKAR, region.sumber.realisasi), "utf8"))
    : { item: [] };
  const BUKAN = /^\s*(dinas|pegawai|opd|pemerintah|badan|kantor|uptd|kecamatan|kelurahan|unsur)\b/i;
  const kodeSnapshot = new Set(paket.map((item) => String(item.kode_rup)));
  const dariLpse = new Set();
  for (const baris of lpse.item ?? []) {
    if (baris.pemenang?.trim()) dariLpse.add(String(baris.kode_rup));
  }
  const dariRealisasi = new Set();
  for (const baris of realisasi.item ?? []) {
    if (!baris.kode_rup || !baris.penyedia) continue;
    if (String(baris.metode ?? "").toLowerCase() === "swakelola") continue;
    if (BUKAN.test(String(baris.penyedia))) continue;
    dariRealisasi.add(String(baris.kode_rup));
  }
  let lpseN = 0;
  let realisasiN = 0;
  let tanpa = 0;
  let tanpaPagu = 0;
  const penyedia = new Set();
  for (const item of paket) {
    const kode = String(item.kode_rup);
    if (dariLpse.has(kode)) {
      lpseN += 1;
    } else if (dariRealisasi.has(kode)) {
      realisasiN += 1;
    } else {
      tanpa += 1;
      tanpaPagu += item.pagu;
    }
  }
  const pemenangLpse = new Map();
  for (const baris of lpse.item ?? []) {
    if (!baris.pemenang?.trim()) continue;
    if (kodeSnapshot.has(String(baris.kode_rup))) {
      pemenangLpse.set(String(baris.kode_rup), baris.pemenang.trim().toUpperCase());
    }
  }
  const penyediaRealisasi = new Map();
  for (const baris of realisasi.item ?? []) {
    if (!baris.kode_rup || !baris.penyedia) continue;
    if (!kodeSnapshot.has(String(baris.kode_rup))) continue;
    if (String(baris.metode ?? "").toLowerCase() === "swakelola") continue;
    if (BUKAN.test(String(baris.penyedia))) continue;
    const kode = String(baris.kode_rup);
    const daftar = penyediaRealisasi.get(kode) ?? new Set();
    daftar.add(baris.penyedia.trim().toUpperCase());
    penyediaRealisasi.set(kode, daftar);
  }
  for (const item of paket) {
    const kode = String(item.kode_rup);
    if (pemenangLpse.has(kode)) {
      penyedia.add(pemenangLpse.get(kode));
    } else {
      for (const nama of penyediaRealisasi.get(kode) ?? []) penyedia.add(nama);
    }
  }
  return { lpseN, realisasiN, tanpa, tanpaPagu, penyedia: penyedia.size };
}

const penyedia = cakupanPenyedia();

// Angka sumber dipakai `workers/verify-db.mjs` untuk merekonsiliasi isi database dengan manifest.
function metrikSumber() {
  const hitungBerkas = (rel) => {
    if (!rel) return null;
    const absolut = path.resolve(AKAR, rel);
    if (!existsSync(absolut)) return null;
    try {
      const isi = JSON.parse(readFileSync(absolut, "utf8"));
      if (Array.isArray(isi.item)) return isi.item.length;
      if (Array.isArray(isi.features)) return isi.features.length;
      if (Array.isArray(isi.paket)) return isi.paket.length;
      return null;
    } catch {
      return null;
    }
  };
  return {
    rup: hitungBerkas(region.sumber.rup),
    detail: hitungBerkas(region.sumber.detail),
    realisasi: hitungBerkas(region.sumber.realisasi),
    lpse: region.lpse?.keluaran ? hitungBerkas(region.lpse.keluaran) : null,
    batas_kecamatan: region.batas.kecamatan?.berkas
      ? hitungBerkas(region.batas.kecamatan.berkas)
      : null,
    batas_kelurahan: region.jumlahKelurahan,
    batas_rw: region.jumlahUnitLingkungan,
  };
}
const sumber = metrikSumber();
const pagu = paket.reduce((total, item) => total + (item.pagu ?? 0), 0);
const hitung = (kunci) => {
  const hasil = {};
  for (const item of paket) hasil[item[kunci] ?? "null"] = (hasil[item[kunci] ?? "null"] ?? 0) + 1;
  return hasil;
};
const presisi = hitung("presisi_peta");
const berlokus = paket.filter((item) => item.presisi_peta !== "Kabupaten").length;
const kelurahanTersentuh = new Set(paket.map((item) => item.desa_resmi).filter(Boolean));
const kecamatanTersentuh = new Set(paket.map((item) => item.kecamatan_resmi).filter(Boolean));

const persen = (bagian, total) =>
  total ? ((bagian / total) * 100).toFixed(1).replace(".", ",") : "0,0";
const rupiah = (nilai) => `Rp${(nilai / 1e9).toFixed(2).replace(".", ",")} M`;

console.log(`region            : ${region.label} (${region.id}, ${region.instansi})`);
console.log(`paket             : ${paket.length} · ${rupiah(pagu)}`);
console.log(`presisi           : ${JSON.stringify(presisi)}`);
console.log(
  `berlokus          : ${berlokus}/${paket.length} (${persen(berlokus, paket.length)}%) · ${kelurahanTersentuh.size}/${region.jumlahKelurahan} kelurahan · ${terlihatUnit.size}/${region.jumlahUnitLingkungan} ${region.batas.lingkungan?.label ?? "unit lingkungan"} · ${kecamatanTersentuh.size} kecamatan`,
);
console.log(
  `penyedia          : ${penyedia.lpseN + penyedia.realisasiN}/${paket.length} (${persen(penyedia.lpseN + penyedia.realisasiN, paket.length)}%) · LPSE ${penyedia.lpseN} · realisasi ${penyedia.realisasiN} · tanpa ${penyedia.tanpa} (${rupiah(penyedia.tanpaPagu)}) · ${penyedia.penyedia} unik`,
);

if (masalah.length) {
  console.error(`\nGAGAL: ${masalah.length} masalah ditemukan`);
  for (const pesan of masalah) console.error(`- ${pesan}`);
  process.exitCode = 1;
} else {
  console.log("LULUS: 0 masalah");
}

if (TULIS_MANIFEST) {
  const berkas = (rel) => {
    const absolut = path.resolve(AKAR, rel);
    if (!existsSync(absolut)) return null;
    const isi = readFileSync(absolut);
    return {
      berkas: rel,
      byte: isi.byteLength,
      sha256: createHash("sha256").update(isi).digest("hex"),
    };
  };
  const daftar = [
    path.join("data", "regions", region.id, "region.json"),
    path.join("data", "regions", region.id, "aliases.json"),
    region.sumber.rup,
    region.sumber.detail,
    region.sumber.realisasi,
    region.lpse?.keluaran,
    region.keluaran,
    region.batas.kelurahan.berkas,
    region.batas.lingkungan?.berkas,
    region.batas.kecamatan?.berkas,
  ].filter(Boolean);
  const manifest = {
    region: region.id,
    label: region.label,
    instansi: region.instansi,
    tahun: region.tahun,
    dibuat: new Date().toISOString(),
    sumber: region.sumber,
    lpse: region.lpse ?? null,
    berkas: Object.fromEntries(
      daftar.map((rel) => [rel, berkas(rel)]).filter(([, isi]) => isi),
    ),
    metrik: {
      paket: paket.length,
      pagu,
      per_tahun: hitung("tahun"),
      presisi,
      berlokus,
      kelurahan_tersentuh: kelurahanTersentuh.size,
      unit_lingkungan_tersentuh: terlihatUnit.size,
      kecamatan_tersentuh: kecamatanTersentuh.size,
      penyedia: {
        lpse: penyedia.lpseN,
        realisasi: penyedia.realisasiN,
        tanpa_rekam: penyedia.tanpa,
        tanpa_rekam_pagu: penyedia.tanpaPagu,
        unik: penyedia.penyedia,
      },
      sumber,
    },
    masalah,
  };
  const jalur = path.resolve(AKAR, "data", "regions", region.id, "manifest.json");
  writeFileSync(jalur, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`manifest          : ${path.relative(AKAR, jalur)}`);
}
