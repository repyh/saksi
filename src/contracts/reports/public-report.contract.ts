import { z } from "zod";
import { reportCoarseSizes, reportDamageTypes } from "./report-submission.contract";

/**
 * Proyeksi publik laporan warga. Hanya laporan berstatus PUBLISHED yang boleh
 * memakai bentuk ini: tanpa identitas pelapor, deskripsi, petunjuk lokasi,
 * lokasi presisi, atau media.
 */
export const publicReportItemSchema = z.object({
  publicCode: z.string(),
  damageType: z.enum(reportDamageTypes),
  coarseSize: z.enum(reportCoarseSizes).nullable(),
  areaName: z.string().nullable(),
  districtName: z.string().nullable(),
  roadName: z.string().nullable(),
  roadNumber: z.string().nullable(),
  submittedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
  package: z.object({
    rup: z.string(),
    name: z.string(),
  }).nullable(),
});

/** Detail publik: titik hanya muncul bila pelapor memberi consent. */
export const publicReportDetailSchema = publicReportItemSchema.extend({
  rwCode: z.string().nullable(),
  road: z.object({
    name: z.string(),
    number: z.string().nullable(),
    sourceObjectId: z.string().nullable(),
  }).nullable(),
  point: z.object({
    latitude: z.number(),
    longitude: z.number(),
  }).nullable(),
});

export const publicReportsResponseSchema = z.object({
  reports: z.array(publicReportItemSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().positive(),
});

export const publicReportsQuerySchema = z.object({
  region: z.string().trim().max(80).optional(),
  package: z.string().trim().regex(/^\d{1,32}$/).optional(),
  district: z.string().trim().max(100).optional(),
  village: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const reportStatusChangeSchema = z.object({
  status: z.enum(["PUBLISHED", "REJECTED"]),
  reason: z.string().trim().min(3).max(1000),
});

export type PublicReportItem = z.infer<typeof publicReportItemSchema>;
export type PublicReportDetail = z.infer<typeof publicReportDetailSchema>;
export type PublicReportsResponse = z.infer<typeof publicReportsResponseSchema>;
export type PublicReportsQuery = z.infer<typeof publicReportsQuerySchema>;
export type ReportStatusChangeInput = z.infer<typeof reportStatusChangeSchema>;
