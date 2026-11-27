import { AuditHeader } from "@/features/audit/components/audit-header";
import { PackageJourneySection } from "@/features/audit/components/package-journey-section";
import { PackageSearchSection } from "@/features/audit/components/package-search-section";
import { buildAuditSummaryMetrics } from "@/server/packages/audit-metrics";
import { resolveRegionId } from "@/server/regions/region-registry";
import { buildBudgetExplorer } from "@/server/packages/budget-explorer";
import { BudgetExplorer } from "@/features/audit/components/budget-explorer";
import { JsonLd } from "@/components/seo/json-ld";
import { getSiteOrigin, SITE_DESCRIPTION, SITE_NAME } from "@/lib/seo";

export const revalidate = 300;

interface HomeProps {
  searchParams: Promise<{ region?: string | string[] }>;
}

export default async function Home({ searchParams }: HomeProps) {
  const query = await searchParams;
  const regionId = resolveRegionId(query.region);
  const [metrics, explorer] = await Promise.all([
    buildAuditSummaryMetrics(regionId),
    buildBudgetExplorer(regionId),
  ]);
  const siteUrl = getSiteOrigin().toString();

  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "@id": `${siteUrl}#website`,
          url: siteUrl,
          name: SITE_NAME,
          alternateName: "Sistem Akuntabilitas & Komparasi Spasial Infrastruktur",
          description: SITE_DESCRIPTION,
          inLanguage: "id-ID",
        }}
      />
      <main className="min-h-screen bg-white text-foreground">
        <AuditHeader metrics={metrics} regionId={regionId} />
        <BudgetExplorer region={regionId} data={explorer} snapshot={metrics.snapshotDate} source={metrics.snapshotSource} />
        <PackageJourneySection regionId={regionId} />
        <PackageSearchSection regionId={regionId} />
      </main>
    </>
  );
}
