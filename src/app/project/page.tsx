import type { Metadata } from "next";
import Link from "next/link";
import { FiMap, FiSearch } from "react-icons/fi";
import type { RoadWorkCategory } from "@/contracts/packages/road-package.contract";
import { classifyRoadWork } from "@/contracts/packages/road-work";
import { formatRupiahFull } from "@/features/map/road-types";
import { CatalogPageShell } from "@/features/packages/components/catalog-page-shell";
import { listRoadPackages } from "@/server/packages/service";
import { resolveRegionId } from "@/server/regions/region-registry";

export const metadata: Metadata = {
  title: "Proyek Jalan — SAKSI",
  description: "Direktori proyek jalan dengan rincian RUP, lokasi, pagu, dan rekam kontrak.",
};

const PAGE_SIZE = 50;
const WORK_OPTIONS: Array<{ value: RoadWorkCategory; label: string }> = [
  { value: "SEMUA", label: "Semua jenis pekerjaan" },
  { value: "PERMUKAAN", label: "Permukaan jalan" },
  { value: "DRAINASE", label: "Drainase" },
  { value: "JEMBATAN", label: "Jembatan" },
];

type SearchParam = string | string[] | undefined;

interface ProjectPageProps {
  searchParams: Promise<{
    region?: SearchParam;
    q?: SearchParam;
    tahun?: SearchParam;
    jenis?: SearchParam;
    urut?: SearchParam;
    arah?: SearchParam;
    halaman?: SearchParam;
  }>;
}

function firstValue(value?: SearchParam) {
  return Array.isArray(value) ? value[0] : value;
}

function makeDirectoryUrl(page: number, params: { region: string; query: string; year: string; work: string; sort: string; direction: string }) {
  const query = new URLSearchParams({ region: params.region, urut: params.sort, arah: params.direction, halaman: String(page) });
  if (params.query) query.set("q", params.query);
  if (params.year) query.set("tahun", params.year);
  if (params.work !== "SEMUA") query.set("jenis", params.work.toLocaleLowerCase("id-ID"));
  return `/project?${query.toString()}`;
}

