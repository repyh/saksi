import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FiArrowLeft, FiArrowRight } from "react-icons/fi";
import { Badge } from "@/components/ui/badge";
import { classifyRoadWork, ROAD_WORK_LABELS } from "@/contracts/packages/road-work";
import { PackageContractSection } from "@/features/packages/components/package-contract-section";
import { PackageLocationSection } from "@/features/packages/components/package-location-section";
import { PackagePlanSection } from "@/features/packages/components/package-plan-section";
import { PackageReportsSection } from "@/features/packages/components/package-reports-section";
import { routeForPackage } from "@/features/map/report-routes";
import { formatRupiahFull } from "@/features/map/road-types";
import { getRoadPackageDetail } from "@/server/packages/service";
import { getRegion, resolveRegionId } from "@/server/regions/region-registry";
import { listPublishedReports } from "@/server/reports/public-report.repository";

export interface RoadPackageDetailPageProps {
  params: Promise<{ rup: string }>;
  searchParams: Promise<{ region?: string | string[]; returnTo?: string | string[] }>;
  directoryPath: "/paket" | "/project";
}

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function packageDirectoryHref(returnTo: string | undefined, regionId: string, directoryPath: RoadPackageDetailPageProps["directoryPath"]) {
  const fallback = `${directoryPath}?region=${encodeURIComponent(regionId)}`;
  if (!returnTo?.startsWith(`${directoryPath}?`)) return fallback;

  const requested = new URLSearchParams(returnTo.slice(`${directoryPath}?`.length));
  const params = new URLSearchParams({ region: regionId });
  const query = requested.get("q")?.trim().slice(0, 120);
  const year = requested.get("tahun");
  const work = requested.get("jenis");
  const sort = requested.get("urut");
  const direction = requested.get("arah");
  const page = Number(requested.get("halaman"));

  if (query) params.set("q", query);
  if (year === "2025" || year === "2026") params.set("tahun", year);
  if (work === "permukaan" || work === "drainase" || work === "jembatan") params.set("jenis", work);
  if (sort === "pagu" || sort === "kontrak" || sort === "nama" || sort === "tahun") params.set("urut", sort);
  if (direction === "asc" || direction === "desc") params.set("arah", direction);
  if (Number.isInteger(page) && page > 0 && page <= 10_000) params.set("halaman", String(page));

  return `${directoryPath}?${params.toString()}`;
}

function labelPresisi(item: { presisi_peta: string; rw: string | null }): string {
  if (item.presisi_peta === "RW" && item.rw) return `RW ${item.rw}`;
  if (item.presisi_peta === "Kelurahan") return "Kelurahan";
  if (item.presisi_peta === "Kecamatan") return "Kecamatan";
  return "Kota Tangerang (umum)";
}

export async function generateRoadPackageDetailMetadata({
  params,
  searchParams,
  directoryPath,
}: RoadPackageDetailPageProps): Promise<Metadata> {
  const [{ rup }, query] = await Promise.all([params, searchParams]);
  const typeLabel = directoryPath === "/project" ? "Proyek" : "Paket";
  if (!/^\d{1,16}$/.test(rup)) return { title: `${typeLabel} tidak ditemukan — SAKSI` };
  const regionId = resolveRegionId(query.region);
  const detail = await getRoadPackageDetail(rup, regionId);
  if (!detail) return { title: `${typeLabel} tidak ditemukan — SAKSI` };

  return {
    title: `${detail.item.nama} — ${typeLabel} RUP ${detail.item.kode_rup} — SAKSI`,
    description: `Rencana, lokasi, realisasi kontrak, dan laporan warga untuk RUP ${detail.item.kode_rup} di ${detail.region.label}.`,
  };
}

