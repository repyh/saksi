import "server-only";
import { ApiController } from "@/server/api/shared/api-controller";
import { ApiError } from "@/server/api/shared/api-error";
import { prisma } from "@/lib/prisma";
import { getRegionOrNull, DEFAULT_REGION_ID } from "@/server/regions/region-registry";
import {
  roadGroupQuerySchema,
  roadSegmentQuerySchema,
  type RoadGroupsResponse,
  type RoadSegmentsResponse,
  type RoadSegment,
} from "@/contracts/reports/road-search.contract";

type GroupRow = { name: string | null; count: number };
type SegmentRow = {
  id: string;
  name: string | null;
  number: string | null;
  roadClass: string;
  surface: string | null;
  lengthM: number | null;
  widthM: number | null;
  geometry: unknown;
};

export class RoadsApi extends ApiController {
  groups(request: Request): Promise<Response> {
    return this.withPublicCache(this.respond(async (): Promise<RoadGroupsResponse> => {
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "ROADS_UNAVAILABLE", "Pencarian ruas belum tersedia.");
      }
      const url = new URL(request.url);
      const parsed = roadGroupQuerySchema.safeParse({
        region: url.searchParams.get("region")?.trim() || undefined,
        q: url.searchParams.get("q")?.trim() || undefined,
      });
      if (!parsed.success) throw new ApiError(400, "INVALID_ROAD_QUERY", "Pencarian ruas tidak valid.");
      const regionId = parsed.data.region ?? DEFAULT_REGION_ID;
      if (!getRegionOrNull(regionId)) throw new ApiError(400, "INVALID_REGION", "Region tidak dikenal.");

      const q = parsed.data.q ?? "";
      const rows = await prisma.$queryRawUnsafe<GroupRow[]>(
        `SELECT name, count(*)::int AS "count"
           FROM road_segments
          WHERE region_id = $1
            AND is_active = true
            AND ($2 = '' OR name ILIKE '%' || $2 || '%')
          GROUP BY name
          ORDER BY "count" DESC, name ASC NULLS LAST
          LIMIT 60`,
        regionId,
        q,
      );
      return {
        groups: rows.map((row) => ({ name: row.name, count: Number(row.count) })),
      };
    }, {
      code: "ROADS_UNAVAILABLE",
      message: "Pencarian ruas belum dapat dimuat.",
    }));
  }

  segments(request: Request): Promise<Response> {
    return this.withPublicCache(this.respond(async (): Promise<RoadSegmentsResponse> => {
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "ROADS_UNAVAILABLE", "Pencarian ruas belum tersedia.");
      }
      const url = new URL(request.url);
      const parsed = roadSegmentQuerySchema.safeParse({
        region: url.searchParams.get("region")?.trim() || undefined,
        name: url.searchParams.get("name") ?? undefined,
        unnamed: url.searchParams.get("unnamed") ?? undefined,
      });
      if (!parsed.success) throw new ApiError(400, "INVALID_ROAD_QUERY", "Pencarian ruas tidak valid.");
      const regionId = parsed.data.region ?? DEFAULT_REGION_ID;
      if (!getRegionOrNull(regionId)) throw new ApiError(400, "INVALID_REGION", "Region tidak dikenal.");

      const unnamed = parsed.data.unnamed === "1";
      const name = parsed.data.name?.trim() ?? "";
      if (!unnamed && !name) return { segments: [] };

      const rows = await prisma.$queryRawUnsafe<SegmentRow[]>(
        `SELECT id::text AS id, name, number, road_class AS "roadClass", surface,
                length_m::float8 AS "lengthM", width_m::float8 AS "widthM",
                extensions.ST_AsGeoJSON(geometry)::json AS geometry
           FROM road_segments
          WHERE region_id = $1
            AND is_active = true
            AND ${unnamed ? "name IS NULL" : "name = $2"}
          ORDER BY name ASC NULLS LAST, id ASC
          LIMIT 200`,
        ...(unnamed ? [regionId] : [regionId, name]),
      );
      return {
        segments: rows.map((row) => ({
          id: row.id,
          name: row.name,
          number: row.number,
          roadClass: row.roadClass,
          surface: row.surface,
          lengthM: row.lengthM === null ? null : Number(row.lengthM),
          widthM: row.widthM === null ? null : Number(row.widthM),
          geometry: row.geometry as RoadSegment["geometry"],
        })),
      };
    }, {
      code: "ROADS_UNAVAILABLE",
      message: "Ruas jalan belum dapat dimuat.",
    }));
  }

  private async withPublicCache(response: Promise<Response>): Promise<Response> {
    const result = await response;
    const headers = new Headers(result.headers);
    headers.set("Cache-Control", "public, max-age=60");
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
  }
}

export const roadsApi = new RoadsApi();
