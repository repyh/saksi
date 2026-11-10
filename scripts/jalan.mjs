// Snapshot layer jaringan jalan dari Overture Maps transportation segment.
// Pemakaian: node scripts/jalan.mjs [--region <id>] [--check]
// Prasyarat: `uvx overturemaps` (atau `overturemaps`/`pipx run overturemaps`) dan
// `uv run --with shapely` untuk memotong garis ke batas kota.
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { AKAR, muatRegion } from "./lib/region.mjs";

const argv = process.argv.slice(2);
const arg = (nama, bawaan = null) => {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};
const REGION_ID = arg("region", "kota-tangerang");
const HANYA_CEK = argv.includes("--check");
/** Untuk pengembangan/runbook: pakai unduhan yang sudah ada, lewati unduh ulang. */
const INPUT_OVERRIDE = arg("input", null);
const MIN_LENGTH_M = 2;

const region = await muatRegion(REGION_ID).catch((error) => {
  console.error(`region: ${error.message}`);
  process.exit(1);
});
const konfigurasi = region.jalan;
if (!konfigurasi || konfigurasi.sumber !== "overture") {
  console.error(`region ${REGION_ID} tidak punya konfigurasi "jalan" bersumber Overture`);
  process.exit(2);
}

const presisi = Number.isInteger(konfigurasi.presisi) ? konfigurasi.presisi : 6;
const toleransi = Number(konfigurasi.simplify ?? 0);
const kelasDipakai = new Set(
  konfigurasi.filter?.kelas_dipakai?.length
    ? konfigurasi.filter.kelas_dipakai
    : [
      "motorway", "trunk", "primary", "secondary", "tertiary", "unclassified",
      "residential", "living_street", "service", "track", "pedestrian", "road",
    ],
);
const kelasDibuang = new Set(konfigurasi.filter?.kelas_dibuang ?? ["unknown", "steps"]);
const kelasTanpaNamaDibuang = new Set(konfigurasi.filter?.kelas_tanpa_nama_dibuang ?? []);

function jalankan(perintah, args, { timeout = 3_600_000 } = {}) {
  const hasil = spawnSync(perintah, args, {
    cwd: AKAR,
    encoding: "utf8",
    env: process.env,
    timeout,
    maxBuffer: 64 * 1024 * 1024,
  });
  if (hasil.error) {
    throw new Error(`${perintah} gagal dijalankan: ${hasil.error.message}`);
  }
  if (hasil.status !== 0) {
    const pesan = `${hasil.stderr ?? ""}`.trim().slice(-2000);
    throw new Error(`${perintah} ${args.join(" ")} keluar ${hasil.status}: ${pesan}`);
  }
  return { stdout: hasil.stdout ?? "", stderr: hasil.stderr ?? "" };
}

async function jalankanUnduh(cli, args) {
  let terakhir;
  for (let percobaan = 1; percobaan <= 3; percobaan += 1) {
    try {
      return jalankan(cli.perintah, [...cli.args, ...args]);
    } catch (error) {
      terakhir = error;
      if (percobaan === 3) break;
      const jeda = 5_000 * percobaan;
      console.warn(`unduhan Overture gagal (percobaan ${percobaan}/3): ${error.message}`);
      console.warn(`mencoba lagi dalam ${jeda / 1000} detik…`);
      await new Promise((resolve) => setTimeout(resolve, jeda));
    }
  }
  throw terakhir;
}

function perintahOverture() {
  const kandidat = [
    ["overturemaps", []],
    ["uvx", ["overturemaps"]],
    ["pipx", ["run", "overturemaps"]],
  ];
  for (const [perintah, args] of kandidat) {
    const cek = spawnSync(perintah, [...args, "--version"], { cwd: AKAR, encoding: "utf8" });
    if (cek.status === 0) return { perintah, args };
  }
  throw new Error(
    "CLI Overture tidak tersedia. Pasang dengan `pip install overturemaps` atau sediakan `uvx overturemaps`. "
    + "Script tidak akan kembali memakai ArcGIS.",
  );
}

function bacaBatas(relatif) {
  return JSON.parse(readFileSync(path.resolve(AKAR, relatif), "utf8"));
}

