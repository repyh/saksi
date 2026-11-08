import { AuditHeader } from "@/features/audit/components/audit-header";
import { PackageJourneySection } from "@/features/audit/components/package-journey-section";
import MapDashboard from "@/features/map/map-dashboard";
import { buildAuditSummaryMetrics } from "@/server/packages/audit-metrics";
import { searchRoadPackages, aggregateRoadPackages } from "@/server/packages/service";
import { listRegions, resolveRegionId } from "@/server/regions/region-registry";

interface HomeProps {
  searchParams: Promise<{ region?: string | string[] }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const query = await searchParams;
  const regionId = resolveRegionId(query.region);
  const [initialPackages, initialAggregate, metrics] = await Promise.all([
    searchRoadPackages({ region: regionId, locatedOnly: true }),
    aggregateRoadPackages({ region: regionId, locatedOnly: true }),
    buildAuditSummaryMetrics(regionId),
  ]);

  return (
    <main className="min-h-screen bg-white text-foreground">
      <AuditHeader metrics={metrics} />
      <PackageJourneySection />
      <MapDashboard
        initialData={initialPackages}
        initialAggregate={initialAggregate}
        regionId={regionId}
        availableRegions={listRegions()}
      />
    </main>
  );
}
