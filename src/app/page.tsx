import { AuditHeader } from "@/features/audit/components/audit-header";
import { PackageJourneySection } from "@/features/audit/components/package-journey-section";
import MapDashboard from "@/features/map/map-dashboard";
import { buildAuditSummaryMetrics } from "@/server/packages/audit-metrics";
import { searchRoadPackages } from "@/server/packages/service";

export default async function Home() {
  const [initialPackages, metrics] = await Promise.all([
    searchRoadPackages({ locatedOnly: true }),
    buildAuditSummaryMetrics(),
  ]);

  return (
    <main className="min-h-screen bg-white text-foreground">
      <AuditHeader metrics={metrics} />
      <PackageJourneySection />
      <MapDashboard initialData={initialPackages} />
    </main>
  );
}