function kunjungiKoordinat(geometry, kunjungi) {
  if (!geometry) return;
  if (geometry.type === "LineString") {
    for (const titik of geometry.coordinates ?? []) kunjungi(titik);
    return;
  }
  if (geometry.type === "MultiLineString") {
    for (const garis of geometry.coordinates ?? []) for (const titik of garis) kunjungi(titik);
    return;
  }
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates ?? []) for (const titik of ring) kunjungi(titik);
    return;
  }
  if (geometry.type === "MultiPolygon") {
    for (const poligon of geometry.coordinates ?? []) {
      for (const ring of poligon) for (const titik of ring) kunjungi(titik);
    }
  }
}

function bboxDariBatas(relatif) {
  const dokumen = bacaBatas(relatif);
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  for (const fitur of dokumen.features ?? []) {
    kunjungiKoordinat(fitur.geometry, ([lon, lat]) => {
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
      west = Math.min(west, lon);
      south = Math.min(south, lat);
      east = Math.max(east, lon);
      north = Math.max(north, lat);
    });
  }
  if (![west, south, east, north].every(Number.isFinite)) {
    throw new Error(`batas ${relatif} tidak menghasilkan bbox`);
  }
  return [west, south, east, north];
}

function bboxKonfigurasi() {
  if (Array.isArray(konfigurasi.bbox) && konfigurasi.bbox.length === 4) return konfigurasi.bbox;
  const berkas = region.batas.kecamatan?.berkas ?? region.batas.lingkungan?.berkas ?? region.batas.kelurahan.berkas;
  return bboxDariBatas(berkas);
}

function duaDimensi(koordinat) {
  if (!Array.isArray(koordinat) || koordinat.length < 2) return null;
  const [lon, lat] = koordinat;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  return [Number(lon.toFixed(presisi)), Number(lat.toFixed(presisi))];
}

function bersihkanGaris(garis) {
  const hasil = [];
  for (const titik of garis ?? []) {
    const bersih = duaDimensi(titik);
    if (!bersih) continue;
    const terakhir = hasil.at(-1);
    if (terakhir && terakhir[0] === bersih[0] && terakhir[1] === bersih[1]) continue;
    hasil.push(bersih);
  }
  return hasil;
}

function geometriGaris(geometry) {
  if (!geometry) return null;
  if (geometry.type === "LineString") {
    const coordinates = bersihkanGaris(geometry.coordinates);
    return coordinates.length >= 2 ? { type: "LineString", coordinates } : null;
  }
  if (geometry.type === "MultiLineString") {
    const coordinates = (geometry.coordinates ?? [])
      .map((garis) => bersihkanGaris(garis))
      .filter((garis) => garis.length >= 2);
    return coordinates.length ? { type: "MultiLineString", coordinates } : null;
  }
  return null;
}

function aturanSederhana(nilai) {
  if (!Array.isArray(nilai) || nilai.length !== 1) return null;
  const aturan = nilai[0];
  if (!aturan || (Array.isArray(aturan.between) && aturan.between.length)) return null;
  return aturan.value ?? null;
}

function lebarSederhana(nilai) {
  const sederhana = aturanSederhana(nilai);
  const angka = Number(sederhana);
  return Number.isFinite(angka) && angka > 0 ? angka : null;
}

function permukaanSederhana(nilai) {
  const sederhana = aturanSederhana(nilai);
  return typeof sederhana === "string" && sederhana.trim() ? sederhana.trim() : null;
}

