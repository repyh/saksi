import "server-only";
import { reportSubmissionSchema, type ReportSubmissionInput } from "@/contracts/reports/report-submission.contract";
import { ApiError } from "@/server/api/shared/api-error";

export function parseReportSubmissionFields(fields: Record<string, string | string[]>): ReportSubmissionInput {
  const normalized = { ...fields };
  for (const optional of ["coarseSize", "description", "areaKey", "locationSource", "locationHint", "packageRup", "packageSelectionSource"]) {
    if (normalized[optional] === "") delete normalized[optional];
  }
  if (normalized.observedCauses === undefined) normalized.observedCauses = [];
  const parsed = reportSubmissionSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new ApiError(422, "INVALID_REPORT", "Periksa kembali rincian laporan yang diisi.");
  }
  return parsed.data;
}
