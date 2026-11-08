export interface AuditSpatialBreakdown {
  rwPackages: number;
  kelurahanPackages: number;
  kecamatanPackages: number;
  unmappedPackages: number;
}

export interface AuditSummaryMetrics {
  regionName: string;
  /** Human-readable snapshot date, e.g. "5 November 2026". */
  snapshotDate: string;
  /** Snapshot source as recorded in the dataset manifest. */
  snapshotSource: string;
  fiscalYears: [number, number];
  totalPackages: number;
  packagesByYear: {
    y2025: number;
    y2026: number;
  };
  totalBudgetDisplay: string;
  coveredKelurahan: number;
  totalKelurahan: number;
  totalDistricts: number;
  coveredRw: number;
  totalRw: number;
  mappedCount: number;
  mappedPercent: string;
  spatial: AuditSpatialBreakdown;
}
