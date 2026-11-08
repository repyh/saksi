-- Migrasi aditif pipeline ingestion multi-region.
-- Tidak menyentuh tabel report/auth. Indeks unik lama diganti versi per-region;
-- tidak ada baris yang dihapus. Backfill region memakai nilai bawaan kota-tangerang.
SET search_path TO public, extensions;

-- CreateEnum
CREATE TYPE "IngestionRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "IngestionTrigger" AS ENUM ('MANUAL', 'CRON', 'BACKFILL');

-- CreateEnum
CREATE TYPE "IngestionSourceKind" AS ENUM ('RUP', 'RUP_DETAIL', 'REALISASI', 'LPSE', 'BOUNDARY', 'SNAPSHOT');

-- CreateEnum
CREATE TYPE "IngestionStepStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('SOURCE_EXPORT', 'GEOJSON', 'SNAPSHOT', 'MANIFEST');

-- CreateEnum
CREATE TYPE "RoadPackageAreaRole" AS ENUM ('RW', 'KELURAHAN', 'KECAMATAN');

-- DropIndex
DROP INDEX "administrative_areas_district_name_village_name_rw_code_idx";

-- DropIndex
DROP INDEX "administrative_areas_level_is_active_idx";

-- DropIndex
DROP INDEX "administrative_areas_stable_key_key";

-- DropIndex
DROP INDEX "road_packages_official_district_official_village_rw_code_idx";

-- DropIndex
DROP INDEX "road_packages_rup_key";

-- DropIndex
DROP INDEX "road_packages_year_idx";

