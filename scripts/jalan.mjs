// Snapshot layer jaringan jalan kota dari layanan ArcGIS region.
// Pemakaian: node scripts/jalan.mjs [--region <id>] [--check]
// Konfigurasi lengkap ada di data/regions/<id>/region.json pada kunci "jalan".
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AKAR, muatRegion } from "./lib/region.mjs";

const argv = process.argv.slice(2);
const arg = (nama, bawaan = null) => {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};
const REGION_ID = arg("region", "kota-tangerang");
const HANYA_CEK = argv.includes("--check");
const PAGE_SIZE = 1000;
const MAX_PAGE = 200;

const region = await muatRegion(REGION_ID).catch((error) => {
  console.error(`region: ${error.message}`);
  process.exit(1);
});
const konfigurasi = region.jalan;
if (!konfigurasi) {
  console.error(`region ${REGION_ID} tidak punya konfigurasi "jalan"`);
  process.exit(2);
}

const fields = konfigurasi.fields ?? {};
if (!fields.objectid || !fields.nama) {
  console.error("konfigurasi jalan.fields wajib memuat objectid dan nama");
  process.exit(2);
}
const presisi = Number.isInteger(konfigurasi.presisi) ? konfigurasi.presisi : 6;
const toleransi = Number(konfigurasi.simplify ?? 0);

function duaDimensi(koordinat) {
  if (!Array.isArray(koordinat) || koordinat.length < 2) return null;
  const [lon, lat] = koordinat;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [Number(lon.toFixed(presisi)), Number(lat.toFixed(presisi))];
}

function bersihkanGaris(garis) {
  const hasil = [];
  for (const titik of garis) {
    const bersih = duaDimensi(titik);
    if (!bersih) continue;
    const terakhir = hasil.at(-1);
    if (terakhir && terakhir[0] === bersih[0] && terakhir[1] === bersih[1]) continue;
    hasil.push(bersih);
  }
  return hasil;
}

function jarakKuadratTitikSegmen(titik, awal, akhir) {
  const dx = akhir[0] - awal[0];
  const dy = akhir[1] - awal[1];
  if (dx === 0 && dy === 0) {
    return (titik[0] - awal[0]) ** 2 + (titik[1] - awal[1]) ** 2;
  }
  const t = Math.max(
    0,
    Math.min(1, ((titik[0] - awal[0]) * dx + (titik[1] - awal[1]) * dy) / (dx * dx + dy * dy)),
  );
  const proyeksi = [awal[0] + t * dx, awal[1] + t * dy];
  return (titik[0] - proyeksi[0]) ** 2 + (titik[1] - proyeksi[1]) ** 2;
}

function sederhanakanGaris(garis, batas) {
  if (garis.length <= 2 || batas <= 0) return garis;
  const batasKuadrat = batas * batas;
  const simpan = new Uint8Array(garis.length);
  simpan[0] = 1;
  simpan[garis.length - 1] = 1;
  const tumpukan = [[0, garis.length - 1]];

  while (tumpukan.length) {
    const [awal, akhir] = tumpukan.pop();
    let terjauh = -1;
    let jarakTerjauh = 0;
    for (let i = awal + 1; i < akhir; i += 1) {
      const jarak = jarakKuadratTitikSegmen(garis[i], garis[awal], garis[akhir]);
      if (jarak > jarakTerjauh) {
        jarakTerjauh = jarak;
        terjauh = i;
      }
    }
    if (terjauh >= 0 && jarakTerjauh > batasKuadrat) {
      simpan[terjauh] = 1;
      tumpukan.push([awal, terjauh], [terjauh, akhir]);
    }
  }

  return garis.filter((_, indeks) => simpan[indeks] === 1);
}

function sederhanakan(geometry, batas) {
  if (geometry.type === "LineString") {
    return { type: "LineString", coordinates: sederhanakanGaris(geometry.coordinates, batas) };
  }
  return {
    type: "MultiLineString",
    coordinates: geometry.coordinates.map((garis) => sederhanakanGaris(garis, batas)),
  };
}

function nomorAtauNull(nilai) {
  if (nilai === null || nilai === undefined || nilai === "") return null;
  const angka = Number(nilai);
  return Number.isFinite(angka) ? angka : null;
}