function jarakMeter(a, b) {
  const R = 6_371_008.8;
  const rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad;
  const dLon = (b[0] - a[0]) * rad;
  const lat1 = a[1] * rad;
  const lat2 = b[1] * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function panjangGaris(garis) {
  let total = 0;
  for (let i = 1; i < garis.length; i += 1) total += jarakMeter(garis[i - 1], garis[i]);
  return total;
}

function panjangGeometri(geometry) {
  const garis = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
  return garis.reduce((total, baris) => total + panjangGaris(baris), 0);
}

function titikTengah(geometry) {
  const garis = geometry.type === "LineString" ? [geometry.coordinates] : geometry.coordinates;
  let terpanjang = garis[0];
  let panjangTerpanjang = panjangGaris(terpanjang);
  for (const baris of garis.slice(1)) {
    const panjang = panjangGaris(baris);
    if (panjang > panjangTerpanjang) {
      terpanjang = baris;
      panjangTerpanjang = panjang;
    }
  }
  let sisa = panjangTerpanjang / 2;
  for (let i = 1; i < terpanjang.length; i += 1) {
    const segmen = jarakMeter(terpanjang[i - 1], terpanjang[i]);
    if (sisa <= segmen || i === terpanjang.length - 1) {
      const rasio = segmen > 0 ? Math.min(1, sisa / segmen) : 0;
      const a = terpanjang[i - 1];
      const b = terpanjang[i];
      return [a[0] + (b[0] - a[0]) * rasio, a[1] + (b[1] - a[1]) * rasio];
    }
    sisa -= segmen;
  }
  return terpanjang[0];
}

function pointInRing(lon, lat, ring) {
  let dalam = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const memotong = (yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (memotong) dalam = !dalam;
  }
  return dalam;
}

function siapkanArea(relatif, namaField, kecamatanField) {
  const dokumen = bacaBatas(relatif);
  const hasil = [];
  for (const fitur of dokumen.features ?? []) {
    const geometry = fitur.geometry;
    if (!geometry) continue;
    const nama = String(fitur.properties?.[namaField] ?? "").trim();
    const kecamatan = String(fitur.properties?.[kecamatanField] ?? "").trim();
    if (!nama) continue;
    const poligon = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    let west = Number.POSITIVE_INFINITY;
    let south = Number.POSITIVE_INFINITY;
    let east = Number.NEGATIVE_INFINITY;
    let north = Number.NEGATIVE_INFINITY;
    kunjungiKoordinat(geometry, ([lon, lat]) => {
      west = Math.min(west, lon);
      south = Math.min(south, lat);
      east = Math.max(east, lon);
      north = Math.max(north, lat);
    });
    hasil.push({ nama, kecamatan, poligon, bbox: [west, south, east, north] });
  }
  return hasil;
}

function areaPada(areas, lon, lat) {
  for (const area of areas) {
    const [west, south, east, north] = area.bbox;
    if (lon < west || lon > east || lat < south || lat > north) continue;
    const cocok = area.poligon.some((poligon) => {
      const [luar, ...lubang] = poligon;
      return pointInRing(lon, lat, luar) && !lubang.some((ring) => pointInRing(lon, lat, ring));
    });
    if (cocok) return area;
  }
  return null;
}

function validasi(features) {
  const masalah = [];
  const ids = new Set();
  let tanpaNama = 0;
  for (const fitur of features) {
    const id = String(fitur?.properties?.id ?? "");
    if (!id) masalah.push("fitur tanpa GERS id");
    else if (ids.has(id)) masalah.push(`GERS id ganda: ${id}`);
    else ids.add(id);
    if (!fitur?.properties?.nama) tanpaNama += 1;
    if (!["LineString", "MultiLineString"].includes(fitur?.geometry?.type)) {
      masalah.push(`geometri ${fitur?.geometry?.type ?? "kosong"} pada ${id || "?"} bukan garis`);
    }
  }
  return {
    lulus: masalah.length === 0,
    masalah,
    coverage: { fitur: features.length, bernama: features.length - tanpaNama, tanpa_nama: tanpaNama },
  };
}

if (HANYA_CEK) {
  const berkas = path.resolve(AKAR, konfigurasi.berkas);
  if (!existsSync(berkas)) {
    console.error(`layer jalan belum ada: ${konfigurasi.berkas}`);
    process.exit(1);
  }
  const isi = JSON.parse(readFileSync(berkas, "utf8"));
  const hasil = validasi(isi.features ?? []);
  if (!hasil.lulus) {
    console.error(hasil.masalah.slice(0, 20).join("\n"));
    process.exit(1);
  }
  const checksum = createHash("sha256").update(readFileSync(berkas)).digest("hex");
  console.log(`layer jalan OK: ${hasil.coverage.fitur} segmen · ${hasil.coverage.bernama} bernama · ${hasil.coverage.tanpa_nama} tanpa nama`);
  console.log(`rilis ${isi.source?.release ?? "?"} · lisensi ${isi.source?.license ?? "?"} · sha256 ${checksum.slice(0, 12)}…`);
  process.exit(0);
}

const cli = perintahOverture();
const release = konfigurasi.release
  || jalankan(cli.perintah, [...cli.args, "releases", "latest"]).stdout.trim().split("\n").at(-1);
if (!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(release ?? "")) {
  throw new Error(`rilis Overture tidak valid: ${release}`);
}

const bbox = bboxKonfigurasi();
const bboxArg = bbox.map((nilai) => Number(nilai).toFixed(6)).join(",");
const sementara = mkdtempSync(path.join(os.tmpdir(), `saksi-overture-${REGION_ID}-`));
const mentahPath = path.join(sementara, "segments.geojson");
const filterPath = path.join(sementara, "filtered.geojson");
const potongPath = path.join(sementara, "clipped.geojson");
const batasPath = path.resolve(AKAR, region.batas.kecamatan?.berkas ?? region.batas.kelurahan.berkas);

try {
  console.log(`Overture ${release} · bbox ${bboxArg}`);
  if (INPUT_OVERRIDE) {
    console.log(`memakai unduhan lokal: ${INPUT_OVERRIDE}`);
    const sumber = path.resolve(AKAR, INPUT_OVERRIDE);
    if (!existsSync(sumber)) throw new Error(`berkas unduhan tidak ditemukan: ${INPUT_OVERRIDE}`);
    await writeFile(mentahPath, readFileSync(sumber));
  } else {
    await jalankanUnduh(cli, [
      "download",
      `--bbox=${bboxArg}`,
      `--type=${konfigurasi.tipe ?? "segment"}`,
      "-f", "geojson",
      "-o", mentahPath,
      "-r", release,
      "--connect_timeout", "60",
      "--request_timeout", "600",
    ]);
  }
  if (!existsSync(mentahPath)) throw new Error("Overture tidak menghasilkan berkas unduhan");

  const mentah = JSON.parse(readFileSync(mentahPath, "utf8"));
  const mentahFeatures = mentah.features ?? [];
  const subtype = konfigurasi.subtype ?? "road";
  const terlihat = new Map();
  let duplikat = 0;
  let bukanSubtype = 0;
  let kelasDibuangN = 0;
  let tanpaNamaDibuang = 0;

  for (const fitur of mentahFeatures) {
    const p = fitur.properties ?? {};
    if (p.subtype !== subtype) {
      bukanSubtype += 1;
      continue;
    }
    const kelas = String(p.class ?? "").trim();
    if (!kelas || kelasDibuang.has(kelas) || !kelasDipakai.has(kelas)) {
      kelasDibuangN += 1;
      continue;
    }
    const nama = typeof p.names?.primary === "string" && p.names.primary.trim() ? p.names.primary.trim() : null;
    if (!nama && kelasTanpaNamaDibuang.has(kelas)) {
      tanpaNamaDibuang += 1;
      continue;
    }
    const id = String(fitur.id ?? p.id ?? "").trim();
    if (!id) continue;
    const geometry = geometriGaris(fitur.geometry);
    if (!geometry) continue;
    if (terlihat.has(id)) {
      duplikat += 1;
      continue;
    }
    terlihat.set(id, {
      type: "Feature",
      id,
      properties: {
        id,
        nama,
        kelas,
        permukaan: permukaanSederhana(p.road_surface),
        lebar: lebarSederhana(p.width_rules),
      },
      geometry,
    });
  }

  await writeFile(
    filterPath,
    JSON.stringify({ type: "FeatureCollection", features: [...terlihat.values()] }),
  );

  console.log(`filter: ${terlihat.size} segmen road (${bukanSubtype} bukan subtype, ${kelasDibuangN} kelas dibuang, ${tanpaNamaDibuang} tanpa nama dibuang, ${duplikat} duplikat)`);

  const klip = jalankan("uv", [
    "run", "--with", "shapely", "python3",
    path.resolve(AKAR, "scripts/lib/clip-jalan.py"),
    "--input", filterPath,
    "--boundary", batasPath,
    "--output", potongPath,
    "--simplify", String(toleransi),
  ]);
  if (klip.stderr) console.log(klip.stderr.trim());

  const terpotong = JSON.parse(readFileSync(potongPath, "utf8"));
  const kecamatanArea = siapkanArea(region.batas.kecamatan?.berkas ?? region.batas.kelurahan.berkas, region.batas.kecamatan?.nama ?? region.batas.kelurahan.nama, region.batas.kecamatan?.nama ?? region.batas.kelurahan.kecamatan);
  const kelurahanArea = region.batas.lingkungan || region.batas.kelurahan
    ? siapkanArea(region.batas.kelurahan.berkas, region.batas.kelurahan.nama, region.batas.kelurahan.kecamatan)
    : [];

  const features = [];
  let terlaluPendek = 0;
  for (const fitur of terpotong.features ?? []) {
    const geometry = geometriGaris(fitur.geometry);
    if (!geometry) continue;
    const panjang = panjangGeometri(geometry);
    if (panjang < MIN_LENGTH_M) {
      terlaluPendek += 1;
      continue;
    }
    const [lon, lat] = titikTengah(geometry);
    const kec = areaPada(kecamatanArea, lon, lat);
    const kel = areaPada(kelurahanArea, lon, lat);
    features.push({
      type: "Feature",
      properties: {
        id: fitur.properties.id,
        nama: fitur.properties.nama ?? null,
        kelas: fitur.properties.kelas,
        permukaan: fitur.properties.permukaan ?? null,
        lebar: fitur.properties.lebar ?? null,
        panjang: Number(panjang.toFixed(1)),
        kecamatan: kec?.nama ? [kec.nama] : [],
        kelurahan: kel?.nama ? [kel.nama] : [],
      },
      geometry,
    });
  }

  features.sort((a, b) => String(a.properties.nama ?? "").localeCompare(String(b.properties.nama ?? ""), "id") || a.properties.id.localeCompare(b.properties.id));
  const valid = validasi(features);
  if (!valid.lulus) {
    console.error(`GAGAL validasi layer jalan:\n- ${valid.masalah.slice(0, 20).join("\n- ")}`);
    process.exit(1);
  }

  const dokumen = {
    type: "FeatureCollection",
    name: konfigurasi.label ?? "Jaringan jalan Overture",
    source: {
      name: "Overture Maps Foundation",
      theme: "transportation",
      type: konfigurasi.tipe ?? "segment",
      subtype,
      release,
      bbox,
      license: konfigurasi.lisensi ?? "ODbL-1.0",
      attribution: konfigurasi.atribusi ?? "© OpenStreetMap contributors, Overture Maps Foundation (ODbL)",
      url: "https://overturemaps.org/",
      generatedAt: new Date().toISOString(),
      decimals: presisi,
      simplify: toleransi,
      filter: {
        kelas_dipakai: [...kelasDipakai],
        kelas_dibuang: [...kelasDibuang],
        kelas_tanpa_nama_dibuang: [...kelasTanpaNamaDibuang],
      },
      stats: {
        unduhan: mentahFeatures.length,
        bukan_subtype: bukanSubtype,
        kelas_dibuang: kelasDibuangN,
        tanpa_nama_dibuang: tanpaNamaDibuang,
        duplikat,
        setelah_filter: terlihat.size,
        setelah_potong: (terpotong.features ?? []).length,
        terlalu_pendek: terlaluPendek,
        fitur: features.length,
        bernama: valid.coverage.bernama,
        tanpa_nama: valid.coverage.tanpa_nama,
      },
    },
    features,
  };

  const keluaran = path.resolve(AKAR, konfigurasi.berkas);
  await mkdir(path.dirname(keluaran), { recursive: true });
  const teks = JSON.stringify(dokumen);
  await writeFile(keluaran, teks);
  const byte = Buffer.byteLength(teks);
  const checksum = createHash("sha256").update(teks).digest("hex");

  console.log(`layer jalan          : ${konfigurasi.berkas}`);
  console.log(`rilis Overture       : ${release}`);
  console.log(`segmen               : ${features.length}/${mentahFeatures.length} unduhan · ${valid.coverage.bernama} bernama · ${valid.coverage.tanpa_nama} tanpa nama`);
  console.log(`ukuran               : ${(byte / 1024 / 1024).toFixed(2)} MB`);
  console.log(`sha256               : ${checksum}`);
  console.log(`lisensi              : ${dokumen.source.license} · ${dokumen.source.attribution}`);

  if (!argv.includes("--no-tiles")) {
    const tiles = spawnSync(process.execPath, [
      path.resolve(AKAR, "scripts/jalan-tiles.mjs"),
      "--region", REGION_ID,
    ], { cwd: AKAR, stdio: "inherit", env: process.env });
    if (tiles.status !== 0) {
      throw new Error(`pembuatan tile gagal (exit ${tiles.status ?? "signal"})`);
    }
  }
} finally {
  rmSync(sementara, { recursive: true, force: true });
}
