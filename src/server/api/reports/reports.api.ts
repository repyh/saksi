import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiController } from "@/server/api/shared/api-controller";
import { ApiError } from "@/server/api/shared/api-error";
import { parseReportSubmissionFields } from "@/server/api/reports/report-schema";
import { parseReportMultipart } from "@/server/api/reports/multipart-schema";
import { claimReportIdempotency, setReportIdempotencyStagedPath } from "@/server/reports/report-idempotency.repository";
import { resolveReportLocation } from "@/server/reports/report-location.service";
import { persistSubmittedReport } from "@/server/reports/report.repository";
import { enforceReportSubmissionRateLimit } from "@/server/reports/report-rate-limit";
import { removePrivateReportImage, assertPrivateReportBucketReady, downloadPrivateReportImage } from "@/server/storage/supabase-storage.client";
import { uploadController } from "@/server/uploads/upload.controller";
import { createRoadPackageRepository } from "@/server/packages/source";
import { listRegions } from "@/server/regions/region-registry";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import type { MyReportsResponse } from "@/contracts/reports/report-history.contract";
import { reportReviewQueueQuerySchema, type ReportReviewQueueResponse } from "@/contracts/reports/report-review-queue.contract";
import {
  publicReportsQuerySchema,
  reportStatusChangeSchema,
  type PublicReportsResponse,
} from "@/contracts/reports/public-report.contract";
import { changeReportStatus, listPublishedReports } from "@/server/reports/public-report.repository";
import { hasPermission, requirePermission, requireRequestPermission, AuthorizationError } from "@/server/authorization/authority";
import { apiFailure } from "@/server/api/shared/api-response";
import type { Prisma } from "@/generated/prisma/client";

const IDEMPOTENCY_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function isReportDatabaseUnavailable(error: unknown) {
  if (typeof error !== "object" || error === null) return false;
  const value = error as { name?: string; code?: string; meta?: { code?: string } };
  return value.name === "PrismaClientInitializationError"
    || ["P1000", "P1001", "P1017", "P2021", "P2022"].includes(value.code ?? "")
    || value.code === "P2010" && value.meta?.code === "42P01";
}

