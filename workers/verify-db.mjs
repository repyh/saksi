#!/usr/bin/env node
// Rekonsiliasi database ingestion dengan manifest region dan angka sumber.
// Pemakaian: node workers/verify-db.mjs [--region <id>] [--json]
// Keluar 1 bila ada satu pun angka yang tidak cocok/duplikat.
import { readFileSync } from "node:fs";
import path from "node:path";
import { AKAR } from "../scripts/lib/region.mjs";
import { sha256 } from "./lib/util.mjs";

if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  for (const berkas of [".env.local", ".env"]) {
    const jalur = path.resolve(AKAR, berkas);
    try {
      process.loadEnvFile(jalur);
      break;
    } catch {
      // lanjut
    }
  }
}

const argv = process.argv.slice(2);
const arg = (nama, bawaan = null) => {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};
const REGION_ID = arg("region", "kota-tangerang");
const JSON_ONLY = argv.includes("--json");

const manifestPath = path.resolve(AKAR, "data", "regions", REGION_ID, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const m = manifest.metrik;

const { default: pg } = await import("pg");
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL/DIRECT_URL tidak diisi");
  process.exit(1);
}
const client = new pg.Client({
  connectionString,
  ssl: /supabase|pooler|sslmode=require/i.test(connectionString)
    ? { rejectUnauthorized: false }
    : undefined,
});
await client.connect();

const q = async (sql, params = []) => (await client.query(sql, params)).rows;
const satu = async (sql, params = []) => Number((await q(sql, params))[0]?.n ?? 0);

const hasil = [];
const cek = (nama, harap, aktual) => {
  const cocok = String(harap) === String(aktual);
  hasil.push({ nama, harap, aktual, cocok });
  return cocok;
};
const catat = (nama, aktual) => hasil.push({ nama, harap: "info", aktual, cocok: true });

// ---- Paket jalan ----
const road = (
  await q(
    `SELECT count(*)::int AS n, COALESCE(sum(budget),0)::text AS pagu,
       count(*) FILTER (WHERE location_precision='RW')::int AS rw,
       count(*) FILTER (WHERE location_precision='KELURAHAN')::int AS kelurahan,
       count(*) FILTER (WHERE location_precision='KECAMATAN')::int AS kecamatan,
       count(*) FILTER (WHERE location_precision='KABUPATEN')::int AS kabupaten,
       count(DISTINCT official_village)::int AS desa,
       count(DISTINCT official_district)::int AS kec,
       count(DISTINCT (official_village, rw_code)) FILTER (WHERE location_precision='RW')::int AS rw_unit
     FROM road_packages WHERE region_id=$1`,
    [REGION_ID],
  )
)[0];

cek("paket", m.paket, road.n);
cek("pagu", String(m.pagu), road.pagu);
cek("presisi RW", m.presisi.RW, road.rw);
cek("presisi kelurahan", m.presisi.Kelurahan, road.kelurahan);
cek("presisi kecamatan", m.presisi.Kecamatan, road.kecamatan);
cek("presisi kabupaten", m.presisi.Kabupaten, road.kabupaten);
// 2.208 = 2.552 - 344, bukan angka terpisah di manifest.
cek("berlokus", m.berlokus, road.n - road.kabupaten);
cek("kelurahan tersentuh", m.kelurahan_tersentuh, road.desa);
cek("unit RW tersentuh", m.unit_lingkungan_tersentuh, road.rw_unit);
cek("kecamatan tersentuh", m.kecamatan_tersentuh, road.kec);

// ---- Katalog RUP, detail, kontrak ----
const detailSource = JSON.parse(
  readFileSync(path.resolve(AKAR, JSON.parse(readFileSync(path.resolve(AKAR, "data", "regions", REGION_ID, "region.json"), "utf8")).sumber.detail), "utf8"),
).item;
const rupSource = JSON.parse(
  readFileSync(path.resolve(AKAR, JSON.parse(readFileSync(path.resolve(AKAR, "data", "regions", REGION_ID, "region.json"), "utf8")).sumber.rup), "utf8"),
).item;
const rupSourceKode = new Set(rupSource.map((x) => String(x.kode_rup)));
const detailCocok = detailSource.filter((d) => rupSourceKode.has(String(d.kode_rup))).length;

