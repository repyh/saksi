import ReportPrototype from "@/features/reports/components/report-prototype";
import { createPageMetadata } from "@/lib/seo";
import { getRegion, regionSummary, resolveRegionId } from "@/server/regions/region-registry";

export const metadata = createPageMetadata({
  title: "Laporkan kerusakan jalan",
  description: "Buat laporan kerusakan jalan di Kota Tangerang dengan informasi lokasi yang jelas.",
  path: "/laporan",
  index: false,
});

interface LaporanPageProps {
  searchParams: Promise<{ region?: string | string[] }>;
}

export default async function LaporanPage({ searchParams }: LaporanPageProps) {
  const query = await searchParams;
  const region = regionSummary(getRegion(resolveRegionId(query.region)));
  return <ReportPrototype region={region} />;
}