export class ReportsApi extends ApiController {
  listReviewQueue(request: Request): Promise<Response> {
    return this.withPrivateNoStore(this.respond(async (): Promise<ReportReviewQueueResponse> => {
      await requireRequestPermission(request.headers, "reports.read_queue");
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "REPORTS_UNAVAILABLE", "Antrean laporan belum tersedia.");
      }

      const url = new URL(request.url);
      const parsedQuery = reportReviewQueueQuerySchema.safeParse({
        status: url.searchParams.get("status") ?? undefined,
        order: url.searchParams.get("order") ?? undefined,
        cursor: url.searchParams.get("cursor") ?? undefined,
      });
      if (!parsedQuery.success) {
        throw new ApiError(400, "INVALID_REVIEW_QUERY", "Filter antrean laporan tidak valid.");
      }

      const { status, order, cursor } = parsedQuery.data;
      const statusWhere: Prisma.ReportWhereInput = status === "active"
        ? { status: { in: ["SUBMITTED", "UNDER_REVIEW", "NEEDS_MORE_INFO"] } }
        : status === "all"
          ? {}
          : { status };
      const cursorId = cursor ? Buffer.from(cursor, "base64url").toString("utf8") : null;
      if (cursor && (!cursorId || !UUID_PATTERN.test(cursorId))) {
        throw new ApiError(400, "INVALID_REVIEW_CURSOR", "Posisi antrean tidak valid. Muat ulang antrean.");
      }
      const cursorReport = cursorId
        ? await prisma.report.findUnique({
          where: { id: cursorId },
          select: { id: true, submittedAt: true },
        })
        : null;
      if (cursor && !cursorReport) {
        throw new ApiError(400, "INVALID_REVIEW_CURSOR", "Posisi antrean sudah tidak tersedia. Muat ulang antrean.");
      }

      const isAscending = order === "submittedAt_asc";
      const cursorWhere: Prisma.ReportWhereInput = cursorReport
        ? {
          OR: [
            { submittedAt: { [isAscending ? "gt" : "lt"]: cursorReport.submittedAt } },
            { submittedAt: cursorReport.submittedAt, id: { [isAscending ? "gt" : "lt"]: cursorReport.id } },
          ],
        }
        : {};
      const where: Prisma.ReportWhereInput = { ...statusWhere, ...cursorWhere };
      const [rows, total] = await Promise.all([
        prisma.report.findMany({
          where,
          orderBy: [{ submittedAt: isAscending ? "asc" : "desc" }, { id: isAscending ? "asc" : "desc" }],
          take: 31,
          select: {
            id: true,
            publicCode: true,
            status: true,
            damageType: true,
            submittedAt: true,
            areaNameSnapshot: true,
            districtNameSnapshot: true,
            packageLink: { select: { rupSnapshot: true, packageNameSnapshot: true } },
          },
        }),
        prisma.report.count({ where: statusWhere }),
      ]);
      const hasMore = rows.length > 30;
      const page = hasMore ? rows.slice(0, 30) : rows;
      const last = page.at(-1);

      return {
        reports: page.map((report) => ({
          publicCode: report.publicCode,
          id: report.id,
          status: report.status,
          damageType: report.damageType,
          submittedAt: report.submittedAt.toISOString(),
          areaName: report.areaNameSnapshot,
          districtName: report.districtNameSnapshot,
          package: report.packageLink
            ? { rup: report.packageLink.rupSnapshot, name: report.packageLink.packageNameSnapshot }
            : null,
        })),
        total,
        nextCursor: hasMore && last ? Buffer.from(last.id).toString("base64url") : null,
      };
    }, {
      code: "REPORT_REVIEW_QUEUE_UNAVAILABLE",
      message: "Antrean laporan belum dapat dimuat. Coba lagi nanti.",
    }, 200, (error) => isReportDatabaseUnavailable(error)
      ? new ApiError(503, "REPORT_DATABASE_UNAVAILABLE", "Layanan antrean laporan belum siap.")
      : undefined));
  }

  listPublic(request: Request): Promise<Response> {
    return this.withPublicCache(this.respond(async (): Promise<PublicReportsResponse> => {
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "REPORTS_UNAVAILABLE", "Laporan publik belum tersedia.");
      }

      const url = new URL(request.url);
      const parsedQuery = publicReportsQuerySchema.safeParse({
        region: url.searchParams.get("region")?.trim() || undefined,
        package: url.searchParams.get("paket")?.trim() || undefined,
        district: url.searchParams.get("kecamatan")?.trim() || undefined,
        village: url.searchParams.get("kelurahan")?.trim() || undefined,
        page: url.searchParams.get("page") ?? undefined,
        limit: url.searchParams.get("limit") ?? undefined,
      });
      if (!parsedQuery.success) {
        throw new ApiError(400, "INVALID_PUBLIC_REPORT_QUERY", "Filter laporan publik tidak valid.");
      }

      return listPublishedReports(parsedQuery.data);
    }, {
      code: "PUBLIC_REPORTS_UNAVAILABLE",
      message: "Laporan publik belum dapat dimuat. Coba lagi nanti.",
    }, 200, (error) => isReportDatabaseUnavailable(error)
      ? new ApiError(503, "REPORT_DATABASE_UNAVAILABLE", "Layanan laporan publik belum siap.")
      : undefined));
  }

  changeStatus(request: Request, publicCode: string): Promise<Response> {
    return this.withPrivateNoStore(this.respond(async () => {
      const user = await requireRequestPermission(request.headers, "reports.change_status");
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "REPORTS_UNAVAILABLE", "Moderasi laporan belum tersedia.");
      }
      if (!/^[A-Za-z0-9_-]{10,64}$/.test(publicCode)) {
        throw new ApiError(404, "REPORT_NOT_FOUND", "Laporan tidak ditemukan.");
      }

      const body = await request.json().catch(() => null);
      const parsedBody = reportStatusChangeSchema.safeParse(body);
      if (!parsedBody.success) {
        throw new ApiError(400, "INVALID_STATUS_CHANGE", "Status dan alasan moderasi wajib diisi dengan benar.");
      }

      return changeReportStatus({
        publicCode,
        actorUserId: user.id,
        change: parsedBody.data,
      });
    }, {
      code: "REPORT_STATUS_UPDATE_FAILED",
      message: "Status laporan belum dapat diubah. Coba lagi nanti.",
    }, 200, (error) => isReportDatabaseUnavailable(error)
      ? new ApiError(503, "REPORT_DATABASE_UNAVAILABLE", "Layanan moderasi laporan belum siap.")
      : undefined));
  }

  getReviewDetail(request: Request, reportId: string): Promise<Response> {
    return this.withPrivateNoStore(this.respond(async () => {
      const actor = await requireRequestPermission(request.headers, "reports.read_queue");
      await requirePermission(actor.id, "reports.read_deidentified");
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "REPORTS_UNAVAILABLE", "Detail laporan belum tersedia.");
      }
      if (!UUID_PATTERN.test(reportId)) throw new ApiError(404, "REPORT_NOT_FOUND", "Laporan tidak ditemukan.");

      const report = await prisma.report.findUnique({
        where: { id: reportId },
        select: {
          id: true,
          publicCode: true,
          status: true,
          damageType: true,
          observedCauses: true,
          coarseSize: true,
          description: true,
          submittedAt: true,
          areaNameSnapshot: true,
          districtNameSnapshot: true,
          roadSegmentId: true,
          publicLocationConsent: true,
          packageLink: { select: { rupSnapshot: true, packageNameSnapshot: true } },
          media: { select: { id: true, deletedAt: true, retainedUntil: true } },
        },
      });
      if (!report) throw new ApiError(404, "REPORT_NOT_FOUND", "Laporan tidak ditemukan.");

      await prisma.authorizationAuditEvent.create({
        data: {
          actorUserId: actor.id,
          action: "report.detail.read",
          resourceType: "report",
          resourceId: report.id,
        },
      });

      const preciseLocationAccess = await hasPermission(actor.id, "reports.read_precise_location");
      let location: { latitude: number; longitude: number; accuracyM: number | null } | null = null;
      let road: { id: string; name: string; number: string | null } | null = null;
      if (preciseLocationAccess) {
        const points = await prisma.$queryRawUnsafe<Array<{ latitude: number; longitude: number; accuracyM: number | null }>>(
          `SELECT extensions.ST_Y(location_point) AS "latitude",
                  extensions.ST_X(location_point) AS "longitude",
                  location_accuracy_m AS "accuracyM"
             FROM reports
            WHERE id = $1::uuid AND location_point IS NOT NULL
            LIMIT 1`,
          report.id,
        );
        location = points[0]
          ? {
            latitude: Number(points[0].latitude),
            longitude: Number(points[0].longitude),
            accuracyM: points[0].accuracyM === null ? null : Number(points[0].accuracyM),
          }
          : null;
        if (report.roadSegmentId) {
          road = await prisma.roadSegment.findUnique({
            where: { id: report.roadSegmentId },
            select: { id: true, name: true, number: true },
          });
        }
        if (location) {
          await prisma.authorizationAuditEvent.create({
            data: {
              actorUserId: actor.id,
              action: "report.precise_location.read",
              resourceType: "report",
              resourceId: report.id,
            },
          });
        }
      }

      const now = new Date();
      const hasEvidence = Boolean(report.media && !report.media.deletedAt && (!report.media.retainedUntil || report.media.retainedUntil > now));
      return {
        publicCode: report.publicCode,
        id: report.id,
        status: report.status,
        damageType: report.damageType,
        observedCauses: report.observedCauses,
        coarseSize: report.coarseSize,
        description: report.description,
        submittedAt: report.submittedAt.toISOString(),
        areaName: report.areaNameSnapshot,
        districtName: report.districtNameSnapshot,
        package: report.packageLink
          ? { rup: report.packageLink.rupSnapshot, name: report.packageLink.packageNameSnapshot }
          : null,
        hasEvidence,
        preciseLocationAccess,
        publicLocationConsent: report.publicLocationConsent,
        location,
        road,
      };
    }, {
      code: "REPORT_REVIEW_DETAIL_UNAVAILABLE",
      message: "Detail laporan belum dapat dimuat.",
    }, 200, (error) => isReportDatabaseUnavailable(error)
      ? new ApiError(503, "REPORT_DATABASE_UNAVAILABLE", "Layanan detail laporan belum siap.")
      : undefined));
  }

  async getReviewEvidence(request: Request, reportId: string): Promise<Response> {
    let response: Response;
    try {
      const actor = await requireRequestPermission(request.headers, "reports.read_queue");
      await requirePermission(actor.id, "reports.read_sensitive_evidence");
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "REPORTS_UNAVAILABLE", "Foto laporan belum tersedia.");
      }
      if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        throw new ApiError(503, "REPORT_STORAGE_UNAVAILABLE", "Penyimpanan foto laporan belum dikonfigurasi.");
      }
      if (!UUID_PATTERN.test(reportId)) throw new ApiError(404, "REPORT_NOT_FOUND", "Laporan tidak ditemukan.");

      await assertPrivateReportBucketReady();

      const report = await prisma.report.findUnique({
        where: { id: reportId },
        select: { id: true, media: { select: { id: true, objectPath: true, deletedAt: true, retainedUntil: true } } },
      });
      const media = report?.media;
      const now = new Date();
      if (!report || !media || media.deletedAt || (media.retainedUntil && media.retainedUntil <= now)) {
        throw new ApiError(404, "REPORT_EVIDENCE_NOT_FOUND", "Foto laporan tidak tersedia.");
      }

      await prisma.authorizationAuditEvent.create({
        data: {
          actorUserId: actor.id,
          action: "report.evidence.read",
          resourceType: "report",
          resourceId: report.id,
          metadata: { mediaId: media.id },
        },
      });

      const bytes = await downloadPrivateReportImage(media.objectPath);
      response = new Response(bytes, {
        headers: {
          "Content-Type": "image/webp",
          "Content-Length": String(bytes.byteLength),
          "Content-Disposition": 'inline; filename="report-evidence.webp"',
          "X-Content-Type-Options": "nosniff",
          "Cross-Origin-Resource-Policy": "same-origin",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    } catch (error) {
      if (error instanceof AuthorizationError) response = apiFailure(error.code, error.message, error.status);
      else if (error instanceof ApiError) response = apiFailure(error.code, error.message, error.status);
      else if (isReportDatabaseUnavailable(error)) response = apiFailure("REPORT_DATABASE_UNAVAILABLE", "Layanan foto laporan belum siap.", 503);
      else response = apiFailure("REPORT_EVIDENCE_UNAVAILABLE", "Foto laporan belum dapat dibuka.", 500);
    }
    return this.withPrivateNoStore(Promise.resolve(response));
  }

  listMine(request: Request): Promise<Response> {
    return this.withPrivateNoStore(this.respond(async (): Promise<MyReportsResponse> => {
      const session = await auth.api.getSession({ headers: request.headers });
      if (!session?.user) {
        throw new ApiError(401, "AUTHENTICATION_REQUIRED", "Masuk untuk melihat laporan yang terkait dengan akun ini.");
      }
      if (!process.env.DATABASE_URL) {
        throw new ApiError(503, "REPORTS_UNAVAILABLE", "Riwayat laporan belum tersedia.");
      }

      const reports = await prisma.report.findMany({
        where: { reporterUserId: session.user.id },
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        select: {
          publicCode: true,
          status: true,
          damageType: true,
          submittedAt: true,
          areaNameSnapshot: true,
          districtNameSnapshot: true,
          packageLink: {
            select: { rupSnapshot: true, packageNameSnapshot: true },
          },
        },
      });

      return {
        reports: reports.map((report) => ({
          publicCode: report.publicCode,
          status: report.status,
          damageType: report.damageType,
          submittedAt: report.submittedAt.toISOString(),
          areaName: report.areaNameSnapshot,
          districtName: report.districtNameSnapshot,
          package: report.packageLink
            ? { rup: report.packageLink.rupSnapshot, name: report.packageLink.packageNameSnapshot }
            : null,
        })),
      };
    }, { code: "REPORT_HISTORY_UNAVAILABLE", message: "Riwayat laporan belum dapat dimuat. Coba lagi nanti." }));
  }

  submit(request: Request): Promise<Response> {
    return this.respond(
      async () => {
        if (!process.env.DATABASE_URL) {
          throw new ApiError(503, "REPORTS_UNAVAILABLE", "Pengiriman laporan belum dikonfigurasi.");
        }
        if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
          throw new ApiError(503, "REPORT_STORAGE_UNAVAILABLE", "Penyimpanan foto laporan belum dikonfigurasi.");
        }

        const idempotencyKey = request.headers.get("idempotency-key") ?? "";
        if (!IDEMPOTENCY_KEY_PATTERN.test(idempotencyKey)) {
          throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Kunci pengiriman yang valid diperlukan.");
        }

        const { fields, photo: inputPhoto } = await parseReportMultipart(request);
        const submission = parseReportSubmissionFields(fields);
        const location = await resolveReportLocation({
          regionId: "kota-tangerang",
          latitude: submission.latitude,
          longitude: submission.longitude,
          accuracyM: submission.accuracyM,
          roadSegmentId: submission.roadSegmentId,
          areaKey: submission.areaKey,
        });
        if (!location.point && submission.areaKey && !location.area) {
          throw new ApiError(422, "UNKNOWN_REPORT_AREA", "Wilayah laporan tidak ditemukan pada data batas yang tersedia.");
        }

        // Kode RUP unik lintas region; cari di semua region yang terdaftar tanpa menyimpan region di laporan.
        let packageItem: RoadPackageItem | null = null;
        if (submission.packageRup) {
          for (const region of listRegions()) {
            const rows = await createRoadPackageRepository(region.id).listRoadPackages();
            packageItem = rows.find((item) => item.kode_rup === submission.packageRup) ?? null;
            if (packageItem) break;
          }
        }
        if (submission.packageRup && !packageItem) {
          throw new ApiError(422, "UNKNOWN_PACKAGE_REFERENCE", "Nomor RUP tidak ditemukan pada daftar paket yang tersedia.");
        }

        const session = await auth.api.getSession({ headers: request.headers });
        const actorUserId = session?.user.id ?? null;
        const requestHash = sha256(JSON.stringify({
          submission,
          actorUserId,
          photoSha256: sha256(inputPhoto),
        }));
        const attemptId = randomUUID();
        const claim = await claimReportIdempotency({
          keyHash: sha256(idempotencyKey),
          requestHash,
          attemptId,
        });
        if (claim.kind === "completed") return { code: claim.responseCode, status: "SUBMITTED" as const };
        if (claim.kind === "processing") {
          throw new ApiError(409, "REPORT_SUBMISSION_IN_PROGRESS", "Pengiriman yang sama sedang diproses. Coba lagi sebentar.");
        }

        try {
          await enforceReportSubmissionRateLimit(request);
          await assertPrivateReportBucketReady();
        } catch (error) {
          await prisma.reportIdempotencyKey.deleteMany({ where: { id: claim.id, attemptId: claim.attemptId, status: "PROCESSING" } });
          throw error;
        }

        const reportId = randomUUID();
        const objectPath = `reports/${reportId}/${randomUUID()}.webp`;
        let uploadStarted = false;
        try {
          await setReportIdempotencyStagedPath(claim.id, claim.attemptId, objectPath);
          uploadStarted = true;
          const storedPhoto = await uploadController.dispatch({ purpose: "report.photo", objectPath, bytes: inputPhoto });
          const report = await persistSubmittedReport({
            id: reportId,
            publicCode: randomBytes(24).toString("base64url"),
            actorUserId,
            submission,
            location,
            packageItem,
            photo: storedPhoto,
            idempotency: { id: claim.id, attemptId: claim.attemptId },
          });
          return { code: report.publicCode, status: "SUBMITTED" as const };
        } catch (error) {
          const state = await prisma.reportIdempotencyKey.findUnique({ where: { id: claim.id } }).catch(() => null);
          if (state?.status === "COMPLETED" && state.responseCode) {
            return { code: state.responseCode, status: "SUBMITTED" as const };
          }

          if (uploadStarted) {
            try {
              await removePrivateReportImage(objectPath);
              await prisma.reportIdempotencyKey.deleteMany({ where: { id: claim.id, attemptId: claim.attemptId, status: "PROCESSING" } });
            } catch {
              await prisma.reportIdempotencyKey.updateMany({
                where: { id: claim.id, attemptId: claim.attemptId, status: "PROCESSING" },
                data: { stagedObjectPath: objectPath, leaseExpiresAt: new Date(0) },
              }).catch(() => undefined);
            }
          } else {
            await prisma.reportIdempotencyKey.deleteMany({ where: { id: claim.id, attemptId: claim.attemptId, status: "PROCESSING" } });
          }
          throw error;
        }
      },
      { code: "REPORT_SUBMISSION_FAILED", message: "Laporan belum dapat dikirim. Coba lagi nanti." },
      201,
      (error) => isReportDatabaseUnavailable(error)
        ? new ApiError(503, "REPORT_DATABASE_UNAVAILABLE", "Layanan laporan belum siap. Coba lagi setelah konfigurasi server selesai.")
        : undefined,
    );
  }

  private async withPrivateNoStore(response: Promise<Response>): Promise<Response> {
    const result = await response;
    const headers = new Headers(result.headers);
    headers.set("Cache-Control", "private, no-store");
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
  }

  private async withPublicCache(response: Promise<Response>): Promise<Response> {
    const result = await response;
    const headers = new Headers(result.headers);
    headers.set("Cache-Control", "public, max-age=60");
    return new Response(result.body, { status: result.status, statusText: result.statusText, headers });
  }
}

export const reportsApi = new ReportsApi();