-- CreateTable
CREATE TABLE "regions" (
    "id" VARCHAR(64) NOT NULL,
    "label" VARCHAR(160) NOT NULL,
    "instansi" VARCHAR(32) NOT NULL,
    "years" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Jakarta',
    "config" JSONB,
    "config_checksum" VARCHAR(64),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- Seed region awal. Migrasi tetap aditif: baris lama (bila ada) memakai region ini,
-- lalu default dihapus agar region baru wajib eksplisit.
INSERT INTO "regions" ("id", "label", "instansi", "years", "timezone", "is_active", "updated_at")
VALUES ('kota-tangerang', 'Kota Tangerang', 'D44', ARRAY[2025, 2026], 'Asia/Jakarta', true, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "administrative_areas"
  ADD COLUMN "region_id" VARCHAR(64) NOT NULL DEFAULT 'kota-tangerang',
  ADD COLUMN "source_artifact_id" UUID,
  ADD COLUMN "source_checksum" VARCHAR(64);
ALTER TABLE "administrative_areas" ALTER COLUMN "region_id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "road_packages"
  ADD COLUMN "region_id" VARCHAR(64) NOT NULL DEFAULT 'kota-tangerang',
  ADD COLUMN "rup_package_id" UUID;
ALTER TABLE "road_packages" ALTER COLUMN "region_id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "data_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region_id" VARCHAR(64) NOT NULL,
    "kind" "IngestionSourceKind" NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "endpoint" TEXT,
    "format" VARCHAR(40),
    "license" VARCHAR(160),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region_id" VARCHAR(64) NOT NULL,
    "trigger" "IngestionTrigger" NOT NULL DEFAULT 'MANUAL',
    "status" "IngestionRunStatus" NOT NULL DEFAULT 'RUNNING',
    "dry_run" BOOLEAN NOT NULL DEFAULT false,
    "requested_sources" "IngestionSourceKind"[] DEFAULT ARRAY[]::"IngestionSourceKind"[],
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(6),
    "duration_ms" INTEGER,
    "git_commit" VARCHAR(64),
    "host_name" VARCHAR(160),
    "lock_owner" VARCHAR(160),
    "error_code" VARCHAR(80),
    "error_message" TEXT,
    "stats" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_run_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_id" UUID NOT NULL,
    "step" VARCHAR(64) NOT NULL,
    "status" "IngestionStepStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "started_at" TIMESTAMPTZ(6),
    "finished_at" TIMESTAMPTZ(6),
    "record_count" INTEGER,
    "checksum" VARCHAR(64),
    "error_message" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_run_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_artifacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region_id" VARCHAR(64) NOT NULL,
    "source_id" UUID NOT NULL,
    "kind" "ArtifactKind" NOT NULL,
    "artifact_key" VARCHAR(256) NOT NULL,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "record_count" INTEGER,
    "retrieved_at" TIMESTAMPTZ(6) NOT NULL,
    "parser_version" VARCHAR(64) NOT NULL,
    "schema_version" VARCHAR(64) NOT NULL,
    "storage_path" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_run_artifacts" (
    "run_id" UUID NOT NULL,
    "artifact_id" UUID NOT NULL,
    "role" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingestion_run_artifacts_pkey" PRIMARY KEY ("run_id","artifact_id")
);

-- CreateTable
CREATE TABLE "raw_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artifact_id" UUID NOT NULL,
    "source_kind" "IngestionSourceKind" NOT NULL,
    "external_key" VARCHAR(256),
    "row_index" INTEGER NOT NULL,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rup_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region_id" VARCHAR(64) NOT NULL,
    "source_artifact_id" UUID,
    "kode_rup" VARCHAR(32) NOT NULL,
    "tahun" INTEGER NOT NULL,
    "satker" TEXT NOT NULL,
    "instansi" VARCHAR(160),
    "name" TEXT NOT NULL,
    "cara" VARCHAR(32),
    "method" VARCHAR(64),
    "jenis" VARCHAR(64),
    "sumber_dana" TEXT,
    "total_nilai" DECIMAL(20,0) NOT NULL,
    "pdn" VARCHAR(8),
    "umk" VARCHAR(8),
    "is_road" BOOLEAN NOT NULL DEFAULT false,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "source_retrieved_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rup_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rup_details" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rup_package_id" UUID NOT NULL,
    "region_id" VARCHAR(64) NOT NULL,
    "source_artifact_id" UUID,
    "kode_rup" VARCHAR(32) NOT NULL,
    "tahun" INTEGER NOT NULL,
    "satker" TEXT,
    "jadwal_pemilihan_mulai" VARCHAR(40),
    "jadwal_pemilihan_akhir" VARCHAR(40),
    "jadwal_kontrak_mulai" VARCHAR(40),
    "jadwal_kontrak_akhir" VARCHAR(40),
    "lokasi_raw" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uraian" TEXT,
    "volume" TEXT,
    "spesifikasi" TEXT,
    "mak" VARCHAR(120),
    "funding_sources" JSONB,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "rup_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "normalized_name" VARCHAR(256) NOT NULL,
    "display_name" TEXT NOT NULL,
    "npwp_masked" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lpse_contracts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region_id" VARCHAR(64) NOT NULL,
    "source_artifact_id" UUID,
    "road_package_id" UUID,
    "rup_package_id" UUID,
    "vendor_id" UUID,
    "kode_rup" VARCHAR(32) NOT NULL,
    "lpse_id" VARCHAR(64) NOT NULL,
    "jenis_lpse" VARCHAR(32) NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT,
    "method" TEXT,
    "satker" TEXT,
    "pagu_lpse" DECIMAL(20,0),
    "hps" DECIMAL(20,0),
    "pemenang_name" TEXT,
    "npwp_masked" VARCHAR(64),
    "nilai_kontrak" DECIMAL(20,0),
    "tahun" INTEGER NOT NULL,
    "matched_via" VARCHAR(24),
    "url" TEXT,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "source_retrieved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "lpse_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realization_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region_id" VARCHAR(64) NOT NULL,
    "source_artifact_id" UUID,
    "vendor_id" UUID,
    "kode_paket" VARCHAR(96) NOT NULL,
    "tahun" INTEGER NOT NULL,
    "name" TEXT,
    "satker" TEXT,
    "metode" VARCHAR(64),
    "sumber_transaksi" VARCHAR(64),
    "total_nilai" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "transaction_count" INTEGER NOT NULL DEFAULT 0,
    "rup_count" INTEGER NOT NULL DEFAULT 0,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "first_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "realization_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realization_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region_id" VARCHAR(64) NOT NULL,
    "package_id" UUID NOT NULL,
    "source_artifact_id" UUID,
    "vendor_id" UUID,
    "kode_paket" VARCHAR(96) NOT NULL,
    "kode_rup" VARCHAR(32),
    "tahun" INTEGER NOT NULL,
    "metode" VARCHAR(64),
    "sumber_transaksi" VARCHAR(64),
    "satker" TEXT,
    "name" TEXT,
    "penyedia_raw" TEXT,
    "nilai" DECIMAL(20,0) NOT NULL DEFAULT 0,
    "checksum_sha256" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "realization_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "realization_package_rups" (
    "package_id" UUID NOT NULL,
    "rup_package_id" UUID NOT NULL,
    "kode_rup" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "realization_package_rups_pkey" PRIMARY KEY ("package_id","rup_package_id")
);

