import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublishedReportDetail } from "@/server/reports/public-report.repository";
import { getRegion, regionSummary, DEFAULT_REGION_ID } from "@/server/regions/region-registry";
import ReportLocationMap from "@/features/reports/components/report-location-map";
import { createPageMetadata } from "@/lib/seo";

interface PublicReportDetailPageProps {
  params: Promise<{ publicCode: string }>;
}

export async function generateMetadata({ params }: PublicReportDetailPageProps) {
  const { publicCode } = await params;
  return createPageMetadata({
    title: "Detail laporan publik",
    description: "Informasi laporan kerusakan jalan yang telah disetujui untuk ditampilkan.",
    path: `/laporan/publik/${encodeURIComponent(publicCode)}`,
    index: false,
  });
}

const DAMAGE_LABELS: Record<string, string> = {
  POTHOLE: "Lubang",
  CRACK: "Retak",
  SUBSIDENCE: "Amblas",
  STANDING_WATER: "Genangan",
  BLOCKED_DRAINAGE: "Drainase mampet",
  DAMAGED_BRIDGE: "Jembatan rusak",
  OTHER: "Lainnya",
};

const SIZE_LABELS: Record<string, string> = {
  PALM: "Setelapak tangan",
  TIRE: "Sebesar ban",
  OVER_1M2: "Lebih dari 1 m²",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

interface PublicReportDetailPageProps {
  params: Promise<{ publicCode: string }>;
}

export default async function PublicReportDetailPage({ params }: PublicReportDetailPageProps) {
  const { publicCode } = await params;
  if (!process.env.DATABASE_URL) notFound();
  const report = await getPublishedReportDetail(publicCode).catch((error: unknown) => {
    if (error instanceof Error && /P20(21|22)/.test(error.message)) return null;
    throw error;
  });
  if (!report) notFound();

  const region = regionSummary(getRegion(DEFAULT_REGION_ID));
  const area = [report.areaName, report.districtName].filter(Boolean).join(" · ");
  const mapPoint = report.point ? { ...report.point, accuracyM: null } : null;

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-white text-foreground">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <nav className="text-sm">
          <Link href="/laporan/publik" className="font-semibold text-primary underline-offset-4 hover:underline">
            ← Kembali ke laporan publik
          </Link>
        </nav>

        <header className="mt-5 border-b border-border pb-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Laporan warga · sudah disetujui</p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            {DAMAGE_LABELS[report.damageType] ?? report.damageType}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Dikirim {formatDate(report.submittedAt)}
            {report.publishedAt ? ` · disetujui ${formatDate(report.publishedAt)}` : ""}
          </p>
        </header>

        <div className="mt-6 grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
          <div className="min-w-0">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Ukuran kasar</dt>
                <dd className="mt-1 text-sm text-foreground">{report.coarseSize ? SIZE_LABELS[report.coarseSize] : "Tidak dicantumkan"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Wilayah</dt>
                <dd className="mt-1 text-sm text-foreground">{area || "Tidak dicantumkan"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Ruas jalan</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {report.road
                    ? `${report.road.name ?? "Ruas tanpa nama"}${report.road.roadClass ? ` · ${report.road.roadClass}` : ""}`
                    : "Tidak dicantumkan"}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Paket rujukan</dt>
                <dd className="mt-1 text-sm text-foreground">
                  {report.package ? (
                    <Link href={`/project/${encodeURIComponent(report.package.rup)}?region=${encodeURIComponent(region.id)}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                      RUP {report.package.rup}
                    </Link>
                  ) : "Tidak ditautkan"}
                </dd>
              </div>
            </dl>

            {report.package ? <p className="mt-3 text-xs leading-5 text-muted-foreground">{report.package.name}</p> : null}

            <div className="mt-6 bg-muted/40 px-4 py-3 text-xs leading-5 text-muted-foreground">
              <p>
                <strong className="text-foreground">Titik laporan warga, belum diverifikasi.</strong>{" "}
                {report.point
                  ? "Titik ditampilkan karena pelapor memilih menampilkannya di halaman publik; titik bukan lokasi resmi paket."
                  : "Pelapor memilih menyembunyikan titik, atau laporan dibuat sebelum fitur titik tersedia. Titik tidak ditampilkan."}
              </p>
              <p className="mt-1">Laporan warga adalah sinyal untuk ditinjau, bukan bukti pelanggaran atau penyebab kerusakan.</p>
            </div>
          </div>

          <div className="min-w-0">
            {report.road?.geometry || report.point ? (
              <ReportLocationMap
                region={region}
                point={mapPoint}
                readOnly
                roadsAlwaysVisible
                selectedRoad={report.road?.geometry ? {
                  id: report.road.sourceObjectId ?? report.publicCode,
                  name: report.road.name,
                  geometry: report.road.geometry as unknown as import("geojson").LineString | import("geojson").MultiLineString,
                } : null}
                label={report.point ? "Titik laporan warga, belum diverifikasi. Bukan lokasi paket." : "Ruas laporan warga; titik tidak ditampilkan."}
                className="h-[340px] sm:h-[420px]"
              />
            ) : (
              <div className="flex h-[340px] items-center justify-center border border-dashed border-border bg-muted/20 px-5 text-center text-sm text-muted-foreground sm:h-[420px]">
                Peta tidak ditampilkan karena laporan tidak memiliki titik maupun ruas.
              </div>
            )}
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              Peta memuat layer jalan Overture. © OpenStreetMap contributors, Overture Maps Foundation (ODbL).
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
