export interface AuditSpatialBreakdown {
  villagePoints: number;
  corridorLines: number;
  districtCentroids: number;
  unmappedPackages: number;
}

export interface AuditSummaryMetrics {
  regionName: string;
  kldiCode: string;
  bpsCode: string;
  snapshotDate: string;
  fiscalYears: [number, number];
  totalPackages: number;
  packagesByYear: {
    y2025: number;
    y2026: number;
  };
  totalBudgetBillionRp: string;
  medianBudgetMillionRp: string;
  coveredVillages: number;
  totalVillages: number;
  totalDistricts: number;
  mappedCount: number;
  mappedPercent: string;
  spatial: AuditSpatialBreakdown;
}
