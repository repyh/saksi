import "server-only";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/shared/api-error";
import {
  findReportAreaSnapshot,
  type ReportAreaSnapshot,
} from "@/server/reports/report-area-catalog";

export type ReportPoint = {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
};

export type ReportRoadReference = {
  id: string;
  name: string;
  number: string | null;
  sourceVersion: string;
};

export type ResolvedReportLocation = {
  point: ReportPoint | null;
  /** Wilayah hasil derivasi server untuk titik, atau fallback areaKey lama. */
  area: ReportAreaSnapshot | null;
  road: ReportRoadReference | null;
};

type AreaRow = {
  stableKey: string;
  level: "RW" | "KELURAHAN" | "KECAMATAN";
  districtName: string;
  villageName: string | null;
  rwCode: string | null;
  datasetVersion: string;
};

function pointSql(longitude: number, latitude: number) {
  return `extensions.ST_SetSRID(extensions.ST_MakePoint(${longitude}, ${latitude}), 4326)`;
}

async function pointInRegion(regionId: string, longitude: number, latitude: number) {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `SELECT id FROM administrative_areas
      WHERE region_id = $1
        AND level = 'KECAMATAN'::"AdministrativeAreaLevel"
        AND is_active = true
        AND extensions.ST_Contains(geometry, ${pointSql(longitude, latitude)})
      LIMIT 1`,
    regionId,
  );
  return rows.length > 0;
}

async function deriveArea(regionId: string, longitude: number, latitude: number): Promise<ReportAreaSnapshot | null> {
  const rows = await prisma.$queryRawUnsafe<AreaRow[]>(
    `SELECT stable_key AS "stableKey",
            level::text AS "level",
            district_name AS "districtName",
            village_name AS "villageName",
            rw_code AS "rwCode",
            dataset_version AS "datasetVersion"
       FROM administrative_areas
      WHERE region_id = $1
        AND is_active = true
        AND extensions.ST_Contains(geometry, ${pointSql(longitude, latitude)})
      ORDER BY CASE level
                 WHEN 'RW' THEN 0
                 WHEN 'KELURAHAN' THEN 1
                 ELSE 2
               END
      LIMIT 1`,
    regionId,
  );
  const row = rows[0];
  if (!row) return null;
  return {
    stableKey: row.stableKey,
    level: row.level,
    districtName: row.districtName,
    villageName: row.villageName,
    rwCode: row.rwCode,
    datasetVersion: row.datasetVersion,
  };
}

/**
 * Validasi lokasi laporan di server. Titik harus berada di dalam region; wilayah laporan
 * selalu diturunkan dari PostGIS, bukan dari areaKey kiriman klien. Ruas hanya anotasi:
 * ketidakberirisan tidak menolak laporan, dan peringatannya urusan UI.
 */
export async function resolveReportLocation(input: {
  regionId: string;
  latitude?: number;
  longitude?: number;
  accuracyM?: number;
  roadSegmentId?: string;
  areaKey?: string;
}): Promise<ResolvedReportLocation> {
  const hasPoint = input.latitude !== undefined && input.longitude !== undefined;

  let area: ReportAreaSnapshot | null = null;
  if (hasPoint) {
    const inside = await pointInRegion(input.regionId, input.longitude!, input.latitude!);
    if (!inside) {
      throw new ApiError(
        422,
        "REPORT_POINT_OUTSIDE_REGION",
        "Titik laporan berada di luar wilayah kerja. Geser pin ke dalam Kota Tangerang.",
      );
    }
    area = await deriveArea(input.regionId, input.longitude!, input.latitude!);
    if (!area) {
      throw new ApiError(
        422,
        "REPORT_POINT_UNRESOLVED_AREA",
        "Wilayah titik laporan belum dapat ditentukan. Pilih wilayah secara manual.",
      );
    }
  } else if (input.areaKey) {
    area = await findReportAreaSnapshot(input.areaKey);
  }

  let road: ReportRoadReference | null = null;
  if (input.roadSegmentId) {
    const segment = await prisma.roadSegment.findFirst({
      where: { id: input.roadSegmentId, regionId: input.regionId, isActive: true },
      select: { id: true, name: true, number: true, datasetVersion: true },
    });
    if (!segment) {
      throw new ApiError(422, "UNKNOWN_ROAD_SEGMENT", "Ruas jalan yang dipilih tidak ditemukan pada data terbaru.");
    }
    road = {
      id: segment.id,
      name: segment.name,
      number: segment.number,
      sourceVersion: segment.datasetVersion,
    };
  }

  return {
    point: hasPoint
      ? {
        latitude: input.latitude!,
        longitude: input.longitude!,
        accuracyM: input.accuracyM ?? null,
      }
      : null,
    area,
    road,
  };
}
