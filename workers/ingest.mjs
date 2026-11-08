#!/usr/bin/env node
// Worker ingestion SAKSI — satu region, satu pipeline.
// RUP -> detail -> realisasi -> LPSE -> normalisasi -> validasi -> upsert DB -> snapshot -> region:check.
// Pemakaian: node workers/ingest.mjs [--region <id>] [--dry-run] [--sources rup,detail,...]
//            [--refresh] [--trigger manual|cron] [--simulate-failure <stage>] [--log-level info]
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { AKAR, muatRegion } from "../scripts/lib/region.mjs";
import { serialisasiSnapshot } from "../scripts/lib/snapshot.mjs";
import {
  ambilIdMap,
  ambilLock,
  buatRun,
  bukaDb,
  catatStep,
  gagalkanRun,
  heartbeatLock,
  infoLock,
  lepasLock,
  lewatiRun,
  selesaikanRun,
  simpanArea,
  simpanArtifact,
  simpanDataSource,
  simpanManifest,
  simpanRawRecords,
  simpanRegion,
  tautkanArtifact,
  transaksi,
  upsertBanyak,
} from "./lib/db.mjs";
import { buatLog } from "./lib/log.mjs";
import { normalisasi } from "./lib/normalize.mjs";
import { bacaSumber, daftarSumber } from "./lib/sources.mjs";
import { checksumJson, denganRetry, rupiah, sha256, tidur } from "./lib/util.mjs";
import { bacaManifest, validasi } from "./lib/validate.mjs";

const GRUP = ["rup", "detail", "realisasi", "lpse", "boundaries"];

// Deployment cron memberi env langsung; pengembangan memakai .env.local (tanpa menimpa env host).
if (!process.env.DATABASE_URL && !process.env.DIRECT_URL) {
  for (const berkas of [".env.local", ".env"]) {
    const jalur = path.resolve(AKAR, berkas);
    if (existsSync(jalur)) {
      process.loadEnvFile(jalur);
      break;
    }
  }
}

const argv = process.argv.slice(2);
const arg = (nama, bawaan = null) => {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : bawaan;
};
const adaFlag = (nama) => argv.includes(`--${nama}`);

if (adaFlag("help") || argv.includes("-h")) {
  console.log(`pakai: node workers/ingest.mjs [opsi]
  --region <id>              region dari data/regions (bawaan kota-tangerang)
  --dry-run                  parse + normalisasi + validasi + gate, tanpa tulis DB/berkas
  --sources <daftar>         rup,detail,realisasi,lpse,boundaries (bawaan semua)
  --refresh                  jalankan penarik sumber sebelum impor
  --trigger <manual|cron>    label riwayat run (bawaan manual)
  --simulate-failure <stage> fetch|normalize|validate|before-commit|after-commit|snapshot
  --lock-ttl-minutes <n>     masa lock (bawaan 120)
  --log-level <level>        debug|info|warn|error`);
  process.exit(0);
}

const REGION_ID = arg("region", "kota-tangerang");
const DRY = adaFlag("dry-run");
const REFRESH = adaFlag("refresh");
const TRIGGER = (arg("trigger", "manual") ?? "manual").toUpperCase();
if (!["MANUAL", "CRON", "BACKFILL"].includes(TRIGGER)) {
  console.error("trigger harus manual, cron, atau backfill");
  process.exit(2);
}
const SIMULASI = arg("simulate-failure", null);
const LOG_LEVEL = arg("log-level", "info");
const TTL_MS = Math.max(1, Number(arg("lock-ttl-minutes", "120")) || 120) * 60_000;
const GRUP_DIPILIH = new Set(
  (arg("sources", GRUP.join(",")) ?? GRUP.join(","))
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
);
for (const g of GRUP_DIPILIH) {
  if (!GRUP.includes(g)) {
    console.error(`sumber tidak dikenal: ${g}. Pilihan: ${GRUP.join(",")}`);
    process.exit(2);
  }
}
const mulai = new Date();
const owner = `${os.hostname()}:${process.pid}:${createHash("sha1").update(`${Date.now()}${Math.random()}`).digest("hex").slice(0, 10)}`;
let log = buatLog({ level: LOG_LEVEL, konteks: { region: REGION_ID, owner, dry_run: DRY } });

const gitCommit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: AKAR, encoding: "utf8" })
  .stdout?.trim() || null;