cek("katalog RUP", m.sumber.rup, await satu("SELECT count(*) AS n FROM rup_packages WHERE region_id=$1", [REGION_ID]));
cek("detail RUP (DB)", detailCocok, await satu("SELECT count(*) AS n FROM rup_details WHERE region_id=$1", [REGION_ID]));
cek("kontrak LPSE", m.sumber.lpse, await satu("SELECT count(*) AS n FROM lpse_contracts WHERE region_id=$1", [REGION_ID]));
cek("LPSE dengan pemenang", m.penyedia.lpse, await satu(
  `SELECT count(DISTINCT road_package_id) AS n FROM lpse_contracts
   WHERE region_id=$1 AND pemenang_name IS NOT NULL AND road_package_id IS NOT NULL`,
  [REGION_ID],
));

// ---- Realisasi ----
cek("baris realisasi", m.sumber.realisasi, await satu("SELECT count(*) AS n FROM realization_transactions WHERE region_id=$1", [REGION_ID]));
catat("paket realisasi", await satu("SELECT count(*) AS n FROM realization_packages WHERE region_id=$1", [REGION_ID]));
cek(
  "paket realisasi (dari transaksi)",
  await satu(
    `SELECT count(*) AS n FROM (
       SELECT DISTINCT kode_paket, tahun FROM realization_transactions WHERE region_id=$1
     ) x`,
    [REGION_ID],
  ),
  await satu("SELECT count(*) AS n FROM realization_packages WHERE region_id=$1", [REGION_ID]),
);

const penyedia = (
  await q(
    `WITH lpse AS (
       SELECT DISTINCT rp.id AS road_id, lc.vendor_id
       FROM road_packages rp
       JOIN lpse_contracts lc ON lc.road_package_id = rp.id AND lc.pemenang_name IS NOT NULL
       WHERE rp.region_id=$1
     ), realisasi AS (
       SELECT DISTINCT rp.id AS road_id, rt.vendor_id
       FROM road_packages rp
       JOIN realization_transactions rt
         ON rt.kode_rup = rp.rup AND rt.region_id = rp.region_id AND rt.vendor_id IS NOT NULL
       WHERE rp.region_id=$1
         AND NOT EXISTS (
           SELECT 1 FROM lpse_contracts lc
           WHERE lc.road_package_id = rp.id AND lc.pemenang_name IS NOT NULL
         )
     )
     SELECT
       (SELECT count(DISTINCT road_id) FROM lpse)::int AS lpse,
       (SELECT count(DISTINCT road_id) FROM realisasi)::int AS realisasi,
       (SELECT count(DISTINCT vendor_id) FROM (
          SELECT vendor_id FROM lpse UNION SELECT vendor_id FROM realisasi
        ) v)::int AS unik,
       (SELECT COALESCE(sum(rp.budget),0)::text FROM road_packages rp
        WHERE rp.region_id=$1
          AND NOT EXISTS (SELECT 1 FROM lpse_contracts lc WHERE lc.road_package_id=rp.id AND lc.pemenang_name IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM realization_transactions rt
                          WHERE rt.kode_rup=rp.rup AND rt.region_id=rp.region_id AND rt.vendor_id IS NOT NULL)
       ) AS tanpa_pagu`,
    [REGION_ID],
  )
)[0];
cek("penyedia LPSE", m.penyedia.lpse, penyedia.lpse);
cek("penyedia realisasi", m.penyedia.realisasi, penyedia.realisasi);
cek("tanpa rekam", m.penyedia.tanpa_rekam, road.n - penyedia.lpse - penyedia.realisasi);
cek("tanpa rekam pagu", String(m.penyedia.tanpa_rekam_pagu), penyedia.tanpa_pagu);
cek("penyedia unik", m.penyedia.unik, penyedia.unik);

