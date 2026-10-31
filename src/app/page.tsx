import { AuditHeader } from "@/features/audit/components/audit-header";
import { PackageJourneySection } from "@/features/audit/components/package-journey-section";
import MapDashboard from "@/features/map/map-dashboard";
import { searchRoadPackages } from "@/server/packages/service";

export default async function Home() {
  const initialPackages = await searchRoadPackages();

  return (
    <main className="min-h-screen bg-white text-foreground">
      <AuditHeader />
      <PackageJourneySection />
      <MapDashboard initialData={initialPackages} />
    </main>
  );
}
