-- Migrasi aditif: layer jaringan jalan sebagai referensi, plus titik/ruas pada laporan.
-- Tidak ada kolom lama yang diubah atau dihapus; laporan lama tetap valid tanpa titik/ruas.
SET search_path TO public, extensions;

-- AlterEnum
ALTER TYPE "IngestionSourceKind" ADD VALUE IF NOT EXISTS 'ROAD_NETWORK';
ALTER TYPE "ReportLocationSource" ADD VALUE IF NOT EXISTS 'DEVICE_GEOLOCATION';
ALTER TYPE "ReportLocationSource" ADD VALUE IF NOT EXISTS 'ADDRESS_GEOCODE';
ALTER TYPE "ReportLocationSource" ADD VALUE IF NOT EXISTS 'MAP_PIN';

-- CreateTable
CREATE TABLE "road_segments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region_id" VARCHAR(64) NOT NULL,
    "source_object_id" VARCHAR(64) NOT NULL,
    "name" TEXT NOT NULL,
    "number" VARCHAR(80),
    "length_m" DECIMAL(12,2),
    "width_m" DECIMAL(8,2),
    "district_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "village_names" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "geometry" extensions.geometry(Geometry, 4326) NOT NULL,
    "source_name" VARCHAR(120) NOT NULL,
    "source_url" TEXT,
    "source_retrieved_at" TIMESTAMPTZ(6) NOT NULL,
    "dataset_version" VARCHAR(120) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "road_segments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "road_segments_geometry_type_check"
      CHECK (extensions.GeometryType("geometry") IN ('LINESTRING', 'MULTILINESTRING'))
);

-- CreateIndex
CREATE UNIQUE INDEX "road_segments_region_id_source_object_id_key"
  ON "road_segments"("region_id", "source_object_id");
CREATE INDEX "road_segments_region_id_name_idx" ON "road_segments"("region_id", "name");
CREATE INDEX "road_segments_region_id_is_active_idx" ON "road_segments"("region_id", "is_active");
CREATE INDEX "road_segments_geometry_gist_idx" ON "road_segments" USING GIST ("geometry");

-- AlterTable
ALTER TABLE "reports"
  ADD COLUMN "location_point" extensions.geometry(Point, 4326),
  ADD COLUMN "location_accuracy_m" DOUBLE PRECISION,
  ADD COLUMN "public_location_consent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "road_segment_id" UUID,
  ADD COLUMN "road_name_snapshot" TEXT,
  ADD COLUMN "road_number_snapshot" VARCHAR(80),
  ADD COLUMN "road_source_version" VARCHAR(120);

-- CreateIndex
CREATE INDEX "reports_location_point_gist_idx" ON "reports" USING GIST ("location_point");
CREATE INDEX "reports_road_segment_id_idx" ON "reports"("road_segment_id");

-- AddForeignKey
ALTER TABLE "road_segments"
  ADD CONSTRAINT "road_segments_region_id_fkey"
  FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reports"
  ADD CONSTRAINT "reports_road_segment_id_fkey"
  FOREIGN KEY ("road_segment_id") REFERENCES "road_segments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The precise-location permission becomes active again; previously retired grants stay archived.
INSERT INTO "Permission" ("code", "description", "sensitive", "createdAt")
VALUES (
  'reports.read_precise_location',
  'View exact report locations and annotated road segments',
  true,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "description" = EXCLUDED."description",
  "sensitive" = EXCLUDED."sensitive";
