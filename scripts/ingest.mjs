// Orkestrasi penarikan dan pembangunan snapshot per region (satu job per kode instansi/kldi).
// Pemakaian: node scripts/ingest.mjs [--region <id> | --semua] [--dry-run] [--tanpa-lpse] [--jeda <ms>]
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { AKAR } from "./lib/region.mjs";

const argv = process.argv.slice(2);
const arg = (nama, bawaan) => {
  const i = argv.indexOf(`--${nama}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : bawaan;
};
const DRY = argv.includes("--dry-run");
const TANPA_LPSE = argv.includes("--tanpa-lpse");
const JEDA = Math.max(0, Number(arg("jeda", "1500")) || 0);
const REGION = arg("region", null);
const SEMUA = argv.includes("--semua");

if (!REGION && !SEMUA) {
  console.error("pakai: node scripts/ingest.mjs --region <id> | --semua  [--dry-run] [--jeda 1500]");
  process.exit(1);
}

const regionIds = SEMUA
  ? readdirSync(path.join(AKAR, "data", "regions"), { withFileTypes: true })
      .filter((entri) => entri.isDirectory())
      .map((entri) => entri.name)
      .sort()
  : [REGION];

const tidur = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function langkah(regionId) {
  const daftar = [
    ["scripts/rup.mjs", ["--region", regionId]],
    ["scripts/rup.mjs", ["--detail", "--region", regionId]],
    ["scripts/realisasi.mjs", ["--region", regionId]],
  ];
  if (!TANPA_LPSE) {
    daftar.push(
      ["scripts/lpse.mjs", ["list", "--region", regionId]],
      ["scripts/lpse.mjs", ["detail", "--region", regionId]],
      ["scripts/lpse.mjs", ["match", "--region", regionId]],
    );
  }
  const configPath = path.join(AKAR, "data", "regions", regionId, "region.json");
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    if (config.jalan) daftar.push(["scripts/jalan.mjs", ["--region", regionId]]);
  }
  daftar.push(
    ["scripts/build-snapshot.mjs", ["--region", regionId]],
    ["scripts/check-region.mjs", ["--region", regionId, "--manifest"]],
  );
  return daftar;
}

for (const regionId of regionIds) {
  console.log(`\n=== ${regionId} ===`);
  for (const [skrip, args] of langkah(regionId)) {
    const perintah = `${process.execPath} ${skrip} ${args.join(" ")}`;
    console.log(`$ ${perintah}`);
    if (DRY) continue;
    const hasil = spawnSync(process.execPath, [skrip, ...args], {
      cwd: AKAR,
      stdio: "inherit",
      env: process.env,
    });
    if (hasil.status !== 0) {
      console.error(`gagal: ${skrip} (exit ${hasil.status ?? "signal"})`);
      process.exit(hasil.status ?? 1);
    }
    await tidur(JEDA);
  }
}

console.log(`\nselesai${DRY ? " (dry-run)" : ""}: ${regionIds.length} region`);