const BULAN = {
  januari: 1, februari: 2, maret: 3, april: 4, mei: 5, juni: 6,
  juli: 7, agustus: 8, september: 9, oktober: 10, november: 11, desember: 12,
};

function tanggalProvenance(dokumen, mtime) {
  const snap = dokumen?.snapshot;
  if (typeof snap === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(snap)) return new Date(`${snap.slice(0, 10)}T00:00:00Z`);
    const m = snap.toLowerCase().match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (m && BULAN[m[2]]) return new Date(Date.UTC(Number(m[3]), BULAN[m[2]] - 1, Number(m[1])));
  }
  return mtime;
}

function kunciEksternal(sumber, baris) {
  if (sumber.grup === "boundaries") return baris?.properties?.objectid ?? null;
  if (sumber.key === "realisasi") return baris?.kode_paket ?? null;
  if (sumber.key === "lpse-rows" || sumber.key === "lpse-detail") return baris?.id ?? null;
  return baris?.kode_rup ?? baris?.kode_paket ?? baris?.id ?? null;
}

function simulasi(stage) {
  if (SIMULASI === stage) {
    throw Object.assign(new Error(`simulasi kegagalan pada stage ${stage}`), {
      code: "SIMULATED_FAILURE",
    });
  }
}

async function jalankanPerintah(skrip, args, { jeda = 1500 } = {}) {
  await tidur(jeda);
  return denganRetry(
    () =>
      new Promise((resolve, reject) => {
        const anak = spawn(process.execPath, [skrip, ...args], {
          cwd: AKAR,
          env: process.env,
          stdio: ["ignore", "pipe", "pipe"],
        });
        let keluaran = "";
        let galat = "";
        anak.stdout.on("data", (d) => {
          keluaran += d;
          for (const baris of d.toString().split("\n").filter(Boolean)) {
            log.debug("sumber", { baris });
          }
        });
        anak.stderr.on("data", (d) => {
          galat += d;
        });
        anak.on("error", reject);
        anak.on("close", (kode) => {
          if (kode === 0) resolve({ keluaran, galat });
          else reject(new Error(`${skrip} ${args.join(" ")} keluar ${kode}: ${galat.slice(-800)}`));
        });
      }),
    { percobaan: 3, dasarMs: 1000, log, label: `${skrip} ${args.join(" ")}` },
  );
}

async function bacaSemua(sumber) {
  const data = {};
  for (const s of sumber) {
    const d = await bacaSumber(s);
    if (!d.ada) {
      log.warn("sumber opsional tidak tersedia", { sumber: s.key, path: s.path });
      continue;
    }
    data[s.key] = d;
    log.info("sumber dibaca", { sumber: s.key, baris: d.baris.length, path: s.path });
  }
  return data;
}

const ARTEFAK_KIND = {
  RUP: "SOURCE_EXPORT",
  RUP_DETAIL: "SOURCE_EXPORT",
  REALISASI: "SOURCE_EXPORT",
  LPSE: "SOURCE_EXPORT",
  BOUNDARY: "GEOJSON",
  SNAPSHOT: "SNAPSHOT",
};

async function simpanStaging(client, { region, sumber, data }) {
  return transaksi(client, async () => {
    await simpanRegion(client, { region, checksum: region.configChecksum });
    const artifactByKey = new Map();
    for (const s of sumber) {
      const d = data[s.key];
      if (!d?.ada) continue;
      const info = await stat(d.absolut);
      const checksum = sha256(d.teks);
      const retrievedAt = tanggalProvenance(d.dokumen, info.mtime);
      const sourceId = await simpanDataSource(client, {
        ...s,
        regionId: region.id,
      });
      const artifactId = await simpanArtifact(client, {
        regionId: region.id,
        sourceId,
        kind: ARTEFAK_KIND[s.kind] ?? "SOURCE_EXPORT",
        artifactKey: s.path,
        checksum,
        byteSize: Buffer.byteLength(d.teks),
        recordCount: d.baris.length,
        retrievedAt,
        parserVersion: s.parserVersion,
        metadata: {
          role: s.role,
          format: s.format,
          level: s.level ?? null,
          rows: d.baris.length,
          snapshot: d.dokumen?.snapshot ?? null,
        },
      });
      await tautkanArtifact(client, region.runId, artifactId, s.role);
      const raw = d.baris.map((payload, i) => ({
        rowIndex: i,
        externalKey: kunciEksternal(s, payload),
        checksum: checksumJson(payload),
        payload,
      }));
      await simpanRawRecords(client, { artifactId, sourceKind: s.kind, rows: raw });
      artifactByKey.set(s.key, { id: artifactId, checksum, retrievedAt, byteSize: info.size });
      log.info("artefak disimpan", {
        sumber: s.key,
        artifact_id: artifactId,
        checksum,
        baris: raw.length,
      });
    }
    return artifactByKey;
  });
}

