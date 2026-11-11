import type { Metadata } from "next";
import Link from "next/link";
import { FiSearch } from "react-icons/fi";
import { formatRupiahFull } from "@/features/map/road-types";
import { CatalogPageShell } from "@/features/packages/components/catalog-page-shell";
import { listVendors, searchRoadPackages } from "@/server/packages/service";
import { resolveRegionId } from "@/server/regions/region-registry";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Penyedia & Kontrak Jalan — SAKSI",
  description:
    "Rekam jejak penyedia paket jalan dari LPSE/SPSE dan Data INAPROC, disandingkan dengan paket RUP.",
};

const KATEGORI_LABEL: Record<string, string> = {
  PERMUKAAN: "Permukaan",
  DRAINASE: "Drainase",
  JEMBATAN: "Jembatan",
  SEMUA: "Campuran",
};

function hrefForVendorDetail(slug: string, regionId: string, returnTo: string) {
  const params = new URLSearchParams({ region: regionId, returnTo });
  return `/penyedia/${encodeURIComponent(slug)}?${params.toString()}`;
}

function hrefForProviderDirectory(regionId: string, query: string, sortBy: string, direction: string) {
  const params = new URLSearchParams({ region: regionId, urut: sortBy, arah: direction });
  if (query) params.set("q", query);
  return `/penyedia?${params.toString()}`;
}

interface PenyediaPageProps {
  searchParams: Promise<{ q?: string; urut?: string; arah?: string; region?: string | string[] }>;
}

