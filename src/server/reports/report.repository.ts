import "server-only";
import { randomUUID } from "node:crypto";
import type { ReportSubmissionInput } from "@/contracts/reports/report-submission.contract";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/server/api/shared/api-error";
import type { ReportAreaSnapshot } from "@/server/reports/report-area-catalog";
import type { StoredReportPhoto } from "@/server/uploads/purposes/report-photo.handler";

const DATASET_VERSION = "kota-tangerang-2025-2026-2026-10-31";
const DATASET_RETRIEVED_AT = new Date("2026-10-31T00:00:00.000Z");

function precisionCode(value: RoadPackageItem["presisi_peta"]) {
  return value.toLocaleUpperCase("en-US") as "RW" | "KELURAHAN" | "KECAMATAN" | "KABUPATEN";
}

export async function persistSubmittedReport(input: {
  id: string;
  publicCode: string;
  actorUserId: string | null;
  submission: ReportSubmissionInput;
  areaSnapshot: ReportAreaSnapshot | null;
  packageItem: RoadPackageItem | null;
  photo: StoredReportPhoto;
  idempotency: { id: string; attemptId: string };
}) {
  return prisma.$transaction(async (transaction) => {
    let areaId: string | null = null;
    if (input.areaSnapshot) {
      const area = await transaction.administrativeArea.findUnique({ where: { stableKey: input.areaSnapshot.stableKey } });
      if (area?.isActive && area.level === "RW") areaId = area.id;
    }

    let roadPackageId: string | null = null;
    if (input.packageItem) {
      const item = input.packageItem;
      const roadPackage = await transaction.roadPackage.upsert({
        where: { rup: item.kode_rup },
        create: {
          rup: item.kode_rup,
          year: item.tahun,
          name: item.nama,
          agencyName: item.satker,
          budget: item.pagu.toFixed(0),
          method: item.metode ?? "Tidak dicantumkan",
          sourceName: "Data INAPROC RUP",
          sourceRetrievedAt: DATASET_RETRIEVED_AT,
          datasetVersion: DATASET_VERSION,
          locationPrecision: precisionCode(item.presisi_peta),
          officialDistrict: item.kecamatan_resmi,
          officialVillage: item.desa_resmi,
          rwCode: item.rw,
          microLocation: item.lokasi_mikro,
        },
        update: {},
        select: { id: true },
      });
      roadPackageId = roadPackage.id;
    }

    const report = await transaction.report.create({
      data: {
        id: input.id,
        publicCode: input.publicCode,
        reporterUserId: input.actorUserId,
        status: "SUBMITTED",
        damageType: input.submission.damageType,
        observedCauses: input.submission.observedCauses,
        coarseSize: input.submission.coarseSize ?? null,
        description: input.submission.description || null,
        areaId,
        areaNameSnapshot: input.areaSnapshot
          ? `${input.areaSnapshot.villageName}, RW ${input.areaSnapshot.rwCode}`
          : null,
        districtNameSnapshot: input.areaSnapshot?.districtName ?? null,
        rwCodeSnapshot: input.areaSnapshot?.rwCode ?? null,
        areaDatasetVersion: input.areaSnapshot?.datasetVersion ?? null,
        locationSource: input.areaSnapshot
          ? input.submission.locationSource!
          : input.packageItem ? "PACKAGE_REFERENCE_ONLY" : "UNKNOWN",
        locationHint: input.submission.locationHint || null,
        media: {
          create: {
            objectPath: input.photo.objectPath,
            mediaType: input.photo.mediaType,
            byteSize: input.photo.bytes.byteLength,
            width: input.photo.width,
            height: input.photo.height,
            sanitizerVersion: input.photo.sanitizerVersion,
          },
        },
        ...(input.packageItem && roadPackageId ? {
          packageLink: {
            create: {
              roadPackageId,
              rupSnapshot: input.packageItem.kode_rup,
              packageNameSnapshot: input.packageItem.nama,
              selectionSource: input.submission.packageSelectionSource!,
            },
          },
        } : {}),
        statusEvents: {
          create: { fromStatus: null, toStatus: "SUBMITTED", actorUserId: input.actorUserId },
        },
      },
      select: { id: true, publicCode: true },
    });

    const completed = await transaction.reportIdempotencyKey.updateMany({
      where: { id: input.idempotency.id, attemptId: input.idempotency.attemptId, status: "PROCESSING" },
      data: {
        status: "COMPLETED",
        stagedObjectPath: null,
        reportId: report.id,
        responseCode: report.publicCode,
        completedAt: new Date(),
      },
    });
    if (completed.count !== 1) {
      throw new ApiError(409, "IDEMPOTENCY_LEASE_LOST", "Pengiriman ini sudah kedaluwarsa. Coba kirim ulang.");
    }

    return report;
  });
}

export function createReportId() {
  return randomUUID();
}