-- CreateTable
CREATE TABLE "road_package_area_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "road_package_id" UUID NOT NULL,
    "area_id" UUID NOT NULL,
    "role" "RoadPackageAreaRole" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "road_package_area_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "region_manifests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region_id" VARCHAR(64) NOT NULL,
    "run_id" UUID NOT NULL,
    "snapshot_path" VARCHAR(256) NOT NULL,
    "snapshot_checksum" VARCHAR(64) NOT NULL,
    "gate_passed" BOOLEAN NOT NULL,
    "metrics" JSONB NOT NULL,
    "checksums" JSONB NOT NULL,
    "generated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "region_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingestion_locks" (
    "region_id" VARCHAR(64) NOT NULL,
    "run_id" UUID,
    "owner" VARCHAR(160) NOT NULL,
    "acquired_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeat_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ingestion_locks_pkey" PRIMARY KEY ("region_id")
);

-- CreateIndex
CREATE INDEX "data_sources_region_id_kind_idx" ON "data_sources"("region_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "data_sources_region_id_kind_name_key" ON "data_sources"("region_id", "kind", "name");

-- CreateIndex
CREATE INDEX "ingestion_runs_region_id_started_at_idx" ON "ingestion_runs"("region_id", "started_at");

-- CreateIndex
CREATE INDEX "ingestion_runs_status_started_at_idx" ON "ingestion_runs"("status", "started_at");

-- CreateIndex
CREATE INDEX "ingestion_run_steps_run_id_status_idx" ON "ingestion_run_steps"("run_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ingestion_run_steps_run_id_step_attempt_key" ON "ingestion_run_steps"("run_id", "step", "attempt");

-- CreateIndex
CREATE INDEX "source_artifacts_region_id_kind_retrieved_at_idx" ON "source_artifacts"("region_id", "kind", "retrieved_at");

-- CreateIndex
CREATE UNIQUE INDEX "source_artifacts_source_id_checksum_sha256_key" ON "source_artifacts"("source_id", "checksum_sha256");

-- CreateIndex
CREATE INDEX "ingestion_run_artifacts_artifact_id_idx" ON "ingestion_run_artifacts"("artifact_id");

-- CreateIndex
CREATE INDEX "raw_records_source_kind_external_key_idx" ON "raw_records"("source_kind", "external_key");

-- CreateIndex
CREATE INDEX "raw_records_checksum_sha256_idx" ON "raw_records"("checksum_sha256");

-- CreateIndex
CREATE UNIQUE INDEX "raw_records_artifact_id_row_index_key" ON "raw_records"("artifact_id", "row_index");

-- CreateIndex
CREATE INDEX "rup_packages_region_id_tahun_idx" ON "rup_packages"("region_id", "tahun");

-- CreateIndex
CREATE INDEX "rup_packages_region_id_is_road_idx" ON "rup_packages"("region_id", "is_road");

-- CreateIndex
CREATE INDEX "rup_packages_region_id_method_idx" ON "rup_packages"("region_id", "method");

-- CreateIndex
CREATE UNIQUE INDEX "rup_packages_region_id_kode_rup_key" ON "rup_packages"("region_id", "kode_rup");

-- CreateIndex
CREATE UNIQUE INDEX "rup_details_rup_package_id_key" ON "rup_details"("rup_package_id");

-- CreateIndex
CREATE INDEX "rup_details_region_id_tahun_idx" ON "rup_details"("region_id", "tahun");

-- CreateIndex
CREATE INDEX "rup_details_kode_rup_idx" ON "rup_details"("kode_rup");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_normalized_name_key" ON "vendors"("normalized_name");

-- CreateIndex
CREATE INDEX "vendors_display_name_idx" ON "vendors"("display_name");

-- CreateIndex
CREATE INDEX "lpse_contracts_region_id_kode_rup_idx" ON "lpse_contracts"("region_id", "kode_rup");

-- CreateIndex
CREATE INDEX "lpse_contracts_region_id_tahun_idx" ON "lpse_contracts"("region_id", "tahun");

-- CreateIndex
CREATE INDEX "lpse_contracts_vendor_id_idx" ON "lpse_contracts"("vendor_id");

-- CreateIndex
CREATE INDEX "lpse_contracts_road_package_id_idx" ON "lpse_contracts"("road_package_id");

-- CreateIndex
CREATE UNIQUE INDEX "lpse_contracts_region_id_lpse_id_key" ON "lpse_contracts"("region_id", "lpse_id");

-- CreateIndex
CREATE INDEX "realization_packages_region_id_tahun_idx" ON "realization_packages"("region_id", "tahun");

-- CreateIndex
CREATE INDEX "realization_packages_vendor_id_idx" ON "realization_packages"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "realization_packages_region_id_kode_paket_tahun_key" ON "realization_packages"("region_id", "kode_paket", "tahun");

-- CreateIndex
CREATE INDEX "realization_transactions_region_id_tahun_idx" ON "realization_transactions"("region_id", "tahun");

-- CreateIndex
CREATE INDEX "realization_transactions_region_id_kode_rup_idx" ON "realization_transactions"("region_id", "kode_rup");

-- CreateIndex
CREATE INDEX "realization_transactions_package_id_idx" ON "realization_transactions"("package_id");

-- CreateIndex
CREATE INDEX "realization_transactions_vendor_id_idx" ON "realization_transactions"("vendor_id");

-- CreateIndex
CREATE UNIQUE INDEX "realization_transactions_region_id_checksum_sha256_key" ON "realization_transactions"("region_id", "checksum_sha256");

-- CreateIndex
CREATE INDEX "realization_package_rups_kode_rup_idx" ON "realization_package_rups"("kode_rup");

-- CreateIndex
CREATE INDEX "road_package_area_links_area_id_role_idx" ON "road_package_area_links"("area_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "road_package_area_links_road_package_id_role_key" ON "road_package_area_links"("road_package_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "region_manifests_run_id_key" ON "region_manifests"("run_id");

-- CreateIndex
CREATE INDEX "region_manifests_region_id_generated_at_idx" ON "region_manifests"("region_id", "generated_at");

-- CreateIndex
CREATE INDEX "administrative_areas_region_id_level_is_active_idx" ON "administrative_areas"("region_id", "level", "is_active");

-- CreateIndex
CREATE INDEX "administrative_areas_region_id_district_name_village_name_r_idx" ON "administrative_areas"("region_id", "district_name", "village_name", "rw_code");

-- CreateIndex
CREATE UNIQUE INDEX "administrative_areas_region_id_stable_key_key" ON "administrative_areas"("region_id", "stable_key");

-- CreateIndex
CREATE INDEX "road_packages_region_id_year_idx" ON "road_packages"("region_id", "year");

-- CreateIndex
CREATE INDEX "road_packages_region_id_official_district_official_village__idx" ON "road_packages"("region_id", "official_district", "official_village", "rw_code");

-- CreateIndex
CREATE INDEX "road_packages_region_id_location_precision_idx" ON "road_packages"("region_id", "location_precision");

-- CreateIndex
CREATE UNIQUE INDEX "road_packages_region_id_rup_key" ON "road_packages"("region_id", "rup");

-- AddForeignKey
ALTER TABLE "administrative_areas" ADD CONSTRAINT "administrative_areas_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "administrative_areas" ADD CONSTRAINT "administrative_areas_source_artifact_id_fkey" FOREIGN KEY ("source_artifact_id") REFERENCES "source_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_packages" ADD CONSTRAINT "road_packages_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_packages" ADD CONSTRAINT "road_packages_rup_package_id_fkey" FOREIGN KEY ("rup_package_id") REFERENCES "rup_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_sources" ADD CONSTRAINT "data_sources_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_runs" ADD CONSTRAINT "ingestion_runs_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_run_steps" ADD CONSTRAINT "ingestion_run_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ingestion_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_artifacts" ADD CONSTRAINT "source_artifacts_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_artifacts" ADD CONSTRAINT "source_artifacts_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "data_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_run_artifacts" ADD CONSTRAINT "ingestion_run_artifacts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ingestion_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_run_artifacts" ADD CONSTRAINT "ingestion_run_artifacts_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "source_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "raw_records" ADD CONSTRAINT "raw_records_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "source_artifacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rup_packages" ADD CONSTRAINT "rup_packages_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rup_packages" ADD CONSTRAINT "rup_packages_source_artifact_id_fkey" FOREIGN KEY ("source_artifact_id") REFERENCES "source_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rup_details" ADD CONSTRAINT "rup_details_rup_package_id_fkey" FOREIGN KEY ("rup_package_id") REFERENCES "rup_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rup_details" ADD CONSTRAINT "rup_details_source_artifact_id_fkey" FOREIGN KEY ("source_artifact_id") REFERENCES "source_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rup_details" ADD CONSTRAINT "rup_details_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lpse_contracts" ADD CONSTRAINT "lpse_contracts_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lpse_contracts" ADD CONSTRAINT "lpse_contracts_source_artifact_id_fkey" FOREIGN KEY ("source_artifact_id") REFERENCES "source_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lpse_contracts" ADD CONSTRAINT "lpse_contracts_road_package_id_fkey" FOREIGN KEY ("road_package_id") REFERENCES "road_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lpse_contracts" ADD CONSTRAINT "lpse_contracts_rup_package_id_fkey" FOREIGN KEY ("rup_package_id") REFERENCES "rup_packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lpse_contracts" ADD CONSTRAINT "lpse_contracts_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realization_packages" ADD CONSTRAINT "realization_packages_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realization_packages" ADD CONSTRAINT "realization_packages_source_artifact_id_fkey" FOREIGN KEY ("source_artifact_id") REFERENCES "source_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realization_packages" ADD CONSTRAINT "realization_packages_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realization_transactions" ADD CONSTRAINT "realization_transactions_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realization_transactions" ADD CONSTRAINT "realization_transactions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "realization_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realization_transactions" ADD CONSTRAINT "realization_transactions_source_artifact_id_fkey" FOREIGN KEY ("source_artifact_id") REFERENCES "source_artifacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realization_transactions" ADD CONSTRAINT "realization_transactions_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realization_package_rups" ADD CONSTRAINT "realization_package_rups_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "realization_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "realization_package_rups" ADD CONSTRAINT "realization_package_rups_rup_package_id_fkey" FOREIGN KEY ("rup_package_id") REFERENCES "rup_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_package_area_links" ADD CONSTRAINT "road_package_area_links_road_package_id_fkey" FOREIGN KEY ("road_package_id") REFERENCES "road_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "road_package_area_links" ADD CONSTRAINT "road_package_area_links_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "administrative_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "region_manifests" ADD CONSTRAINT "region_manifests_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "region_manifests" ADD CONSTRAINT "region_manifests_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ingestion_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingestion_locks" ADD CONSTRAINT "ingestion_locks_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

