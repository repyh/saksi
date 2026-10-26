export type CoarseReportLocation = {
  latitude: number;
  longitude: number;
};

export type ReportDraftAssessment = {
  damageType: string;
  severity?: string;
  confidence?: number;
};

/** Local-only draft shape. It deliberately has no field for photo or image bytes. */
export type ReportDraft = {
  id: string;
  description: string;
  location?: CoarseReportLocation;
  assessment?: ReportDraftAssessment;
  createdAt: string;
  updatedAt: string;
};

export type SaveReportDraftInput = Omit<ReportDraft, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};