function teksAtauNull(nilai) {
  if (nilai === null || nilai === undefined) return null;
  const teks = String(nilai).trim();
  return teks ? teks : null;
}

function daftarTeks(nilai) {
  return String(nilai ?? "")
    .split(",")
    .map((bagian) => bagian.trim())
    .filter(Boolean);
}

async function ambilMetadata() {
  const response = await fetch(`${konfigurasi.layanan}?f=json`);
  if (!response.ok) throw new Error(`metadata ArcGIS menolak permintaan: ${response.status}`);
  return response.json();
}

async function hitungFitur() {
  const url = new URL(`${konfigurasi.layanan}/query`);
  url.searchParams.set("where", "1=1");
  url.searchParams.set("returnCountOnly", "true");
  url.searchParams.set("f", "json");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`hitungan ArcGIS menolak permintaan: ${response.status}`);
  return Number((await response.json()).count ?? 0);
}

async function ambilHalaman(offset, ukuran) {
  const url = new URL(`${konfigurasi.layanan}/query`);
  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", Object.values(fields).join(","));
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("f", "geojson");
  url.searchParams.set("resultOffset", String(offset));
  url.searchParams.set("resultRecordCount", String(ukuran));
  url.searchParams.set("orderByFields", fields.objectid);
  url.searchParams.set("geometryPrecision", String(presisi));
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`ArcGIS menolak halaman offset ${offset}: ${response.status} ${await response.text().catch(() => "")}`);
  }
  const dokumen = await response.json();
  if (dokumen.error) {
    throw new Error(`ArcGIS error pada offset ${offset}: ${dokumen.error.message ?? "tidak diketahui"}`);
  }
  return dokumen;
}

function fiturBersih(fitur) {
  const properties = fitur?.properties ?? {};
  const objectid = teksAtauNull(properties[fields.objectid]);
  const nama = teksAtauNull(properties[fields.nama]);
  if (!objectid || !nama) return { ditolak: "objectid atau nama kosong" };

  const geometry = fitur?.geometry;
  if (!geometry || !["LineString", "MultiLineString"].includes(geometry.type)) {
    return { ditolak: `geometri ${geometry?.type ?? "kosong"} bukan garis` };
  }
  const dibersihkan = geometry.type === "LineString"
    ? { type: "LineString", coordinates: bersihkanGaris(geometry.coordinates ?? []) }
    : {
      type: "MultiLineString",
      coordinates: (geometry.coordinates ?? []).map((garis) => bersihkanGaris(garis)).filter((garis) => garis.length >= 2),
    };
  const jumlahTitik = dibersihkan.type === "LineString"
    ? dibersihkan.coordinates.length
    : dibersihkan.coordinates.reduce((total, garis) => total + garis.length, 0);
  if (jumlahTitik < 2) return { ditolak: "geometri kosong setelah pembersihan" };

  return {
    feature: {
      type: "Feature",
      properties: {
        objectid,
        nama,
        nomor: teksAtauNull(properties[fields.nomor]),
        panjang: nomorAtauNull(properties[fields.panjang]),
        lebar: nomorAtauNull(properties[fields.lebar]),
        kecamatan: daftarTeks(properties[fields.kecamatan]),
        kelurahan: daftarTeks(properties[fields.kelurahan]),
      },
      geometry: sederhanakan(dibersihkan, toleransi),
    },
  };
}

async function ambilSemua() {
  const metadata = await ambilMetadata();
  if (metadata.error) throw new Error(`metadata ArcGIS: ${metadata.error.message ?? "tidak diketahui"}`);
  const total = await hitungFitur();
  const ukuran = Math.min(PAGE_SIZE, Number(metadata.maxRecordCount) || PAGE_SIZE);
  const features = [];
  let offset = 0;
  let halaman = 0;
  let ditolak = 0;
  const alasanTolak = new Map();

  while (offset < total && halaman < MAX_PAGE) {
    const dokumen = await ambilHalaman(offset, ukuran);
    const bagian = Array.isArray(dokumen.features) ? dokumen.features : [];
    if (!bagian.length) break;
    for (const fitur of bagian) {
      const hasil = fiturBersih(fitur);
      if (hasil.feature) features.push(hasil.feature);
      else {
        ditolak += 1;
        alasanTolak.set(hasil.ditolak, (alasanTolak.get(hasil.ditolak) ?? 0) + 1);
      }
    }
    offset += bagian.length;
    halaman += 1;
    process.stdout.write(`\rhalaman ${halaman}: ${offset}/${total} fitur`);
    if (bagian.length < ukuran && !dokumen.exceededTransferLimit) break;
  }
  process.stdout.write("\n");

  if (halaman >= MAX_PAGE && offset < total) {
    throw new Error(`paging berhenti di ${offset}/${total} setelah ${MAX_PAGE} halaman`);
  }
  if (features.length + ditolak !== total) {
    throw new Error(`jumlah fitur tidak cocok: ${features.length} bersih + ${ditolak} ditolak ≠ ${total} sumber`);
  }

  return { features, total, ditolak, alasanTolak, metadata };
}

