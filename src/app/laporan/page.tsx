import type { Metadata } from "next";
import ReportPrototype from "@/features/reports/components/report-prototype";
import { getRegion, regionSummary, resolveRegionId } from "@/server/regions/region-registry";

export const metadata: Metadata = {
  title: "Laporkan Kerusakan Jalan — SAKSI",
  description: "Simulasi alur laporan kerusakan jalan SAKSI.",
};

interface LaporanPageProps {
  searchParams: Promise<{ region?: string | string[] }>;
}

export default async function LaporanPage({ searchParams }: LaporanPageProps) {
  const query = await searchParams;
  const region = regionSummary(getRegion(resolveRegionId(query.region)));
  return <ReportPrototype region={region} />;
}
