import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReportPrototype from "@/features/reports/components/report-prototype";
import { searchRoadPackages } from "@/server/packages/service";
import { resolveRegionId } from "@/server/regions/region-registry";

export const metadata: Metadata = {
  title: "Laporkan Kerusakan Jalan — SAKSI",
  description: "Buat laporan kerusakan jalan dengan paket pekerjaan sebagai rujukan.",
};

interface ReportPackagePageProps {
  params: Promise<{ rup: string }>;
  searchParams: Promise<{ region?: string | string[] }>;
}

export default async function ReportPackagePage({ params, searchParams }: ReportPackagePageProps) {
  const [{ rup }, query] = await Promise.all([params, searchParams]);
  const regionId = resolveRegionId(query.region);
  if (!/^\d{1,16}$/.test(rup)) notFound();

  const data = await searchRoadPackages({ region: regionId, query: rup });
  const initialPackage = data.items.find((item) => item.kode_rup === rup);
  if (!initialPackage) notFound();

  return <ReportPrototype initialPackage={initialPackage} />;
}
