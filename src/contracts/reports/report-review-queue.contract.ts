import { z } from "zod";
import { reportStatuses } from "@/contracts/reports/report-history.contract";
import { reportDamageTypes } from "@/contracts/reports/report-submission.contract";

export const reportReviewQueueQuerySchema = z.object({
  status: z.enum(["active", "all", ...reportStatuses]).default("active"),
  cursor: z.string().min(1).max(64).optional(),
});

export const reportReviewQueueItemSchema = z.object({
  status: z.enum(reportStatuses),
  damageType: z.enum(reportDamageTypes),
  submittedAt: z.string().datetime(),
  areaName: z.string().nullable(),
  districtName: z.string().nullable(),
  package: z.object({ rup: z.string(), name: z.string() }).nullable(),
});

export const reportReviewQueueResponseSchema = z.object({
  reports: z.array(reportReviewQueueItemSchema),
  total: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
});

export type ReportReviewQueueItem = z.infer<typeof reportReviewQueueItemSchema>;
export type ReportReviewQueueResponse = z.infer<typeof reportReviewQueueResponseSchema>;
