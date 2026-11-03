#!/usr/bin/env node
/**
 * Tarik **Data INAPROC — RUP** (data.inaproc.id/rup) untuk Kota Tangerang.
 *
 * Pengganti `sirup.inaproc.id`: SIRUP kini login-gated dan datatable publiknya hanya 8 kolom
 * (tanpa penyedia). Dashboard RUP di data.inaproc.id memakai alur ekspor CSV yang sama dengan
 * realisasi, jadi cukup 4 request per tahun untuk seluruh instansi.
 *
 *  1. POST /dashboard-api/export/signature  {"path": ".../rup/export", "body": "<json filter>"}
 *       → {time, nonce, signature, headers:{x-auth-*}}
 *  2. POST /dashboard-api/rup/export        body json + header x-auth-* → {job_id, events_url}
 *  3. GET  /dashboard-api/export/<id>/events (text/event-stream) → data: {"download_url": ...}
 *  4. GET  <download_url>                    URL GCS bertanda tangan; TANPA header API.
 *
 * Filter wajib: tahun + jenis ("5" = pemerintah daerah) + instansi ("D44").
 * Anti-bot: x-request-time (epoch ms) + x-secret = base64(timestamp dibalik).
 *
 * Pakai: node scripts/rup.mjs [--tahun 2025,2026]
 * Keluaran: data/rup_kota_tangerang_2025_2026.json
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = "https://data.inaproc.id";
const INSTANSI = "D44";
const JENIS_INSTANSI = "5";
const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";

const argv = process.argv.slice(2);
const arg = (nama, bawaan) => {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};
const TAHUN = arg("tahun", "2025,2026").split(",").map(Number);
const DETAIL = argv.includes("--detail");
const JEDA_MS = 250;

function header(extra = {}) {
  const t = Date.now().toString();
  return {
    accept: "*/*",
    "content-type": "application/json",
    origin: BASE,
    referer: `${BASE}/rup`,
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
      await new Promise((r) => setTimeout(r, 800 * (coba + 1)));
    }
  }
  throw new Error("unreachable");
}

/** Parser CSV RFC-4180 secukupnya. */
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

