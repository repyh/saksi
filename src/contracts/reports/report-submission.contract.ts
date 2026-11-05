import { z } from "zod";

export const reportDamageTypes = [
  "POTHOLE",
  "CRACK",
  "SUBSIDENCE",
  "STANDING_WATER",
  "BLOCKED_DRAINAGE",
  "DAMAGED_BRIDGE",
  "OTHER",
] as const;

export const reportObservedCauses = [
  "HEAVY_VEHICLE",
  "NO_DRAINAGE",
  "RECURRING_FLOODING",
  "HEAVY_TRAFFIC",
  "UNSUITABLE_MATERIAL",
  "UNKNOWN",
] as const;

export const reportCoarseSizes = ["PALM", "TIRE", "OVER_1M2"] as const;

export const reportSubmissionSchema = z.object({
  damageType: z.enum(reportDamageTypes),
  observedCauses: z.array(z.enum(reportObservedCauses)).max(6),
  coarseSize: z.enum(reportCoarseSizes).optional(),
  description: z.string().trim().max(500).optional(),
  areaKey: z.string().trim().min(1).max(180).regex(/^[^|]+\|[^|]+\|[^|]+$/).optional(),
  locationSource: z.enum(["MANUAL_AREA", "DEVICE_RESOLVED_AREA"]).optional(),
  locationHint: z.string().trim().max(180).optional(),
  packageRup: z.string().trim().regex(/^\d{1,32}$/).optional(),
  packageSelectionSource: z.enum(["PACKAGE_PAGE", "CANDIDATE_LIST"]).optional(),
}).superRefine((value, context) => {
  if (value.packageRup && !value.packageSelectionSource) {
    context.addIssue({ code: "custom", path: ["packageSelectionSource"], message: "Pilih sumber tautan paket." });
  }
  if (!value.packageRup && value.packageSelectionSource) {
    context.addIssue({ code: "custom", path: ["packageRup"], message: "Nomor RUP diperlukan untuk tautan paket." });
  }
  if (value.areaKey && !value.locationSource) {
    context.addIssue({ code: "custom", path: ["locationSource"], message: "Sumber wilayah diperlukan." });
  }
  if (!value.areaKey && value.locationSource) {
    context.addIssue({ code: "custom", path: ["areaKey"], message: "Wilayah diperlukan untuk sumber lokasi." });
  }
  if (!value.areaKey && !value.packageRup) {
    context.addIssue({ code: "custom", path: ["areaKey"], message: "Pilih wilayah atau tautkan paket." });
  }
});

export type ReportSubmissionInput = z.infer<typeof reportSubmissionSchema>;
