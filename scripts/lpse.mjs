#!/usr/bin/env node
/**
 * Tarik data LPSE (SPSE) Kota Tangerang lalu cocokkan dengan snapshot RUP.
 *
 * Sumber: https://spse.inaproc.id/tangerangkota (SPSE 4.5, pengganti lpse.tangerangkota.go.id)
 *   - Tender      : POST /dt/lelang?tahun=YYYY       (daftar)  + /lelang/<id>/pengumumanlelang
 *                   /evaluasi/<id>/pemenangberkontrak         (pemenang + nilai kontrak)
 *   - Non-tender  : POST /dt/pl?tahun=YYYY           (daftar)  + /nontender/<id>/pengumumanpl
 *                   /evaluasinontender/<id>/pemenangberkontrak
 *
 * Pakai:
 *   node scripts/lpse.mjs list      # daftar paket tender + non-tender (2025, 2026)
 *   node scripts/lpse.mjs detail    # detail + pemenang untuk kandidat yang namanya cocok RUP
 *   node scripts/lpse.mjs match     # cocokkan ke data/saksi_kota_tangerang_2025_2026.json
 *
 * Keluaran: data/lpse/rows.json, data/lpse/details.jsonl,
 *           data/lpse_kota_tangerang_2025_2026.json
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = join(AKAR, "data", "lpse");
const BASE = "https://spse.inaproc.id/tangerangkota";
const UA =
  "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";
const TAHUN = [2025, 2026];
const JEDA_MS = 300;

let kuki = "";

const tidur = (ms) => new Promise((r) => setTimeout(r, ms));

async function minta(url, { method = "GET", body, xhr = false } = {}) {
  const headers = {
    "User-Agent": UA,
    Accept: xhr ? "application/json, text/javascript, */*; q=0.01" : "*/*",
    Referer: `${BASE}/`,
  };
  if (kuki) headers.Cookie = kuki;
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
  if (xhr) headers["X-Requested-With"] = "XMLHttpRequest";

  for (let coba = 0; coba < 4; coba += 1) {
    try {
      const res = await fetch(url, { method, headers, body, redirect: "follow" });
      const set = res.headers.getSetCookie?.() ?? [];
      if (set.length) {
        const baru = set.map((c) => c.split(";")[0]);
        const peta = new Map(kuki.split("; ").filter(Boolean).map((c) => [c.split("=")[0], c]));
        for (const c of baru) peta.set(c.split("=")[0], c);
        kuki = [...peta.values()].join("; ");
      }
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (coba === 3) throw err;
      await tidur(1000 * (coba + 1));
    }
  }
  throw new Error("unreachable");
}

const tokenDari = (html) => /authenticityToken\s*=\s*'([a-f0-9]+)'/.exec(html)?.[1] ?? null;

/** Ambil pasangan label→nilai dari tabel HTML sederhana. */
function bacaTabel(html) {
  const bersih = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  const hasil = new Map();
  for (const baris of bersih.split(/<tr[^>]*>/i)) {
    const th = /<th[^>]*>([\s\S]*?)<\/th>/i.exec(baris);
    const td = [...baris.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => teks(m[1]));
    if (th && td.length) {
      const label = teks(th[1]).toLowerCase();
      if (label && !hasil.has(label)) hasil.set(label, td[0]);
    }
  }
  return hasil;
}

