import Link from "next/link";
import { FiArrowRight } from "react-icons/fi";
import { Badge } from "@/components/ui/badge";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import { routeForPackage } from "@/features/map/report-routes";

function labelPresisi(item: RoadPackageItem): string {
  if (item.presisi_peta === "RW" && item.rw) return `RW ${item.rw}`;
  if (item.presisi_peta === "Kelurahan") return "Kelurahan";
  if (item.presisi_peta === "Kecamatan") return "Kecamatan";
  return "Kota Tangerang (umum)";
}

export function PackageLocationSection({
  item,
  regionId,
  regionLabel,
}: {
  item: RoadPackageItem;
  regionId: string;
  regionLabel: string;
}) {
  const tanpaLokus = item.presisi_peta === "Kabupaten";

  return (
    <section aria-labelledby="lokasi-paket" className="border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="lokasi-paket" className="font-heading text-lg font-bold tracking-tight">
          Lokasi
        </h2>
        <Badge variant="outline">{labelPresisi(item)}</Badge>
      </div>

      <div className="mt-3 flex flex-col gap-3 border border-border p-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {tanpaLokus ? (
            <>
              <p className="font-sans text-sm font-semibold text-foreground">{regionLabel} (umum)</p>
              <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
                Paket ini tidak punya anchor wilayah pada snapshot; lokasinya tidak diturunkan ke kecamatan,
                kelurahan, atau RW. Tidak ada titik lokasi yang dibuat untuk paket ini.
              </p>
            </>
          ) : (
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-sm">
              <li className="font-semibold text-foreground">{regionLabel}</li>
              {item.kecamatan_resmi ? (
                <>
                  <li aria-hidden="true" className="text-muted-foreground">/</li>
                  <li className="font-semibold text-foreground">{item.kecamatan_resmi}</li>
                </>
              ) : null}
              {item.desa_resmi ? (
                <>
                  <li aria-hidden="true" className="text-muted-foreground">/</li>
                  <li className="font-semibold text-foreground">{item.desa_resmi}</li>
                </>
              ) : null}
              {item.presisi_peta === "RW" && item.rw ? (
                <>
                  <li aria-hidden="true" className="text-muted-foreground">/</li>
                  <li className="font-semibold text-foreground">RW {item.rw}</li>
                </>
              ) : null}
            </ol>
          )}
          <p className="mt-2 font-sans text-[11px] leading-relaxed text-muted-foreground">
            Lokasi ditampilkan sebagai batas wilayah, bukan koordinat pekerjaan.
          </p>
        </div>

        <Link
          href={`${routeForPackage(item)}?region=${encodeURIComponent(regionId)}`}
          className="inline-flex shrink-0 items-center gap-1.5 border border-primary px-3 py-2 font-sans text-[11px] font-bold uppercase tracking-[0.08em] text-primary hover:bg-primary/5"
        >
          Lihat di peta <FiArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
