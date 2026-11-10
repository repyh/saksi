// Akses database worker lewat `pg` langsung. Schema tetap dimiliki Prisma; worker hanya
// memakai SQL parameterized agar batch besar (50 ribu transaksi) tidak membebani ORM.
import pg from "pg";
import { potong } from "./util.mjs";

export function bukaDb({ log } = {}) {
  const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL atau DIRECT_URL tidak diisi; worker DB tidak bisa dijalankan");
  }
  const client = new pg.Client({
    connectionString,
    ssl: /supabase|pooler|sslmode=require/i.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
    application_name: "saksi-ingestion-worker",
    statement_timeout: 120_000,
  });
  client.on("error", (error) => log?.("error", "koneksi database error", { error: error.message }));
  return client;
}

export async function transaksi(client, fn) {
  await client.query("BEGIN");
  try {
    const hasil = await fn();
    await client.query("COMMIT");
    return hasil;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  }
}

const kutip = (nama) => `"${nama}"`;

/**
 * Upsert batch generik. `columns` dan `conflict` berasal dari kode (bukan input pengguna).
 * `cast` sejajar columns; `update` kolom yang diperbarui saat konflik.
 */
export async function upsertBanyak(
  client,
  { table, columns, rows, conflict, cast = [], update = [], chunk = 400 },
) {
  if (!rows.length) return 0;
  const cols = columns.map(kutip).join(", ");
  const konflik = conflict.map(kutip).join(", ");
  const pembaruan = update.length
    ? `DO UPDATE SET ${update.map((c) => `${kutip(c)} = EXCLUDED.${kutip(c)}`).join(", ")}`
    : "DO NOTHING";
  let total = 0;

  for (const bagian of potong(rows, chunk)) {
    const params = [];
    const nilai = bagian
      .map(
        (row) =>
          `(${columns
            .map((c, i) => {
              params.push(row[c] ?? null);
              return `$${params.length}${cast[i] ? `::${cast[i]}` : ""}`;
            })
            .join(", ")})`,
      )
      .join(", ");
    await client.query(
      `INSERT INTO ${kutip(table)} (${cols}) VALUES ${nilai} ON CONFLICT (${konflik}) ${pembaruan}`,
      params,
    );
    total += bagian.length;
  }
  return total;
}

export async function simpanRegion(client, { region, checksum }) {
  const config = JSON.stringify({
    id: region.id,
    label: region.label,
    instansi: region.instansi,
    tahun: region.tahun,
    metadata: region.metadata,
    sumber: region.sumber,
    lpse: region.lpse,
    batas: region.batas,
  });
  const { rows } = await client.query(
    `INSERT INTO regions (id, label, instansi, years, timezone, config, config_checksum, is_active, updated_at)
     VALUES ($1,$2,$3,$4::int[],$5,$6::jsonb,$7,true,CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET label=EXCLUDED.label, instansi=EXCLUDED.instansi,
       years=EXCLUDED.years, timezone=EXCLUDED.timezone, config=EXCLUDED.config,
       config_checksum=EXCLUDED.config_checksum, is_active=true, updated_at=CURRENT_TIMESTAMP
     RETURNING id`,
    [region.id, region.label, region.instansi, region.tahun, "Asia/Jakarta", config, checksum],
  );
  return rows[0].id;
}

export async function simpanDataSource(client, sumber) {
  const metadata = JSON.stringify({
    format: sumber.format,
    role: sumber.role,
    path: sumber.path,
    level: sumber.level ?? null,
    parserVersion: sumber.parserVersion,
  });
  const { rows } = await client.query(
    `INSERT INTO data_sources (region_id, kind, name, endpoint, format, license, is_active, metadata, updated_at)
     VALUES ($1,$2::"IngestionSourceKind",$3,$4,$5,$6,true,$7::jsonb,CURRENT_TIMESTAMP)
     ON CONFLICT (region_id, kind, name) DO UPDATE SET endpoint=EXCLUDED.endpoint,
       format=EXCLUDED.format, license=EXCLUDED.license, is_active=true,
       metadata=EXCLUDED.metadata, updated_at=CURRENT_TIMESTAMP
     RETURNING id`,
    [
      sumber.regionId,
      sumber.kind,
      sumber.name,
      sumber.endpoint ?? null,
      sumber.format,
      sumber.license ?? null,
      metadata,
    ],
  );
  return rows[0].id;
}