export async function RoadPackageDetailPage({
  params,
  searchParams,
  directoryPath,
}: RoadPackageDetailPageProps) {
  const [{ rup }, query] = await Promise.all([params, searchParams]);
  const regionId = resolveRegionId(query.region);
  const returnHref = packageDirectoryHref(firstValue(query.returnTo), regionId, directoryPath);
  if (!/^\d{1,16}$/.test(rup)) notFound();

  const detail = await getRoadPackageDetail(rup, regionId);
  if (!detail) notFound();

  const reports = process.env.DATABASE_URL
    ? await listPublishedReports({ region: regionId, package: rup, page: 1, limit: 20 }).catch(() => null)
    : null;

  const { item, plan, snapshot } = detail;
  const regionLabel = getRegion(regionId).label;
  const typeLabel = directoryPath === "/project" ? "Proyek" : "Paket";
  const returnLabel = directoryPath === "/project" ? "Semua proyek jalan" : "Semua paket jalan";

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-white text-foreground">
      <section className="border-b border-border bg-muted/20">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Link href={returnHref} className="inline-flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-primary underline-offset-2 hover:underline">
            <FiArrowLeft aria-hidden="true" className="size-3.5" /> {returnLabel}
          </Link>

          <p className="mt-4 font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-primary">
            {typeLabel} RUP {item.kode_rup} · TA {item.tahun}
          </p>
          <h1 className="mt-2 font-heading text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">{item.nama}</h1>

          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Pagu {typeLabel.toLocaleLowerCase("id-ID")}</p>
              <p className="mt-1 font-heading text-3xl font-extrabold tabular-nums tracking-tight text-primary">{formatRupiahFull(item.pagu)}</p>
            </div>
            <Link href={`/laporan/paket/${item.kode_rup}?region=${encodeURIComponent(regionId)}`} className="inline-flex items-center gap-2 bg-primary px-4 py-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-[#004682]">
              Laporkan kerusakan <FiArrowRight aria-hidden="true" className="size-3.5 text-secondary" />
            </Link>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge variant="official">DATA RESMI (INAPROC)</Badge>
            <Badge variant="outline">{labelPresisi(item)}</Badge>
            <Link href={`${routeForPackage(item)}?region=${encodeURIComponent(regionId)}`} className="font-sans text-[11px] font-bold text-primary underline-offset-2 hover:underline">
              Lihat wilayah paket di peta
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <dl className="grid gap-4 border border-border bg-muted/10 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Satuan kerja</dt><dd className="mt-1 font-sans text-sm font-semibold leading-snug text-foreground">{item.satker}</dd></div>
          <div><dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Sektor</dt><dd className="mt-1 font-sans text-sm font-semibold leading-snug text-foreground">{item.sektor}</dd></div>
          <div><dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jenis pekerjaan</dt><dd className="mt-1 font-sans text-sm font-semibold leading-snug text-foreground">{ROAD_WORK_LABELS[classifyRoadWork(item.nama)]}</dd></div>
          <div><dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Metode</dt><dd className="mt-1 font-sans text-sm font-semibold leading-snug text-foreground">{item.metode ?? "Tidak dicantumkan"}</dd></div>
          <div><dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Sumber dana</dt><dd className="mt-1 font-sans text-sm font-semibold leading-snug text-foreground">{item.sumber ? item.sumber.replace(/,+$/, "") : "Tidak dicantumkan"}</dd></div>
          <div><dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jadwal</dt><dd className="mt-1 font-sans text-sm font-semibold leading-snug text-foreground">{item.bulan ?? "Belum tersedia"}</dd></div>
        </dl>

        <div className="mt-8 grid gap-8">
          <PackagePlanSection plan={plan} />
          <PackageLocationSection item={item} regionId={regionId} regionLabel={regionLabel} />
          <PackageContractSection item={item} regionId={regionId} />
          <PackageReportsSection reports={reports} regionId={regionId} rup={item.kode_rup} />
        </div>

        <p className="mt-8 border-t border-border pt-4 font-sans text-[11px] text-muted-foreground">Snapshot {snapshot.snapshot} · Sumber {snapshot.sumber}</p>
      </section>
    </main>
  );
}
