import { z } from "zod";
import { reportDamageTypes } from "@/contracts/reports/report-submission.contract";

export const reportStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_MORE_INFO",
  "PUBLISHED",
  "REJECTED",
  "WITHDRAWN",
  "ARCHIVED",
] as const;

export const myReportSummarySchema = z.object({
  publicCode: z.string(),
  status: z.enum(reportStatuses),
  damageType: z.enum(reportDamageTypes),
  submittedAt: z.string().datetime(),
  areaName: z.string().nullable(),
  districtName: z.string().nullable(),
  package: z.object({
    rup: z.string(),
    name: z.string(),
  }).nullable(),
});

export const myReportsResponseSchema = z.object({
  reports: z.array(myReportSummarySchema),
});

export type MyReportSummary = z.infer<typeof myReportSummarySchema>;
export type MyReportsResponse = z.infer<typeof myReportsResponseSchema>;
