import { Badge } from "@/components/ui/badge";
import type { RoadPackagePlanDetail } from "@/contracts/packages/road-package-detail.contract";

const KOSONG = "Belum tersedia dari RUP";
const SPESIFIKASI_RINGKAS = 600;

function Nilai({ children }: { children: string | null }) {
  if (!children) {
    return <p className="font-sans text-sm italic text-muted-foreground">{KOSONG}</p>;
  }
  return <p className="whitespace-pre-line font-sans text-sm leading-relaxed text-foreground">{children}</p>;
}

function Jadwal({ label, children }: { label: string; children: string | null }) {
  return (
    <div>
      <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-sans text-sm font-semibold text-foreground">{children ?? KOSONG}</dd>
    </div>
  );
}

export function PackagePlanSection({ plan }: { plan: RoadPackagePlanDetail }) {
  const spesifikasiPanjang = (plan.spesifikasi?.length ?? 0) > SPESIFIKASI_RINGKAS;

  return (
    <section aria-labelledby="rencana-pengadaan" className="border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rencana-pengadaan" className="font-heading text-lg font-bold tracking-tight">
          Rencana pengadaan
        </h2>
        <Badge variant="official">DATA RESMI (INAPROC)</Badge>
      </div>

      <dl className="mt-4 grid gap-4 border border-border bg-muted/10 p-4 sm:grid-cols-2">
        <div>
          <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jadwal pemilihan</dt>
          <dd className="mt-1 grid gap-2 sm:grid-cols-2">
            <Jadwal label="Mulai">{plan.jadwalPemilihanMulai}</Jadwal>
            <Jadwal label="Akhir">{plan.jadwalPemilihanAkhir}</Jadwal>
          </dd>
        </div>
        <div>
          <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jadwal pelaksanaan kontrak</dt>
          <dd className="mt-1 grid gap-2 sm:grid-cols-2">
            <Jadwal label="Mulai">{plan.jadwalKontrakMulai}</Jadwal>
            <Jadwal label="Akhir">{plan.jadwalKontrakAkhir}</Jadwal>
          </dd>
        </div>
      </dl>

      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Volume</dt>
          <dd className="mt-1"><Nilai>{plan.volume}</Nilai></dd>
        </div>
        <div>
          <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">MAK</dt>
          <dd className="mt-1">
            {plan.mak ? (
              <p className="break-all font-mono text-xs text-foreground">{plan.mak}</p>
            ) : (
              <p className="font-sans text-sm italic text-muted-foreground">{KOSONG}</p>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <h3 className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Uraian</h3>
        <div className="mt-1"><Nilai>{plan.uraian}</Nilai></div>
      </div>

      <div className="mt-4">
        <h3 className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Spesifikasi</h3>
        <div className="mt-1">
          {!plan.spesifikasi ? (
            <Nilai>{null}</Nilai>
          ) : spesifikasiPanjang ? (
            <details className="border border-border bg-white">
              <summary className="cursor-pointer px-3 py-2 font-sans text-xs font-bold text-primary">
                Spesifikasi lengkap ({plan.spesifikasi.length.toLocaleString("id-ID")} karakter)
              </summary>
              <p className="whitespace-pre-line border-t border-border px-3 py-2 font-sans text-sm leading-relaxed text-foreground">
                {plan.spesifikasi}
              </p>
            </details>
          ) : (
            <Nilai>{plan.spesifikasi}</Nilai>
          )}
        </div>
      </div>
    </section>
  );
}
