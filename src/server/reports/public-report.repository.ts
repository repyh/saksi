import "server-only";
import { unstable_cache } from "next/cache";
import type { LineString, MultiLineString } from "geojson";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/shared/api-error";
import type {
  PublicReportDetail,
  PublicReportsQuery,
  PublicReportsResponse,
  ReportStatusChangeInput,
} from "@/contracts/reports/public-report.contract";

const PUBLIC_SELECT = {
  publicCode: true,
  damageType: true,
  coarseSize: true,
  areaNameSnapshot: true,
  districtNameSnapshot: true,
  roadNameSnapshot: true,
  roadNumberSnapshot: true,
  submittedAt: true,
  area: { select: { regionId: true } },
  packageLink: {
    select: {
      rupSnapshot: true,
      packageNameSnapshot: true,
      roadPackage: { select: { regionId: true } },
    },
  },
  statusEvents: {
    where: { toStatus: "PUBLISHED" as const },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { createdAt: true },
  },
} satisfies Prisma.ReportSelect;

const EDITABLE_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW", "NEEDS_MORE_INFO", "PUBLISHED"]);
const PUBLIC_REPORTS_CACHE_TAG = "published-reports";
const PUBLIC_REPORTS_REVALIDATE_SECONDS = 60;

function publicWhere(query: PublicReportsQuery): Prisma.ReportWhereInput {
  const where: Prisma.ReportWhereInput = { status: "PUBLISHED" };

  if (query.region) {
    where.OR = [
      { area: { regionId: query.region } },
      { packageLink: { roadPackage: { regionId: query.region } } },
    ];
  }
  if (query.package) {
    where.packageLink = { rupSnapshot: query.package };
  }
  if (query.district) {
    where.districtNameSnapshot = { equals: query.district, mode: "insensitive" };
  }
  if (query.village) {
    where.areaNameSnapshot = { startsWith: query.village, mode: "insensitive" };
  }

  return where;
}