export async function simpanArtifact(
  client,
  { regionId, sourceId, kind, artifactKey, checksum, byteSize, recordCount, retrievedAt, parserVersion, metadata },
) {
  const { rows } = await client.query(
    `INSERT INTO source_artifacts
       (region_id, source_id, kind, artifact_key, checksum_sha256, byte_size, record_count,
        retrieved_at, parser_version, schema_version, storage_path, metadata)
     VALUES ($1,$2,$3::"ArtifactKind",$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
     ON CONFLICT (source_id, checksum_sha256) DO UPDATE SET artifact_key=EXCLUDED.artifact_key
     RETURNING id`,
    [
      regionId,
      sourceId,
      kind,
      artifactKey,
      checksum,
      String(byteSize),
      recordCount,
      retrievedAt,
      parserVersion,
      "v1",
      artifactKey,
      JSON.stringify(metadata ?? {}),
    ],
  );
  return rows[0].id;
}

export async function tautkanArtifact(client, runId, artifactId, role) {
  await client.query(
    `INSERT INTO ingestion_run_artifacts (run_id, artifact_id, role) VALUES ($1,$2,$3)
     ON CONFLICT (run_id, artifact_id) DO UPDATE SET role=EXCLUDED.role`,
    [runId, artifactId, role],
  );
}

export async function simpanRawRecords(client, { artifactId, sourceKind, rows, chunk = 400 }) {
  if (!rows.length) return 0;
  let total = 0;
  for (const bagian of potong(rows, chunk)) {
    const params = [];
    const nilai = bagian
      .map((row) => {
        params.push(artifactId, sourceKind, row.externalKey ?? null, row.rowIndex, row.checksum, JSON.stringify(row.payload));
        const n = params.length;
        return `($${n - 5},$${n - 4}::"IngestionSourceKind",$${n - 3},$${n - 2},$${n - 1},$${n}::jsonb)`;
      })
      .join(", ");
    await client.query(
      `INSERT INTO raw_records (artifact_id, source_kind, external_key, row_index, checksum_sha256, payload)
       VALUES ${nilai} ON CONFLICT (artifact_id, row_index) DO NOTHING`,
      params,
    );
    total += bagian.length;
  }
  return total;
}

export async function simpanArea(client, { regionId, areas, chunk = 200 }) {
  if (!areas.length) return 0;
  let total = 0;
  for (const bagian of potong(areas, chunk)) {
    const params = [];
    const nilai = bagian
      .map((a) => {
        params.push(
          regionId,
          a.stableKey,
          a.level,
          a.districtName,
          a.villageName,
          a.rwCode,
          JSON.stringify(a.geometry),
          a.sourceName,
          a.sourceFeatureId,
          a.sourceArtifactId,
          a.sourceChecksum,
          a.datasetVersion,
          a.retrievedAt,
        );
        const n = params.length;
        return `($${n - 12},$${n - 11},$${n - 10}::"AdministrativeAreaLevel",$${n - 9},$${n - 8},$${n - 7},
          extensions.ST_Multi(extensions.ST_CollectionExtract(
            extensions.ST_MakeValid(extensions.ST_SetSRID(extensions.ST_GeomFromGeoJSON($${n - 6}), 4326)), 3)),
          $${n - 5},$${n - 4},$${n - 3},$${n - 2},$${n - 1},$${n},true,CURRENT_TIMESTAMP)`;
      })
      .join(", ");
    await client.query(
      `INSERT INTO administrative_areas
         (region_id, stable_key, level, district_name, village_name, rw_code, geometry,
          source_name, source_feature_id, source_artifact_id, source_checksum,
          dataset_version, source_retrieved_at, is_active, updated_at)
       VALUES ${nilai}
       ON CONFLICT (region_id, stable_key) DO UPDATE SET
         level=EXCLUDED.level, district_name=EXCLUDED.district_name,
         village_name=EXCLUDED.village_name, rw_code=EXCLUDED.rw_code,
         geometry=EXCLUDED.geometry, source_name=EXCLUDED.source_name,
         source_feature_id=EXCLUDED.source_feature_id,
         source_artifact_id=EXCLUDED.source_artifact_id,
         source_checksum=EXCLUDED.source_checksum, dataset_version=EXCLUDED.dataset_version,
         source_retrieved_at=EXCLUDED.source_retrieved_at, is_active=true,
         updated_at=CURRENT_TIMESTAMP`,
      params,
    );
    total += bagian.length;
  }
  return total;
}