async function eksporRup(tahun) {
  const body = JSON.stringify({
    filters: {
      tahun: String(tahun),
      jenis: [JENIS_INSTANSI],
      instansi: [INSTANSI],
      eselon: [],
      satker: [],
      sumber: "",
      sumberDana: [],
      filterMetode: "",
      filterJenis: "",
      filterPdn: "Semua",
    },
    table: {
      viewTable: "Anggaran",
      searchRup: "",
      searchPaket: "",
      searchQ: "",
      sortBy: "",
      sortDir: "desc",
    },
  });

  const sig = await (
    await minta("/dashboard-api/export/signature", {
      method: "POST",
      body: JSON.stringify({ path: "/dashboard-api/rup/export", body }),
    })
  ).json();

  const job = (
    await (
      await minta("/dashboard-api/rup/export", {
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
      /* abaikan */
    }
  }
  if (!tautan) throw new Error(`job ${job.job_id} tidak memberi download_url`);

  const csv = await (await fetch(tautan, { headers: { "user-agent": UA } })).text();
  const rows = bacaCsv(csv);
  console.log(`${tahun}: ${rows.length} baris RUP (job ${job.job_id.slice(0, 8)})`);
  return rows;
}

async function tarikDetail() {
  const jalurSnapshot = join(AKAR, "data", "saksi_kota_tangerang_2025_2026.json");
  if (!existsSync(jalurSnapshot)) throw new Error("snapshot paket tidak ada — jalankan mode daftar dulu");
  const paket = JSON.parse(readFileSync(jalurSnapshot, "utf8")).paket ?? [];
  const hasil = [];

  for (let i = 0; i < paket.length; i += 1) {
    const p = paket[i];
    let d = null;
    try {
      d = await (await minta(`/dashboard-api/rup/detail?kode=${p.kode_rup}&kind=Penyedia`)).json();
    } catch (err) {
      console.warn(`  gagal ${p.kode_rup}: ${err.message}`);
    }
    const main = d?.main ?? {};
    const lokasi = (d?.lokasi ?? []).map((l) => l?.detail_lokasi).filter(Boolean);
    hasil.push({
      kode_rup: String(p.kode_rup),
      tahun: p.tahun,
      satker: main.satuan_kerja ?? null,
      jadwal_pemilihan_mulai: main.jadwal_pemilihan_penyedia_mulai ?? null,
      jadwal_pemilihan_akhir: main.jadwal_pemilihan_penyedia_akhir ?? null,
      jadwal_kontrak_mulai: main.jadwal_pelaksanaan_kontrak_mulai ?? null,
      jadwal_kontrak_akhir: main.jadwal_pelaksanaan_kontrak_akhir ?? null,
      lokasi_raw: lokasi,
      uraian: main.uraian_pekerjaan ?? null,
      volume: main.volume_pekerjaan ?? null,
      spesifikasi: main.spesifikasi_pekerjaan ?? null,
      mak: d?.sumberDana?.[0]?.mak ?? null,
    });
    if (i % 100 === 0) console.log(`  ${i}/${paket.length}`);
    await new Promise((r) => setTimeout(r, JEDA_MS));
  }

  const adaJadwal = hasil.filter((h) => h.jadwal_pemilihan_mulai).length;
  const adaLokasi = hasil.filter((h) => h.lokasi_raw.length > 0).length;
  writeFileSync(
    join(AKAR, "data", "rup_detail_kota_tangerang.json"),
    JSON.stringify(
      {
        snapshot: new Date().toISOString().slice(0, 10),
        sumber: `${BASE}/dashboard-api/rup/detail`,
        jumlah: hasil.length,
        punya_jadwal: adaJadwal,
        punya_lokasi: adaLokasi,
        item: hasil,
      },
      null,
      1,
    ),
  );
  console.log(`${hasil.length} paket · jadwal ${adaJadwal} · lokasi ${adaLokasi}`);
  console.log("→ data/rup_detail_kota_tangerang.json");
}

if (DETAIL) {
  await tarikDetail();
  process.exit(0);
}

const item = [];
for (const tahun of TAHUN) {
  for (const r of await eksporRup(tahun)) {
    item.push({
      kode_rup: r.kode_rup,
      tahun: Number(r.tahun_anggaran),
      satker: r.nama_satuan_kerja,
      instansi: r.nama_instansi,
      paket: r.nama_paket,
      cara: r.cara_pengadaan,
      metode: r.metode_pengadaan,
      jenis: r.jenis_pengadaan,
      sumber_dana: r.sumber_dana,
      total_nilai: Number(r.total_nilai) || 0,
      pdn: r.produk_dalam_negeri,
      umk: r.status_umk,
    });
  }
}

const per = (kunci) => {
  const map = {};
  for (const r of item) map[r[kunci] || "-"] = (map[r[kunci] || "-"] ?? 0) + 1;
  return map;
};

// Cek cakupan terhadap snapshot jalan yang dipakai produk (kalau ada).
let cakupan = null;
const jalurSnapshot = join(AKAR, "data", "saksi_kota_tangerang_2025_2026.json");
if (existsSync(jalurSnapshot)) {
  const snapshot = JSON.parse(readFileSync(jalurSnapshot, "utf8")).paket ?? [];
  const ada = new Set(item.map((r) => String(r.kode_rup)));
  const hilang = snapshot.filter((p) => !ada.has(String(p.kode_rup)));
  cakupan = {
    paket_snapshot: snapshot.length,
    ada_di_rup: snapshot.length - hilang.length,
    tidak_ada: hilang.length,
    contoh_tidak_ada: hilang.slice(0, 5).map((p) => ({ kode_rup: p.kode_rup, tahun: p.tahun, nama: p.nama })),
  };
  console.log(`cakupan snapshot: ${cakupan.ada_di_rup}/${cakupan.paket_snapshot} paket ada di ekspor RUP`);
}

mkdirSync(join(AKAR, "data"), { recursive: true });
writeFileSync(
  join(AKAR, "data", "rup_kota_tangerang_2025_2026.json"),
  JSON.stringify(
    {
      snapshot: new Date().toISOString().slice(0, 10),
      sumber: `${BASE}/rup — ekspor CSV (Data INAPROC)`,
      instansi: INSTANSI,
      jumlah_baris: item.length,
      jumlah_rup: new Set(item.map((r) => r.kode_rup)).size,
      per_jenis: per("jenis"),
      per_cara: per("cara"),
      per_metode: per("metode"),
      per_tahun: per("tahun"),
      total_nilai: item.reduce((n, r) => n + r.total_nilai, 0),
      cakupan_snapshot: cakupan,
      item,
    },
  ),
);

console.log(`total ${item.length} RUP · Rp${(item.reduce((n, r) => n + r.total_nilai, 0) / 1e9).toFixed(2)} M`);
console.log("→ data/rup_kota_tangerang_2025_2026.json");
