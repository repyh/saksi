#!/usr/bin/env node
/**
 * Ukur latensi halaman & API katalog pada server `next start` yang sudah berjalan.
 *
 * Tidak menuntut DATABASE_URL: URL uji ditemukan dari HTML halaman itu sendiri
 * (`/paket` untuk kode RUP, `/penyedia` untuk slug penyedia), sehingga skrip yang
 * sama dipakai pada jalur database maupun snapshot.
 *
 * Contoh:
 *   node scripts/profile-pages.mjs                       # 7 sampel sekuensial + 3 warm-up
 *   node scripts/profile-pages.mjs --parallel 8          # tambahan uji 8 request paralel
 *   node scripts/profile-pages.mjs --samples 7 --json /tmp/profile.json --label baseline
 *   node scripts/profile-pages.mjs --dump /tmp/baseline  # simpan HTML/JSON untuk banding
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function option(name, fallback) {
  const index = args.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) return true;
  return value;
}

const base = String(option("base", process.env.PROFILE_BASE_URL ?? "http://127.0.0.1:3000")).replace(/\/$/, "");
const samples = Math.max(1, Number(option("samples", 7)));
const warmup = Math.max(0, Number(option("warmup", 3)));
const parallel = Math.max(0, Number(option("parallel", 8)));
const parallelRounds = Math.max(1, Number(option("parallel-rounds", 3)));
const dumpDir = option("dump", null);
const jsonPath = option("json", null);
const label = String(option("label", "profile"));
const only = option("only", null);
const cold = args.includes("--cold");

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function formatMs(value) {
  return value === null ? "—" : `${value.toFixed(0)} ms`;
}

function firstMatch(text, pattern) {
  const match = pattern.exec(text);
  return match ? match[1] : null;
}

async function request(url) {
  const started = performance.now();
  const response = await fetch(url, { headers: { "user-agent": "saksi-profile/1.0" } });
  const body = await response.arrayBuffer();
  const elapsed = performance.now() - started;
  return {
    url,
    status: response.status,
    bytes: body.byteLength,
    ms: elapsed,
    text: Buffer.from(body).toString("utf8"),
  };
}

function slugPenyedia(nama) {
  return nama
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("id-ID")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 96);
}

/**
 * Temukan URL uji dari berkas region/snapshot lebih dulu, supaya mode `--cold`
 * tidak memanaskan halaman `/paket` atau `/penyedia` sebelum diukur. Bila berkas
 * tidak tersedia, jatuh ke penemuan lewat HTML (dengan konsekuensi warm-up).
 */
async function discoverTargets() {
  let rup = null;
  let vendorSlug = null;
  try {
    const regionFile = path.resolve("data", "regions", "kota-tangerang", "region.json");
    const region = JSON.parse(readFileSync(regionFile, "utf8"));
    const snapshot = JSON.parse(readFileSync(path.resolve(region.keluaran), "utf8"));
    const rows = (snapshot.paket ?? []).filter(
      (item) => item?.sektor === "Jalan, Jembatan & Drainase" && item?.kode_rup,
    );
    rup = rows[0] ? String(rows[0].kode_rup) : null;

    const rupSet = new Set(rows.map((item) => String(item.kode_rup)));
    const lpseFile = region.lpse?.keluaran
      ? path.resolve(region.lpse.keluaran)
      : null;
    if (lpseFile && existsSync(lpseFile) && rup) {
      const lpse = JSON.parse(readFileSync(lpseFile, "utf8"));
      const cocok = (lpse.item ?? []).find(
        (row) => row?.pemenang && rupSet.has(String(row.kode_rup)),
      );
      if (cocok) vendorSlug = slugPenyedia(cocok.pemenang);
    }
  } catch {
    // Berkas tidak lengkap; penemuan HTTP di bawah tetap bekerja.
  }

  if (!rup) {
    const listPage = await request(`${base}/paket`);
    if (listPage.status !== 200) {
      throw new Error(`/paket menjawab ${listPage.status}; server belum siap?`);
    }
    rup = firstMatch(listPage.text, /href="\/paket\/(\d{1,16})\?/);
    if (!rup) throw new Error("Tidak menemukan kode RUP pada HTML /paket.");
  }
  if (!vendorSlug) {
    try {
      const vendorPage = await request(`${base}/penyedia`);
      if (vendorPage.status === 200) {
        vendorSlug = firstMatch(vendorPage.text, /href="\/penyedia\/([^"?]+)\?/);
      }
    } catch {
      // Halaman penyedia opsional bila region tidak punya rekam kontrak.
    }
  }

  const targets = [
    { name: "paket-list", url: `${base}/paket`, budget: 100 },
    { name: "penyedia-list", url: `${base}/penyedia`, budget: 100 },
    { name: "paket-detail", url: `${base}/paket/${rup}`, budget: 300 },
    { name: "peta-pekerjaan", url: `${base}/peta-pekerjaan`, budget: 300 },
    { name: "laporan-publik", url: `${base}/laporan/publik`, budget: 300 },
    { name: "metode", url: `${base}/metode`, budget: 300 },
    { name: "home", url: `${base}/`, budget: 300 },
    { name: "api-packages", url: `${base}/api/packages`, budget: 100 },
    { name: "api-map", url: `${base}/api/packages/map`, budget: 100 },
    { name: "api-detail", url: `${base}/api/packages/${rup}`, budget: 100 },
  ];
  if (vendorSlug) {
    targets.splice(3, 0, {
      name: "penyedia-detail",
      url: `${base}/penyedia/${encodeURIComponent(vendorSlug)}`,
      budget: 300,
    });
  }
  return targets;
}

