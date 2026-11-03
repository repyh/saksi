#!/usr/bin/env node
/**
 * Tarik **Data INAPROC — Realisasi** (data.inaproc.id) untuk Kota Tangerang.
 *
 * Ini melengkapi LPSE: e-purchasing tidak pernah muncul di SPSE, tetapi transaksinya
 * tercatat di dashboard publik Data INAPROC lengkap dengan `kode_rup` dan `nama_penyedia`.
 *
 * API internal `/dashboard-api/...` mensyaratkan dua header sederhana:
 *   x-request-time : epoch milidetik
 *   x-secret       : base64 dari string waktu itu yang dibalik
 * Paginasi memakai cursor: ambil `tablePagination.nextCursor`, kirim balik sebagai query
 * `cursor=`. Ukuran halaman tetap 20, tidak bisa dinaikkan lewat parameter.
 *
 * Pakai: node scripts/realisasi.mjs [--tahun 2025,2026] [--satker <kode>,<kode>,...]
 *        Hasil digabung dengan berkas sebelumnya, jadi aman dijalankan per satker.
 * Keluaran: data/realisasi_kota_tangerang.json
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = "https://data.inaproc.id";
const INSTANSI = "D44"; // Kota Tangerang
const SATKER_PU = "1.03.2.10.0.00.01.0000"; // Dinas Pekerjaan Umum dan Penataan Ruang
const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";
const JEDA_MS = 250;

const argv = process.argv.slice(2);
const arg = (nama, bawaan) => {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};
const TAHUN = arg("tahun", "2025,2026").split(",").map(Number);
const SATKERS = arg("satker", SATKER_PU)
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

function header() {
  const t = Date.now().toString();
  return {
    Accept: "application/json",
    "x-request-time": t,
    "x-secret": Buffer.from(t.split("").reverse().join("")).toString("base64"),
    "User-Agent": UA,
    Referer: `${BASE}/realisasi`,
  };
}

async function ambil(path) {
  const url = `${BASE}${path}`;
  for (let coba = 0; coba < 4; coba += 1) {
    try {
      const res = await fetch(url, { headers: header() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (coba === 3) throw new Error(`${url} → ${err.message}`);
      await tidur(800 * (coba + 1));
    }
  }
  throw new Error("unreachable");
}

async function tarikSatker(tahun, satker, urutan, jumlah) {
  const dasar = `/dashboard-api/realisasi/table?tahun=${tahun}&instansi=${INSTANSI}&satker=${satker}`;
  const hasil = [];
  let cursor = "";
  let total = null;

  for (let halaman = 0; halaman < 1000; halaman += 1) {
    const path = cursor ? `${dasar}&cursor=${encodeURIComponent(cursor)}` : dasar;
    const data = await ambil(path);
    const rows = data.tableRows ?? [];
    if (total === null) total = data.tableTotalRows ?? null;
    hasil.push(...rows);

    const pag = data.tablePagination ?? {};
    if (!pag.hasMore || !pag.nextCursor) break;
    if (pag.nextCursor === cursor) break;
    cursor = pag.nextCursor;
    if (halaman % 25 === 0) {
      console.log(`  [${urutan}/${jumlah}] ${tahun} ${satker.slice(0, 18)}: ${hasil.length}/${total ?? "?"}`);
    }
    await tidur(JEDA_MS);
  }
  console.log(`${tahun} ${satker}: ${hasil.length} baris (dilaporkan ${total})`);
  return { tahun, satker, total, rows: hasil };
}

const semua = [];
let urutan = 0;
for (const tahun of TAHUN) {
  for (const satker of SATKERS) {
    urutan += 1;
    semua.push(await tarikSatker(tahun, satker, urutan, TAHUN.length * SATKERS.length));
    await tidur(JEDA_MS);
  }
}

const rows = semua.flatMap((b) => b.rows);
// Gabung dengan hasil penarikan sebelumnya supaya bisa menambah satker tanpa menarik ulang.
const berkas = join(AKAR, "data", "realisasi_kota_tangerang.json");
let lama = [];
if (existsSync(berkas)) {
  try {
    const isi = JSON.parse(readFileSync(berkas, "utf8"));
    lama = (isi.item ?? []).map((r) => ({
      kode_rup: r.kode_rup,
      kode_paket: r.kode_paket,
      tahun_anggaran: r.tahun,
      metode_pengadaan: r.metode,
      nama_satuan_kerja: r.satker,
      nama_penyedia: r.penyedia ?? "-",
      total_nilai: r.nilai,
      sumber_transaksi: r.sumber_transaksi,
      sumber_dana: r.sumber_dana,
      jenis_pengadaan: r.jenis,
      nama_paket: r.paket,
      status_paket: r.status,
      tahapan_pengadaan: r.tahapan,
      nilai_pagu: r.pagu,
    }));
    console.log(`menggabung ${lama.length} baris dari penarikan sebelumnya`);
  } catch {
    console.warn("berkas sebelumnya tidak bisa dibaca — mulai dari nol");
  }
}

// Satu paket bisa punya beberapa transaksi (mis. e-purchasing beberapa pesanan) —
// simpan semuanya, jangan dibuang.
const unik = new Map();
for (const r of [...lama, ...rows]) {
  unik.set(`${r.tahun_anggaran}:${r.kode_paket}:${r.nama_penyedia}:${r.total_nilai}`, r);
}

const semuaBaris = [...unik.values()];
const perRup = new Map();
for (const r of semuaBaris) {
  if (!r.kode_rup) continue;
  const rup = String(r.kode_rup);
  const agg = perRup.get(rup) ?? {
    kode_rup: rup,
    tahun: r.tahun_anggaran,
    metode: r.metode_pengadaan,
    transaksi: 0,
    nilai: 0,
    penyedia: [],
    satker: [],
  };
  agg.transaksi += 1;
  agg.nilai += Number(r.total_nilai ?? 0);
  if (r.nama_satuan_kerja && !agg.satker.includes(r.nama_satuan_kerja)) {
    agg.satker.push(r.nama_satuan_kerja);
  }
  if (r.nama_penyedia && r.nama_penyedia !== "-" && !agg.penyedia.includes(r.nama_penyedia)) {
    agg.penyedia.push(r.nama_penyedia);
  }
  perRup.set(rup, agg);
}

const perMetode = {};
for (const r of semuaBaris) {
  const k = r.metode_pengadaan || "TIDAK_DIKETAHUI";
  perMetode[k] = (perMetode[k] ?? 0) + 1;
}

mkdirSync(join(AKAR, "data"), { recursive: true });
writeFileSync(
  join(AKAR, "data", "realisasi_kota_tangerang.json"),
  JSON.stringify(
    {
      snapshot: new Date().toISOString().slice(0, 10),
      sumber: `${BASE}/realisasi (Data INAPROC, sinkron 02 Nov 2026 02.39 WIB)`,
      instansi: INSTANSI,
      satker: SATKERS,
      per_penarikan: semua.map((b) => ({
        tahun: b.tahun,
        satker: b.satker,
        dilaporkan: b.total,
        ditarik: b.rows.length,
      })),
      per_metode: perMetode,
      jumlah_baris: semuaBaris.length,
      jumlah_rup: perRup.size,
      tanpa_penyedia: semuaBaris.filter((r) => !r.nama_penyedia || r.nama_penyedia === "-").length,
      per_rup: [...perRup.values()].sort((a, b) => b.nilai - a.nilai),
      item: semuaBaris.map((r) => ({
        kode_rup: r.kode_rup || null,
        kode_paket: r.kode_paket,
        tahun: r.tahun_anggaran,
        metode: r.metode_pengadaan,
        jenis: r.jenis_pengadaan,
        sumber_transaksi: r.sumber_transaksi,
        sumber_dana: r.sumber_dana,
        satker: r.nama_satuan_kerja,
        paket: r.nama_paket,
        status: r.status_paket,
        tahapan: r.tahapan_pengadaan,
        penyedia: r.nama_penyedia && r.nama_penyedia !== "-" ? r.nama_penyedia : null,
        nilai: r.total_nilai ?? null,
        pagu: r.nilai_pagu ?? null,
      })),
    },
    null,
    1,
  ),
);

console.log(`total unik ${unik.size} baris · metode: ${JSON.stringify(perMetode)}`);
console.log("→ data/realisasi_kota_tangerang.json");
