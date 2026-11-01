import type { AuditSummaryMetrics } from "../audit-types";
import { FiMap, FiMapPin, FiX } from "react-icons/fi";

interface CoverageSectionProps {
  metrics: AuditSummaryMetrics;
}

function LocationMark({ kind }: { kind: "rw" | "kelurahan" | "none" }) {
  const iconClass = "size-6 shrink-0";

  if (kind === "rw") return <FiMapPin aria-hidden="true" className={iconClass} />;
  if (kind === "kelurahan") return <FiMap aria-hidden="true" className={iconClass} />;

  return (
    <span aria-hidden="true" className="relative inline-flex size-6 shrink-0 items-center justify-center">
      <FiMapPin className="size-6" />
      <FiX className="absolute size-3" strokeWidth={3} />
    </span>
  );
}

export function CoverageSection({ metrics }: CoverageSectionProps) {
  const {
    totalPackages,
    coveredKelurahan,
    totalKelurahan,
    totalDistricts,
    mappedCount,
    mappedPercent,
    spatial,
  } = metrics;

  const locations = [
    {
      kind: "rw" as const,
      label: "RW",
      count: spatial.rwPackages,
      description: "Nomor RW pada paket cocok dengan batas wilayah.",
    },
    {
      kind: "kelurahan" as const,
      label: "Kelurahan",
      count: spatial.kelurahanPackages,
      description: "Nama kelurahan cocok, tanpa kecocokan RW.",
    },
    {
      kind: "none" as const,
      label: "Tanpa lokasi",
      count: spatial.unmappedPackages,
      description: "Tetap tercatat di daftar tanpa penanda peta.",
    },
  ];
  const mappedRatio = totalPackages > 0 ? (mappedCount / totalPackages) * 100 : 0;
  const kelurahanRatio = totalKelurahan > 0 ? (coveredKelurahan / totalKelurahan) * 100 : 0;

  return (
    <section aria-labelledby="coverage-section-title" className="border-t border-border bg-white">
      <div className="mx-auto w-full max-w-7xl px-4 pt-12 pb-10 sm:px-6 sm:pt-16 sm:pb-12 lg:px-8 lg:pt-20 lg:pb-14">
        <div className="pb-10 sm:pb-12 lg:pb-14">
          <p className="mb-2 text-center text-sm font-medium leading-6 text-muted-foreground sm:mb-3 sm:text-base">
            Anggaran jalan terbuka.
          </p>
          <h2 id="coverage-section-title" className="mx-auto max-w-5xl text-center font-heading text-3xl leading-[1.2] font-extrabold tracking-[-0.035em] text-primary sm:text-4xl sm:leading-[1.15] lg:text-[2.75rem]">
            Sejauh mana <span className="box-decoration-clone bg-secondary px-1.5 py-0.5 text-white">lokasinya bisa ditelusuri?</span>
          </h2>
        </div>

        <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16">
          <div className="flex flex-col justify-center gap-9 sm:flex-row sm:items-start sm:gap-12 lg:flex-col lg:items-stretch lg:gap-10">
            <div className="min-w-0 flex-1">
              <p className="font-heading text-6xl leading-[0.95] font-extrabold tracking-[-0.05em] text-primary sm:text-7xl">{mappedPercent}</p>
              <p className="mt-2 text-base font-semibold leading-6 text-foreground">Paket terhubung ke wilayah peta</p>
              <div className="mt-4 h-2 w-full bg-muted" role="img" aria-label={`${mappedPercent} paket terhubung ke wilayah peta`}>
                <div className="h-full bg-primary" style={{ width: `${mappedRatio}%` }} />
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {mappedCount.toLocaleString("id-ID")} dari {totalPackages.toLocaleString("id-ID")} paket
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-4xl leading-[1.05] font-extrabold tracking-[-0.04em] text-foreground sm:text-5xl">
                {coveredKelurahan}<span className="ml-1 text-2xl font-bold text-muted-foreground sm:text-3xl">/ {totalKelurahan}</span>
              </p>
              <p className="mt-2 text-base font-semibold leading-6 text-foreground">Kelurahan tersentuh paket</p>
              <div className="mt-4 h-2 w-full bg-muted" role="img" aria-label={`${coveredKelurahan} dari ${totalKelurahan} kelurahan tersentuh paket`}>
                <div className="h-full bg-secondary" style={{ width: `${kelurahanRatio}%` }} />
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Di {totalDistricts} kecamatan</p>
            </div>
          </div>

          <figure aria-label="Jenis penanda lokasi dan jumlah paket">
          <ul className="space-y-2">
              {locations.map((location, index) => {
                const isBlue = index % 2 === 0;

                return (
                  <li
                    key={location.label}
                    className={`grid grid-cols-[2rem_1fr_auto] items-center gap-3 px-4 py-4 sm:grid-cols-[2rem_1fr_auto] sm:gap-4 sm:px-5 sm:py-5 ${
                      isBlue ? "bg-primary text-white" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    <LocationMark kind={location.kind} />
                    <div className="min-w-0">
                      <h3 className="text-base font-bold leading-6">{location.label}</h3>
                      <p className={`mt-0.5 text-sm leading-6 ${isBlue ? "text-white/85" : "text-secondary-foreground/80"}`}>
                        {location.description}
                      </p>
                    </div>
                    <p className="text-xl font-bold tabular-nums sm:text-2xl">
                      {location.count.toLocaleString("id-ID")}
                    </p>
                  </li>
                );
              })}
          </ul>
            <figcaption className="pt-3 text-xs leading-5 text-muted-foreground">
              Peta menampilkan batas administrasi, bukan titik lokasi pekerjaan.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
