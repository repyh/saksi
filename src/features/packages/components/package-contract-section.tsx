import Link from "next/link";
import { FiExternalLink } from "react-icons/fi";
import { Badge } from "@/components/ui/badge";
import type { RoadPackageItem } from "@/contracts/packages/road-package.contract";
import { slugPenyedia } from "@/contracts/packages/vendor-slug";
import { formatRupiahFull } from "@/features/map/road-types";
import { buildPenyediaPanel } from "@/features/map/penyedia-panel";

function persenDariPagu(selisih: number, pagu: number): string {
  if (!pagu) return "—";
  const persen = (selisih / pagu) * 100;
  return `${persen.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% dari pagu`;
}

function penjelasanTanpaKontrak(metode: string | null): string {
  const label = (metode ?? "").toLocaleLowerCase("id-ID");
  if (label.includes("e-purchasing")) {
    return "Paket ini melalui e-purchasing (e-katalog), yang tidak menerbitkan nama penyedia di LPSE. Pencatatannya ada di Data INAPROC dan belum tercocokkan ke paket ini.";
  }
  if (label.includes("dikecualikan")) {
    return "Paket dikecualikan dari prosedur pengadaan LPSE, sehingga tidak ada rekam tender atau pengadaan langsung.";
  }
  return "Belum ada pencatatan tender, pengadaan langsung, atau transaksi e-purchasing yang cocok untuk paket ini.";
}

