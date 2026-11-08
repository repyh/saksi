import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ApiController } from "@/server/api/shared/api-controller";
import { ApiError } from "@/server/api/shared/api-error";
import { parseReportSubmissionFields } from "@/server/api/reports/report-schema";
import { parseReportMultipart } from "@/server/api/reports/multipart-schema";
import { claimReportIdempotency, setReportIdempotencyStagedPath } from "@/server/reports/report-idempotency.repository";
import { findReportAreaSnapshot } from "@/server/reports/report-area-catalog";
import { persistSubmittedReport } from "@/server/reports/report.repository";
import { enforceReportSubmissionRateLimit } from "@/server/reports/report-rate-limit";
import { removePrivateReportImage, assertPrivateReportBucketReady } from "@/server/storage/supabase-storage.client";
import { uploadController } from "@/server/uploads/upload.controller";
import { createSnapshotRoadPackageRepository } from "@/server/packages/snapshot-repository";
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
import { requireRequestPermission } from "@/server/authorization/authority";
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
        cursor: url.searchParams.get("cursor") ?? undefined,
      });
      if (!parsedQuery.success) {
        throw new ApiError(400, "INVALID_REVIEW_QUERY", "Filter antrean laporan tidak valid.");
      }

      const { status, cursor } = parsedQuery.data;
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

      const cursorWhere: Prisma.ReportWhereInput = cursorReport
        ? {
          OR: [
            { submittedAt: { lt: cursorReport.submittedAt } },
            { submittedAt: cursorReport.submittedAt, id: { lt: cursorReport.id } },
          ],
        }
        : {};
      const where: Prisma.ReportWhereInput = { ...statusWhere, ...cursorWhere };
      const [rows, total] = await Promise.all([
        prisma.report.findMany({
          where,
          orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
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
        const areaSnapshot = submission.areaKey ? await findReportAreaSnapshot(submission.areaKey) : null;
        if (submission.areaKey && !areaSnapshot) {
          throw new ApiError(422, "UNKNOWN_REPORT_AREA", "Wilayah laporan tidak ditemukan pada data batas yang tersedia.");
        }

        // Kode RUP unik lintas region; cari di semua region yang terdaftar tanpa menyimpan region di laporan.
        let packageItem: RoadPackageItem | null = null;
        if (submission.packageRup) {
          for (const region of listRegions()) {
            const rows = await createSnapshotRoadPackageRepository(region.id).listRoadPackages();
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
            areaSnapshot,
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
