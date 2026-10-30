// Asersi dataset yang disajikan ke peramban (web/public/data).
// Gagal (exit 1) bila angka kunci bergeser dari snapshot 29 Oktober 2026.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const akar = dirname(dirname(fileURLToPath(import.meta.url)));
const berkas = join(akar, "public", "data", "paket.json");

const mentah = JSON.parse(readFileSync(berkas, "utf8"));
const semua = Array.isArray(mentah) ? mentah : (mentah.paket ?? []);
const jalan = semua.filter((p) => p.sektor === "Jalan, Jembatan & Drainase");

const hasil = {
  "paket jalan": jalan.length,
  "titik (lat != null)": jalan.filter((p) => p.lat != null).length,
  koridor: jalan.filter((p) => p.presisi_peta === "Garis Koridor").length,
  "desa unik": new Set(jalan.map((p) => p.desa_resmi).filter(Boolean)).size,
  "kecamatan unik": new Set(jalan.map((p) => p.kecamatan_resmi).filter(Boolean)).size,
  "pagu (Miliar Rp)": Number((jalan.reduce((n, p) => n + p.pagu, 0) / 1e9).toFixed(2)),
};

const harapan = {
  "paket jalan": 3602,
  "titik (lat != null)": 3331,
  koridor: 102,
  "desa unik": 251,
  "kecamatan unik": 29,
  "pagu (Miliar Rp)": 848.6,
};

let gagal = false;

console.log(`Berkas: ${berkas.replace(`${akar}/`, "")}`);
console.log(`Total baris (5 sektor): ${semua.length}`);

for (const [label, nilai] of Object.entries(hasil)) {
  const target = harapan[label];
  const ok = nilai === target;
  if (!ok) gagal = true;
  console.log(`${ok ? "OK  " : "GAGAL"} ${label.padEnd(20)} ${nilai}${ok ? "" : ` (harus ${target})`}`);
}

if (jalan.length !== 3602) gagal = true;
if (jalan.filter((p) => p.lat != null).length !== 3331) gagal = true;

if (gagal) {
  console.error("\nCHECK DATA GAGAL — dataset tidak sesuai snapshot 29 Oktober 2026.");
  process.exit(1);
}

console.log("\nCHECK DATA OK — 3.602 paket jalan · 3.331 bertitik · 102 koridor · 251 desa.");
