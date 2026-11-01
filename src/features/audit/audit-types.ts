export interface AuditSpatialBreakdown {
  rwPackages: number;
  kelurahanPackages: number;
  unmappedPackages: number;
}

export interface AuditSummaryMetrics {
  regionName: string;
  snapshotDate: string;
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
  mappedCount: number;
  mappedPercent: string;
  spatial: AuditSpatialBreakdown;
}