/** Daftar laporan yang sudah disetujui moderator; tidak pernah memuat data privat. */
async function queryPublishedReports(query: PublicReportsQuery): Promise<PublicReportsResponse> {
  const where = publicWhere(query);
  const [rows, total] = await Promise.all([
    prisma.report.findMany({
      where,
      orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: PUBLIC_SELECT,
    }),
    prisma.report.count({ where }),
  ]);

  return {
    reports: rows.map((report) => ({
      publicCode: report.publicCode,
      damageType: report.damageType,
      coarseSize: report.coarseSize,
      areaName: report.areaNameSnapshot,
      districtName: report.districtNameSnapshot,
      roadName: report.roadNameSnapshot,
      roadNumber: report.roadNumberSnapshot,
      submittedAt: report.submittedAt.toISOString(),
      publishedAt: report.statusEvents[0]?.createdAt.toISOString() ?? null,
      package: report.packageLink
        ? { rup: report.packageLink.rupSnapshot, name: report.packageLink.packageNameSnapshot }
        : null,
    })),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

const listPublishedReportsCached = unstable_cache(
  queryPublishedReports,
  ["published-report-list"],
  { revalidate: PUBLIC_REPORTS_REVALIDATE_SECONDS, tags: [PUBLIC_REPORTS_CACHE_TAG] },
);

export function listPublishedReports(query: PublicReportsQuery): Promise<PublicReportsResponse> {
  return listPublishedReportsCached(query);
}

/**
 * Detail satu laporan publik. Hanya status PUBLISHED yang boleh dibaca; deskripsi,
 * petunjuk lokasi, foto, identitas pelapor, dan id area internal tidak pernah dipilih.
 */
async function queryPublishedReportDetail(publicCode: string): Promise<PublicReportDetail | null> {
  const report = await prisma.report.findFirst({
    where: { publicCode, status: "PUBLISHED" },
    select: {
      id: true,
      publicCode: true,
      damageType: true,
      coarseSize: true,
      areaNameSnapshot: true,
      districtNameSnapshot: true,
      rwCodeSnapshot: true,
      roadNameSnapshot: true,
      roadNumberSnapshot: true,
      roadClassSnapshot: true,
      roadSourceRelease: true,
      submittedAt: true,
      roadSegment: { select: { id: true, sourceObjectId: true } },
      packageLink: { select: { rupSnapshot: true, packageNameSnapshot: true } },
      statusEvents: {
        where: { toStatus: "PUBLISHED" as const },
        orderBy: { createdAt: "desc" as const },
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  if (!report) return null;

  const points = await prisma.$queryRawUnsafe<Array<{ latitude: number; longitude: number }>>(
    `SELECT extensions.ST_Y(location_point) AS "latitude",
            extensions.ST_X(location_point) AS "longitude"
       FROM reports
      WHERE id = $1::uuid
        AND public_location_consent = true
        AND location_point IS NOT NULL
      LIMIT 1`,
    report.id,
  );

  const point = points[0]
    ? { latitude: Number(points[0].latitude), longitude: Number(points[0].longitude) }
    : null;
  const geometryRows = report.roadSegment
    ? await prisma.$queryRawUnsafe<Array<{ geometry: unknown }>>(
      `SELECT extensions.ST_AsGeoJSON(geometry)::json AS geometry
         FROM road_segments WHERE id = $1::uuid LIMIT 1`,
      report.roadSegment.id,
    )
    : [];
  const road = report.roadNameSnapshot || report.roadClassSnapshot
    ? {
      name: report.roadNameSnapshot,
      number: report.roadNumberSnapshot,
      roadClass: report.roadClassSnapshot,
      sourceObjectId: report.roadSegment?.sourceObjectId ?? null,
      geometry: (geometryRows[0]?.geometry ?? null) as LineString | MultiLineString | null,
    }
    : null;

  return {
    publicCode: report.publicCode,
    damageType: report.damageType,
    coarseSize: report.coarseSize,
    areaName: report.areaNameSnapshot,
    districtName: report.districtNameSnapshot,
    rwCode: report.rwCodeSnapshot,
    roadName: report.roadNameSnapshot,
    roadNumber: report.roadNumberSnapshot,
    road,
    point,
    submittedAt: report.submittedAt.toISOString(),
    publishedAt: report.statusEvents[0]?.createdAt.toISOString() ?? null,
    package: report.packageLink
      ? { rup: report.packageLink.rupSnapshot, name: report.packageLink.packageNameSnapshot }
      : null,
  };
}

const getPublishedReportDetailCached = unstable_cache(
  queryPublishedReportDetail,
  ["published-report-detail"],
  { revalidate: PUBLIC_REPORTS_REVALIDATE_SECONDS, tags: [PUBLIC_REPORTS_CACHE_TAG] },
);

export function getPublishedReportDetail(publicCode: string): Promise<PublicReportDetail | null> {
  return getPublishedReportDetailCached(publicCode);
}

/** Publikasikan atau tolak satu laporan, dengan alasan dan riwayat status. */
export async function changeReportStatus(input: {
  publicCode: string;
  actorUserId: string;
  change: ReportStatusChangeInput;
}) {
  return prisma.$transaction(async (transaction) => {
    const report = await transaction.report.findUnique({
      where: { publicCode: input.publicCode },
      select: { id: true, status: true },
    });
    if (!report) {
      throw new ApiError(404, "REPORT_NOT_FOUND", "Laporan tidak ditemukan.");
    }
    if (report.status === input.change.status) {
      throw new ApiError(409, "REPORT_STATUS_UNCHANGED", "Laporan sudah berada pada status itu.");
    }
    if (!EDITABLE_STATUSES.has(report.status)) {
      throw new ApiError(409, "INVALID_STATUS_TRANSITION", "Status laporan ini tidak dapat diubah dari antrean.");
    }

    const updated = await transaction.report.updateMany({
      where: { id: report.id, status: report.status },
      data: { status: input.change.status },
    });
    if (updated.count !== 1) {
      throw new ApiError(409, "REPORT_STATUS_CONFLICT", "Status laporan berubah. Muat ulang antrean.");
    }

    const event = await transaction.reportStatusEvent.create({
      data: {
        reportId: report.id,
        actorUserId: input.actorUserId,
        fromStatus: report.status,
        toStatus: input.change.status,
        reason: input.change.reason,
      },
      select: { createdAt: true },
    });

    return {
      publicCode: input.publicCode,
      status: input.change.status,
      publishedAt: input.change.status === "PUBLISHED" ? event.createdAt.toISOString() : null,
    };
  });
}