export async function simpanSegmenJalan(client, { regionId, segments, chunk = 200 }) {
  if (!segments.length) return 0;
  let total = 0;
  for (const bagian of potong(segments, chunk)) {
    const params = [];
    const nilai = bagian
      .map((s) => {
        params.push(
          regionId,
          s.source_object_id,
          s.name,
          s.number,
          s.length_m,
          s.width_m,
          s.district_names,
          s.village_names,
          s.source_name,
          s.source_url,
          s.source_retrieved_at,
          s.dataset_version,
        );
        const n = params.length;
        params.push(s.geometry);
        return `($${n - 11},$${n - 10},$${n - 9},$${n - 8},$${n - 7},$${n - 6},
          $${n - 5}::text[],$${n - 4}::text[],$${n - 3},$${n - 2},$${n - 1},$${n},
          extensions.ST_SetSRID(extensions.ST_Force2D(extensions.ST_GeomFromGeoJSON($${n + 1})), 4326),
          true,CURRENT_TIMESTAMP)`;
      })
      .join(", ");
    await client.query(
      `INSERT INTO road_segments
         (region_id, source_object_id, name, number, length_m, width_m,
          district_names, village_names, source_name, source_url, source_retrieved_at,
          dataset_version, geometry, is_active, updated_at)
       VALUES ${nilai}
       ON CONFLICT (region_id, source_object_id) DO UPDATE SET
         name=EXCLUDED.name, number=EXCLUDED.number, length_m=EXCLUDED.length_m,
         width_m=EXCLUDED.width_m, district_names=EXCLUDED.district_names,
         village_names=EXCLUDED.village_names, source_name=EXCLUDED.source_name,
         source_url=EXCLUDED.source_url, source_retrieved_at=EXCLUDED.source_retrieved_at,
         dataset_version=EXCLUDED.dataset_version, geometry=EXCLUDED.geometry,
         is_active=true, updated_at=CURRENT_TIMESTAMP`,
      params,
    );
    total += bagian.length;
  }
  return total;
}

/** Segmen yang tidak lagi ada di snapshot ditandai nonaktif, bukan dihapus. */
export async function nonaktifkanSegmenJalan(client, { regionId, activeObjectIds }) {
  const { rowCount } = await client.query(
    `UPDATE road_segments SET is_active=false, updated_at=CURRENT_TIMESTAMP
      WHERE region_id=$1 AND is_active=true
        AND NOT (source_object_id = ANY($2::varchar[]))`,
    [regionId, activeObjectIds],
  );
  return rowCount;
}

export async function ambilIdMap(client, sql, params) {
  const { rows } = await client.query(sql, params);
  return new Map(rows.map((r) => [r.kunci, r.id]));
}

// ---- Riwayat run ----

export async function buatRun(client, { regionId, trigger, dryRun, sources, gitCommit, hostName, lockOwner, status = "RUNNING" }) {
  const { rows } = await client.query(
    `INSERT INTO ingestion_runs
       (region_id, trigger, status, dry_run, requested_sources, git_commit, host_name, lock_owner)
     VALUES ($1,$2::"IngestionTrigger",$3::"IngestionRunStatus",$4,$5::"IngestionSourceKind"[],$6,$7,$8)
     RETURNING id`,
    [regionId, trigger, status, dryRun, sources, gitCommit, hostName, lockOwner],
  );
  return rows[0].id;
}

export async function catatStep(client, { runId, step, status, attempt = 1, recordCount = null, checksum = null, errorMessage = null, metadata = null }) {
  await client.query(
    `INSERT INTO ingestion_run_steps
       (run_id, step, status, attempt, started_at, finished_at, record_count, checksum, error_message, metadata)
     VALUES ($1,$2,$3::"IngestionStepStatus",$4,
       CASE WHEN $3 = 'RUNNING' THEN CURRENT_TIMESTAMP ELSE NULL END,
       CASE WHEN $3 IN ('SUCCEEDED','FAILED','SKIPPED') THEN CURRENT_TIMESTAMP ELSE NULL END,
       $5,$6,$7,$8::jsonb)
     ON CONFLICT (run_id, step, attempt) DO UPDATE SET
       status=EXCLUDED.status,
       started_at=COALESCE(ingestion_run_steps.started_at, EXCLUDED.started_at, CURRENT_TIMESTAMP),
       finished_at=EXCLUDED.finished_at,
       record_count=COALESCE(EXCLUDED.record_count, ingestion_run_steps.record_count),
       checksum=COALESCE(EXCLUDED.checksum, ingestion_run_steps.checksum),
       error_message=EXCLUDED.error_message,
       metadata=COALESCE(EXCLUDED.metadata, ingestion_run_steps.metadata)`,
    [runId, step, status, attempt, recordCount, checksum, errorMessage, metadata ? JSON.stringify(metadata) : null],
  );
}

