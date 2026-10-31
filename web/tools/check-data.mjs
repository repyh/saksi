// Asersi dataset yang disajikan ke peramban (web/public/data).
// Gagal (exit 1) bila angka kunci bergeser dari snapshot 31 Oktober 2026 (Kota Tangerang).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const akar = dirname(dirname(fileURLToPath(import.meta.url)));
const berkas = join(akar, "public", "data", "paket.json");
const batasRw = join(akar, "public", "data", "rw.geojson");
const batasKel = join(akar, "public", "data", "kel.geojson");

const mentah = JSON.parse(readFileSync(berkas, "utf8"));
const semua = Array.isArray(mentah) ? mentah : (mentah.paket ?? []);
const jalan = semua.filter((p) => p.sektor === "Jalan, Jembatan & Drainase");
const rw = JSON.parse(readFileSync(batasRw, "utf8"));
const kel = JSON.parse(readFileSync(batasKel, "utf8"));

const hasil = {
  "paket jalan": jalan.length,
  "punya lokus (lat)": jalan.filter((p) => p.lat != null).length,
  "anchor RW": jalan.filter((p) => p.presisi_peta === "RW").length,
  "anchor kelurahan": jalan.filter((p) => p.presisi_peta === "Kelurahan").length,
  "tanpa lokus": jalan.filter((p) => p.presisi_peta === "Kabupaten" || p.lat == null).length,
  "kelurahan unik": new Set(jalan.map((p) => p.desa_resmi).filter(Boolean)).size,
  "unit RW unik": new Set(jalan.filter((p) => p.presisi_peta === "RW").map((p) => p.unit_id)).size,
  "kecamatan unik": new Set(jalan.map((p) => p.kecamatan_resmi).filter(Boolean)).size,
  "poligon RW": rw.features.length,
  "poligon kelurahan": kel.features.length,
  "pagu (Miliar Rp)": Number((jalan.reduce((n, p) => n + p.pagu, 0) / 1e9).toFixed(2)),
};

const harapan = {
  "paket jalan": 1557,
  "punya lokus (lat)": 1155,
  "anchor RW": 818,
  "anchor kelurahan": 337,
  "tanpa lokus": 402,
  "kelurahan unik": 80,
  "unit RW unik": 483,
  "kecamatan unik": 13,
  "poligon RW": 1020,
  "poligon kelurahan": 104,
  "pagu (Miliar Rp)": 650.18,
};

let gagal = false;

console.log(`Berkas: ${berkas.replace(`${akar}/`, "")}`);
console.log(`Total baris paket.json: ${semua.length}`);

for (const [label, nilai] of Object.entries(hasil)) {
  const target = harapan[label];
  const ok = nilai === target;
  if (!ok) gagal = true;
  console.log(`${ok ? "OK  " : "GAGAL"} ${label.padEnd(20)} ${nilai}${ok ? "" : ` (harus ${target})`}`);
}

if (gagal) {
  console.error("\nCHECK DATA GAGAL — dataset tidak sesuai snapshot 31 Oktober 2026 (Kota Tangerang).");
  process.exit(1);
}

console.log(
  "\nCHECK DATA OK — 1.557 paket jalan · 1.155 berlokus · 818 anchor RW · 80 kelurahan · 1.020 poligon RW.",
);
