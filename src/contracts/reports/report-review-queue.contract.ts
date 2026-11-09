import { z } from "zod";
import { reportStatuses } from "@/contracts/reports/report-history.contract";
import {
  reportCoarseSizes,
  reportDamageTypes,
  reportObservedCauses,
} from "@/contracts/reports/report-submission.contract";

export const reportReviewQueueQuerySchema = z.object({
  status: z.enum(["active", "all", ...reportStatuses]).default("active"),
  order: z.enum(["submittedAt_desc", "submittedAt_asc"]).default("submittedAt_desc"),
  cursor: z.string().min(1).max(64).optional(),
});

export const reportReviewQueueItemSchema = z.object({
  publicCode: z.string(),
  id: z.string().uuid(),
  status: z.enum(reportStatuses),
  damageType: z.enum(reportDamageTypes),
  submittedAt: z.string().datetime(),
  areaName: z.string().nullable(),
  districtName: z.string().nullable(),
  package: z.object({ rup: z.string(), name: z.string() }).nullable(),
});

export const reportReviewDetailSchema = reportReviewQueueItemSchema.extend({
  observedCauses: z.array(z.enum(reportObservedCauses)),
  coarseSize: z.enum(reportCoarseSizes).nullable(),
  description: z.string().max(500).nullable(),
  hasEvidence: z.boolean(),
});

export const reportReviewQueueResponseSchema = z.object({
  reports: z.array(reportReviewQueueItemSchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
});

export type ReportReviewQueueItem = z.infer<typeof reportReviewQueueItemSchema>;
export type ReportReviewDetail = z.infer<typeof reportReviewDetailSchema>;
export type ReportReviewQueueResponse = z.infer<typeof reportReviewQueueResponseSchema>;
