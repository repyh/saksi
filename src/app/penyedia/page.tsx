import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowRight, FiSearch } from "react-icons/fi";
import { formatRupiahFull } from "@/features/map/road-types";
import { lpseMeta } from "@/server/packages/lpse-repository";
import { listVendors } from "@/server/packages/service";

export const metadata: Metadata = {
  title: "Penyedia & Kontrak Jalan — SAKSI",
  description:
    "Rekam jejak penyedia paket jalan Kota Tangerang dari LPSE, disandingkan dengan paket RUP.",
};

const KATEGORI_LABEL: Record<string, string> = {
  PERMUKAAN: "Permukaan",
  DRAINASE: "Drainase",
  JEMBATAN: "Jembatan",
  SEMUA: "Campuran",
};

interface PenyediaPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function PenyediaPage({ searchParams }: PenyediaPageProps) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const vendor = await listVendors(query || undefined);
  const totalPaket = vendor.reduce((n, item) => n + item.paket, 0);
  const totalNilai = vendor.reduce((n, item) => n + item.nilai, 0);
  const tampil = vendor.slice(0, 60);

  return (
    <main className="min-h-screen bg-white text-foreground">
      <section className="border-b border-border bg-muted/20">
        <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.15em] text-primary">
            Data resmi LPSE · SPSE Kota Tangerang
          </p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            Penyedia &amp; kontrak jalan
          </h1>
          <p className="mt-3 max-w-3xl font-sans text-sm leading-relaxed text-foreground/80">
            Nama penyedia diambil dari LPSE dan disandingkan dengan paket RUP lewat Kode RUP —
            bukan tebakan dari nama paket. Ditampilkan sebagai fakta kontrak, bukan penilaian
            kinerja: tidak ada skor gabungan di halaman ini.
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
            <div>
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Rasio median</dt>
              <dd className="mt-0.5 font-heading text-2xl font-extrabold tabular-nums text-primary">
                {lpseMeta.rasioMedian ? lpseMeta.rasioMedian.toFixed(2) : "—"}
                <span className="ml-1 font-sans text-[11px] font-semibold text-muted-foreground">kontrak / pagu</span>
              </dd>
            </div>
          </dl>

          <form action="/penyedia" method="get" className="mt-6 flex max-w-md items-center gap-2">
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
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-heading text-lg font-bold tracking-tight">
            {query ? `Hasil pencarian “${query}”` : "Penyedia dengan nilai kontrak terbesar"}
          </h2>
          <p className="font-sans text-[11px] text-muted-foreground">
            {vendor.length.toLocaleString("id-ID")} penyedia · menampilkan {tampil.length}
          </p>
        </div>

        {tampil.length === 0 ? (
          <p className="mt-6 border border-dashed border-border p-6 font-sans text-sm text-muted-foreground">
            Tidak ada penyedia yang cocok. Coba kata kunci lain.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto border border-border">
            <table className="w-full min-w-[720px] border-collapse font-sans text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left">
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Penyedia</th>
                  <th scope="col" className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Paket</th>
                  <th scope="col" className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Nilai kontrak</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Tahun</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jenis</th>
                  <th scope="col" className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {tampil.map((item) => (
                  <tr key={item.slug} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2.5 font-semibold leading-snug">
                      <Link href={`/penyedia/${item.slug}`} className="text-primary underline-offset-2 hover:underline">
                        {item.nama}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{item.paket}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatRupiahFull(item.nilai)}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{item.tahun.join(" · ") || "—"}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {item.kategori.map((k) => KATEGORI_LABEL[k] ?? k).join(" · ") || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <Link href={`/penyedia/${item.slug}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-primary">
                        Detail <FiArrowRight aria-hidden="true" className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 border border-border bg-muted/10 p-4 font-sans text-[12px] leading-relaxed text-foreground/80">
          <p className="font-bold uppercase tracking-[0.08em] text-muted-foreground text-[10px]">Yang perlu dibaca dari angka ini</p>
          <p className="mt-1.5">
            {lpseMeta.paketTercocok.toLocaleString("id-ID")} paket RUP tercocok ke LPSE (
            {lpseMeta.persenTercocok.toFixed(1)}%), dengan{" "}
            {lpseMeta.denganPemenang.toLocaleString("id-ID")} paket memiliki nama pemenang. Sisa paket
            tidak punya rekam kontrak di LPSE — terbesar karena <strong>e-purchasing</strong> (
            {(lpseMeta.metodeBelumTercocok["E-Purchasing"] ?? 0).toLocaleString("id-ID")} paket), yang
            pengadaannya lewat e-katalog dan tidak menerbitkan nama pemenang di SPSE.
          </p>
          <p className="mt-1.5">
            NPWP penyedia disamarkan oleh LPSE, sehingga penyedia hanya bisa dibedakan lewat nama —
            varian penulisan (<em>CV</em>, <em>cv.</em>, <em>PT</em>) belum dinormalisasi sepenuhnya.
          </p>
        </div>
      </section>
    </main>
  );
}
