#!/usr/bin/env node
/**
 * Tarik **Data INAPROC — Realisasi** (data.inaproc.id) untuk Kota Tangerang.
 *
 * Melengkapi LPSE: e-purchasing tidak pernah muncul di SPSE, tetapi transaksinya tercatat
 * di Data INAPROC lengkap dengan `kode_rup` dan `nama_penyedia`.
 *
 * Dua jalur, keduanya tanpa login (tidak perlu akun):
 *
 *  1. CSV EKSPOR (bawaan) — seluruh instansi dalam 4 request, bukan 20 baris per halaman.
 *       POST /dashboard-api/export/signature  {"path": ".../realisasi/export", "body": "<json>"}
 *            → {time, nonce, signature, path, headers:{x-auth-time,x-auth-path,x-auth-nonce,x-auth-signature}}
 *       POST /dashboard-api/realisasi/export  body json + header x-auth-* → {job_id, events_url, ...}
 *       GET  /dashboard-api/export/<id>/events (text/event-stream) → data: {"download_url": ...}
 *       GET  <download_url>                  URL GCS bertanda tangan; kirim TANPA header API.
 *
 *  2. TABEL (cadangan, `--mode table`) — 20 baris/halaman dengan cursor, per satker.
 *
 * Semua request API butuh anti-bot: `x-request-time` (epoch ms) dan `x-secret` = base64(timestamp dibalik).
 * Filter wajib: tahun + jenis instansi ("5" = pemerintah daerah) + instansi ("D44").
 *
 * Pakai: node scripts/realisasi.mjs [--mode csv|table] [--tahun 2025,2026] [--satker kode,...]
 *        Mode csv TANPA --satker = snapshot penuh (berkas ditimpa); dengan --satker = digabung.
 * Keluaran: data/realisasi_kota_tangerang.json
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = "https://data.inaproc.id";
const INSTANSI = "D44"; // Kota Tangerang
const JENIS_INSTANSI = "5"; // Pemerintah Daerah
const SATKER_PU = "1.03.2.10.0.00.01.0000";
const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";
const JEDA_MS = 250;

const argv = process.argv.slice(2);
const arg = (nama, bawaan) => {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};
const MODE = arg("mode", "csv");
const TAHUN = arg("tahun", "2025,2026").split(",").map(Number);
const SATKERS = arg("satker", "")
  .split(",")
  .map((k) => k.trim())
  .filter(Boolean);

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

function header(extra = {}) {
  const t = Date.now().toString();
  return {
    accept: "*/*",
    "content-type": "application/json",
    origin: BASE,
    referer: `${BASE}/realisasi`,
    "user-agent": UA,
    "x-request-time": t,
    "x-secret": Buffer.from(t.split("").reverse().join("")).toString("base64"),
    ...extra,
  };
}

