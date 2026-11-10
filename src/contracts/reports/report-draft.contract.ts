import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import type { RoadSegment } from "@/contracts/reports/road-search.contract";

export type CoarseReportLocation = {
  latitude: number;
  longitude: number;
};

export type ReportDraftAssessment = {
  damageType: string;
  severity?: string;
  confidence?: number;
};

export type ReportLocationMode = "POINT" | "AREA";

/** Foto tersanitasi disimpan sebagai Blob di IndexedDB; tidak pernah dikirim ke server dari draf. */
export type ReportDraftPhoto = {
  blob: Blob;
  name: string;
  type: string;
  width: number;
  height: number;
};

/** Isian alur laporan yang dipulihkan setelah halaman disegarkan. */
export type ReportDraftState = {
  step: number;
  photo: ReportDraftPhoto | null;
  damageType: string;
  observedCauses: string[];
  coarseSize: string;
  description: string;
  point: CoarseReportLocation | null;
  accuracyM: number | null;
  areaId: string;
  landmark: string;
  publicLocationConsent: boolean;
  locationMode: ReportLocationMode;
  locationSource: string;
  road: RoadSegment | null;
  package: RoadPackageItem | null;
  packageSelectionSource: "PACKAGE_PAGE" | "CANDIDATE_LIST" | null;
};

/** Local-only draft shape kept for seven days and deleted after a successful submission. */
export type ReportDraft = {
  id: string;
  state: ReportDraftState;
  createdAt: string;
  updatedAt: string;
};

export type SaveReportDraftInput = Omit<ReportDraft, "id" | "createdAt" | "updatedAt"> & {
  id?: string;
};
