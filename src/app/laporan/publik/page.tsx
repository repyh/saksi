import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedReports } from "@/server/reports/public-report.repository";
import { searchRoadPackages } from "@/server/packages/service";
import { getRegion, regionSummary, resolveRegionId } from "@/server/regions/region-registry";
import type { PublicReportsResponse } from "@/contracts/reports/public-report.contract";

export const metadata: Metadata = {
  title: "Laporan Publik — SAKSI",
  description: "Laporan kerusakan jalan warga yang sudah disetujui untuk ditampilkan.",
};

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
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "long",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

interface PublicReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PublicReportsPage({ searchParams }: PublicReportsPageProps) {
  const query = await searchParams;
  const regionId = resolveRegionId(query.region);
  const region = getRegion(regionId);
  const summary = regionSummary(region);
  const paket = firstValue(query.paket)?.trim() || "";
  const kecamatan = firstValue(query.kecamatan)?.trim() || "";
  const kelurahan = firstValue(query.kelurahan)?.trim() || "";
  const pageParam = Number(firstValue(query.page) ?? "1");
  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  const [districtsResult, reportsResult] = await Promise.all([
    searchRoadPackages({ region: regionId }).then((data) => data.districts).catch(() => []),
    process.env.DATABASE_URL
      ? listPublishedReports({
        region: regionId,
        package: /^\d{1,32}$/.test(paket) ? paket : undefined,
        district: kecamatan || undefined,
        village: kelurahan || undefined,
        page,
        limit: 20,
      }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const reports: PublicReportsResponse | null = reportsResult;

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-white text-foreground">
      <section className="border-b border-border bg-muted/20">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Laporan warga</p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Laporan publik</h1>
          <p className="mt-3 max-w-[68ch] text-sm leading-6 text-muted-foreground sm:text-base">
            Hanya laporan yang sudah disetujui moderator yang tampil di sini. Identitas pelapor, deskripsi,
            petunjuk lokasi, lokasi presisi, dan foto tidak pernah ditampilkan. Laporan warga adalah sinyal
            untuk ditinjau, bukan bukti pelanggaran.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 text-sm">
            <Link href="/laporan" className="font-semibold text-primary underline-offset-4 hover:underline">
              Buat laporan baru
            </Link>
            <Link href={`/project?region=${encodeURIComponent(regionId)}`} className="font-semibold text-primary underline-offset-4 hover:underline">
              Kembali ke peta
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <form method="get" className="grid gap-3 border border-border bg-muted/10 p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <input type="hidden" name="region" value={regionId} />
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Kecamatan
            <select
              name="kecamatan"
              defaultValue={kecamatan}
              className="h-10 border border-input bg-white px-2 text-sm font-normal text-foreground"
            >
              <option value="">Semua kecamatan</option>
              {districtsResult.map((district) => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Kelurahan
            <input
              name="kelurahan"
              defaultValue={kelurahan}
              placeholder="Nama kelurahan"
              className="h-10 border border-input bg-white px-2 text-sm font-normal text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
            Nomor RUP paket
            <input
              name="paket"
              defaultValue={paket}
              inputMode="numeric"
              placeholder="mis. 55981404"
              className="h-10 border border-input bg-white px-2 text-sm font-normal text-foreground"
            />
          </label>
          <div className="flex gap-2">
            <button type="submit" className="inline-flex h-10 items-center bg-primary px-4 text-sm font-bold text-white hover:bg-[#004682]">
              Terapkan filter
            </button>
            <Link href={`/laporan/publik?region=${encodeURIComponent(regionId)}`} className="inline-flex h-10 items-center border border-border px-3 text-sm font-semibold text-primary hover:bg-muted">
              Reset
            </Link>
          </div>
          <p className="text-xs leading-5 text-muted-foreground lg:col-span-5">
            Wilayah kerja: <strong className="text-foreground">{summary.label}</strong>
            {reports ? ` · ${reports.total.toLocaleString("id-ID")} laporan disetujui` : ""}
          </p>
        </form>

        {!reports ? (
          <div role="status" className="mt-6 border border-dashed border-border bg-muted/10 p-6 text-sm leading-6 text-muted-foreground">
            Daftar laporan publik belum tersedia. Fitur ini memerlukan koneksi basis data laporan yang sudah dikonfigurasi.
          </div>
        ) : reports.reports.length === 0 ? (
          <div role="status" className="mt-6 border border-dashed border-border bg-muted/10 p-6 text-sm leading-6 text-muted-foreground">
            Belum ada laporan yang disetujui pada filter ini.
          </div>
        ) : (
          <>
            <ul className="mt-6 grid gap-3">
              {reports.reports.map((report) => {
                const area = [report.areaName, report.districtName].filter(Boolean).join(" · ");
                return (
                  <li key={report.publicCode} className="border border-border bg-white px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-heading text-lg font-bold leading-6">{DAMAGE_LABELS[report.damageType] ?? report.damageType}</h2>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Dikirim {formatDate(report.submittedAt)}
                          {report.publishedAt ? ` · disetujui ${formatDate(report.publishedAt)}` : ""}
                        </p>
                      </div>
                      <span className="inline-flex min-h-8 items-center border border-primary/30 bg-primary/5 px-3 text-xs font-bold text-primary">
                        Disetujui untuk ditampilkan
                      </span>
                    </div>
                    <dl className="mt-4 grid gap-3 border-t border-border/70 pt-3 text-sm sm:grid-cols-3">
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Ukuran kasar</dt>
                        <dd className="mt-0.5 text-foreground">{report.coarseSize ? SIZE_LABELS[report.coarseSize] : "Tidak dicantumkan"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Wilayah</dt>
                        <dd className="mt-0.5 text-foreground">{area || "Tidak dicantumkan"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">Paket rujukan</dt>
                        <dd className="mt-0.5 text-foreground">
                          {report.package ? (
                            <Link
                              href={`/paket/${encodeURIComponent(report.package.rup)}?region=${encodeURIComponent(regionId)}`}
                              className="font-semibold text-primary underline-offset-4 hover:underline"
                            >
                              RUP {report.package.rup}
                            </Link>
                          ) : (
                            "Tidak ditautkan"
                          )}
                        </dd>
                      </div>
                    </dl>
                    {report.package ? (
                      <p className="mt-2 truncate text-xs text-muted-foreground">{report.package.name}</p>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {reports.totalPages > 1 ? (
              <nav aria-label="Halaman laporan publik" className="mt-6 flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  Halaman {reports.page} dari {reports.totalPages}
                </span>
                <div className="flex gap-2">
                  {reports.page > 1 ? (
                    <Link
                      href={`/laporan/publik?${new URLSearchParams({ region: regionId, ...(kecamatan ? { kecamatan } : {}), ...(kelurahan ? { kelurahan } : {}), ...(paket ? { paket } : {}), page: String(reports.page - 1) }).toString()}`}
                      className="inline-flex h-10 items-center border border-border px-3 font-semibold text-primary hover:bg-muted"
                    >
                      Sebelumnya
                    </Link>
                  ) : null}
                  {reports.page < reports.totalPages ? (
                    <Link
                      href={`/laporan/publik?${new URLSearchParams({ region: regionId, ...(kecamatan ? { kecamatan } : {}), ...(kelurahan ? { kelurahan } : {}), ...(paket ? { paket } : {}), page: String(reports.page + 1) }).toString()}`}
                      className="inline-flex h-10 items-center border border-border px-3 font-semibold text-primary hover:bg-muted"
                    >
                      Berikutnya
                    </Link>
                  ) : null}
                </div>
              </nav>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}