async function minta(path, { method = "GET", body, extra, accept, timeout = 180000 } = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  for (let coba = 0; coba < 4; coba += 1) {
    try {
      const res = await fetch(url, {
        method,
        headers: header({ ...(extra ?? {}), ...(accept ? { accept } : {}) }),
        body,
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (coba === 3) throw new Error(`${path} → ${err.message}`);
      await tidur(800 * (coba + 1));
    }
  }
  throw new Error("unreachable");
}

/** Parser CSV RFC-4180 secukupnya (kutip ganda, koma & baris baru di dalam kutip). */
function bacaCsv(teks) {
  const baris = [];
  let sel = "";
  let kutip = false;
  let isi = [];
  for (let i = 0; i < teks.length; i += 1) {
    const c = teks[i];
    if (kutip) {
      if (c === '"') {
        if (teks[i + 1] === '"') {
          sel += '"';
          i += 1;
        } else kutip = false;
      } else sel += c;
      continue;
    }
    if (c === '"') kutip = true;
    else if (c === ",") {
      isi.push(sel);
      sel = "";
    } else if (c === "\n") {
      isi.push(sel);
      baris.push(isi);
      isi = [];
      sel = "";
    } else if (c !== "\r") sel += c;
  }
  if (sel.length || isi.length) {
    isi.push(sel);
    baris.push(isi);
  }
  if (!baris.length) return [];
  const kepala = baris[0];
  return baris
    .slice(1)
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(kepala.map((k, i) => [k, r[i] ?? ""])));
}

async function eksporCsv(tahun) {
  const body = JSON.stringify({
    filters: {
      tahun,
      jenis: [JENIS_INSTANSI],
      instansi: [INSTANSI],
      eselon: [],
      satker: SATKERS,
      sumber: [],
      sumberDana: [],
      metodePengadaan: [],
      statusPaket: [],
    },
    table: {
      searchKode: "",
      searchPaket: "",
      searchPenyedia: "",
      kdPenyedia: "",
      sortBy: "",
      sortDir: "desc",
    },
  });

  const sig = await (
    await minta("/dashboard-api/export/signature", {
      method: "POST",
      body: JSON.stringify({ path: "/dashboard-api/realisasi/export", body }),
    })
  ).json();

  const job = (
    await (
      await minta("/dashboard-api/realisasi/export", {
        method: "POST",
        body,
        extra: sig.headers,
        accept: "text/csv, application/json",
      })
    ).json()
  ).data;

  const sse = await (await minta(job.events_url, { accept: "text/event-stream" })).text();
  let tautan = null;
  for (const baris of sse.split("\n")) {
    const s = baris.trim();
    if (!s.startsWith("data:")) continue;
    try {
      const payload = JSON.parse(s.slice(5).trim());
      if (payload.download_url) tautan = payload.download_url;
    } catch {
      /* abaikan baris non-JSON */
    }
  }
  if (!tautan) throw new Error(`job ${job.job_id} tidak memberi download_url`);

  const csv = await (await fetch(tautan, { headers: { "user-agent": UA } })).text();
  const rows = bacaCsv(csv);
  console.log(`${tahun}: ${rows.length} baris CSV (job ${job.job_id.slice(0, 8)})`);
  return rows;
}

async function tabelSatker(tahun, satker) {
  const dasar = `/dashboard-api/realisasi/table?tahun=${tahun}&instansi=${INSTANSI}&satker=${satker}`;
  const hasil = [];
  let cursor = "";
  for (let halaman = 0; halaman < 1000; halaman += 1) {
    const path = cursor ? `${dasar}&cursor=${encodeURIComponent(cursor)}` : dasar;
    const data = await (await minta(path)).json();
    hasil.push(...(data.tableRows ?? []));
    const pag = data.tablePagination ?? {};
    if (!pag.hasMore || !pag.nextCursor || pag.nextCursor === cursor) break;
    cursor = pag.nextCursor;
    if (halaman % 25 === 0) console.log(`  ${tahun} ${satker.slice(0, 18)}: ${hasil.length}`);
    await tidur(JEDA_MS);
  }
  console.log(`${tahun} ${satker}: ${hasil.length} baris (tabel)`);
  return hasil;
}

/** Samakan bentuk baris CSV maupun tabel ke satu skema internal. */
function normalkan(r) {
  return {
    kode_rup: r.kode_rup || null,
    kode_paket: r.kode_paket,
    tahun_anggaran: Number(r.tahun_anggaran),
    metode_pengadaan: r.metode_pengadaan,
    jenis_pengadaan: r.jenis_pengadaan,
    nama_satuan_kerja: r.nama_satuan_kerja,
    nama_penyedia: r.nama_penyedia || "-",
    total_nilai: Number(r.total_nilai) || 0,
    nilai_pagu: Number(r.nilai_pagu ?? 0) || 0,
    sumber_transaksi: r.sumber_transaksi,
    sumber_dana: r.sumber_dana,
    nama_paket: r.nama_paket,
    status_paket: r.status_paket,
    tahapan_pengadaan: r.tahapan_pengadaan,
  };
}

const rows = [];
for (const tahun of TAHUN) {
  if (MODE === "table") {
    for (const satker of SATKERS.length ? SATKERS : [SATKER_PU]) {
      rows.push(...(await tabelSatker(tahun, satker)).map(normalkan));
    }
  } else {
    rows.push(...(await eksporCsv(tahun)).map(normalkan));
  }
}

// Berkas lama hanya digabung bila penarikan bersifat sebagian (mode tabel / daftar satker).
const berkas = join(AKAR, "data", "realisasi_kota_tangerang.json");
const penuh = MODE === "csv" && SATKERS.length === 0;
let lama = [];
if (!penuh && existsSync(berkas)) {
  try {
    const isi = JSON.parse(readFileSync(berkas, "utf8"));
    lama = (isi.item ?? []).map((r) => ({
      kode_rup: r.kode_rup,
      kode_paket: r.kode_paket,
      tahun_anggaran: r.tahun,
      metode_pengadaan: r.metode,
      jenis_pengadaan: r.jenis,
      nama_satuan_kerja: r.satker,
      nama_penyedia: r.penyedia ?? "-",
      total_nilai: r.nilai ?? 0,
      nilai_pagu: r.pagu ?? 0,
      sumber_transaksi: r.sumber_transaksi,
      sumber_dana: r.sumber_dana,
      nama_paket: r.paket,
      status_paket: r.status,
      tahapan_pengadaan: r.tahapan,
    }));
    console.log(`menggabung ${lama.length} baris dari penarikan sebelumnya`);
  } catch {
    console.warn("berkas sebelumnya tidak bisa dibaca — mulai dari nol");
  }
}

// Satu paket bisa punya banyak pesanan e-purchasing: simpan semua transaksi.
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
  agg.nilai += r.total_nilai;
  if (r.nama_satuan_kerja && !agg.satker.includes(r.nama_satuan_kerja)) {
    agg.satker.push(r.nama_satuan_kerja);
  }
  if (r.nama_penyedia !== "-" && !agg.penyedia.includes(r.nama_penyedia)) {
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
  berkas,
  JSON.stringify(
    {
      snapshot: new Date().toISOString().slice(0, 10),
      sumber: `${BASE}/realisasi — ekspor ${MODE.toUpperCase()} (Data INAPROC)`,
      instansi: INSTANSI,
      mode: MODE,
      satker: penuh ? "SEMUA" : SATKERS.length ? SATKERS : [SATKER_PU],
      jumlah_baris: semuaBaris.length,
      jumlah_rup: perRup.size,
      tanpa_penyedia: semuaBaris.filter((r) => r.nama_penyedia === "-").length,
      per_metode: perMetode,
      per_rup: [...perRup.values()].sort((a, b) => b.nilai - a.nilai),
      item: semuaBaris.map((r) => ({
        kode_rup: r.kode_rup,
        kode_paket: r.kode_paket,
        tahun: r.tahun_anggaran,
        metode: r.metode_pengadaan,
        sumber_transaksi: r.sumber_transaksi,
        satker: r.nama_satuan_kerja,
        paket: r.nama_paket,
        penyedia: r.nama_penyedia === "-" ? null : r.nama_penyedia,
        nilai: r.total_nilai,
      })),
    },
  ),
);

console.log(`total unik ${semuaBaris.length} baris · ${perRup.size} RUP · metode: ${JSON.stringify(perMetode)}`);
console.log("→ data/realisasi_kota_tangerang.json");
