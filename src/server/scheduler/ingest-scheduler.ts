import "server-only";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_REGION_ID, getRegionOrNull } from "@/server/regions/region-registry";
import { bagianLokal, jadwalTerakhir, kunciHari } from "./jadwal";

/**
 * Penjadwal harian di dalam proses Next, pengganti timer systemd.
 *
 * `src/instrumentation.ts` memanggil `mulaiPenjadwal()` sekali saat server siap. Timer hanya
 * menghitung menit setempat lalu men-spawn CLI yang sudah ada (`workers/ingest.mjs`,
 * `scripts/retention-reports.mjs`) sebagai proses terpisah, sehingga pekerjaan berat tidak
 * menahan event loop web. Idempotensi dan anti-tumpang-tindih tetap milik worker
 * (`ingestion_locks`), bukan milik penjadwal.
 */

const AKAR = process.cwd();
const JEDA_DETAK_MS = 20_000;
const TUNDA_CATCHUP_MS = 30_000;
const TENGGANG_CATCHUP_MS = 15 * 60_000;

interface Pekerjaan {
  id: "ingestion" | "retensi";
  label: string;
  berkas: string;
  argumen: string[];
  jam: number;
  menit: number;
  terakhir: string | null;
  /** `null` berarti siap; string berisi alasan pekerjaan harus dilewati. */
  syarat: () => string | null;
}

function benar(nilai: string | undefined): boolean {
  return nilai === "1" || nilai?.toLowerCase() === "true";
}

function bacaJam(nilai: string, bawaan: string, id: string): { jam: number; menit: number } | null {
  const teks = (nilai || bawaan).trim();
  const cocok = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(teks);
  if (!cocok) {
    console.error(`[jadwal] ${id}: waktu "${teks}" tidak valid; pakai HH:MM.`);
    return null;
  }
  return { jam: Number(cocok[1]), menit: Number(cocok[2]) };
}

function dimatikan(nilai: string | undefined): boolean {
  return nilai === "0" || nilai?.toLowerCase() === "off";
}

function susunPekerjaan(region: string): Pekerjaan[] {
  const pekerjaan: Pekerjaan[] = [];

  const waktuIngest = dimatikan(process.env.INGEST_SCHEDULER_INGEST)
    ? null
    : bacaJam(process.env.INGEST_SCHEDULER_INGEST ?? "", "02:30", "ingestion");
  if (waktuIngest) {
    const argumen = ["--region", region, "--trigger", "cron"];
    if (benar(process.env.INGEST_SCHEDULER_REFRESH)) argumen.push("--refresh");
    pekerjaan.push({
      id: "ingestion",
      label: "ingestion",
      berkas: "workers/ingest.mjs",
      argumen,
      jam: waktuIngest.jam,
      menit: waktuIngest.menit,
      terakhir: null,
      syarat: () => (process.env.DATABASE_URL ? null : "DATABASE_URL kosong"),
    });
  }

  const waktuRetensi = dimatikan(process.env.INGEST_SCHEDULER_RETENTION)
    ? null
    : bacaJam(process.env.INGEST_SCHEDULER_RETENTION ?? "", "03:15", "retensi");
  if (waktuRetensi) {
    pekerjaan.push({
      id: "retensi",
      label: "retensi",
      berkas: "scripts/retention-reports.mjs",
      argumen: [],
      jam: waktuRetensi.jam,
      menit: waktuRetensi.menit,
      terakhir: null,
      syarat: () => {
        if (!process.env.DATABASE_URL) return "DATABASE_URL kosong";
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          return "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY kosong";
        }
        return null;
      },
    });
  }

  return pekerjaan;
}

function jalankan(pekerjaan: Pekerjaan, alasan: string): void {
  const tidakSiap = pekerjaan.syarat();
  if (tidakSiap) {
    console.warn(`[jadwal] ${pekerjaan.label} dilewati (${alasan}): ${tidakSiap}.`);
    return;
  }

  // Berkas dijalankan dari root repo, bukan dibaca server; jangan biarkan Turbopack menelusuri
  // seluruh proyek untuk path dinamis ini.
  const berkas = path.resolve(/* turbopackIgnore: true */ AKAR, pekerjaan.berkas);
  const argumen = [berkas, ...pekerjaan.argumen];
  console.info(`[jadwal] mulai ${pekerjaan.label} (${alasan}): node ${path.relative(AKAR, berkas)} ${pekerjaan.argumen.join(" ")}`.trim());

  const mulai = Date.now();
  const anak = spawn(process.execPath, argumen, {
    cwd: AKAR,
    env: process.env,
    stdio: ["ignore", "inherit", "inherit"],
  });

  anak.on("error", (error) => {
    console.error(`[jadwal] ${pekerjaan.label} gagal dijalankan: ${error.message}`);
  });
  anak.on("exit", (kode, sinyal) => {
    const durasi = Math.round((Date.now() - mulai) / 1000);
    const status = sinyal ? `sinyal ${sinyal}` : `exit ${kode}`;
    const tulis = kode === 0 ? console.info : console.warn;
    tulis(`[jadwal] ${pekerjaan.label} selesai: ${status}, ${durasi} detik.`);
  });
}