export function PackageContractSection({
  item,
  regionId,
}: {
  item: RoadPackageItem;
  regionId: string;
}) {
  const kontrak = item.kontrak;

  return (
    <section aria-labelledby="realisasi-kontrak" className="border-t border-border pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="realisasi-kontrak" className="font-heading text-lg font-bold tracking-tight">
          Realisasi &amp; kontrak
        </h2>
        {kontrak ? (
          <Badge variant="official">
            {kontrak.sumber === "LPSE" ? "DATA RESMI (LPSE)" : "DATA RESMI (INAPROC)"}
          </Badge>
        ) : null}
      </div>

      {!kontrak ? (
        <div className="mt-3 border border-dashed border-border bg-muted/10 p-4">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            Tanpa rekam kontrak publik
          </p>
          <p className="mt-1 font-sans text-sm leading-relaxed text-foreground/80">
            {penjelasanTanpaKontrak(item.metode)}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 border border-border">
            <div className="border-b border-border bg-muted/20 px-4 py-2">
              <p className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                {kontrak.jenis === "tender" ? "Pemenang" : "Penyedia"} &amp; nilai
              </p>
            </div>

            <ul className="divide-y divide-border/60">
              {buildPenyediaPanel(kontrak).baris.map((baris) => (
                <li key={baris.nama} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-2.5">
                  <Link
                    href={`/penyedia/${slugPenyedia(baris.nama)}?region=${encodeURIComponent(regionId)}`}
                    className="font-sans text-sm font-semibold text-primary underline-offset-2 hover:underline"
                  >
                    {baris.nama}
                  </Link>
                  <span className="font-sans text-xs tabular-nums text-foreground">
                    {baris.nilai > 0
                      ? formatRupiahFull(baris.nilai)
                      : baris.nilaiBersama
                        ? <span className="italic text-muted-foreground">nilai bersama</span>
                        : "—"}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="grid gap-0 border-t border-border sm:grid-cols-2">
              <div className="border-b border-border px-4 py-3 sm:border-r sm:border-b-0">
                <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Nilai kontrak</dt>
                <dd className="mt-1 font-sans text-sm font-semibold tabular-nums text-foreground">
                  {kontrak.nilai_kontrak != null ? formatRupiahFull(kontrak.nilai_kontrak) : "Tidak tercatat"}
                </dd>
              </div>
              <div className="border-b border-border px-4 py-3 sm:border-b-0">
                <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">HPS</dt>
                <dd className="mt-1 font-sans text-sm font-semibold tabular-nums text-foreground">
                  {kontrak.hps != null ? formatRupiahFull(kontrak.hps) : "Tidak tercatat"}
                </dd>
              </div>
              <div className="border-b border-border px-4 py-3 sm:border-r sm:border-b-0">
                <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Selisih pagu</dt>
                <dd className="mt-1 font-sans text-sm tabular-nums text-foreground">
                  {kontrak.nilai_kontrak != null
                    ? (
                      <>
                        {formatRupiahFull(item.pagu - kontrak.nilai_kontrak)}
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({persenDariPagu(item.pagu - kontrak.nilai_kontrak, item.pagu)})
                        </span>
                      </>
                    )
                    : "Tidak dapat dihitung"}
                </dd>
              </div>
              <div className="px-4 py-3">
                <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Sumber transaksi</dt>
                <dd className="mt-1 font-sans text-sm text-foreground">
                  {kontrak.sumberTransaksi ?? "Tidak dicantumkan"}
                  {kontrak.transaksi && kontrak.transaksi > 1
                    ? <span className="ml-1 text-xs text-muted-foreground">· {kontrak.transaksi} transaksi</span>
                    : null}
                </dd>
              </div>
            </dl>
          </div>

          {kontrak.paketRealisasi?.length ? (
            <div className="mt-4 overflow-x-auto border border-border">
              <table className="w-full min-w-[560px] border-collapse font-sans text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left">
                    <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Kode paket realisasi</th>
                    <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Penyedia</th>
                    <th scope="col" className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Nilai</th>
                  </tr>
                </thead>
                <tbody>
                  {kontrak.paketRealisasi.map((paket) => (
                    <tr key={paket.kodePaket} className="border-b border-border/60 last:border-0">
                      <td className="px-3 py-2">
                        <a
                          href={`https://data.inaproc.id/realisasi?kode=${encodeURIComponent(paket.kodePaket)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all font-mono text-xs text-primary underline-offset-2 hover:underline"
                          title={`${paket.kodePaket}${paket.sumber ? ` · ${paket.sumber}` : ""}`}
                        >
                          {paket.kodePaket}
                        </a>
                        {paket.sumber ? (
                          <span className="mt-0.5 block text-[10px] text-muted-foreground">{paket.sumber}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs leading-snug text-foreground">{paket.penyediaSemua.join(", ")}</td>
                      <td className="px-3 py-2 text-right text-xs tabular-nums text-foreground">{formatRupiahFull(paket.nilai)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-border px-3 py-2 font-sans text-[10px] leading-relaxed text-muted-foreground">
                Tiap nilai adalah realisasi paket itu sendiri, bukan nilai kontrak. Kode paket membuka halaman
                realisasi Data INAPROC.
              </p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link
              href={`/penyedia/${slugPenyedia(kontrak.penyedia)}?region=${encodeURIComponent(regionId)}`}
              className="font-sans text-[11px] font-bold text-primary underline-offset-2 hover:underline"
            >
              Rekam jejak penyedia
            </Link>
            {kontrak.url ? (
              <a
                href={kontrak.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
              >
                {kontrak.sumber === "LPSE" ? "Bukti halaman LPSE" : "Bukti paket di Data INAPROC"}
                <FiExternalLink aria-hidden="true" className="size-3" />
              </a>
            ) : null}
          </div>

          <p className="mt-3 border-t border-border pt-3 font-sans text-[11px] leading-relaxed text-muted-foreground">
            {kontrak.sumber === "LPSE"
              ? "Nama penyedia dan nilai kontrak dari LPSE, ditampilkan sebagai fakta kontrak — bukan penilaian kinerja. NPWP disamarkan oleh LPSE."
              : "Paket ini melalui e-purchasing/e-katalog, yang pencatatannya ada di Data INAPROC (bukan LPSE). Nama penyedia dan nilai transaksi ditampilkan sebagai fakta kontrak — bukan penilaian kinerja."}
          </p>
        </>
      )}
    </section>
  );
}
