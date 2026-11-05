import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FiArrowLeft, FiArrowRight, FiExternalLink } from "react-icons/fi";
import { formatRupiahFull } from "@/features/map/road-types";
import { getVendor } from "@/server/packages/service";

interface PenyediaDetailPageProps {
  params: Promise<{ slug: string }>;
}

const KATEGORI_LABEL: Record<string, string> = {
  PERMUKAAN: "Permukaan",
  DRAINASE: "Drainase",
  JEMBATAN: "Jembatan",
  SEMUA: "Campuran",
};

export async function generateMetadata({ params }: PenyediaDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getVendor(slug);
  if (!data) return { title: "Penyedia tidak ditemukan — SAKSI" };

  return {
    title: `${data.summary.nama} — Penyedia SAKSI`,
    description: `Rekam kontrak ${data.summary.nama} pada paket jalan Kota Tangerang dari LPSE.`,
  };
}

export default async function PenyediaDetailPage({ params }: PenyediaDetailPageProps) {
  const { slug } = await params;
  const data = await getVendor(slug);
  if (!data) notFound();

  const { summary, items, totalNilai } = data;

  return (
    <main className="min-h-screen bg-white text-foreground">
      <section className="border-b border-border bg-muted/20">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Link href="/penyedia" className="inline-flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-primary underline-offset-2 hover:underline">
            <FiArrowLeft aria-hidden="true" className="size-3.5" /> Semua penyedia
          </Link>

          <h1 className="mt-3 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            {summary.nama}
          </h1>

          <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Paket dengan kontrak</dt>
              <dd className="mt-0.5 font-heading text-2xl font-extrabold tabular-nums text-primary">{summary.paket}</dd>
            </div>
            <div>
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Nilai kontrak</dt>
              <dd className="mt-0.5 font-heading text-2xl font-extrabold tabular-nums text-primary">{formatRupiahFull(totalNilai)}</dd>
            </div>
            <div>
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jenis pekerjaan</dt>
              <dd className="mt-0.5 font-heading text-lg font-bold text-foreground">
                {summary.kategori.length ? summary.kategori.map((k) => KATEGORI_LABEL[k] ?? k).join(" · ") : "—"}
              </dd>
            </div>
          </dl>

          <p className="mt-5 max-w-3xl font-sans text-[12px] leading-relaxed text-foreground/70">
            Angka di atas adalah <strong>penyebut</strong> untuk membaca nama penyedia: jumlah paket,
            nilai, dan tahun. Tidak ada skor kinerja atau peringkat kualitas di SAKSI — nama penyedia
            ditampilkan sebagai fakta kontrak yang bisa diperiksa di LPSE.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="font-heading text-lg font-bold tracking-tight">Paket yang dikontrakkan</h2>

        {items.length === 0 ? (
          <p className="mt-4 border border-dashed border-border p-6 font-sans text-sm text-muted-foreground">
            Tidak ada paket jalan yang cocok dengan rekam kontrak penyedia ini.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto border border-border">
            <table className="w-full min-w-[820px] border-collapse font-sans text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left">
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Paket</th>
                  <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Wilayah</th>
                  <th scope="col" className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Pagu</th>
                  <th scope="col" className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Kontrak</th>
                  <th scope="col" className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.kode_rup} className="border-b border-border/60 last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2.5">
                      <span className="block font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-primary">
                        RUP {item.kode_rup} · TA {item.tahun}
                      </span>
                      <Link href={`/laporan/paket/${item.kode_rup}`} className="mt-0.5 block font-semibold leading-snug text-foreground underline-offset-2 hover:text-primary hover:underline">
                        {item.nama}
                      </Link>
                      <span className="mt-0.5 block font-sans text-[10px] text-muted-foreground">{item.metode ?? "metode tidak dicantumkan"}</span>
                    </td>
                    <td className="px-3 py-2.5 text-[12px] leading-snug text-muted-foreground">
                      {item.desa_resmi ? `${item.desa_resmi}${item.presisi_peta === "RW" && item.rw ? `, RW ${item.rw}` : ""}` : "Lokasi umum"}
                      {item.kecamatan_resmi ? <span className="block">Kec. {item.kecamatan_resmi}</span> : null}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{formatRupiahFull(item.pagu)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-foreground">
                      {item.kontrak?.nilai_kontrak ? formatRupiahFull(item.kontrak.nilai_kontrak) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {item.kontrak?.url ? (
                        <a href={item.kontrak.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-primary underline-offset-2 hover:underline">
                          LPSE <FiExternalLink aria-hidden="true" className="size-3" />
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Link href="/project" className="inline-flex items-center gap-1.5 bg-primary px-4 py-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:bg-[#004682]">
            Lihat di peta audit <FiArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
          <p className="font-sans text-[11px] text-muted-foreground">
            NPWP penyedia disamarkan oleh LPSE; penyedia dibedakan lewat nama.
          </p>
        </div>
      </section>
    </main>
  );
}
