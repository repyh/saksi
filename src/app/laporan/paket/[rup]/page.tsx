import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ReportPrototype from "@/features/reports/components/report-prototype";
import { searchRoadPackages } from "@/server/packages/service";

export const metadata: Metadata = {
  title: "Laporkan Kerusakan Jalan — SAKSI",
  description: "Buat laporan kerusakan jalan dengan paket pekerjaan sebagai rujukan.",
};

interface ReportPackagePageProps {
  params: Promise<{ rup: string }>;
}

export default async function ReportPackagePage({ params }: ReportPackagePageProps) {
  const { rup } = await params;
  if (!/^\d{1,16}$/.test(rup)) notFound();

  const data = await searchRoadPackages({ query: rup });
  const initialPackage = data.items.find((item) => item.kode_rup === rup);
  if (!initialPackage) notFound();

  return <ReportPrototype initialPackage={initialPackage} />;
}