const teks = (s) =>
  String(s ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const rupiah = (s) => {
  const teks = String(s ?? "").trim();
  if (!teks) return null;
  const digit = teks.replace(/[^\d.,]/g, "");
  if (!digit) return null;
  const angka = Number.parseFloat(digit.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(angka)) return null;
  if (/\bjt\b/i.test(teks)) return Math.round(angka * 1e6);
  if (/\bm\b/i.test(teks)) return Math.round(angka * 1e9);
  if (/\brb\b/i.test(teks)) return Math.round(angka * 1e3);
  return Math.round(angka);
};

const norm = (s) =>
  String(s ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function daftar(jenis, tahun) {
  const halaman = jenis === "lelang" ? "/lelang" : "/nontender";
  const html = await minta(BASE + halaman);
  const token = tokenDari(html);
  if (!token) throw new Error(`token tidak ditemukan di ${halaman}`);

  const endpoint = jenis === "lelang" ? "lelang" : "pl";
  const baris = [];
  for (let start = 0; start < 8000; start += 500) {
    const body = new URLSearchParams({
      draw: "1",
      start: String(start),
      length: "500",
      authenticityToken: token,
      "columns[0][data]": "0",
      "columns[1][data]": "1",
    }).toString();
    const teks2 = await minta(`${BASE}/dt/${endpoint}?tahun=${tahun}`, { method: "POST", body, xhr: true });
    let data;
    try {
      data = JSON.parse(teks2).data ?? [];
    } catch {
      throw new Error(`respons bukan JSON untuk ${endpoint}/${tahun}: ${teks2.slice(0, 120)}`);
    }
    baris.push(...data);
    if (data.length < 500) break;
    await tidur(JEDA_MS);
  }
  return baris.map((r) => ({
    jenis,
    tahun,
    id: String(r[0]),
    nama: teks(r[1]),
    instansi: teks(r[2]),
    status: teks(r[3]),
    pagu_teks: teks(r[4]),
    metode: teks(r[5]),
    kategori: teks(r[6]),
  }));
}

async function detailTender(item) {
  const akar = item.jenis === "lelang" ? "/lelang" : "/nontender";
  const hal = item.jenis === "lelang" ? "pengumumanlelang" : "pengumumanpl";
  const evalPath = item.jenis === "lelang" ? "/evaluasi" : "/evaluasinontender";

  const pengumuman = await minta(`${BASE}${akar}/${item.id}/${hal}`);
  const tabel = bacaTabel(pengumuman);
  const kodeRup = /Kode RUP<\/th>[\s\S]{0,400}?<td[^>]*>\s*(\d{6,14})\s*<\/td>/i.exec(pengumuman)?.[1] ?? null;

  await tidur(JEDA_MS);
  const kontrak = await minta(`${BASE}${evalPath}/${item.id}/pemenangberkontrak`);
  const tKontrak = bacaTabel(kontrak);

  // Tabel pemenang: header "Nama Pemenang" lalu satu baris data berisi 7 kolom.
  let pemenang = null;
  let alamat = null;
  let npwp = null;
  let nilaiKontrak = null;
  const barisKontrak = kontrak
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .split(/<tr[^>]*>/i)
    .map((b) => [...b.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => teks(m[1])))
    .filter((sel) => sel.length >= 6);
  const idxHeader = barisKontrak.findIndex((sel) => /nama pemenang/i.test(sel[0] ?? ""));
  if (idxHeader >= 0 && barisKontrak[idxHeader + 1]) {
    const isi = barisKontrak[idxHeader + 1];
    [pemenang, alamat, npwp] = [isi[0] ?? null, isi[1] ?? null, isi[2] ?? null];
    nilaiKontrak = rupiah(isi[3]);
  }
  return {
    ...item,
    kode_rup: kodeRup,
    satker: tabel.get("satuan kerja") ?? null,
    jenis_pengadaan: tabel.get("jenis pengadaan") ?? null,
    pagu: rupiah(tabel.get("pagu") ?? item.pagu_teks) ?? null,
    hps: rupiah(tKontrak.get("hps")) ?? null,
    pemenang,
    alamat,
    npwp,
    nilai_kontrak: nilaiKontrak,
    url: `${BASE}${akar}/${item.id}/${hal}`,
  };
}

function muatSnapshot() {
  const jalur = join(AKAR, "data", "saksi_kota_tangerang_2025_2026.json");
  const data = JSON.parse(readFileSync(jalur, "utf8"));
  return Array.isArray(data) ? data : data.paket ?? [];
}

async function cmdList() {
  mkdirSync(DIR, { recursive: true });
  const semua = [];
  for (const jenis of ["lelang", "nontender"]) {
    for (const tahun of TAHUN) {
      const baris = await daftar(jenis, tahun);
      console.log(`${jenis} ${tahun}: ${baris.length} paket`);
      semua.push(...baris);
      await tidur(JEDA_MS);
    }
  }
  writeFileSync(join(DIR, "rows.json"), JSON.stringify(semua, null, 1));
  console.log(`total ${semua.length} baris → data/lpse/rows.json`);
}

async function cmdDetail() {
  const rows = JSON.parse(readFileSync(join(DIR, "rows.json"), "utf8"));
  const paket = muatSnapshot();
  const namaRup = new Map(paket.map((p) => [norm(p.nama), p]));

  const kandidat = rows.filter((r) => namaRup.has(norm(r.nama)));
  console.log(`kandidat nama cocok RUP: ${kandidat.length} dari ${rows.length}`);

  const jalur = join(DIR, "details.jsonl");
  const sudah = new Set();
  if (existsSync(jalur)) {
    for (const baris of readFileSync(jalur, "utf8").split("\n")) {
      if (!baris.trim()) continue;
      try {
        const d = JSON.parse(baris);
        sudah.add(`${d.jenis}:${d.id}`);
      } catch {
        /* baris rusak diabaikan */
      }
    }
  }
  const sisa = kandidat.filter((r) => !sudah.has(`${r.jenis}:${r.id}`));
  console.log(`sudah diambil ${sudah.size}, sisa ${sisa.length}`);

  let n = 0;
  for (const item of sisa) {
    try {
      const d = await detailTender(item);
      appendFileSync(jalur, `${JSON.stringify(d)}\n`);
      n += 1;
      if (n % 50 === 0) console.log(`  ${n}/${sisa.length} …`);
    } catch (err) {
      console.warn(`  gagal ${item.jenis}:${item.id} — ${err.message}`);
    }
    await tidur(JEDA_MS);
  }
  console.log(`selesai, ${n} detail baru`);
}

function cmdMatch() {
  const rows = JSON.parse(readFileSync(join(DIR, "rows.json"), "utf8"));
  const detail = new Map();
  const jalur = join(DIR, "details.jsonl");
  if (existsSync(jalur)) {
    for (const baris of readFileSync(jalur, "utf8").split("\n")) {
      if (!baris.trim()) continue;
      try {
        const d = JSON.parse(baris);
        detail.set(`${d.jenis}:${d.id}`, d);
      } catch {
        /* abaikan */
      }
    }
  }

  const paket = muatSnapshot();
  const perRup = new Map(paket.map((p) => [String(p.kode_rup), p]));
  // Nama paket tidak unik (mis. "Peningkatan ... Lanjutan" muncul di TA2025 dan TA2026).
  // Cocokkan lewat nama hanya bila kandidatnya tepat satu DAN tahunnya sama; kalau ragu, lewati.
  const perNama = new Map();
  for (const p of paket) {
    const kunci = norm(p.nama);
    const daftar = perNama.get(kunci) ?? [];
    daftar.push(p);
    perNama.set(kunci, daftar);
  }

  const hasil = [];
  for (const r of rows) {
    const d = detail.get(`${r.jenis}:${r.id}`);
    const viaRup = d?.kode_rup ? perRup.get(String(d.kode_rup)) : null;
    const kandidat = perNama.get(norm(r.nama)) ?? [];
    const viaNama =
      kandidat.length === 1 && String(kandidat[0].tahun) === String(r.tahun) ? kandidat[0] : null;
    const target = viaRup ?? viaNama;
    if (!target) continue;
    hasil.push({
      kode_rup: target.kode_rup,
      nama_rup: target.nama,
      pagu_rup: target.pagu,
      kelurahan: target.desa_resmi,
      rw: target.rw,
      jenis_lpse: r.jenis,
      id_lpse: r.id,
      nama_lpse: r.nama,
      status: r.status,
      metode: d?.jenis_pengadaan ?? r.metode,
      satker: d?.satker ?? null,
      pagu_lpse: d?.pagu ?? null,
      hps: d?.hps ?? null,
      pemenang: d?.pemenang ?? null,
      npwp: d?.npwp ?? null,
      nilai_kontrak: d?.nilai_kontrak ?? null,
      tahun: r.tahun,
      via: viaRup ? "kode_rup" : "nama",
      url: d?.url ?? null,
    });
  }

  // Satu paket RUP bisa muncul di beberapa pencatatan (mis. PL + tender) — ambil yang paling kuat.
  const perKode = new Map();
  for (const h of hasil) {
    const k = String(h.kode_rup);
    const lama = perKode.get(k);
    if (!lama) {
      perKode.set(k, h);
      continue;
    }
    const skor = (x) => (x.via === "kode_rup" ? 2 : 0) + (x.nilai_kontrak ? 1 : 0);
    if (skor(h) > skor(lama)) perKode.set(k, h);
  }
  const unik = [...perKode.values()];

  const tercocok = new Set(unik.map((h) => String(h.kode_rup)));
  const belum = paket.filter((p) => !tercocok.has(String(p.kode_rup)));
  const paguTotal = paket.reduce((n, p) => n + p.pagu, 0);
  const paguCocok = paket.filter((p) => tercocok.has(String(p.kode_rup))).reduce((n, p) => n + p.pagu, 0);
  const denganPemenang = unik.filter((h) => h.pemenang);
  const nilai = denganPemenang.reduce((n, h) => n + (h.nilai_kontrak ?? 0), 0);
  const viaKode = unik.filter((h) => h.via === "kode_rup").length;

  const penyedia = new Map();
  for (const h of denganPemenang) {
    const k = h.pemenang.toUpperCase();
    const v = penyedia.get(k) ?? { nama: h.pemenang, paket: 0, nilai: 0 };
    v.paket += 1;
    v.nilai += h.nilai_kontrak ?? 0;
    penyedia.set(k, v);
  }

  const tanpaKontrak = new Map();
  for (const p of belum) tanpaKontrak.set(p.metode, (tanpaKontrak.get(p.metode) ?? 0) + 1);
  const rasio = denganPemenang
    .filter((h) => h.pagu_rup && h.nilai_kontrak)
    .map((h) => h.nilai_kontrak / h.pagu_rup)
    .sort((a, b) => a - b);
  const median = rasio.length ? rasio[Math.floor(rasio.length / 2)] : null;

  writeFileSync(
    join(AKAR, "data", "lpse_kota_tangerang_2025_2026.json"),
    JSON.stringify(
      {
        snapshot: "2 Nov 2026",
        sumber: `${BASE} (SPSE 4.5)`,
        paket_rup: paket.length,
        paket_tercocok: tercocok.size,
        persen_tercocok: Number(((tercocok.size / paket.length) * 100).toFixed(1)),
        pagu_rup_total: paguTotal,
        pagu_tercocok: paguCocok,
        pagu_belum_tercocok: paguTotal - paguCocok,
        metode_belum_tercocok: Object.fromEntries([...tanpaKontrak.entries()].sort((a, b) => b[1] - a[1])),
        baris_lpse: rows.length,
        detail_lpse: detail.size,
        dengan_pemenang: denganPemenang.length,
        via_kode_rup: viaKode,
        via_nama: unik.length - viaKode,
        nilai_kontrak_total: nilai,
        rasio_kontrak_pagu_median: median,
        penyedia_teratas: [...penyedia.values()].sort((a, b) => b.nilai - a.nilai).slice(0, 25),
        item: unik.sort((a, b) => (b.nilai_kontrak ?? 0) - (a.nilai_kontrak ?? 0)),
      },
      null,
      1,
    ),
  );

  console.log(`RUP tercocok        : ${tercocok.size} dari ${paket.length} (${((tercocok.size / paket.length) * 100).toFixed(1)}%)`);
  console.log(`pagu tercocok       : Rp${(paguCocok / 1e9).toFixed(2)} M dari Rp${(paguTotal / 1e9).toFixed(2)} M`);
  console.log(`belum tercocok      : ${belum.length} paket · Rp${((paguTotal - paguCocok) / 1e9).toFixed(2)} M`);
  console.log(`  menurut metode    : ${[...tanpaKontrak.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  console.log(`cocok via kode RUP  : ${viaKode} · via nama: ${unik.length - viaKode}`);
  console.log(`punya pemenang      : ${denganPemenang.length}`);
  console.log(`nilai kontrak total : Rp${(nilai / 1e9).toFixed(2)} M · rasio median kontrak/pagu ${median?.toFixed(2) ?? "-"}`);
  console.log("penyedia teratas (nilai):");
  for (const p of [...penyedia.values()].sort((a, b) => b.nilai - a.nilai).slice(0, 5)) {
    console.log(`  ${p.nama} — ${p.paket} paket · Rp${(p.nilai / 1e9).toFixed(2)} M`);
  }
  console.log("→ data/lpse_kota_tangerang_2025_2026.json");
}

const cmd = process.argv[2] ?? "list";
mkdirSync(DIR, { recursive: true });
if (cmd === "list") await cmdList();
else if (cmd === "detail") await cmdDetail();
else if (cmd === "match") cmdMatch();
else {
  console.log("pakai: node scripts/lpse.mjs [list|detail|match]");
  process.exit(1);
}
