import { notFound } from "next/navigation";
import ReportPrototype from "@/features/reports/components/report-prototype";
import { createPageMetadata } from "@/lib/seo";
import { searchRoadPackages } from "@/server/packages/service";
import { resolveRegionId } from "@/server/regions/region-registry";

interface ReportPackagePageProps {
  params: Promise<{ rup: string }>;
  searchParams: Promise<{ region?: string | string[] }>;
}

export async function generateMetadata({ params }: ReportPackagePageProps) {
  const { rup } = await params;
  return createPageMetadata({
    title: "Laporkan kerusakan jalan",
    description: "Buat laporan kerusakan jalan dengan paket pekerjaan sebagai rujukan.",
    path: `/laporan/paket/${encodeURIComponent(rup)}`,
    index: false,
  });
}

export default async function ReportPackagePage({ params, searchParams }: ReportPackagePageProps) {
  const [{ rup }, query] = await Promise.all([params, searchParams]);
  const regionId = resolveRegionId(query.region);
  if (!/^\d{1,16}$/.test(rup)) notFound();

  const data = await searchRoadPackages({ region: regionId, query: rup });
  const initialPackage = data.items.find((item) => item.kode_rup === rup);
  if (!initialPackage) notFound();

  return <ReportPrototype initialPackage={initialPackage} region={data.region} />;
}