export async function selesaikanRun(client, { runId, stats, startedAt }) {
  await client.query(
    `UPDATE ingestion_runs SET status='SUCCEEDED', finished_at=CURRENT_TIMESTAMP,
       duration_ms=EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - $2))*1000, stats=$3::jsonb
     WHERE id=$1`,
    [runId, startedAt, JSON.stringify(stats)],
  );
}

export async function gagalkanRun(client, { runId, code, message, stats, startedAt }) {
  await client.query(
    `UPDATE ingestion_runs SET status='FAILED', finished_at=CURRENT_TIMESTAMP,
       duration_ms=EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - $2))*1000,
       error_code=$3, error_message=$4, stats=$5::jsonb
     WHERE id=$1`,
    [runId, startedAt, code ?? "INGESTION_FAILED", String(message ?? "").slice(0, 4000), JSON.stringify(stats ?? {})],
  );
}

export async function lewatiRun(client, { runId, code, message }) {
  await client.query(
    `UPDATE ingestion_runs SET status='SKIPPED', finished_at=CURRENT_TIMESTAMP,
       error_code=$2, error_message=$3 WHERE id=$1`,
    [runId, code, message],
  );
}

export async function simpanManifest(client, { regionId, runId, region, snapshotChecksum, gatePassed, metrics, checksums }) {
  await client.query(
    `INSERT INTO region_manifests
       (region_id, run_id, snapshot_path, snapshot_checksum, gate_passed, metrics, checksums)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb)
     ON CONFLICT (run_id) DO UPDATE SET snapshot_checksum=EXCLUDED.snapshot_checksum,
       gate_passed=EXCLUDED.gate_passed, metrics=EXCLUDED.metrics, checksums=EXCLUDED.checksums,
       generated_at=CURRENT_TIMESTAMP`,
    [
      regionId,
      runId,
      region.keluaran,
      snapshotChecksum,
      gatePassed,
      JSON.stringify(metrics),
      JSON.stringify(checksums),
    ],
  );
}

// ---- Lock anti-tumpang-tindih ----

export async function ambilLock(client, { regionId, runId, owner, ttlMs }) {
  const { rows } = await client.query(
    `INSERT INTO ingestion_locks (region_id, run_id, owner, acquired_at, heartbeat_at, expires_at)
     VALUES ($1,$2,$3,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP + ($4::int * interval '1 millisecond'))
     ON CONFLICT (region_id) DO UPDATE SET
       run_id=EXCLUDED.run_id, owner=EXCLUDED.owner, acquired_at=EXCLUDED.acquired_at,
       heartbeat_at=EXCLUDED.heartbeat_at, expires_at=EXCLUDED.expires_at
     WHERE ingestion_locks.expires_at < CURRENT_TIMESTAMP
        OR ingestion_locks.owner = EXCLUDED.owner
     RETURNING region_id, owner, expires_at`,
    [regionId, runId, owner, ttlMs],
  );
  return rows[0] ?? null;
}

export async function heartbeatLock(client, { regionId, owner, ttlMs }) {
  await client.query(
    `UPDATE ingestion_locks SET heartbeat_at=CURRENT_TIMESTAMP,
       expires_at=CURRENT_TIMESTAMP + ($3::int * interval '1 millisecond')
     WHERE region_id=$1 AND owner=$2`,
    [regionId, owner, ttlMs],
  );
}

export async function lepasLock(client, { regionId, owner }) {
  await client.query("DELETE FROM ingestion_locks WHERE region_id=$1 AND owner=$2", [regionId, owner]);
}

export async function infoLock(client, regionId) {
  const { rows } = await client.query("SELECT * FROM ingestion_locks WHERE region_id=$1", [regionId]);
  return rows[0] ?? null;
}