export default async function ProjectPage({ searchParams }: ProjectPageProps) {
  const queryParams = await searchParams;
  const regionId = resolveRegionId(queryParams.region);
  const query = (firstValue(queryParams.q) ?? "").trim().slice(0, 120);
  const rawYear = firstValue(queryParams.tahun);
  const rawWork = firstValue(queryParams.jenis);
  const rawSort = firstValue(queryParams.urut);
  const rawDirection = firstValue(queryParams.arah);
  const year = rawYear === "2025" || rawYear === "2026" ? rawYear : "";
  const work = WORK_OPTIONS.find((option) => option.value.toLocaleLowerCase("id-ID") === rawWork)?.value ?? "SEMUA";
  const sort = rawSort === "nama" || rawSort === "tahun" || rawSort === "kontrak" ? rawSort : "pagu";
  const direction = rawDirection === "asc" ? "asc" : "desc";
  const allProjects = await listRoadPackages(regionId);
  const searchText = query.toLocaleLowerCase("id-ID");
  const projects = allProjects.filter((project) => {
    if (year && String(project.tahun) !== year) return false;
    if (work !== "SEMUA" && classifyRoadWork(project.nama) !== work) return false;
    if (!searchText) return true;
    return [
      project.nama,
      project.kode_rup,
      project.satker,
      project.lokasi_mikro ?? "",
      project.desa_resmi ?? "",
      project.rw ?? "",
      project.kecamatan_resmi ?? "",
      project.kontrak?.penyedia ?? "",
      ...(project.kontrak?.penyediaLain ?? []),
    ].join(" ").toLocaleLowerCase("id-ID").includes(searchText);
  });

  projects.sort((a, b) => {
    const comparison = sort === "nama"
      ? a.nama.localeCompare(b.nama, "id")
      : sort === "tahun"
        ? a.tahun - b.tahun
        : sort === "kontrak"
          ? (a.kontrak?.nilai_kontrak ?? 0) - (b.kontrak?.nilai_kontrak ?? 0)
          : a.pagu - b.pagu;
    return comparison === 0
      ? a.kode_rup.localeCompare(b.kode_rup, "id")
      : direction === "asc" ? comparison : -comparison;
  });

  const totalProjects = projects.length;
  const totalBudget = projects.reduce((total, project) => total + project.pagu, 0);
  const contracted = projects.filter((project) => project.kontrak).length;
  const totalPages = Math.max(1, Math.ceil(totalProjects / PAGE_SIZE));
  const requestedPage = Number(firstValue(queryParams.halaman) ?? "1");
  const page = Number.isInteger(requestedPage) ? Math.min(totalPages, Math.max(1, requestedPage)) : 1;
  const visibleProjects = projects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const directoryParams = { region: regionId, query, year, work, sort, direction };
  const returnTo = makeDirectoryUrl(page, directoryParams);

  return (
    <CatalogPageShell variant="directory" header={
      <>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">Proyek jalan</h1>
        <p className="mt-3 max-w-3xl font-sans text-sm leading-relaxed text-foreground/80">
          Telusuri proyek berdasarkan RUP, lokasi, pagu, dan rekam kontraknya. Setiap proyek menautkan rencana pengadaan, lokasi peta, realisasi, dan laporan terkait.
        </p>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div><dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Proyek</dt><dd className="mt-0.5 font-sans text-2xl font-extrabold tabular-nums text-primary">{totalProjects.toLocaleString("id-ID")}</dd></div>
          <div><dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Total pagu</dt><dd className="mt-0.5 font-sans text-2xl font-extrabold tabular-nums text-primary">{formatRupiahFull(totalBudget)}</dd></div>
          <div><dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Dengan rekam kontrak</dt><dd className="mt-0.5 font-sans text-2xl font-extrabold tabular-nums text-primary">{contracted.toLocaleString("id-ID")}</dd></div>
        </dl>

        <form action="/project" method="get" className="mt-6 grid max-w-4xl gap-2 sm:grid-cols-[minmax(15rem,1fr)_auto_auto_auto_auto] sm:items-center">
          <input type="hidden" name="region" value={regionId} />
          <input type="hidden" name="urut" value={sort} />
          <input type="hidden" name="arah" value={direction} />
          <label className="relative">
            <span className="sr-only">Cari proyek jalan</span>
            <FiSearch aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input type="search" name="q" defaultValue={query} placeholder="Cari nama proyek, RUP, lokasi, atau penyedia" className="h-10 w-full border border-border bg-white pl-9 pr-3 font-sans text-sm text-foreground outline-none focus-visible:border-primary" />
          </label>
          <label htmlFor="project-year" className="sr-only">Tahun anggaran</label>
          <select id="project-year" name="tahun" defaultValue={year} className="h-10 border border-border bg-white px-2 font-sans text-[11px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary">
            <option value="">Semua tahun</option><option value="2025">2025</option><option value="2026">2026</option>
          </select>
          <label htmlFor="project-work" className="sr-only">Jenis pekerjaan</label>
          <select id="project-work" name="jenis" defaultValue={work.toLocaleLowerCase("id-ID")} className="h-10 border border-border bg-white px-2 font-sans text-[11px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary">
            {WORK_OPTIONS.map((option) => <option key={option.value} value={option.value.toLocaleLowerCase("id-ID")}>{option.label}</option>)}
          </select>
          <input type="hidden" name="halaman" value="1" />
          <button type="submit" className="h-10 shrink-0 bg-primary px-4 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-[#004682]">Cari</button>
        </form>
      </>
    }>
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
        <h2 className="font-heading text-lg font-bold tracking-tight">{query ? `Hasil pencarian “${query}”` : "Semua proyek jalan"}</h2>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <p className="font-sans text-[11px] text-muted-foreground">{totalProjects.toLocaleString("id-ID")} proyek · menampilkan {visibleProjects.length}</p>
          <form action="/project" method="get" className="flex items-center gap-1.5">
            <input type="hidden" name="region" value={regionId} />
            {query && <input type="hidden" name="q" value={query} />}
            {year && <input type="hidden" name="tahun" value={year} />}
            {work !== "SEMUA" && <input type="hidden" name="jenis" value={work.toLocaleLowerCase("id-ID")} />}
            <input type="hidden" name="halaman" value="1" />
            <label htmlFor="project-sort" className="font-sans text-[10px] text-muted-foreground">Urutkan</label>
            <select id="project-sort" name="urut" defaultValue={sort} className="h-8 border border-border bg-white px-2 font-sans text-[11px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary">
              <option value="pagu">Pagu</option><option value="kontrak">Nilai kontrak</option><option value="nama">Nama proyek</option><option value="tahun">Tahun</option>
            </select>
            <label htmlFor="project-direction" className="sr-only">Arah pengurutan</label>
            <select id="project-direction" name="arah" defaultValue={direction} className="h-8 border border-border bg-white px-2 font-sans text-[11px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary">
              <option value="desc">{sort === "nama" ? "Z–A" : sort === "tahun" ? "Terbaru" : "Terbesar"}</option>
              <option value="asc">{sort === "nama" ? "A–Z" : sort === "tahun" ? "Terlama" : "Terkecil"}</option>
            </select>
            <button type="submit" className="h-8 bg-primary px-2.5 font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-white hover:bg-[#004682]">Terapkan</button>
          </form>
        </div>
      </div>

      {visibleProjects.length === 0 ? (
        <p className="mt-6 border border-dashed border-border p-6 font-sans text-sm text-muted-foreground">Tidak ada proyek yang cocok. Coba ubah pencarian atau filter.</p>
      ) : (
        <div className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground sm:hidden">Geser tabel ke samping untuk melihat seluruh kolom.</p>
          <div
            role="region"
            aria-label="Daftar proyek. Tabel dapat digeser secara horizontal."
            tabIndex={0}
            className="overflow-x-auto border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <table className="w-full min-w-[760px] border-collapse font-sans text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left">
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Proyek</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Lokasi</th>
                  <th scope="col" className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Pagu</th>
                  <th scope="col" className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Kontrak</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jenis</th>
                </tr>
              </thead>
              <tbody>
                {visibleProjects.map((project) => {
                  const projectParams = new URLSearchParams({ region: regionId, returnTo });
                  return (
                    <tr key={project.kode_rup} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2.5 font-semibold leading-snug">
                        <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-primary">RUP {project.kode_rup} · TA {project.tahun}</span>
                        <Link href={`/project/${encodeURIComponent(project.kode_rup)}?${projectParams.toString()}`} className="mt-0.5 block text-foreground underline decoration-foreground/35 underline-offset-2 hover:text-primary hover:decoration-primary">{project.nama}</Link>
                        <span className="mt-0.5 block font-sans text-[10px] font-normal text-muted-foreground">{project.satker}</span>
                      </td>
                      <td className="px-3 py-2.5 text-[12px] leading-snug text-muted-foreground">
                        {project.desa_resmi ? `${project.desa_resmi}${project.presisi_peta === "RW" && project.rw ? `, RW ${project.rw}` : ""}` : "Lokasi umum"}
                        {project.kecamatan_resmi && <span className="block">Kec. {project.kecamatan_resmi}</span>}
                        <span className="block text-[10px]">Presisi {project.presisi_peta}</span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatRupiahFull(project.pagu)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{project.kontrak?.nilai_kontrak ? formatRupiahFull(project.kontrak.nilai_kontrak) : "—"}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{WORK_OPTIONS.find((option) => option.value === classifyRoadWork(project.nama))?.label ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Halaman proyek jalan" className="mt-5 flex items-center justify-between gap-4 font-sans text-xs">
          {page > 1 ? <Link href={makeDirectoryUrl(page - 1, directoryParams)} className="font-bold text-primary underline-offset-2 hover:underline">Proyek sebelumnya</Link> : <span className="text-muted-foreground">Proyek sebelumnya</span>}
          <span className="text-muted-foreground">Halaman {page.toLocaleString("id-ID")} dari {totalPages.toLocaleString("id-ID")}</span>
          {page < totalPages ? <Link href={makeDirectoryUrl(page + 1, directoryParams)} className="font-bold text-primary underline-offset-2 hover:underline">Proyek berikutnya</Link> : <span className="text-muted-foreground">Proyek berikutnya</span>}
        </nav>
      )}

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link href={`/peta-pekerjaan?region=${encodeURIComponent(regionId)}`} className="inline-flex min-h-10 items-center gap-2 bg-primary px-4 font-sans text-xs font-bold uppercase tracking-[0.1em] text-white hover:bg-[#004682]">
          <FiMap aria-hidden="true" className="size-4" /> Peta pekerjaan
        </Link>
      </div>
    </CatalogPageShell>
  );
}
