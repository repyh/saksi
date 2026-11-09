import pg from "pg";
import { createClient } from "@supabase/supabase-js";

/**
 * Retensi bukti foto laporan.
 *
 * Kebijakan: foto laporan tidak pernah publik. Retensi awal 365 hari sejak
 * pengiriman; laporan REJECTED/WITHDRAWN/ARCHIVED dipersingkat menjadi 180 hari
 * sejak status terakhir. Objek dihapus dari bucket privat, lalu `deleted_at`
 * diisi. Jalankan dengan `--dry-run` untuk melihat kandidat tanpa menghapus.
 */

const dryRun = process.argv.includes("--dry-run");
const retentionDays = Number(process.env.REPORT_MEDIA_RETENTION_DAYS ?? 365);
const rejectedDays = Number(process.env.REPORT_MEDIA_REJECTED_RETENTION_DAYS ?? 180);
const bucket = process.env.SUPABASE_REPORTS_BUCKET || "report-evidence";
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL wajib diisi.");
  process.exit(1);
}
if (!Number.isFinite(retentionDays) || retentionDays < 1 || !Number.isFinite(rejectedDays) || rejectedDays < 1) {
  console.error("REPORT_MEDIA_RETENTION_DAYS dan REPORT_MEDIA_REJECTED_RETENTION_DAYS harus bilangan positif.");
  process.exit(1);
}
if (!dryRun && (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  console.error("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi untuk menghapus objek.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: connectionString.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
});
await client.connect();

const storage = dryRun
  ? null
  : createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  }).storage;

let failures = 0;
try {
  await client.query("BEGIN");
  const backfill = await client.query(
    `UPDATE report_media
     SET retained_until = created_at + ($1 || ' days')::interval
     WHERE retained_until IS NULL`,
    [String(retentionDays)],
  );
  const shortened = await client.query(
    `WITH latest AS (
       SELECT DISTINCT ON (report_id) report_id, to_status, created_at
       FROM report_status_events
       ORDER BY report_id, created_at DESC
     )
     UPDATE report_media m
     SET retained_until = latest.created_at + ($1 || ' days')::interval
     FROM latest
     WHERE m.report_id = latest.report_id
       AND m.deleted_at IS NULL
       AND latest.to_status IN ('REJECTED', 'WITHDRAWN', 'ARCHIVED')
       AND (m.retained_until IS NULL OR m.retained_until > latest.created_at + ($1 || ' days')::interval)`,
    [String(rejectedDays)],
  );
  const due = await client.query(
    `SELECT id, report_id, object_path, retained_until
     FROM report_media
     WHERE deleted_at IS NULL AND retained_until IS NOT NULL AND retained_until <= now()
     ORDER BY retained_until`,
  );

  if (dryRun) {
    await client.query("ROLLBACK");
    console.log(JSON.stringify({
      dryRun: true,
      retentionDays,
      rejectedDays,
      backfilled: backfill.rowCount,
      shortened: shortened.rowCount,
      due: due.rowCount,
      candidates: due.rows,
    }, null, 2));
  } else {
    await client.query("COMMIT");
    let deleted = 0;
    for (const row of due.rows) {
      const { error } = await storage.from(bucket).remove([row.object_path]);
      if (error && !/object.*not found|does not exist/i.test(error.message)) {
        failures += 1;
        console.error("Gagal menghapus objek", row.object_path, error.message);
        continue;
      }
      const updated = await client.query(
        "UPDATE report_media SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL",
        [row.id],
      );
      if (updated.rowCount === 1) deleted += 1;
    }
    console.log(JSON.stringify({
      dryRun: false,
      retentionDays,
      rejectedDays,
      backfilled: backfill.rowCount,
      shortened: shortened.rowCount,
      due: due.rowCount,
      deleted,
      failures,
    }, null, 2));
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => undefined);
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.end();
}

if (failures > 0) process.exitCode = 1;