// ---- Batas administrasi ----
for (const [level, harap] of [
  ["RW", m.sumber.batas_rw],
  ["KELURAHAN", m.sumber.batas_kelurahan],
  ["KECAMATAN", m.sumber.batas_kecamatan],
]) {
  cek(`batas ${level}`, harap, await satu(
    "SELECT count(*) AS n FROM administrative_areas WHERE region_id=$1 AND level=$2::\"AdministrativeAreaLevel\"",
    [REGION_ID, level],
  ));
}
cek("link area paket", m.berlokus, await satu(
  `SELECT count(DISTINCT road_package_id) AS n FROM road_package_area_links l
   JOIN road_packages rp ON rp.id=l.road_package_id WHERE rp.region_id=$1`,
  [REGION_ID],
));

// ---- Layer jaringan jalan ----
const regionConfig = JSON.parse(readFileSync(path.resolve(AKAR, "data", "regions", REGION_ID, "region.json"), "utf8"));
if (regionConfig.jalan) {
  const berkasJalan = path.resolve(AKAR, regionConfig.jalan.berkas);
  const checksumLayer = sha256(readFileSync(berkasJalan));
  cek("segmen jalan aktif", m.jalan?.fitur ?? 0, await satu(
    "SELECT count(*) AS n FROM road_segments WHERE region_id=$1 AND is_active",
    [REGION_ID],
  ));
  if (m.jalan?.bernama != null) {
    cek("segmen jalan bernama", m.jalan.bernama, await satu(
      "SELECT count(*) AS n FROM road_segments WHERE region_id=$1 AND is_active AND name IS NOT NULL",
      [REGION_ID],
    ));
  }
  cek("checksum layer jalan", manifest.berkas?.[regionConfig.jalan.berkas]?.sha256 ?? checksumLayer, checksumLayer);
  catat("segmen jalan tersimpan", await satu(
    "SELECT count(*) AS n FROM road_segments WHERE region_id=$1",
    [REGION_ID],
  ));
  const rilisJalan = await q(
    "SELECT DISTINCT source_release, license FROM road_segments WHERE region_id=$1 AND is_active LIMIT 1",
    [REGION_ID],
  );
  catat("rilis/lisensi jalan", rilisJalan[0] ? `${rilisJalan[0].source_release} · ${rilisJalan[0].license}` : "tidak ada");
}

// ---- Provenance mentah ----
const raw = (
  await q(
    `WITH r AS (
       SELECT rr.source_kind, count(*)::int AS n
       FROM raw_records rr JOIN source_artifacts a ON a.id=rr.artifact_id
       WHERE a.region_id=$1 GROUP BY rr.source_kind
     ), a AS (
       SELECT ds.kind AS source_kind, COALESCE(sum(a.record_count),0)::int AS tercatat
       FROM source_artifacts a JOIN data_sources ds ON ds.id=a.source_id
       WHERE a.region_id=$1 GROUP BY ds.kind
     )
     SELECT r.source_kind, r.n, a.tercatat FROM r JOIN a USING (source_kind) ORDER BY r.source_kind`,
    [REGION_ID],
  )
);
const rawTotal = raw.reduce((n, x) => n + x.n, 0);
for (const x of raw) cek(`raw ${x.source_kind}`, x.tercatat, x.n);
catat("artefak sumber", await satu("SELECT count(*) AS n FROM source_artifacts WHERE region_id=$1", [REGION_ID]));
if (!JSON_ONLY) console.log(`raw records total: ${rawTotal}`);