export default async function PenyediaPage({ searchParams }: PenyediaPageProps) {
  const { q, urut, arah, region } = await searchParams;
  const regionId = resolveRegionId(region);
  const query = (q ?? "").trim();
  const vendor = await listVendors(query || undefined, regionId);
  const sortBy = urut === "paket" || urut === "nama" || urut === "tahun" ? urut : "nilai";
  const direction = arah === "asc" ? "asc" : "desc";
  vendor.sort((a, b) => {
    const compared = sortBy === "nama"
      ? a.nama.localeCompare(b.nama, "id")
      : sortBy === "paket"
        ? a.paket - b.paket
        : sortBy === "tahun"
          ? Math.max(0, ...a.tahun) - Math.max(0, ...b.tahun)
          : a.nilai - b.nilai;
    if (compared !== 0) return direction === "asc" ? compared : -compared;
    return a.nama.localeCompare(b.nama, "id");
  });
  const ringkas = await searchRoadPackages({ region: regionId });
  const totalPaket = vendor.reduce((n, item) => n + item.paket, 0);
  const totalNilai = vendor.reduce((n, item) => n + item.nilai, 0);
  const tampil = vendor.slice(0, 60);
  const returnTo = hrefForProviderDirectory(regionId, query, sortBy, direction);
  const persenVendor = ringkas.totalCount
    ? ((ringkas.withContractCount / ringkas.totalCount) * 100).toLocaleString("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : "0";

  return (
    <CatalogPageShell variant="directory" header={
      <>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            Penyedia &amp; kontrak jalan
          </h1>
          <p className="mt-3 max-w-3xl font-sans text-sm leading-relaxed text-foreground/80">
            Nama penyedia diambil dari dua sumber resmi dan disandingkan dengan paket RUP lewat{" "}
            <strong>Kode RUP</strong> — bukan tebakan dari nama paket: LPSE/SPSE untuk tender dan
            pengadaan langsung, serta Data INAPROC untuk transaksi e-purchasing/e-katalog. Ditampilkan
            sebagai fakta kontrak, bukan penilaian kinerja: tidak ada skor gabungan di halaman ini.
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Penyedia</dt>
              <dd className="mt-0.5 font-heading text-2xl font-extrabold tabular-nums text-primary">
                {vendor.length.toLocaleString("id-ID")}
              </dd>
            </div>
            <div>
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Paket berkontrak</dt>
              <dd className="mt-0.5 font-heading text-2xl font-extrabold tabular-nums text-primary">
                {totalPaket.toLocaleString("id-ID")}
              </dd>
            </div>
            <div>
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Nilai kontrak</dt>
              <dd className="mt-0.5 font-heading text-2xl font-extrabold tabular-nums text-primary">
                Rp{(totalNilai / 1e9).toFixed(2)} M
              </dd>
            </div>
          </dl>

          <form action="/penyedia" method="get" className="mt-6 flex max-w-md items-center gap-2">
            <input type="hidden" name="region" value={regionId} />
            <input type="hidden" name="urut" value={sortBy} />
            <input type="hidden" name="arah" value={direction} />
            <label className="relative flex-1">
              <span className="sr-only">Cari nama penyedia</span>
              <FiSearch aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Cari nama penyedia, mis. CV atau PT"
                className="h-10 w-full border border-border bg-white pl-9 pr-3 font-sans text-sm text-foreground outline-none focus-visible:border-primary"
              />
            </label>
            <button
              type="submit"
              className="h-10 shrink-0 bg-primary px-4 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-[#004682]"
            >
              Cari
            </button>
          </form>
      </>
    }>
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
          <h2 className="font-heading text-lg font-bold tracking-tight">
            {query ? `Hasil pencarian “${query}”` : "Penyedia dengan nilai kontrak terbesar"}
          </h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <p className="font-sans text-[11px] text-muted-foreground">
              {vendor.length.toLocaleString("id-ID")} penyedia · menampilkan {tampil.length}
            </p>
            <form action="/penyedia" method="get" className="flex items-center gap-1.5">
              {query && <input type="hidden" name="q" value={query} />}
              <label htmlFor="vendor-sort" className="font-sans text-[10px] text-muted-foreground">Urutkan</label>
              <select id="vendor-sort" name="urut" defaultValue={sortBy} className="h-8 border border-border bg-white px-2 font-sans text-[11px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary">
                <option value="nilai">Nilai kontrak</option>
                <option value="paket">Jumlah paket</option>
                <option value="nama">Nama penyedia</option>
                <option value="tahun">Tahun terbaru</option>
              </select>
              <label htmlFor="vendor-direction" className="sr-only">Arah pengurutan</label>
              <select id="vendor-direction" name="arah" defaultValue={direction} className="h-8 border border-border bg-white px-2 font-sans text-[11px] text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary">
                <option value="desc">{sortBy === "nama" ? "Z–A" : sortBy === "tahun" ? "Terbaru" : "Terbesar"}</option>
                <option value="asc">{sortBy === "nama" ? "A–Z" : sortBy === "tahun" ? "Terlama" : "Terkecil"}</option>
              </select>
              <button type="submit" className="h-8 bg-primary px-2.5 font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#004682]">
                Terapkan
              </button>
            </form>
          </div>
        </div>

        {tampil.length === 0 ? (
          <p className="mt-6 border border-dashed border-border p-6 font-sans text-sm text-muted-foreground">
            Tidak ada penyedia yang cocok. Coba kata kunci lain.
          </p>
        ) : (
          <>
          <p className="mt-3 text-xs text-muted-foreground sm:hidden">Geser tabel ke samping untuk melihat kolom lainnya.</p>
          <div role="region" aria-label="Daftar penyedia. Tabel dapat digeser secara horizontal." tabIndex={0} className="mt-2 overflow-x-auto border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:mt-4">
            <table className="w-full min-w-[720px] border-collapse font-sans text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left">
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Penyedia</th>
                  <th scope="col" className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Paket</th>
                  <th scope="col" className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Nilai kontrak</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Tahun</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jenis</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((item) => (
                  <tr key={item.slug} className="border-b border-border/60 last:border-0">
                    <td className="px-3 py-2.5 font-semibold leading-snug">
                      <Link href={hrefForVendorDetail(item.slug, regionId, returnTo)} className="text-primary underline decoration-primary/35 underline-offset-2 hover:decoration-current">
                        {item.nama}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{item.paket}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatRupiahFull(item.nilai)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.tahun.join(" · ") || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {item.kategori.map((k) => KATEGORI_LABEL[k] ?? k).join(" · ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>
        )}

        <div className="mt-8 border border-border bg-muted/10 p-4 font-sans text-[12px] leading-relaxed text-foreground/80">
          <p className="font-bold uppercase tracking-[0.08em] text-muted-foreground text-[10px]">Yang perlu dibaca dari angka ini</p>
          <p className="mt-1.5">
            {ringkas.withContractCount.toLocaleString("id-ID")} dari{" "}
            {ringkas.totalCount.toLocaleString("id-ID")} paket ({persenVendor}%) punya nama penyedia —
            tender dan pengadaan langsung dari LPSE, e-purchasing/e-katalog dari Data INAPROC. Sisa{" "}
            {(ringkas.totalCount - ringkas.withContractCount).toLocaleString("id-ID")} paket tidak punya
            rekam publik di kedua sumber.
          </p>
          <p className="mt-1.5">
            NPWP penyedia disamarkan oleh LPSE, sehingga penyedia hanya bisa dibedakan lewat nama —
            varian penulisan (<em>CV</em>, <em>cv.</em>, <em>PT</em>) belum dinormalisasi sepenuhnya.
          </p>
        </div>
    </CatalogPageShell>
  );
}