function validasi(features, total) {
  const masalah = [];
  if (features.length !== total) masalah.push(`jumlah fitur ${features.length} ≠ sumber ${total}`);
  const objectid = new Set();
  let namaKosong = 0;
  let geometriSalah = 0;
  for (const fitur of features) {
    const id = String(fitur.properties.objectid);
    if (objectid.has(id)) masalah.push(`objectid ganda: ${id}`);
    objectid.add(id);
    if (!String(fitur.properties.nama ?? "").trim()) namaKosong += 1;
    if (!["LineString", "MultiLineString"].includes(fitur.geometry.type)) geometriSalah += 1;
  }
  if (namaKosong) masalah.push(`${namaKosong} fitur tanpa nama`);
  if (geometriSalah) masalah.push(`${geometriSalah} fitur dengan geometri bukan garis`);
  return { lulus: masalah.length === 0, masalah };
}

if (HANYA_CEK) {
  const berkas = path.resolve(AKAR, konfigurasi.berkas);
  if (!existsSync(berkas)) {
    console.error(`layer jalan belum ada: ${konfigurasi.berkas}`);
    process.exit(1);
  }
  const isi = JSON.parse(readFileSync(berkas, "utf8"));
  const hasil = validasi(isi.features ?? [], (isi.features ?? []).length);
  if (!hasil.lulus) {
    console.error(hasil.masalah.join("\n"));
    process.exit(1);
  }
  const checksum = createHash("sha256").update(readFileSync(berkas)).digest("hex");
  console.log(`layer jalan OK: ${(isi.features ?? []).length} fitur · sha256 ${checksum.slice(0, 12)}…`);
  process.exit(0);
}

const { features, total, ditolak, alasanTolak, metadata } = await ambilSemua();
const hasilValidasi = validasi(features, total);
if (!hasilValidasi.lulus) {
  console.error(`GAGAL validasi layer jalan:\n- ${hasilValidasi.masalah.slice(0, 20).join("\n- ")}`);
  process.exit(1);
}

const dokumen = {
  type: "FeatureCollection",
  name: konfigurasi.label ?? "Jaringan jalan",
  source: {
    name: konfigurasi.sumber ?? "ArcGIS",
    service: konfigurasi.layanan,
    layer: metadata.name ?? null,
    attribution: konfigurasi.atribusi ?? null,
    license: konfigurasi.lisensi ?? null,
    version: konfigurasi.versi ?? null,
    generatedAt: new Date().toISOString(),
    decimals: presisi,
    simplify: toleransi,
  },
  features: features.sort((a, b) => Number(a.properties.objectid) - Number(b.properties.objectid)),
};

const keluaran = path.resolve(AKAR, konfigurasi.berkas);
await mkdir(path.dirname(keluaran), { recursive: true });
const teks = JSON.stringify(dokumen);
await writeFile(keluaran, teks);
const byte = Buffer.byteLength(teks);
const checksum = createHash("sha256").update(teks).digest("hex");

console.log(`layer jalan          : ${konfigurasi.berkas}`);
console.log(`fitur                : ${features.length}/${total}${ditolak ? ` · ${ditolak} ditolak` : ""}`);
console.log(`ukuran               : ${(byte / 1024 / 1024).toFixed(2)} MB`);
console.log(`sha256               : ${checksum}`);
if (alasanTolak.size) console.log(`alasan ditolak       : ${JSON.stringify(Object.fromEntries(alasanTolak))}`);