// ---- Duplikat kunci natural ----
const duplikat = [
  ["road_packages", "SELECT count(*) AS n FROM road_packages WHERE region_id=$1", "SELECT count(*) AS n FROM (SELECT rup FROM road_packages WHERE region_id=$1 GROUP BY rup HAVING count(*)>1) x"],
  ["rup_packages", "SELECT count(*) AS n FROM rup_packages WHERE region_id=$1", "SELECT count(*) AS n FROM (SELECT kode_rup FROM rup_packages WHERE region_id=$1 GROUP BY kode_rup HAVING count(*)>1) x"],
  ["lpse_contracts", "SELECT count(*) AS n FROM lpse_contracts WHERE region_id=$1", "SELECT count(*) AS n FROM (SELECT lpse_id FROM lpse_contracts WHERE region_id=$1 GROUP BY lpse_id HAVING count(*)>1) x"],
  ["administrative_areas", "SELECT count(*) AS n FROM administrative_areas WHERE region_id=$1", "SELECT count(*) AS n FROM (SELECT stable_key FROM administrative_areas WHERE region_id=$1 GROUP BY stable_key HAVING count(*)>1) x"],
  ["realization_transactions", "SELECT count(*) AS n FROM realization_transactions WHERE region_id=$1", "SELECT count(*) AS n FROM (SELECT checksum_sha256 FROM realization_transactions WHERE region_id=$1 GROUP BY checksum_sha256 HAVING count(*)>1) x"],
  ["raw_records", "SELECT count(*) AS n FROM raw_records r JOIN source_artifacts a ON a.id=r.artifact_id WHERE a.region_id=$1", "SELECT count(*) AS n FROM (SELECT artifact_id,row_index FROM raw_records r JOIN source_artifacts a ON a.id=r.artifact_id WHERE a.region_id=$1 GROUP BY 1,2 HAVING count(*)>1) x"],
];
for (const [nama, semua, ganda] of duplikat) {
  const total = await satu(semua, [REGION_ID]);
  const dup = await satu(ganda, [REGION_ID]);
  cek(`duplikat ${nama}`, 0, dup);
  if (!JSON_ONLY) console.log(`${nama}: ${total} baris`);
}

// ---- Riwayat run, lock, manifest ----
const runs = await q(
  `SELECT status, count(*)::int AS n FROM ingestion_runs WHERE region_id=$1 GROUP BY status ORDER BY status`,
  [REGION_ID],
);
const sukses = runs.find((x) => x.status === "SUCCEEDED")?.n ?? 0;
hasil.push({ nama: "run sukses", harap: ">=1", aktual: sukses, cocok: sukses >= 1 });
cek("lock tersisa", 0, await satu("SELECT count(*) AS n FROM ingestion_locks WHERE region_id=$1", [REGION_ID]));
const manifestDb = (
  await q(
    `SELECT snapshot_checksum, gate_passed FROM region_manifests WHERE region_id=$1 ORDER BY generated_at DESC LIMIT 1`,
    [REGION_ID],
  )
)[0];
const fileSnapshot = readFileSync(path.resolve(AKAR, regionKeluaran()));
function regionKeluaran() {
  const cfg = JSON.parse(readFileSync(path.resolve(AKAR, "data", "regions", REGION_ID, "region.json"), "utf8"));
  return cfg.keluaran;
}
cek("manifest DB gate", true, manifestDb?.gate_passed ?? false);
cek("checksum snapshot DB", sha256(fileSnapshot), manifestDb?.snapshot_checksum ?? "tidak ada");

await client.end();

const gagal = hasil.filter((x) => !x.cocok);
if (JSON_ONLY) {
  console.log(JSON.stringify({ region: REGION_ID, lulus: gagal.length === 0, hasil, runs }, null, 2));
} else {
  const lebar = Math.max(...hasil.map((x) => x.nama.length));
  console.log(`\n${"metrik".padEnd(lebar)}  harap        aktual       status`);
  for (const x of hasil) {
    const harap = String(x.harap ?? "-");
    const aktual = String(x.aktual ?? "-");
    console.log(`${x.nama.padEnd(lebar)}  ${harap.padEnd(12)} ${aktual.padEnd(12)} ${x.cocok ? "OK" : "GAGAL"}`);
  }
  console.log(`\nriwayat run: ${JSON.stringify(runs)}`);
  console.log(gagal.length ? `GAGAL: ${gagal.length} metrik tidak cocok` : "LULUS: semua metrik cocok");
}
process.exitCode = gagal.length ? 1 : 0;
