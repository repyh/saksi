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

export const reportLocationSources = [
  "MANUAL_AREA",
  "DEVICE_RESOLVED_AREA",
  "DEVICE_GEOLOCATION",
  "MAP_PIN",
  "ADDRESS_GEOCODE",
] as const;

/** Sumber yang wajib disertai titik koordinat. */
export const pointLocationSources = ["DEVICE_GEOLOCATION", "MAP_PIN", "ADDRESS_GEOCODE"] as const;

const pointSources = new Set<string>(pointLocationSources);

/** String multipart "true"/"false" diterima di samping boolean JSON. */
const booleanField = z.preprocess(
  (value) => {
    if (value === "true" || value === "1" || value === 1) return true;
    if (value === "false" || value === "0" || value === 0) return false;
    return value;
  },
  z.boolean(),
);

export const reportSubmissionSchema = z.object({
  damageType: z.enum(reportDamageTypes),
  observedCauses: z.array(z.enum(reportObservedCauses)).max(6),
  coarseSize: z.enum(reportCoarseSizes).optional(),
  description: z.string().trim().max(500).optional(),
  areaKey: z.string().trim().min(1).max(180).regex(/^[^|]+\|[^|]+\|[^|]+$/).optional(),
  locationSource: z.enum(reportLocationSources).optional(),
  locationHint: z.string().trim().max(180).optional(),
  latitude: z.coerce.number().finite().min(-90).max(90).optional(),
  longitude: z.coerce.number().finite().min(-180).max(180).optional(),
  /** Akurasi GPS dalam meter; hanya arti bila titik dikirim. */
  accuracyM: z.coerce.number().finite().min(0).max(100_000).optional(),
  /** Titik presisi disimpan untuk staf; izin ini menentukan tampil di halaman publik. */
  publicLocationConsent: booleanField.optional(),
  roadSegmentId: z.string().uuid().optional(),
  packageRup: z.string().trim().regex(/^\d{1,32}$/).optional(),
  packageSelectionSource: z.enum(["PACKAGE_PAGE", "CANDIDATE_LIST"]).optional(),
}).superRefine((value, context) => {
  const hasLatitude = value.latitude !== undefined;
  const hasLongitude = value.longitude !== undefined;
  const hasPoint = hasLatitude && hasLongitude;

  if (hasLatitude !== hasLongitude) {
    context.addIssue({
      code: "custom",
      path: hasLatitude ? ["longitude"] : ["latitude"],
      message: "Lintang dan bujur harus dikirim bersama.",
    });
  }
  if (value.accuracyM !== undefined && !hasPoint) {
    context.addIssue({ code: "custom", path: ["accuracyM"], message: "Akurasi hanya berlaku untuk titik koordinat." });
  }
  if (hasPoint) {
    if (!value.locationSource || !pointSources.has(value.locationSource)) {
      context.addIssue({
        code: "custom",
        path: ["locationSource"],
        message: "Sumber lokasi titik harus GPS, pin peta, atau pencarian alamat.",
      });
    }
  } else if (value.locationSource && pointSources.has(value.locationSource)) {
    context.addIssue({ code: "custom", path: ["locationSource"], message: "Sumber lokasi titik memerlukan koordinat." });
  }

  if (value.packageRup && !value.packageSelectionSource) {
    context.addIssue({ code: "custom", path: ["packageSelectionSource"], message: "Pilih sumber tautan paket." });
  }
  if (!value.packageRup && value.packageSelectionSource) {
    context.addIssue({ code: "custom", path: ["packageRup"], message: "Nomor RUP diperlukan untuk tautan paket." });
  }
  if (value.areaKey && !value.locationSource) {
    context.addIssue({ code: "custom", path: ["locationSource"], message: "Sumber wilayah diperlukan." });
  }
  if (!value.areaKey && !hasPoint && value.locationSource) {
    context.addIssue({ code: "custom", path: ["areaKey"], message: "Wilayah diperlukan untuk sumber lokasi." });
  }
  if (!value.areaKey && !value.packageRup && !hasPoint) {
    context.addIssue({ code: "custom", path: ["areaKey"], message: "Pilih wilayah, titik lokasi, atau tautkan paket." });
  }
});

export type ReportSubmissionInput = z.infer<typeof reportSubmissionSchema>;