function detak(pekerjaan: Pekerjaan[], zona: string): void {
  const sekarang = new Date();
  const bagian = bagianLokal(sekarang, zona);
  const kunci = kunciHari(sekarang, zona);

  for (const job of pekerjaan) {
    if (bagian.jam !== job.jam || bagian.menit !== job.menit) continue;
    if (job.terakhir === kunci) continue;
    job.terakhir = kunci;
    jalankan(job, "jadwal");
  }
}

function waktuManifest(region: string): number | null {
  const jalur = path.resolve(AKAR, "data", "regions", region, "manifest.json");
  try {
    const isi = JSON.parse(readFileSync(jalur, "utf8")) as { dibuat?: string };
    const waktu = Date.parse(isi.dibuat ?? "");
    return Number.isFinite(waktu) ? waktu : null;
  } catch {
    return null;
  }
}

/**
 * Pengganti `Persistent=true`: bila server hidup setelah jadwal hari ini terlewat dan manifest
 * terakhir lebih tua dari jadwal itu, jalankan ingestion sekali. Manifest hanya ditulis ulang
 * setelah run sukses, jadi kegagalan akan dicoba lagi pada boot berikutnya.
 */
function kejarTertinggal(pekerjaan: Pekerjaan[], zona: string, region: string): void {
  const job = pekerjaan.find((item) => item.id === "ingestion");
  if (!job) return;

  const sekarang = new Date();
  const kunci = kunciHari(sekarang, zona);
  if (job.terakhir === kunci) return;

  const dibuat = waktuManifest(region);
  if (dibuat === null) {
    console.warn("[jadwal] catch-up dilewati: manifest region tidak terbaca.");
    return;
  }

  const jadwal = jadwalTerakhir(job.jam, job.menit, zona, sekarang);
  if (dibuat >= jadwal.getTime() - TENGGANG_CATCHUP_MS) return;

  job.terakhir = kunci;
  jalankan(job, "catch-up");
}

interface PenjadwalGlobal {
  __saksiPenjadwal?: boolean;
}

export function mulaiPenjadwal(): void {
  const global = globalThis as typeof globalThis & PenjadwalGlobal;
  if (global.__saksiPenjadwal) return;

  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const aktifDefault = process.env.NODE_ENV === "production";
  const aktif =
    process.env.INGEST_SCHEDULER === undefined
      ? aktifDefault
      : benar(process.env.INGEST_SCHEDULER);
  if (!aktif) return;

  const zona = process.env.INGEST_SCHEDULER_TZ || "Asia/Jakarta";
  try {
    bagianLokal(new Date(), zona);
  } catch {
    console.error(`[jadwal] zona waktu "${zona}" tidak dikenal; penjadwal tidak dijalankan.`);
    return;
  }

  const region = process.env.INGEST_SCHEDULER_REGION || DEFAULT_REGION_ID;
  if (!getRegionOrNull(region)) {
    console.error(`[jadwal] region "${region}" tidak ada di data/regions; penjadwal tidak dijalankan.`);
    return;
  }

  const pekerjaan = susunPekerjaan(region);
  if (pekerjaan.length === 0) {
    console.warn("[jadwal] tidak ada pekerjaan aktif; penjadwal tidak dijalankan.");
    return;
  }

  global.__saksiPenjadwal = true;

  const detakan = setInterval(() => detak(pekerjaan, zona), JEDA_DETAK_MS);
  detakan.unref();

  if (!dimatikan(process.env.INGEST_SCHEDULER_CATCHUP)) {
    const timer = setTimeout(() => kejarTertinggal(pekerjaan, zona, region), TUNDA_CATCHUP_MS);
    timer.unref();
  }

  const ringkas = pekerjaan
    .map((job) => `${job.label} ${String(job.jam).padStart(2, "0")}:${String(job.menit).padStart(2, "0")}`)
    .join(", ");
  console.info(`[jadwal] aktif (${zona}) region ${region}: ${ringkas}.`);
}