async function simpanDomain(client, { region, hasil, grup }) {
  return transaksi(client, async () => {
    if (grup.has("rup")) {
      await upsertBanyak(client, {
        table: "rup_packages",
        columns: [
          "region_id", "source_artifact_id", "kode_rup", "tahun", "satker", "instansi", "name",
          "cara", "method", "jenis", "sumber_dana", "total_nilai", "pdn", "umk", "is_road",
          "checksum_sha256", "source_retrieved_at", "updated_at",
        ],
        rows: hasil.rupRows,
        conflict: ["region_id", "kode_rup"],
        update: [
          "source_artifact_id", "tahun", "satker", "instansi", "name", "cara", "method", "jenis",
          "sumber_dana", "total_nilai", "pdn", "umk", "is_road", "checksum_sha256",
          "source_retrieved_at", "updated_at",
        ],
      });
    }

    const rupIds = await ambilIdMap(
      client,
      "SELECT id, kode_rup AS kunci FROM rup_packages WHERE region_id=$1",
      [region.id],
    );

    if (grup.has("detail") && hasil.detailRows.length) {
      for (const row of hasil.detailRows) {
        const id = rupIds.get(row.kode_rup);
        if (!id) throw new Error(`detail ${row.kode_rup}: paket RUP tidak ditemukan`);
        row.rup_package_id = id;
      }
      await upsertBanyak(client, {
        table: "rup_details",
        columns: [
          "rup_package_id", "region_id", "source_artifact_id", "kode_rup", "tahun", "satker",
          "jadwal_pemilihan_mulai", "jadwal_pemilihan_akhir", "jadwal_kontrak_mulai",
          "jadwal_kontrak_akhir", "lokasi_raw", "uraian", "volume", "spesifikasi", "mak",
          "funding_sources", "checksum_sha256", "updated_at",
        ],
        rows: hasil.detailRows,
        conflict: ["rup_package_id"],
        cast: ["uuid", "varchar", "uuid", "varchar", "int", "text", "varchar", "varchar", "varchar", "varchar", "text[]", "text", "text", "text", "varchar", "jsonb", "varchar"],
        update: [
          "region_id", "source_artifact_id", "kode_rup", "tahun", "satker", "jadwal_pemilihan_mulai",
          "jadwal_pemilihan_akhir", "jadwal_kontrak_mulai", "jadwal_kontrak_akhir", "lokasi_raw",
          "uraian", "volume", "spesifikasi", "mak", "funding_sources", "checksum_sha256",
          "updated_at",
        ],
      });
    }

    if (grup.has("boundaries") && hasil.areaRows.length) {
      await simpanArea(client, { regionId: region.id, areas: hasil.areaRows });
    }

    if (grup.has("rup")) {
      for (const row of hasil.roadRows) {
        const id = rupIds.get(row.rup);
        if (!id) throw new Error(`road_package ${row.rup}: paket RUP tidak ditemukan`);
        row.rup_package_id = id;
      }
      await upsertBanyak(client, {
        table: "road_packages",
        columns: [
          "region_id", "rup_package_id", "rup", "year", "name", "agency_name", "budget", "method",
          "source_name", "source_url", "source_retrieved_at", "dataset_version",
          "dataset_checksum", "location_precision", "official_district", "official_village",
          "rw_code", "micro_location", "updated_at",
        ],
        rows: hasil.roadRows,
        conflict: ["region_id", "rup"],
        cast: ["varchar", "uuid", "varchar", "int", "text", "text", "numeric", "text", "varchar", "text", "timestamptz", "varchar", "varchar", "\"RoadLocationPrecision\"", "varchar", "varchar", "varchar", "text"],
        update: [
          "rup_package_id", "year", "name", "agency_name", "budget", "method", "source_name",
          "source_url", "source_retrieved_at", "dataset_version", "dataset_checksum",
          "location_precision", "official_district", "official_village", "rw_code",
          "micro_location", "updated_at",
        ],
      });
    }

    const vendorRows = grup.has("lpse") || grup.has("realisasi") ? [...hasil.vendorMap.values()] : [];
    if (vendorRows.length) {
      await upsertBanyak(client, {
        table: "vendors",
        columns: ["normalized_name", "display_name", "npwp_masked", "updated_at"],
        rows: vendorRows,
        conflict: ["normalized_name"],
        update: ["display_name", "npwp_masked", "updated_at"],
      });
    }
    const vendorIds = await ambilIdMap(
      client,
      "SELECT id, normalized_name AS kunci FROM vendors",
      [],
    );

    const roadIds =
      grup.has("rup") && hasil.roadRows.length
        ? await ambilIdMap(client, "SELECT id, rup AS kunci FROM road_packages WHERE region_id=$1", [region.id])
        : new Map();

    if (grup.has("lpse") && hasil.lpseRows.length) {
      for (const row of hasil.lpseRows) {
        row.vendor_id = row._vendorKunci ? vendorIds.get(row._vendorKunci) ?? null : null;
        row.rup_package_id = rupIds.get(row.kode_rup) ?? null;
        row.road_package_id = roadIds.get(row.kode_rup) ?? null;
      }
      await upsertBanyak(client, {
        table: "lpse_contracts",
        columns: [
          "region_id", "source_artifact_id", "road_package_id", "rup_package_id", "vendor_id",
          "kode_rup", "lpse_id", "jenis_lpse", "name", "status", "method", "satker", "pagu_lpse",
          "hps", "pemenang_name", "npwp_masked", "nilai_kontrak", "tahun", "matched_via", "url",
          "checksum_sha256", "source_retrieved_at", "updated_at",
        ],
        rows: hasil.lpseRows,
        conflict: ["region_id", "lpse_id"],
        cast: ["varchar", "uuid", "uuid", "uuid", "uuid", "varchar", "varchar", "varchar", "text", "text", "text", "text", "numeric", "numeric", "text", "varchar", "numeric", "int", "varchar", "text", "varchar", "timestamptz"],
        update: [
          "source_artifact_id", "road_package_id", "rup_package_id", "vendor_id", "kode_rup",
          "jenis_lpse", "name", "status", "method", "satker", "pagu_lpse", "hps",
          "pemenang_name", "npwp_masked", "nilai_kontrak", "tahun", "matched_via", "url",
          "checksum_sha256", "source_retrieved_at", "updated_at",
        ],
      });
    }

    if (grup.has("realisasi") && hasil.paketRows.length) {
      for (const row of hasil.paketRows) {
        row.vendor_id = row._vendorKunci ? vendorIds.get(row._vendorKunci) ?? null : null;
        row.last_seen_at = new Date().toISOString();
      }
      await upsertBanyak(client, {
        table: "realization_packages",
        columns: [
          "region_id", "source_artifact_id", "vendor_id", "kode_paket", "tahun", "name", "satker",
          "metode", "sumber_transaksi", "total_nilai", "transaction_count", "rup_count",
          "checksum_sha256", "last_seen_at", "updated_at",
        ],
        rows: hasil.paketRows,
        conflict: ["region_id", "kode_paket", "tahun"],
        cast: ["varchar", "uuid", "uuid", "varchar", "int", "text", "text", "varchar", "varchar", "numeric", "int", "int", "varchar", "timestamptz"],
        update: [
          "source_artifact_id", "vendor_id", "name", "satker", "metode", "sumber_transaksi",
          "total_nilai", "transaction_count", "rup_count", "checksum_sha256", "last_seen_at", "updated_at",
        ],
      });

      const paketIds = await ambilIdMap(
        client,
        "SELECT id, kode_paket || '|' || tahun AS kunci FROM realization_packages WHERE region_id=$1",
        [region.id],
      );
      for (const row of hasil.transaksiRows) {
        const id = paketIds.get(row.package_key);
        if (!id) throw new Error(`transaksi ${row.package_key}: paket realisasi tidak ditemukan`);
        row.package_id = id;
        row.vendor_id = row._vendorKunci ? vendorIds.get(row._vendorKunci) ?? null : null;
      }
      await upsertBanyak(client, {
        table: "realization_transactions",
        columns: [
          "region_id", "package_id", "source_artifact_id", "vendor_id", "kode_paket", "kode_rup",
          "tahun", "metode", "sumber_transaksi", "satker", "name", "penyedia_raw", "nilai",
          "checksum_sha256",
        ],
        rows: hasil.transaksiRows,
        conflict: ["region_id", "checksum_sha256"],
        cast: ["varchar", "uuid", "uuid", "uuid", "varchar", "varchar", "int", "varchar", "varchar", "text", "text", "text", "numeric", "varchar"],
        update: [
          "package_id", "source_artifact_id", "vendor_id", "kode_paket", "kode_rup", "tahun",
          "metode", "sumber_transaksi", "satker", "name", "penyedia_raw", "nilai",
        ],
        chunk: 300,
      });

      const linkRows = [];
      for (const link of hasil.paketRupRows) {
        const packageId = paketIds.get(link.package_key);
        const rupId = rupIds.get(link.kode_rup);
        if (!packageId || !rupId) continue;
        linkRows.push({
          package_id: packageId,
          rup_package_id: rupId,
          kode_rup: link.kode_rup,
        });
      }
      await upsertBanyak(client, {
        table: "realization_package_rups",
        columns: ["package_id", "rup_package_id", "kode_rup"],
        rows: linkRows,
        conflict: ["package_id", "rup_package_id"],
      });
    }

    if (grup.has("boundaries") && grup.has("rup") && hasil.areaRows.length) {
      const areaIds = await ambilIdMap(
        client,
        "SELECT id, stable_key AS kunci FROM administrative_areas WHERE region_id=$1",
        [region.id],
      );
      const links = [];
      const dilihat = new Set();
      for (const row of hasil.roadRows) {
        const roadId = roadIds.get(row.rup);
        if (!roadId) continue;
        for (const link of row._areaLinks) {
          const areaId = areaIds.get(link.stableKey);
          if (!areaId) continue;
          const kunci = `${roadId}|${link.role}`;
          if (dilihat.has(kunci)) continue;
          dilihat.add(kunci);
          links.push({ road_package_id: roadId, area_id: areaId, role: link.role });
        }
      }
      await upsertBanyak(client, {
        table: "road_package_area_links",
        columns: ["road_package_id", "area_id", "role"],
        rows: links,
        conflict: ["road_package_id", "role"],
        cast: ["uuid", "uuid", "\"RoadPackageAreaRole\""],
        update: ["area_id"],
      });
    }

    return {
      rup: grup.has("rup") ? hasil.rupRows.length : 0,
      detail: grup.has("detail") ? hasil.detailRows.length : 0,
      road: grup.has("rup") ? hasil.roadRows.length : 0,
      area: grup.has("boundaries") ? hasil.areaRows.length : 0,
      lpse: grup.has("lpse") ? hasil.lpseRows.length : 0,
      realisasi: grup.has("realisasi") ? hasil.transaksiRows.length : 0,
      vendor: vendorRows.length,
    };
  });
}

