import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { PublicReportsResponse } from "@/contracts/reports/public-report.contract";
import { simulationBadgeEnabled } from "@/lib/flags";

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

export function PackageReportsSection({
  reports,
  regionId,
  rup,
}: {
  reports: PublicReportsResponse | null;
  regionId: string;
  rup: string;
}) {
  const showSimulationBadge = simulationBadgeEnabled();

  return (
    <section aria-labelledby="laporan-warga" className="border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="laporan-warga" className="font-heading text-lg font-bold tracking-tight">
          Laporan warga
        </h2>
        {showSimulationBadge ? <Badge variant="simulation">SIMULASI PROTOTIPE</Badge> : null}
      </div>

      {!reports ? (
        <div role="status" className="mt-3 border border-dashed border-border bg-muted/10 p-4 font-sans text-sm leading-relaxed text-muted-foreground">
          Daftar laporan warga belum tersedia. Fitur ini memerlukan koneksi basis data laporan yang sudah
          dikonfigurasi.
        </div>
      ) : reports.reports.length === 0 ? (
        <div role="status" className="mt-3 border border-dashed border-border bg-muted/10 p-4 font-sans text-sm leading-relaxed text-muted-foreground">
          Belum ada laporan yang disetujui untuk paket ini.
        </div>
      ) : (
        <>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {reports.reports.map((report) => {
              const area = [report.areaName, report.districtName].filter(Boolean).join(" · ");
              return (
                <li key={report.publicCode} className="border border-border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-heading text-base font-bold leading-snug">
                      {DAMAGE_LABELS[report.damageType] ?? report.damageType}
                    </h3>
                    <span className="shrink-0 font-sans text-[10px] text-muted-foreground">
                      {formatDate(report.submittedAt)}
                    </span>
                  </div>
                  <dl className="mt-3 grid gap-2 border-t border-border/70 pt-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Ukuran kasar</dt>
                      <dd className="mt-0.5 text-foreground">
                        {report.coarseSize ? SIZE_LABELS[report.coarseSize] ?? report.coarseSize : "Tidak dicantumkan"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-muted-foreground">Wilayah</dt>
                      <dd className="mt-0.5 text-foreground">{area || "Tidak dicantumkan"}</dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </ul>

          <Link
            href={`/laporan/publik?paket=${encodeURIComponent(rup)}&region=${encodeURIComponent(regionId)}`}
            className="mt-4 inline-flex font-sans text-[11px] font-bold text-primary underline-offset-2 hover:underline"
          >
            Lihat semua laporan publik untuk paket ini
          </Link>
        </>
      )}
    </section>
  );
}
