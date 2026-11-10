// Definisi sumber per region + pembaca berkas. Semua path berasal dari region.json;
// tidak ada path, instansi, atau nama properti yang ditanam di worker.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { AKAR } from "../../scripts/lib/region.mjs";

const SUMBER_DASAR = (region) => [
  {
    key: "rup",
    grup: "rup",
    kind: "RUP",
    name: "rup-ekspor",
    role: "rup",
    path: region.sumber.rup,
    format: "json",
    endpoint: "https://data.inaproc.id/rup",
    license: "Data publik RUP LKPP/INAPROC",
    parserVersion: "rup-item-v1",
    refresh: { skrip: "scripts/rup.mjs", args: ["--region", region.id] },
  },
  {
    key: "detail",
    grup: "detail",
    kind: "RUP_DETAIL",
    name: "rup-detail",
    role: "detail",
    path: region.sumber.detail,
    format: "json",
    endpoint: "https://data.inaproc.id/dashboard-api/rup/detail",
    license: "Data publik RUP LKPP/INAPROC",
    parserVersion: "rup-detail-v1",
    refresh: { skrip: "scripts/rup.mjs", args: ["--detail", "--region", region.id] },
    opsional: true,
  },
  {
    key: "realisasi",
    grup: "realisasi",
    kind: "REALISASI",
    name: "realisasi-ekspor",
    role: "realisasi",
    path: region.sumber.realisasi,
    format: "json",
    endpoint: "https://data.inaproc.id/realisasi",
    license: "Data publik realisasi LKPP/INAPROC",
    parserVersion: "realisasi-item-v1",
    refresh: { skrip: "scripts/realisasi.mjs", args: ["--region", region.id] },
    opsional: true,
  },
  {
    key: "lpse-cocok",
    grup: "lpse",
    kind: "LPSE",
    name: "spse-cocok",
    role: "lpse-kontrak",
    path: region.lpse?.keluaran,
    format: "json",
    endpoint: region.lpse?.base ? `${region.lpse.base}/nontender` : null,
    license: "Data publik SPSE/LPSE",
    parserVersion: "lpse-match-v1",
    refresh: { skrip: "scripts/lpse.mjs", args: ["match", "--region", region.id] },
    opsional: true,
  },
  {
    key: "lpse-rows",
    grup: "lpse",
    kind: "LPSE",
    name: "spse-daftar",
    role: "lpse-daftar",
    path: region.lpse?.direktori ? path.join(region.lpse.direktori, "rows.json") : null,
    format: "json",
    endpoint: region.lpse?.base ? `${region.lpse.base}/dt/lelang` : null,
    license: "Data publik SPSE/LPSE",
    parserVersion: "lpse-rows-v1",
    refresh: { skrip: "scripts/lpse.mjs", args: ["list", "--region", region.id] },
    opsional: true,
  },
  {
    key: "lpse-detail",
    grup: "lpse",
    kind: "LPSE",
    name: "spse-detail",
    role: "lpse-detail",
    path: region.lpse?.direktori ? path.join(region.lpse.direktori, "details.jsonl") : null,
    format: "jsonl",
    endpoint: region.lpse?.base ? `${region.lpse.base}/nontender` : null,
    license: "Data publik SPSE/LPSE",
    parserVersion: "lpse-detail-v1",
    refresh: { skrip: "scripts/lpse.mjs", args: ["detail", "--region", region.id] },
    opsional: true,
  },
  ...(region.jalan
    ? [
        {
          key: "jalan",
          grup: "jalan",
          kind: "ROAD_NETWORK",
          name: "jaringan-jalan",
          role: "road-network",
          path: region.jalan.berkas,
          format: "geojson",
          endpoint: `https://overturemaps.org/ (release ${region.jalan.release ?? "terbaru"})`,
          license: region.jalan.lisensi ?? "ODbL-1.0",
          parserVersion: "geojson-overture-road-v2",
          refresh: { skrip: "scripts/jalan.mjs", args: ["--region", region.id] },
          opsional: true,
        },
      ]
    : []),
  ...(region.batas.kelurahan
    ? [
        {
          key: "batas-kelurahan",
          grup: "boundaries",
          kind: "BOUNDARY",
          name: "batas-kelurahan",
          role: "batas-kelurahan",
          level: "KELURAHAN",
          path: region.batas.kelurahan.berkas,
          format: "geojson",
          endpoint: "https://arcgis.tangerangkota.go.id",
          license: "Batas administrasi Pemerintah Kota Tangerang",
          parserVersion: "geojson-v1",
          properti: region.batas.kelurahan,
        },
      ]
    : []),
  ...(region.batas.lingkungan
    ? [
        {
          key: "batas-rw",
          grup: "boundaries",
          kind: "BOUNDARY",
          name: "batas-rw",
          role: "batas-rw",
          level: "RW",
          path: region.batas.lingkungan.berkas,
          format: "geojson",
          endpoint: "https://arcgis.tangerangkota.go.id",
          license: "Batas administrasi Pemerintah Kota Tangerang",
          parserVersion: "geojson-v1",
          properti: region.batas.lingkungan,
        },
      ]
    : []),
  ...(region.batas.kecamatan
    ? [
        {
          key: "batas-kecamatan",
          grup: "boundaries",
          kind: "BOUNDARY",
          name: "batas-kecamatan",
          role: "batas-kecamatan",
          level: "KECAMATAN",
          path: region.batas.kecamatan.berkas,
          format: "geojson",
          endpoint: "https://arcgis.tangerangkota.go.id",
          license: "Batas administrasi Pemerintah Kota Tangerang",
          parserVersion: "geojson-v1",
          properti: region.batas.kecamatan,
        },
      ]
    : []),
];

export function daftarSumber(region) {
  return SUMBER_DASAR(region).filter((s) => s.path);
}

/** Baca berkas sumber dan kembalikan baris mentahnya. */
export async function bacaSumber(sumber) {
  const absolut = path.resolve(AKAR, sumber.path);
  let teks;
  try {
    teks = await readFile(absolut, "utf8");
  } catch (error) {
    if (sumber.opsional) return { ada: false, absolut, teks: null, baris: [], dokumen: null };
    throw new Error(`sumber ${sumber.key} tidak tersedia di ${sumber.path}: ${error.message}`);
  }

  if (sumber.format === "jsonl") {
    const baris = teks
      .split("\n")
      .map((x) => x.trim())
      .filter(Boolean)
      .map((x) => JSON.parse(x));
    return { ada: true, absolut, teks, dokumen: null, baris };
  }

  const dokumen = JSON.parse(teks);
  let baris;
  if (Array.isArray(dokumen)) baris = dokumen;
  else if (Array.isArray(dokumen.item)) baris = dokumen.item;
  else if (Array.isArray(dokumen.features)) baris = dokumen.features;
  else if (Array.isArray(dokumen.paket)) baris = dokumen.paket;
  else throw new Error(`sumber ${sumber.key}: bentuk dokumen tidak dikenal`);
  return { ada: true, absolut, teks, dokumen, baris };
}