function jalankanGate(snapshotPath, { manifest = false } = {}) {
  const args = ["scripts/check-region.mjs", "--region", REGION_ID, "--snapshot", snapshotPath];
  if (manifest) args.push("--manifest");
  const hasil = spawnSync(process.execPath, args, {
    cwd: AKAR,
    encoding: "utf8",
    env: process.env,
  });
  const keluaran = `${hasil.stdout ?? ""}${hasil.stderr ?? ""}`;
  for (const baris of keluaran.split("\n").filter(Boolean)) log.info("region-check", { baris });
  if (hasil.status !== 0) {
    throw new Error(`region:check gagal (exit ${hasil.status}) pada ${snapshotPath}`);
  }
  return keluaran;
}

async function main() {
  const region = await muatRegion(REGION_ID).catch((error) => {
    throw new Error(`region: ${error.message}`);
  });
  const configBytes = await Promise.all([
    readFile(path.resolve(AKAR, "data", "regions", REGION_ID, "region.json")),
    readFile(path.resolve(AKAR, "data", "regions", REGION_ID, "aliases.json")).catch(() => Buffer.from("")),
  ]);
  region.configChecksum = sha256(Buffer.concat(configBytes));
  log = buatLog({
    level: LOG_LEVEL,
    konteks: { region: REGION_ID, owner, dry_run: DRY, pid: process.pid, git: gitCommit },
  });

  const sumber = daftarSumber(region);
  if (REFRESH) {
    log.info("refresh sumber dimulai", { grup: [...GRUP_DIPILIH] });
    for (const s of sumber) {
      if (!GRUP_DIPILIH.has(s.grup) || !s.refresh) continue;
      log.info("menjalankan penarik", { sumber: s.key, perintah: `${s.refresh.skrip} ${s.refresh.args.join(" ")}` });
      await jalankanPerintah(s.refresh.skrip, s.refresh.args);
    }
    simulasi("fetch");
  }

  const data = await bacaSemua(sumber);
  if (!data.rup) throw new Error(`sumber RUP wajib tersedia untuk region ${REGION_ID}`);
  simulasi("fetch");

  const hasil = normalisasi({ region, sumber, data, artifactByKey: new Map() });
  simulasi("normalize");

  const manifestAwal = bacaManifest(region);
  const valid = validasi({ hasil, manifest: manifestAwal });
  if (!valid.lulus) {
    throw Object.assign(
      new Error(`validasi gagal: ${valid.masalah.slice(0, 5).join("; ")}`),
      { code: "VALIDATION_FAILED", masalah: valid.masalah },
    );
  }
  log.info("validasi lulus", { metrik: valid.metrik });
  simulasi("validate");

  const snapshotTeks = serialisasiSnapshot(
    { snapshot: region.metadata.snapshot, sumber: region.metadata.sumber },
    hasil.paket,
  );
  const snapshotChecksum = sha256(snapshotTeks);
  const tempSnapshot = path.join(os.tmpdir(), `saksi-${REGION_ID}-${process.pid}-${Date.now()}.json`);
  await writeFile(tempSnapshot, snapshotTeks);
  try {
    jalankanGate(tempSnapshot);
    simulasi("gate");
  } finally {
    await readFile(tempSnapshot).catch(() => {});
  }

  if (DRY) {
    log.info("dry-run selesai: tidak ada DB/berkas yang ditulis", {
      snapshot_checksum: snapshotChecksum,
      metrik: valid.metrik,
    });
    process.stdout.write(
      `${JSON.stringify({ dry_run: true, region: REGION_ID, metrik: valid.metrik, snapshot_checksum: snapshotChecksum })}\n`,
    );
    return;
  }

  const client = bukaDb({ log });
  let runId = null;
  let detak = null;
  let lockTerpasang = false;
  let stats = { tahap: "mulai" };
  try {
    await client.connect();
    await simpanRegion(client, { region, checksum: region.configChecksum });
    runId = await buatRun(client, {
      regionId: REGION_ID,
      trigger: TRIGGER,
      dryRun: false,
      sources: [...GRUP_DIPILIH].flatMap((g) => {
        if (g === "rup") return ["RUP"];
        if (g === "detail") return ["RUP_DETAIL"];
        if (g === "realisasi") return ["REALISASI"];
        if (g === "lpse") return ["LPSE"];
        return ["BOUNDARY"];
      }),
      gitCommit,
      hostName: os.hostname(),
      lockOwner: owner,
    });
    region.runId = runId;
    log = buatLog({ level: LOG_LEVEL, konteks: { region: REGION_ID, run_id: runId, owner, git: gitCommit } });

    const lock = await ambilLock(client, { regionId: REGION_ID, runId, owner, ttlMs: TTL_MS });
    if (!lock) {
      const pemegang = await infoLock(client, REGION_ID);
      await lewatiRun(client, {
        runId,
        code: "LOCK_HELD",
        message: `lock dipegang ${pemegang?.owner ?? "?"} sampai ${pemegang?.expires_at?.toISOString?.() ?? "?"}`,
      });
      log.warn("run dilewati: lock masih dipegang", { lock: pemegang });
      process.exitCode = 75;
      return;
    }
    lockTerpasang = true;
    detak = setInterval(() => {
      heartbeatLock(client, { regionId: REGION_ID, owner, ttlMs: TTL_MS }).catch((error) =>
        log.warn("heartbeat lock gagal", { error: error.message }),
      );
    }, 30_000);
    detak.unref?.();

    log.info("run dimulai", { run_id: runId, trigger: TRIGGER });
    stats.tahap = "fetch";
    await catatStep(client, { runId, step: "fetch", status: "RUNNING" });
    const artifactByKey = await simpanStaging(client, { region, sumber, data });
    await catatStep(client, {
      runId,
      step: "fetch",
      status: "SUCCEEDED",
      recordCount: sumber.reduce((n, s) => n + (data[s.key]?.baris.length ?? 0), 0),
      metadata: { artefak: artifactByKey.size },
    });

    // Normalisasi diulang dengan artifact id supaya provenance ikut tersimpan.
    const hasilDb = normalisasi({ region, sumber, data, artifactByKey });
    const validDb = validasi({ hasil: hasilDb, manifest: manifestAwal });
    if (!validDb.lulus) {
      throw Object.assign(new Error(`validasi DB gagal: ${validDb.masalah.slice(0, 5).join("; ")}`), {
        code: "VALIDATION_FAILED",
      });
    }
    stats.tahap = "upsert";
    simulasi("before-commit");
    await catatStep(client, { runId, step: "upsert", status: "RUNNING" });
    const ditulis = await simpanDomain(client, { region, hasil: hasilDb, grup: GRUP_DIPILIH });
    await catatStep(client, {
      runId,
      step: "upsert",
      status: "SUCCEEDED",
      recordCount: ditulis.rup + ditulis.detail + ditulis.road + ditulis.area + ditulis.lpse + ditulis.realisasi,
      metadata: ditulis,
    });
    stats.tahap = "snapshot";
    simulasi("after-commit");
    const finalSnapshot = path.resolve(AKAR, region.keluaran);
    const tmpFinal = `${finalSnapshot}.tmp-${process.pid}`;
    await mkdir(path.dirname(finalSnapshot), { recursive: true });
    await writeFile(tmpFinal, snapshotTeks);
    await rename(tmpFinal, finalSnapshot);
    simulasi("snapshot");

    await catatStep(client, { runId, step: "snapshot", status: "RUNNING" });
    jalankanGate(path.resolve(AKAR, region.keluaran), { manifest: true });
    await catatStep(client, {
      runId,
      step: "snapshot",
      status: "SUCCEEDED",
      checksum: snapshotChecksum,
      recordCount: hasilDb.roadRows.length,
    });

    const manifest = bacaManifest(region);
    stats = {
      tahap: "selesai",
      snapshot_checksum: snapshotChecksum,
      metrik: validDb.metrik,
      ditulis,
      artefak: [...artifactByKey.entries()].map(([k, v]) => ({ sumber: k, checksum: v.checksum })),
    };
    await simpanManifest(client, {
      regionId: REGION_ID,
      runId,
      region,
      snapshotChecksum,
      gatePassed: true,
      metrics: manifest?.metrik ?? validDb.metrik,
      checksums: Object.fromEntries(
        [...artifactByKey.entries()].map(([k, v]) => [k, v.checksum]),
      ),
    });
    await selesaikanRun(client, { runId, stats, startedAt: mulai });
    log.info("run sukses", { run_id: runId, metrik: validDb.metrik, pagu: rupiah(validDb.metrik.pagu), ditulis });
  } catch (error) {
    if (runId) {
      await catatStep(client, {
        runId,
        step: stats.tahap ?? "gagal",
        status: "FAILED",
        errorMessage: String(error.message).slice(0, 3000),
      }).catch(() => {});
      await gagalkanRun(client, {
        runId,
        code: error.code ?? "INGESTION_FAILED",
        message: error.message,
        stats: { ...stats, masalah: error.masalah?.slice(0, 20) ?? undefined },
        startedAt: mulai,
      }).catch((e) => log.error("gagal menandai run gagal", { error: e.message }));
    }
    log.error("run gagal", {
      error: error.message,
      code: error.code ?? null,
      masalah: error.masalah?.slice(0, 20) ?? null,
    });
    process.exitCode = 1;
  } finally {
    if (detak) clearInterval(detak);
    if (lockTerpasang) {
      await lepasLock(client, { regionId: REGION_ID, owner }).catch((error) =>
        log.warn("gagal melepas lock", { error: error.message }),
      );
    }
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: "error", msg: "worker gagal", error: error.message }));
  process.exitCode = 1;
});
