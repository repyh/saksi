import { Suspense } from "react";
import { notFound } from "next/navigation";
import MapDashboard from "@/features/map/map-dashboard";
import { addressForPackage, districtSlug, parseReportSegments, type ReportViewMode } from "@/features/map/report-routes";
import type { RoadContractFilter, RoadPackageSort, RoadWorkCategory } from "@/contracts/packages/road-package.contract";
import { searchRoadPackages, aggregateRoadPackages } from "@/server/packages/service";
import { listRegions, resolveRegionId } from "@/server/regions/region-registry";
import { absoluteSiteUrl, createPageMetadata } from "@/lib/seo";

export const revalidate = 300;

interface LaporanPageProps {
  params: Promise<{ segments?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params, searchParams }: LaporanPageProps) {
  const [{ segments = [] }, query] = await Promise.all([params, searchParams]);
  const metadata = createPageMetadata({
    title: "Peta pekerjaan jalan Kota Tangerang",
    description: "Jelajahi sebaran paket jalan berdasarkan kecamatan, kelurahan, RW, tahun, dan jenis pekerjaan.",
    path: "/peta-pekerjaan",
  });
  const imageQuery = new URLSearchParams();
  const area = segments.join("/").slice(0, 384);
  if (area) imageQuery.set("area", area);
  for (const key of ["region", "tahun", "jenis", "tampilan", "kelompok", "umum", "lokasi", "q"] as const) {
    const value = firstValue(query[key])?.trim();
    if (value) imageQuery.set(key, value.slice(0, key === "q" ? 80 : 64));
  }

  const imageUrl = absoluteSiteUrl(`/api/og/peta-pekerjaan?${imageQuery.toString()}`);
  const image = {
    url: imageUrl,
    width: 1200,
    height: 630,
    alt: "Pratinjau peta pekerjaan jalan SAKSI",
  };

  return {
    ...metadata,
    openGraph: { ...metadata.openGraph, images: [image] },
    twitter: { ...metadata.twitter, card: "summary_large_image", images: [imageUrl] },
  };
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
  const regionId = resolveRegionId(query.region);
  const rawYear = firstValue(query.tahun);
  const rawWork = firstValue(query.jenis)?.toLocaleUpperCase("id-ID");
  const rawView = firstValue(query.tampilan);
  const rawDecile = firstValue(query.kelompok);
  const decile = rawDecile !== undefined ? Number(rawDecile) : undefined;
  if (rawDecile !== undefined && (decile === undefined || !Number.isInteger(decile) || decile < 1 || decile > 10 || (rawYear !== "2025" && rawYear !== "2026"))) notFound();
  const selectedWork: RoadWorkCategory = rawWork === "PERMUKAAN" || rawWork === "DRAINASE" || rawWork === "JEMBATAN" ? rawWork : "SEMUA";
  const generalOnly = firstValue(query.umum) === "1";
  const locatedOnly = !generalOnly && firstValue(query.lokasi) !== "0";
  const rawContract = firstValue(query.kontrak);
  const contract: RoadContractFilter = rawContract === "ADA" || rawContract === "TANPA" ? rawContract : "SEMUA";
  const rawSort = firstValue(query.urut);
  const sort: RoadPackageSort = rawSort === "pagu-asc" || rawSort === "nama" ? rawSort : "pagu-desc";
  const rawVillages = query.desa;
  const villages = (Array.isArray(rawVillages) ? rawVillages : rawVillages ? [rawVillages] : []).filter(Boolean);
  const selection = parseReportSegments(segments, regionId);
  const catalog = await searchRoadPackages({ region: regionId, limit: 1 });
  const selectedDistrict = selection.districtSlug
    ? catalog.districts.find((district) => districtSlug(district) === selection.districtSlug)
    : undefined;
  if (selection.districtSlug && !selectedDistrict) notFound();
  const filters = {
    region: regionId, locatedOnly, generalOnly, budgetDecile: decile,
    year: rawYear === "2025" || rawYear === "2026" ? rawYear : undefined,
    work: selectedWork, contract, district: selectedDistrict, query: firstValue(query.q),
    sort,
    villages: selectedDistrict && villages.length ? villages : undefined,
  } as const;
  const [initialData, initialAggregate] = await Promise.all([searchRoadPackages(filters), aggregateRoadPackages(filters)]);
  const selectedPackage = selection.rupCode
    ? initialData.items.find((item) => item.kode_rup === selection.rupCode) ??
      (await searchRoadPackages({ region: regionId, query: selection.rupCode })).items.find(
        (item) => item.kode_rup === selection.rupCode,
      ) ??
      null
    : null;
  if (selection.rupCode && !selectedPackage) notFound();

  const mapView: ReportViewMode = rawView === "budget" ? "budget" : "packages";
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
        initialAggregate={initialAggregate}
        regionId={regionId}
        availableRegions={listRegions()}
        showIntro={false}
        fillViewport
        addressRouting
        initialRouteState={{
          budgetDecile: decile,
          generalOnly,
          locatedOnly,
          selectedDistrict: selectedDistrict ?? "SEMUA",
          selectedRegion,
          selectedPackage,
          selectedYear: rawYear === "2025" || rawYear === "2026" ? rawYear : "SEMUA",
          selectedWork,
          selectedContract: contract,
          selectedVillages: selectedDistrict && villages.length ? villages : null,
          selectedSort: sort,
          mapView,
          searchQuery: firstValue(query.q) ?? "",
        }}
      />
    </main>
  );
}
