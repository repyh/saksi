import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FiArrowLeft, FiArrowRight, FiExternalLink, FiMap } from "react-icons/fi";
import { classifyRoadWork, ROAD_WORK_LABELS } from "@/contracts/packages/road-work";
import { slugPenyedia } from "@/contracts/packages/vendor-slug";
import { buildPenyediaPanel } from "@/features/map/penyedia-panel";
import { routeForPackage } from "@/features/map/report-routes";
import { formatRupiahFull } from "@/features/map/road-types";
import { CatalogPageShell } from "@/features/packages/components/catalog-page-shell";
import { getRoadPackage } from "@/server/packages/service";
import { getRegion, resolveRegionId } from "@/server/regions/region-registry";

interface ProjectDetailPageProps {
  params: Promise<{ rup: string }>;
  searchParams: Promise<{ region?: string | string[] }>;
}

function lokasiPaket(project: NonNullable<Awaited<ReturnType<typeof getRoadPackage>>>) {
  const parts = [
    project.presisi_peta === "RW" && project.rw ? `RW ${project.rw}` : null,
    project.desa_resmi,
    project.kecamatan_resmi ? `Kecamatan ${project.kecamatan_resmi}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(", ") : "Lokasi umum";
}

async function loadProject(params: ProjectDetailPageProps["params"], searchParams: ProjectDetailPageProps["searchParams"]) {
  const [{ rup }, query] = await Promise.all([params, searchParams]);
  if (!/^\d+$/.test(rup)) notFound();
  const regionId = resolveRegionId(query.region);
  const project = await getRoadPackage(rup, regionId);
  if (!project) notFound();
  return { project, regionId };
}

export async function generateMetadata(props: ProjectDetailPageProps): Promise<Metadata> {
  const { project, regionId } = await loadProject(props.params, props.searchParams);
  return {
    title: `${project.nama} — Paket Jalan SAKSI`,
    description: `Rincian paket RUP ${project.kode_rup} di ${getRegion(regionId).label}: pagu, lokasi, metode, dan rekam kontrak yang tersedia.`,
  };
}

export default async function ProjectDetailPage(props: ProjectDetailPageProps) {
  const { project, regionId } = await loadProject(props.params, props.searchParams);
  const workLabel = ROAD_WORK_LABELS[classifyRoadWork(project.nama)];
  const penyedia = buildPenyediaPanel(project.kontrak);
  const mapHref = `${routeForPackage(project)}?region=${encodeURIComponent(regionId)}`;
  const reportHref = `/laporan/paket/${encodeURIComponent(project.kode_rup)}?region=${encodeURIComponent(regionId)}`;

  return (
    <CatalogPageShell variant="detail" header={
      <>
        <Link href={`/project?region=${encodeURIComponent(regionId)}`} className="inline-flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-primary underline-offset-2 hover:underline">
          <FiArrowLeft aria-hidden="true" className="size-3.5" /> Semua paket jalan
        </Link>
        <p className="mt-3 font-sans text-[10px] font-bold uppercase tracking-[0.1em] text-primary">RUP {project.kode_rup} · TA {project.tahun}</p>
        <h1 className="mt-1 max-w-4xl font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">{project.nama}</h1>
        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Pagu</dt>
            <dd className="mt-0.5 font-heading text-2xl font-extrabold tabular-nums text-primary">{formatRupiahFull(project.pagu)}</dd>
          </div>
          <div>
            <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Lokasi paket</dt>
            <dd className="mt-1 font-sans text-sm font-bold leading-snug text-foreground">{lokasiPaket(project)}</dd>
          </div>
          <div>
            <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jenis pekerjaan</dt>
            <dd className="mt-1 font-sans text-sm font-bold text-foreground">{workLabel}</dd>
          </div>
        </dl>
      </>
    }>
      <section aria-labelledby="project-core-title">
        <h2 id="project-core-title" className="font-heading text-lg font-bold tracking-tight">Informasi paket</h2>
        <div className="mt-4 overflow-x-auto border border-border">
          <table className="w-full min-w-[600px] border-collapse font-sans text-sm">
            <tbody>
              <tr className="border-b border-border/60"><th scope="row" className="w-44 px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Kode RUP</th><td className="px-3 py-2.5 font-mono">{project.kode_rup}</td></tr>
              <tr className="border-b border-border/60"><th scope="row" className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Satuan kerja</th><td className="px-3 py-2.5">{project.satker}</td></tr>
              <tr className="border-b border-border/60"><th scope="row" className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Lokasi paket</th><td className="px-3 py-2.5">{project.lokasi_mikro || lokasiPaket(project)}</td></tr>
              <tr className="border-b border-border/60"><th scope="row" className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Presisi lokasi</th><td className="px-3 py-2.5">{project.presisi_peta}{project.presisi_peta === "RW" && project.rw ? ` · RW ${project.rw}` : ""}</td></tr>
              <tr className="border-b border-border/60"><th scope="row" className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Metode & dana</th><td className="px-3 py-2.5">{project.metode ?? "Tidak dicantumkan"}{project.sumber ? ` (${project.sumber.replace(/,+$/, "")})` : ""}</td></tr>
              <tr className="border-b border-border/60"><th scope="row" className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jadwal</th><td className="px-3 py-2.5">{project.bulan ?? "Belum tersedia"}</td></tr>
              <tr><th scope="row" className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Sektor</th><td className="px-3 py-2.5">{project.sektor}</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="project-contract-title" className="mt-10">
        <h2 id="project-contract-title" className="font-heading text-lg font-bold tracking-tight">Rekam kontrak dan penyedia</h2>
        {project.kontrak ? (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 bg-muted/30 px-3 py-2">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.08em]">{project.kontrak.jenis === "tender" ? "Pemenang tender" : "Penyedia"}</p>
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-primary">DATA RESMI ({project.kontrak.sumber === "LPSE" ? "LPSE" : "INAPROC"})</span>
            </div>
            <div className="overflow-x-auto border-x border-b border-border">
              <table className="w-full min-w-[600px] border-collapse font-sans text-sm">
                <tbody>
                  {penyedia.baris.map((row) => (
                    <tr key={row.nama} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="w-44 px-3 py-2.5 text-left font-medium">
                        <Link href={`/penyedia/${slugPenyedia(row.nama)}?region=${encodeURIComponent(regionId)}`} className="text-primary underline-offset-2 hover:underline">{row.nama}</Link>
                      </th>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {row.nilai ? formatRupiahFull(row.nilai) : row.nilaiBersama ? <span className="text-xs italic text-muted-foreground">Nilai dicatat bersama</span> : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-b border-border/60"><th scope="row" className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Nilai kontrak</th><td className="px-3 py-2.5 text-right font-bold tabular-nums">{project.kontrak.nilai_kontrak ? formatRupiahFull(project.kontrak.nilai_kontrak) : "Tidak tercatat"}</td></tr>
                  {project.kontrak.hps !== null && <tr className="border-b border-border/60"><th scope="row" className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">HPS</th><td className="px-3 py-2.5 text-right tabular-nums">{formatRupiahFull(project.kontrak.hps)}</td></tr>}
                  {project.kontrak.metode && <tr className="border-b border-border/60"><th scope="row" className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Metode pada sumber kontrak</th><td className="px-3 py-2.5">{project.kontrak.metode}</td></tr>}
                  {project.kontrak.nilai_kontrak !== null && <tr className="border-b border-border/60"><th scope="row" className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Selisih terhadap pagu</th><td className="px-3 py-2.5 text-right tabular-nums">{formatRupiahFull(project.pagu - project.kontrak.nilai_kontrak)} <span className="text-xs text-muted-foreground">(selisih aritmetika, bukan ukuran kinerja)</span></td></tr>}
                  {project.kontrak.sumberTransaksi && <tr className="border-b border-border/60"><th scope="row" className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Sumber transaksi</th><td className="px-3 py-2.5">{project.kontrak.sumberTransaksi}{project.kontrak.transaksi && project.kontrak.transaksi > 1 ? ` · ${project.kontrak.transaksi} transaksi` : ""}</td></tr>}
                  {project.kontrak.jumlahPaket && <tr><th scope="row" className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Paket realisasi</th><td className="px-3 py-2.5">{project.kontrak.jumlahPaket.toLocaleString("id-ID")}</td></tr>}
                </tbody>
              </table>
            </div>

            {project.kontrak.paketRealisasi && project.kontrak.paketRealisasi.length > 0 && (
              <details className="mt-4 border border-border p-3">
                <summary className="cursor-pointer font-sans text-xs font-bold text-primary">Lihat rincian paket realisasi ({project.kontrak.paketRealisasi.length})</summary>
                <ul className="mt-3 divide-y divide-border font-sans text-xs">
                  {project.kontrak.paketRealisasi.map((related) => (
                    <li key={related.kodePaket} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span>
                        <a href={`https://data.inaproc.id/realisasi?kode=${encodeURIComponent(related.kodePaket)}`} target="_blank" rel="noreferrer" className="font-mono text-primary underline-offset-2 hover:underline">{related.kodePaket}<FiExternalLink aria-hidden="true" className="ml-1 inline size-3" /></a>
                        <span className="ml-2 text-muted-foreground">{related.penyedia}{related.sumber ? ` · ${related.sumber}` : ""}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{formatRupiahFull(related.nilai)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Nilai di daftar ini adalah realisasi per kode paket, bukan pembagian nilai kontrak. Nilai bersama tidak dibagi antarpenyedia.</p>
              </details>
            )}

            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              {project.kontrak.sumber === "LPSE"
                ? "Rekam tender atau pengadaan langsung dari LPSE/SPSE. NPWP disamarkan oleh sumber."
                : "Rekam transaksi e-purchasing/e-katalog dari Data INAPROC; transaksi ini tidak diterbitkan pada LPSE."}
            </p>
            {project.kontrak.url && <a href={project.kontrak.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 font-sans text-xs font-bold text-primary underline-offset-2 hover:underline">Buka sumber {project.kontrak.sumber === "LPSE" ? "LPSE/SPSE" : "Data INAPROC"}<FiExternalLink aria-hidden="true" className="size-3.5" /></a>}
          </>
        ) : (
          <p className="mt-4 border border-dashed border-border p-5 font-sans text-sm leading-relaxed text-muted-foreground">
            Belum ditemukan rekam kontrak yang cocok pada LPSE/SPSE atau Data INAPROC. Ini menunjukkan keterbatasan pencatatan yang tersedia, bukan penilaian atas paket.
          </p>
        )}
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Link href={mapHref} className="inline-flex min-h-10 items-center gap-2 bg-primary px-4 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-white hover:bg-[#004682]"><FiMap aria-hidden="true" className="size-4" />Lihat paket di peta</Link>
        <Link href={reportHref} className="inline-flex min-h-10 items-center gap-2 border border-primary px-4 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-primary hover:bg-muted/30">Laporkan kerusakan terkait <FiArrowRight aria-hidden="true" className="size-3.5" /></Link>
      </div>
    </CatalogPageShell>
  );
}
