import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import MapDashboard from "@/features/map/map-dashboard";
import { addressForPackage, districtSlug, parseReportSegments, type ReportViewMode } from "@/features/map/report-routes";
import type { RoadWorkCategory } from "@/contracts/packages/road-package.contract";
import { searchRoadPackages } from "@/server/packages/service";

export const metadata: Metadata = {
  title: "Peta Pekerjaan — SAKSI",
  description: "Peta paket pekerjaan jalan Kota Tangerang.",
};

interface LaporanPageProps {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default function LaporanPage(props: LaporanPageProps) {
  return (
    <Suspense fallback={<main aria-hidden="true" className="min-h-[calc(100dvh-4rem)] bg-muted/20 lg:h-[calc(100dvh-4rem)]" />}>
      <LaporanContent {...props} />
    </Suspense>
  );
}

async function LaporanContent({ params, searchParams }: LaporanPageProps) {
  const [{ segments = [] }, query] = await Promise.all([params, searchParams]);
  const initialData = await searchRoadPackages();
  const selection = parseReportSegments(segments);
  const selectedPackage = selection.rupCode
    ? initialData.items.find((item) => item.kode_rup === selection.rupCode) ?? null
    : null;
  if (selection.rupCode && !selectedPackage) notFound();

  const selectedDistrict = selection.districtSlug
    ? initialData.districts.find((district) => districtSlug(district) === selection.districtSlug)
    : undefined;
  if (selection.districtSlug && !selectedDistrict) notFound();

  const rawYear = firstValue(query.tahun);
  const rawWork = firstValue(query.jenis)?.toLocaleUpperCase("id-ID");
  const rawView = firstValue(query.tampilan);
  const selectedWork: RoadWorkCategory = rawWork === "PERMUKAAN" || rawWork === "DRAINASE" || rawWork === "JEMBATAN" ? rawWork : "SEMUA";
  const mapView: ReportViewMode = rawView === "budget" || rawView === "work" ? rawView : "packages";
  const selectedRegion = selection.districtSlug || selection.villageSlug || selection.rwSlug
    ? {
        districtSlug: selection.districtSlug,
        villageSlug: selection.villageSlug,
        rwSlug: selection.rwSlug,
      }
    : selectedPackage
      ? addressForPackage(selectedPackage)
      : null;

  return (
    <main aria-label="Peta pekerjaan" className="min-h-[calc(100dvh-4rem)] w-full lg:h-[calc(100dvh-4rem)] lg:overflow-hidden">
      <MapDashboard
        initialData={initialData}
        showIntro={false}
        fillViewport
        addressRouting
        initialRouteState={{
          selectedDistrict: selectedDistrict ?? "SEMUA",
          selectedRegion,
          selectedPackage,
          selectedYear: rawYear === "2025" || rawYear === "2026" ? rawYear : "SEMUA",
          selectedWork,
          mapView,
          searchQuery: firstValue(query.q) ?? "",
        }}
      />
    </main>
  );
}
