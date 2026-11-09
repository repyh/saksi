import { AuditHeader } from "@/features/audit/components/audit-header";
import { PackageJourneySection } from "@/features/audit/components/package-journey-section";
import { PackageSearchSection } from "@/features/audit/components/package-search-section";
import { buildAuditSummaryMetrics } from "@/server/packages/audit-metrics";
import { resolveRegionId } from "@/server/regions/region-registry";
import { buildBudgetExplorer } from "@/server/packages/budget-explorer";
import { BudgetExplorer } from "@/features/audit/components/budget-explorer";

interface HomeProps {
  searchParams: Promise<{ region?: string | string[] }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const query = await searchParams;
  const regionId = resolveRegionId(query.region);
  const [metrics, explorer] = await Promise.all([buildAuditSummaryMetrics(regionId), buildBudgetExplorer(regionId)]);

  return (
    <main className="min-h-screen bg-white text-foreground">
      <AuditHeader metrics={metrics} />
      <BudgetExplorer region={regionId} data={explorer} snapshot={metrics.snapshotDate} source={metrics.snapshotSource} />
      <PackageJourneySection />
      <PackageSearchSection />
    </main>
  );
}
