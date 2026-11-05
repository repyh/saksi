-- PostGIS is installed in Supabase's `extensions` schema by the earlier foundation migration.
SET search_path TO public, extensions;

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'NEEDS_MORE_INFO', 'PUBLISHED', 'REJECTED', 'WITHDRAWN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ReportDamageType" AS ENUM ('POTHOLE', 'CRACK', 'SUBSIDENCE', 'STANDING_WATER', 'BLOCKED_DRAINAGE', 'DAMAGED_BRIDGE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportObservedCause" AS ENUM ('HEAVY_VEHICLE', 'NO_DRAINAGE', 'RECURRING_FLOODING', 'HEAVY_TRAFFIC', 'UNSUITABLE_MATERIAL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReportCoarseSize" AS ENUM ('PALM', 'TIRE', 'OVER_1M2');

-- CreateEnum
CREATE TYPE "ReportLocationSource" AS ENUM ('MANUAL_AREA', 'DEVICE_RESOLVED_AREA', 'PACKAGE_REFERENCE_ONLY', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ReportPackageSelectionSource" AS ENUM ('PACKAGE_PAGE', 'CANDIDATE_LIST');

-- CreateEnum
CREATE TYPE "ReportIdempotencyStatus" AS ENUM ('PROCESSING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "AdministrativeAreaLevel" AS ENUM ('RW', 'KELURAHAN', 'KECAMATAN');

-- CreateEnum
CREATE TYPE "RoadLocationPrecision" AS ENUM ('RW', 'KELURAHAN', 'KECAMATAN', 'KABUPATEN');

-- CreateTable
CREATE TABLE "administrative_areas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "stable_key" VARCHAR(180) NOT NULL,
    "level" "AdministrativeAreaLevel" NOT NULL,
    "district_name" VARCHAR(160) NOT NULL,
    "village_name" VARCHAR(160),
    "rw_code" VARCHAR(32),
    "geometry" extensions.geometry(MultiPolygon, 4326) NOT NULL,
    "source_name" VARCHAR(120) NOT NULL,
    "source_feature_id" VARCHAR(120),
    "dataset_version" VARCHAR(120) NOT NULL,
    "source_retrieved_at" TIMESTAMPTZ(6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "administrative_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "road_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rup" VARCHAR(32) NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "agency_name" TEXT NOT NULL,
    "budget" DECIMAL(20,0) NOT NULL,
    "method" TEXT NOT NULL,
    "source_name" VARCHAR(120) NOT NULL,
    "source_url" TEXT,
    "source_retrieved_at" TIMESTAMPTZ(6) NOT NULL,
    "dataset_version" VARCHAR(120) NOT NULL,
    "dataset_checksum" VARCHAR(128),
    "location_precision" "RoadLocationPrecision" NOT NULL,
    "official_district" VARCHAR(160),
    "official_village" VARCHAR(160),
    "rw_code" VARCHAR(32),
    "micro_location" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "road_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "public_code" VARCHAR(64) NOT NULL,
    "reporter_user_id" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'SUBMITTED',
    "damage_type" "ReportDamageType" NOT NULL,
    "observed_causes" "ReportObservedCause"[] DEFAULT ARRAY[]::"ReportObservedCause"[],
    "coarse_size" "ReportCoarseSize",
    "description" VARCHAR(500),
    "area_id" UUID,
    "area_name_snapshot" VARCHAR(160),
    "district_name_snapshot" VARCHAR(160),
    "rw_code_snapshot" VARCHAR(32),
    "area_dataset_version" VARCHAR(120),
    "location_source" "ReportLocationSource" NOT NULL DEFAULT 'UNKNOWN',
    "location_hint" VARCHAR(180),
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_media" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_id" UUID NOT NULL,
    "object_path" VARCHAR(512) NOT NULL,
    "media_type" VARCHAR(80) NOT NULL DEFAULT 'image/webp',
    "byte_size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sanitizer_version" VARCHAR(80) NOT NULL,
    "retained_until" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_media_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "report_media_byte_size_check" CHECK ("byte_size" BETWEEN 1 AND 5242880),
    CONSTRAINT "report_media_dimensions_check" CHECK ("width" BETWEEN 1 AND 1024 AND "height" BETWEEN 1 AND 1024),
    CONSTRAINT "report_media_type_check" CHECK ("media_type" = 'image/webp')
);

-- CreateTable
CREATE TABLE "report_package_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_id" UUID NOT NULL,
    "road_package_id" UUID NOT NULL,
    "rup_snapshot" VARCHAR(32) NOT NULL,
    "package_name_snapshot" TEXT NOT NULL,
    "selection_source" "ReportPackageSelectionSource" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_package_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_status_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_id" UUID NOT NULL,
    "actor_user_id" TEXT,
    "from_status" "ReportStatus",
    "to_status" "ReportStatus" NOT NULL,
    "reason" VARCHAR(1000),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_idempotency_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key_hash" VARCHAR(64) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "attempt_id" UUID NOT NULL,
    "status" "ReportIdempotencyStatus" NOT NULL DEFAULT 'PROCESSING',
    "staged_object_path" VARCHAR(512),
    "report_id" UUID,
    "response_code" VARCHAR(64),
    "lease_expires_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "report_idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "administrative_areas_stable_key_key" ON "administrative_areas"("stable_key");

-- CreateIndex
CREATE INDEX "administrative_areas_level_is_active_idx" ON "administrative_areas"("level", "is_active");

-- CreateIndex
CREATE INDEX "administrative_areas_district_name_village_name_rw_code_idx" ON "administrative_areas"("district_name", "village_name", "rw_code");

-- CreateIndex
CREATE INDEX "administrative_areas_geometry_gist_idx" ON "administrative_areas" USING GIST ("geometry");

-- CreateIndex
CREATE UNIQUE INDEX "road_packages_rup_key" ON "road_packages"("rup");

-- CreateIndex
CREATE INDEX "road_packages_year_idx" ON "road_packages"("year");

-- CreateIndex
CREATE INDEX "road_packages_official_district_official_village_rw_code_idx" ON "road_packages"("official_district", "official_village", "rw_code");

-- CreateIndex
CREATE UNIQUE INDEX "reports_public_code_key" ON "reports"("public_code");

-- CreateIndex
CREATE INDEX "reports_status_submitted_at_idx" ON "reports"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "reports_area_id_submitted_at_idx" ON "reports"("area_id", "submitted_at");

-- CreateIndex
CREATE INDEX "reports_reporter_user_id_submitted_at_idx" ON "reports"("reporter_user_id", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_media_report_id_key" ON "report_media"("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "report_media_object_path_key" ON "report_media"("object_path");

-- CreateIndex
CREATE INDEX "report_media_retained_until_idx" ON "report_media"("retained_until");

-- CreateIndex
CREATE UNIQUE INDEX "report_package_links_report_id_key" ON "report_package_links"("report_id");

-- CreateIndex
CREATE INDEX "report_package_links_road_package_id_idx" ON "report_package_links"("road_package_id");

-- CreateIndex
CREATE INDEX "report_status_events_report_id_created_at_idx" ON "report_status_events"("report_id", "created_at");

-- CreateIndex
CREATE INDEX "report_status_events_actor_user_id_created_at_idx" ON "report_status_events"("actor_user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_idempotency_keys_key_hash_key" ON "report_idempotency_keys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "report_idempotency_keys_report_id_key" ON "report_idempotency_keys"("report_id");

-- CreateIndex
CREATE INDEX "report_idempotency_keys_status_lease_expires_at_idx" ON "report_idempotency_keys"("status", "lease_expires_at");

-- CreateIndex
CREATE INDEX "report_idempotency_keys_expires_at_idx" ON "report_idempotency_keys"("expires_at");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "administrative_areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_media" ADD CONSTRAINT "report_media_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_package_links" ADD CONSTRAINT "report_package_links_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_package_links" ADD CONSTRAINT "report_package_links_road_package_id_fkey" FOREIGN KEY ("road_package_id") REFERENCES "road_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_status_events" ADD CONSTRAINT "report_status_events_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_status_events" ADD CONSTRAINT "report_status_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_idempotency_keys" ADD CONSTRAINT "report_idempotency_keys_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Status history is append-only, including against accidental application updates/deletes.
CREATE FUNCTION prevent_report_status_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'report status events are append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "report_status_events_append_only"
BEFORE UPDATE OR DELETE ON "report_status_events"
FOR EACH ROW EXECUTE FUNCTION prevent_report_status_event_mutation();