function safeFileName(target) {
  return `${target.name}.body`;
}

async function main() {
  const allTargets = await discoverTargets();
  const targets = Array.isArray(only)
    ? allTargets.filter((target) => only.includes(target.name))
    : typeof only === "string"
      ? allTargets.filter((target) => only.split(",").includes(target.name))
      : allTargets;

  if (dumpDir) mkdirSync(dumpDir, { recursive: true });

  const coldResults = [];
  if (cold) {
    // Satu request pertama per halaman setelah server dinyalakan; tidak masuk p50.
    for (const target of targets) {
      const result = await request(target.url);
      coldResults.push({
        name: target.name,
        status: result.status,
        ms: result.ms,
        bytes: result.bytes,
      });
    }
  }

  // Warm-up: isi cache proses + cache data sebelum sampel dihitung.
  for (let round = 0; round < warmup; round += 1) {
    for (const target of targets) {
      const result = await request(target.url);
      if (result.status >= 400) throw new Error(`${target.name} menjawab ${result.status}`);
    }
  }

  const results = [];
  for (const target of targets) {
    const latencies = [];
    let bytes = 0;
    for (let index = 0; index < samples; index += 1) {
      const result = await request(target.url);
      if (result.status >= 400) throw new Error(`${target.name} menjawab ${result.status}`);
      latencies.push(result.ms);
      bytes = result.bytes;
      if (dumpDir) writeFileSync(path.join(dumpDir, safeFileName(target)), result.text);
    }
    results.push({
      name: target.name,
      url: target.url,
      budget: target.budget,
      samples: latencies.length,
      bytes,
      min: Math.min(...latencies),
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: Math.max(...latencies),
    });
  }

  let parallelResult = null;
  if (parallel > 1) {
    const latencies = [];
    const statuses = [];
    for (let round = 0; round < parallelRounds; round += 1) {
      const batch = Array.from({ length: parallel }, (_, index) => targets[index % targets.length]);
      const settled = await Promise.all(
        batch.map(async (target) => {
          const result = await request(target.url);
          statuses.push(result.status);
          return result.ms;
        }),
      );
      latencies.push(...settled);
    }
    parallelResult = {
      concurrency: parallel,
      rounds: parallelRounds,
      requests: latencies.length,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: Math.max(...latencies),
      failures: statuses.filter((status) => status >= 400).length,
    };
  }

  const report = {
    label,
    base,
    timestamp: new Date().toISOString(),
    databaseEnv: Boolean(process.env.DATABASE_URL),
    warmup,
    samples,
    cold: coldResults,
    results,
    parallel: parallelResult,
  };

  if (jsonPath) writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\n${label} — ${base}`);
  console.log(`warm-up ${warmup} · sampel ${samples} · paralel ${parallelSizeLabel(parallel)}`);
  console.log("");
  console.log(
    [
      "halaman".padEnd(18),
      "p50".padStart(9),
      "p95".padStart(9),
      "min".padStart(9),
      "maks".padStart(9),
      "byte".padStart(10),
      "target".padStart(8),
      "status".padStart(8),
    ].join(" "),
  );
  for (const result of results) {
    const within = result.p50 <= result.budget;
    console.log(
      [
        result.name.padEnd(18),
        formatMs(result.p50).padStart(9),
        formatMs(result.p95).padStart(9),
        formatMs(result.min).padStart(9),
        formatMs(result.max).padStart(9),
        String(result.bytes).padStart(10),
        `≤${result.budget}`.padStart(8),
        (within ? "LULUS" : "LEWAT").padStart(8),
      ].join(" "),
    );
  }

  if (coldResults.length) {
    console.log("");
    console.log("cold start terpisah (request pertama, tanpa warm-up):");
    for (const result of coldResults) {
      console.log(`  ${result.name.padEnd(18)} ${formatMs(result.ms).padStart(9)}  ${String(result.bytes).padStart(10)} byte  HTTP ${result.status}`);
    }
  }

  if (parallelResult) {
    console.log("");
    console.log(
      `paralel ${parallelResult.concurrency} × ${parallelResult.rounds} putaran · ` +
        `${parallelResult.requests} request · ` +
        `p50 ${formatMs(parallelResult.p50)} · p95 ${formatMs(parallelResult.p95)} · ` +
        `maks ${formatMs(parallelResult.max)} · gagal ${parallelResult.failures} · ` +
        `target p95 ≤1000 ms → ${parallelResult.p95 !== null && parallelResult.p95 <= 1000 ? "LULUS" : "LEWAT"}`,
    );
  }

  const failed = results.filter((result) => result.p50 > result.budget);
  console.log("");
  console.log(failed.length === 0 ? "Semua target p50 terpenuhi." : `${failed.length} halaman melewati target p50.`);
  return failed.length === 0 && (!parallelResult || parallelResult.p95 <= 1000) ? 0 : 1;
}

function parallelSizeLabel(value) {
  return value > 1 ? `${value} request` : "tidak dijalankan";
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`profile-pages gagal: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 2;
  });
