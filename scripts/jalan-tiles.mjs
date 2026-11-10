// Bangun tile vektor MVT dari snapshot jaringan jalan Overture.
// Pemakaian: node scripts/jalan-tiles.mjs [--region <id>]
// Prasyarat: `uv` (atau python3 dengan shapely, mapbox-vector-tile, mercantile).
import { existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { AKAR, muatRegion } from "./lib/region.mjs";

const argv = process.argv.slice(2);
const arg = (nama, bawaan = null) => {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};
const REGION_ID = arg("region", "kota-tangerang");
const region = await muatRegion(REGION_ID).catch((error) => {
  console.error(`region: ${error.message}`);
  process.exit(1);
});
const konfigurasi = region.jalan;
if (!konfigurasi?.berkas || !konfigurasi?.tiles) {
  console.error(`region ${REGION_ID} tidak punya konfigurasi jalan.berkas/jalan.tiles`);
  process.exit(2);
}
const sumber = path.resolve(AKAR, konfigurasi.berkas);
if (!existsSync(sumber)) {
  console.error(`snapshot jalan belum ada: ${konfigurasi.berkas}`);
  process.exit(1);
}
const keluaran = path.resolve(AKAR, konfigurasi.tiles);
const sementara = `${keluaran}.tmp-${process.pid}`;
rmSync(sementara, { recursive: true, force: true });
await mkdir(sementara, { recursive: true });

const args = [
  "run",
  "--with", "shapely",
  "--with", "mapbox-vector-tile",
  "--with", "mercantile",
  "python3",
  path.resolve(AKAR, "scripts/lib/build-tiles.py"),
  "--input", sumber,
  "--output", sementara,
  "--layer", konfigurasi.tile_layer ?? "jalan",
  "--minzoom", String(konfigurasi.tile_minzoom ?? 10),
  "--maxzoom", String(konfigurasi.tile_maxzoom ?? 16),
  "--tolerance", String(konfigurasi.tile_tolerance ?? konfigurasi.simplify ?? 0.00001),
  "--attribution", konfigurasi.atribusi ?? "© OpenStreetMap contributors, Overture Maps Foundation (ODbL)",
  "--license", konfigurasi.lisensi ?? "ODbL-1.0",
  "--release", konfigurasi.release ?? "",
];

const hasil = spawnSync("uv", args, {
  cwd: AKAR,
  encoding: "utf8",
  env: process.env,
  timeout: 30 * 60_000,
  maxBuffer: 64 * 1024 * 1024,
});
if (hasil.error) {
  console.error(`uv gagal dijalankan: ${hasil.error.message}`);
  process.exit(1);
}
if (hasil.status !== 0) {
  rmSync(sementara, { recursive: true, force: true });
  console.error(`${hasil.stdout ?? ""}${hasil.stderr ?? ""}`.trim().slice(-3000));
  process.exit(hasil.status ?? 1);
}
rmSync(keluaran, { recursive: true, force: true });
renameSync(sementara, keluaran);
if (hasil.stdout) process.stdout.write(hasil.stdout);
if (hasil.stderr) process.stderr.write(hasil.stderr);

const metadataPath = path.join(keluaran, "metadata.json");
if (!existsSync(metadataPath)) {
  console.error("tile selesai tanpa metadata.json");
  process.exit(1);
}
const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
console.log(`tiles jalan: ${metadata.tiles} tile · ${(metadata.bytes / 1024 / 1024).toFixed(2)} MB · zoom ${metadata.minzoom}–${metadata.maxzoom} · layer ${metadata.layer}`);
