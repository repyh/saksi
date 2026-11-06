// Tambal detail RUP yang belum ada di data/rup_detail_kota_tangerang.json
// (dipakai setelah sumber RUP pindah ke data.inaproc.id: paket baru belum punya jadwal).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const AKAR = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = "https://data.inaproc.id";
const UA = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";
const JEDA_MS = 250;

function header() {
  const t = Date.now().toString();
  return {
    accept: "*/*",
    "content-type": "application/json",
    origin: BASE,
    referer: `${BASE}/rup`,
    "user-agent": UA,
    "x-request-time": t,
    "x-secret": Buffer.from(t.split("").reverse().join("")).toString("base64"),
  };
}

async function minta(path) {
  const res = await fetch(`${BASE}${path}`, { headers: header(), signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const snapshot = JSON.parse(readFileSync(join(AKAR, "data", "saksi_kota_tangerang_2025_2026.json"), "utf8"));
const berkasDetail = join(AKAR, "data", "rup_detail_kota_tangerang.json");
const detail = JSON.parse(readFileSync(berkasDetail, "utf8"));
const sudah = new Set(detail.item.map((d) => String(d.kode_rup)));
const kurang = snapshot.paket.filter((p) => !sudah.has(String(p.kode_rup)));

console.log(`detail tersimpan: ${detail.item.length} · perlu ditambal: ${kurang.length}`);

for (const p of kurang) {
  try {
    const d = await minta(`/dashboard-api/rup/detail?kode=${p.kode_rup}&kind=Penyedia`);
    const main = d?.main ?? {};
    detail.item.push({
      kode_rup: String(p.kode_rup),
      tahun: p.tahun,
      satker: main.satuan_kerja ?? null,
      jadwal_pemilihan_mulai: main.jadwal_pemilihan_penyedia_mulai ?? null,
      jadwal_pemilihan_akhir: main.jadwal_pemilihan_penyedia_akhir ?? null,
      jadwal_kontrak_mulai: main.jadwal_pelaksanaan_kontrak_mulai ?? null,
      jadwal_kontrak_akhir: main.jadwal_pelaksanaan_kontrak_akhir ?? null,
      lokasi_raw: (d?.lokasi ?? []).map((l) => l?.detail_lokasi).filter(Boolean),
      uraian: main.uraian_pekerjaan ?? null,
      volume: main.volume_pekerjaan ?? null,
      spesifikasi: main.spesifikasi_pekerjaan ?? null,
      mak: d?.sumberDana?.[0]?.mak ?? null,
    });
  } catch (err) {
    console.warn(`  gagal ${p.kode_rup}: ${err.message}`);
  }
  await new Promise((r) => setTimeout(r, JEDA_MS));
}

detail.item.sort((a, b) => String(a.kode_rup).localeCompare(String(b.kode_rup)));
detail.jumlah = detail.item.length;
detail.punya_jadwal = detail.item.filter((d) => d.jadwal_pemilihan_mulai).length;
detail.punya_lokasi = detail.item.filter((d) => (d.lokasi_raw ?? []).length > 0).length;
writeFileSync(berkasDetail, JSON.stringify(detail));
console.log(`detail sekarang: ${detail.item.length} · punya jadwal: ${detail.punya_jadwal}`);
