import type { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { buildMetodologi } from "@/server/packages/methodology";
import { resolveRegionId } from "@/server/regions/region-registry";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Metode Data SAKSI: Paket Jalan Tangerang",
  description:
    "Kenali sumber data paket jalan SAKSI, cara lokasi ditampilkan di peta, tanggal snapshot, dan batas yang perlu dipahami.",
};

interface MetodePageProps {
  searchParams: Promise<{ region?: string | string[] }>;
}

function formatJumlah(value: number) {
  return value.toLocaleString("id-ID");
}

function SectionHeading({ nomor, children }: { nomor: string; children: ReactNode }) {
  return (
    <div className="mb-6 flex items-start gap-4 sm:gap-5">
      <span
        aria-hidden="true"
        className="pt-0.5 font-heading text-lg font-extrabold tabular-nums text-primary sm:text-xl"
      >
        {nomor}
      </span>
      <h2 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
        {children}
      </h2>
    </div>
  );
}

export default async function MetodePage({ searchParams }: MetodePageProps) {
  const { region } = await searchParams;
  const regionId = resolveRegionId(region);
  const data = await buildMetodologi(regionId);
  const { angka, penyedia, ujiAnchor, snapshot, region: wilayah } = data;
  const tautanRegion = `region=${encodeURIComponent(regionId)}`;

  return (
    <main className="min-h-screen bg-white text-foreground">
      <section className="bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
            Metode dan sumber data
          </p>
          <h1 className="mt-2 max-w-4xl font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">
            Dari paket pengadaan ke wilayah di peta
          </h1>
          <p className="mt-5 max-w-3xl font-sans text-lg leading-relaxed text-foreground/80">
            SAKSI menggabungkan data paket RUP, catatan kontrak dari LPSE/SPSE dan Data INAPROC,
            serta batas wilayah {wilayah.label}. Data paket tidak memuat koordinat pekerjaan yang
            bisa dipastikan. Karena itu, peta menunjukkan wilayah yang disebut dalam paket—bukan
            titik ruas jalan yang pasti.
          </p>
          <p className="mt-5 font-sans text-sm text-muted-foreground">
            {wilayah.label} · Instansi {wilayah.instansi} · TA {wilayah.tahun.join("–")} · Snapshot
            paket {snapshot.tanggal ?? "belum tercatat"}
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            <figure>
              <a
                href="https://commons.wikimedia.org/wiki/File:Bratan_Bali_Indonesia_Road-work-01.jpg"
                target="_blank"
                rel="noreferrer"
                className="relative block aspect-[3/2] overflow-hidden"
              >
                <Image
                  src="https://thumb.wikimedia.org/wikipedia/commons/thumb/3/33/Bratan_Bali_Indonesia_Road-work-01.jpg/960px-Bratan_Bali_Indonesia_Road-work-01.jpg"
                  alt="Dua pekerja mengerjakan perawatan jalan di Bratan, Bali"
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                />
              </a>
              <figcaption className="mt-2 font-sans text-xs leading-relaxed text-muted-foreground">
                Pekerjaan jalan di Bratan, Bali. Foto: CEphoto, Uwe Aranas. Lisensi{" "}
                <a
                  href="https://creativecommons.org/licenses/by-sa/3.0/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  CC BY-SA 3.0
                </a>
                . Foto contoh dari daerah lain, bukan dokumentasi paket di SAKSI.
              </figcaption>
            </figure>
            <figure>
              <a
                href="https://commons.wikimedia.org/wiki/File:Pekerjaan_PUPR_Perbaikan_Jalan_Aspal_Di_Kebumen_Jateng_Indonesia.jpg"
                target="_blank"
                rel="noreferrer"
                className="relative block aspect-[3/2] overflow-hidden"
              >
                <Image
                  src="https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b2/Pekerjaan_PUPR_Perbaikan_Jalan_Aspal_Di_Kebumen_Jateng_Indonesia.jpg/960px-Pekerjaan_PUPR_Perbaikan_Jalan_Aspal_Di_Kebumen_Jateng_Indonesia.jpg"
                  alt="Pekerjaan perbaikan jalan aspal di Kebumen, Jawa Tengah"
                  fill
                  unoptimized
                  sizes="(max-width: 640px) 100vw, 50vw"
                  className="object-cover"
                />
              </a>
              <figcaption className="mt-2 font-sans text-xs leading-relaxed text-muted-foreground">
                Perbaikan jalan aspal di Kebumen, Jawa Tengah. Foto: SATELIT BM9. Lisensi{" "}
                <a
                  href="https://creativecommons.org/licenses/by-sa/4.0/"
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  CC BY-SA 4.0
                </a>
                . Foto contoh, bukan dokumentasi paket di SAKSI.
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      {data.catatan.length > 0 ? (
        <section className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 lg:px-8">
          <div
            className="border-l-4 border-amber-500 bg-amber-50 p-4"
            role="status"
            aria-live="polite"
          >
            <h2 className="font-heading text-sm font-bold">Ada angka yang perlu diperiksa</h2>
            <p className="mt-1 font-sans text-sm leading-relaxed text-foreground/80">
              Sebagian catatan sumber belum cocok dengan snapshot aktif. Baca angka di halaman ini
              sebagai sementara sampai perbedaan berikut ditinjau.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 font-sans text-xs leading-relaxed text-foreground/75">
              {data.catatan.map((catatan) => (
                <li key={catatan}>{catatan}</li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {angka && penyedia ? (
        <section className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="font-heading text-2xl font-extrabold tracking-tight sm:text-3xl">
            Sekilas tentang snapshot ini
          </h2>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-border py-6 sm:grid-cols-4">
            <div>
              <dt className="font-sans text-xs text-muted-foreground">Paket jalan</dt>
              <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-primary">
                {formatJumlah(angka.paket)}
              </dd>
            </div>
            <div>
              <dt className="font-sans text-xs text-muted-foreground">Total pagu</dt>
              <dd className="mt-1 font-heading text-xl font-extrabold tabular-nums text-primary">
                {angka.paguTampil}
              </dd>
            </div>
            <div>
              <dt className="font-sans text-xs text-muted-foreground">Lokasi punya rujukan wilayah</dt>
              <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-primary">
                {angka.berlokusPersen}
              </dd>
              <p className="font-sans text-xs text-muted-foreground">
                {formatJumlah(angka.berlokus)} dari {formatJumlah(angka.paket)} paket
              </p>
            </div>
            <div>
              <dt className="font-sans text-xs text-muted-foreground">Ada nama penyedia</dt>
              <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-primary">
                {penyedia.punyaRekamPersen}
              </dd>
              <p className="font-sans text-xs text-muted-foreground">
                {formatJumlah(penyedia.punyaRekam)} dari {formatJumlah(penyedia.paket)} paket
              </p>
            </div>
          </dl>
          <p className="mt-3 font-sans text-xs leading-relaxed text-muted-foreground">
            {angka.perTahun
              .map((item) => `TA ${item.tahun}: ${formatJumlah(item.jumlah)} paket`)
              .join(" · ")}
            {snapshot.dibuat ? ` · Data dirakit ${snapshot.dibuat}` : ""}
          </p>
        </section>
      ) : (
        <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="border border-border bg-muted/10 p-5">
            <h2 className="font-heading text-lg font-bold">Ringkasan belum tersedia</h2>
            <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-foreground/75">
              Sumber data tetap dicantumkan di bawah, tetapi angka paket dan penyedia belum dapat
              ditampilkan untuk wilayah ini karena catatan snapshot belum lengkap.
            </p>
          </div>
        </section>
      )}

      <section id="alur-data" className="bg-muted/80">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeading nomor="01">Bagaimana data disusun</SectionHeading>
          <p className="max-w-3xl font-sans text-base leading-relaxed text-foreground/80">
            Setiap angka di peta berawal dari paket pengadaan. Lokasi dibaca dari keterangan paket,
            lalu dicocokkan dengan batas wilayah resmi. Jika ada catatan kontrak, SAKSI
            mencocokkannya ke paket menggunakan Kode RUP.
          </p>
          <ol className="mt-8 grid gap-4 sm:grid-cols-3">
            <li className="bg-white p-5">
              <p className="font-heading text-3xl font-extrabold tabular-nums text-primary/35">01</p>
              <p className="font-heading text-lg font-bold">Kumpulkan paket</p>
              <p className="mt-1 font-sans text-sm leading-relaxed text-foreground/75">
                Daftar RUP disaring untuk pekerjaan jalan, jembatan, dan drainase pada tahun
                anggaran yang dipilih.
              </p>
            </li>
            <li className="bg-white p-5">
              <p className="font-heading text-3xl font-extrabold tabular-nums text-primary/35">02</p>
              <p className="font-heading text-lg font-bold">Cocokkan rekam kontrak</p>
              <p className="mt-1 font-sans text-sm leading-relaxed text-foreground/75">
                Data LPSE/SPSE dan Data INAPROC realisasi ditautkan ke paket lewat Kode RUP.
              </p>
            </li>
            <li className="bg-white p-5">
              <p className="font-heading text-3xl font-extrabold tabular-nums text-primary/35">03</p>
              <p className="font-heading text-lg font-bold">Tampilkan wilayah</p>
              <p className="mt-1 font-sans text-sm leading-relaxed text-foreground/75">
                Keterangan lokasi paket dicocokkan ke batas RW, kelurahan, atau kecamatan. Lokasi
                yang tidak cukup jelas tidak dipaksakan masuk ke peta.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {angka ? (
        <section id="lokasi" className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeading nomor="02">Seberapa tepat lokasi di peta?</SectionHeading>
          <div className="max-w-3xl space-y-4 font-sans text-base leading-relaxed text-foreground/80">
            <p>
              Nama jalan saja sering tidak cukup untuk memastikan lokasi paket. Dalam uji pada
              {" "}{ujiAnchor.tanggal}, {ujiAnchor.ruasPersen} paket menyebut nama ruas yang dapat
              dicocokkan. Sebaliknya, {ujiAnchor.rwPersen} menyebut nomor {wilayah.environmentLabel}
              {" "}dan {ujiAnchor.kelurahanPersen} menyebut kelurahan. Itulah sebabnya SAKSI
              memakai nama wilayah yang tercantum, bukan menebak titik pekerjaan dari nama jalan.
            </p>
            <p>
              Peta mewarnai batas wilayah (koroplet), bukan menaruh pin atau titik untuk setiap
              paket. Paket tanpa rujukan wilayah tetap ada di tabel dengan label “{wilayah.label}
              (umum)”, tetapi tidak ditempatkan di peta.
            </p>
            <p>
              Pada snapshot ini, {formatJumlah(angka.berlokus)} dari {formatJumlah(angka.paket)}
              paket ({angka.berlokusPersen}) punya rujukan wilayah. {formatJumlah(angka.tanpaLokus)}
              paket ({angka.tanpaLokusPersen}) belum punya rujukan yang cukup untuk dipetakan.
            </p>
          </div>

          <div className="mt-8 overflow-x-auto border border-border">
            <table className="w-full border-collapse font-sans text-sm">
              <caption className="sr-only">Jumlah paket menurut tingkat detail lokasi</caption>
              <thead>
                <tr className="border-b border-border bg-muted/30 text-left">
                  <th scope="col" className="px-3 py-2 font-semibold">Rujukan lokasi</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Paket</th>
                  <th scope="col" className="px-3 py-2 text-right font-semibold">Bagian</th>
                </tr>
              </thead>
              <tbody>
                {angka.presisi.map((baris) => (
                  <tr key={baris.label} className="border-b border-border/60 last:border-0">
                    <th scope="row" className="px-3 py-2 text-left font-medium">{baris.label}</th>
                    <td className="px-3 py-2 text-right tabular-nums">{formatJumlah(baris.jumlah)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{baris.persen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-7 font-heading text-base font-bold">Wilayah yang terjangkau</h3>
          <dl className="mt-3 grid gap-3 sm:grid-cols-3">
            {angka.cakupan.map((baris) => (
              <div key={baris.label} className="border border-border p-4">
                <dt className="font-sans text-sm text-muted-foreground">{baris.label}</dt>
                <dd className="mt-1 font-heading text-xl font-extrabold tabular-nums text-primary">
                  {formatJumlah(baris.tercakup)}
                  <span className="text-sm font-bold text-muted-foreground"> / {formatJumlah(baris.total)}</span>
                </dd>
                <dd className="font-sans text-xs text-muted-foreground">{baris.persen} dari wilayah</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {penyedia ? (
        <section id="penyedia" className="bg-primary/[0.04]">
          <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
            <SectionHeading nomor="03">Dari mana nama penyedia berasal?</SectionHeading>
            <p className="max-w-3xl font-sans text-base leading-relaxed text-foreground/80">
              Dua sumber melengkapi jenis transaksi yang berbeda. LPSE/SPSE memuat rekam tender dan
              pengadaan langsung; Data INAPROC realisasi mencakup transaksi e-purchasing dan
              e-katalog. Kode RUP menjadi penghubung antara rekam tersebut dan paket.
            </p>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-y border-border py-5 sm:grid-cols-4">
              <div>
                <dt className="font-sans text-xs text-muted-foreground">Rekam LPSE/SPSE</dt>
                <dd className="mt-1 font-heading text-xl font-extrabold tabular-nums text-primary">{formatJumlah(penyedia.lpse)}</dd>
              </div>
              <div>
                <dt className="font-sans text-xs text-muted-foreground">Rekam Data INAPROC</dt>
                <dd className="mt-1 font-heading text-xl font-extrabold tabular-nums text-primary">{formatJumlah(penyedia.realisasi)}</dd>
              </div>
              <div>
                <dt className="font-sans text-xs text-muted-foreground">Nama unik di snapshot</dt>
                <dd className="mt-1 font-heading text-xl font-extrabold tabular-nums text-primary">{formatJumlah(penyedia.unikKontrak)}</dd>
              </div>
              <div>
                <dt className="font-sans text-xs text-muted-foreground">Belum ada rekam publik</dt>
                <dd className="mt-1 font-heading text-xl font-extrabold tabular-nums text-primary">{formatJumlah(penyedia.tanpaRekam)}</dd>
              </div>
            </dl>
            <p className="mt-4 max-w-3xl font-sans text-sm leading-relaxed text-foreground/80">
              {formatJumlah(penyedia.punyaRekam)} dari {formatJumlah(penyedia.paket)} paket
              ({penyedia.punyaRekamPersen}) memiliki nama penyedia yang tercatat. {formatJumlah(penyedia.tanpaRekam)}
              {" "}paket lainnya, dengan pagu {penyedia.tanpaRekamPaguTampil} ({penyedia.tanpaRekamPaguPersen}
              {" "}dari total pagu), belum memiliki rekam di dua sumber tersebut. Artinya data belum
              ditemukan di cakupan yang digunakan; itu sendiri bukan bukti pelanggaran.
            </p>
            <p className="mt-2 max-w-3xl font-sans text-xs leading-relaxed text-muted-foreground">
              Jumlah nama unik dihitung setelah nama gabungan dinormalisasi. Angka tiap sumber
              menghitung rekam paket, bukan jumlah perusahaan unik.
            </p>
          </div>
        </section>
      ) : null}

      <section id="batas-data" className="bg-secondary/20">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeading nomor="04">Cara membaca angka SAKSI</SectionHeading>
        <ul className="grid gap-x-10 gap-y-5 font-sans text-base leading-relaxed text-foreground/80 sm:grid-cols-2">
          <li>
            <strong>Lokasi adalah petunjuk wilayah.</strong> Tingkat detail tertinggi yang ditampilkan
            adalah {wilayah.environmentLabel}; data ini tidak memastikan titik atau ruas pekerjaan.
          </li>
          <li>
            <strong>Indikator bukan vonis.</strong> Label “Diduga Tidak Sesuai” menandai hal yang perlu
            ditinjau lebih lanjut, bukan kesimpulan atau tuduhan.
          </li>
          <li>
            <strong>Nama penyedia bukan peringkat.</strong> SAKSI menampilkan rekam administratif
            beserta jumlah paket dan sumbernya, tanpa skor gabungan atau penilaian kinerja.
          </li>
          <li>
            <strong>Laporan warga adalah sinyal.</strong> Laporan membantu menunjukkan kondisi yang
            perlu diperiksa; laporan tidak membuktikan hubungan dengan paket atau penyedia tertentu.
          </li>
        </ul>
        </div>
      </section>

      <section id="sumber" className="bg-muted/80">
        <div className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
          <SectionHeading nomor="05">Sumber yang digunakan</SectionHeading>
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.sumber.map((item) => (
              <li key={item.id} className="bg-white p-5">
                <h3 className="font-heading text-lg font-bold">{item.nama}</h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-foreground/75">{item.keterangan}</p>
                <p className="mt-3 font-sans text-xs font-semibold text-muted-foreground">
                  {item.tanggal ? `Diperbarui ${item.tanggal}` : "Tanggal belum tercatat"}
                </p>
              </li>
            ))}
          </ul>
          <details className="mt-6 bg-white p-5">
            <summary className="cursor-pointer font-sans text-sm font-semibold">
              Lihat berkas sumber dan checksum
            </summary>
            <p className="mt-2 font-sans text-xs leading-relaxed text-muted-foreground">
              Manifest snapshot mencatat berkas yang dipakai beserta checksum SHA-256, agar versi
              data dapat ditelusuri.
            </p>
            <ul className="mt-3 space-y-3">
              {data.sumber.flatMap((item) =>
                item.berkas.map((berkas) => (
                  <li key={`${item.id}-${berkas.path}`} className="font-sans text-xs">
                    <span className="font-semibold">{item.nama}</span>
                    <code className="mt-1 block break-all text-muted-foreground">{berkas.path}</code>
                    <code className="mt-0.5 block break-all text-muted-foreground">
                      SHA-256: {berkas.sha256 ?? "belum tercatat"}
                    </code>
                  </li>
                )),
              )}
            </ul>
          </details>
        </div>
      </section>

      <section id="pertanyaan" className="mx-auto w-full max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <SectionHeading nomor="06">Pertanyaan umum</SectionHeading>
        <div className="grid gap-3 sm:grid-cols-2">
          <details className="bg-muted/30 p-5">
            <summary className="cursor-pointer font-heading text-sm font-bold">
              Apakah peta menunjukkan lokasi pekerjaan yang persis?
            </summary>
            <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-foreground/75">
              Tidak. Peta menyorot batas wilayah yang disebut dalam paket. SAKSI tidak menempatkan
              titik pekerjaan karena data yang tersedia tidak memastikan koordinat atau ruasnya.
            </p>
          </details>
          <details className="bg-muted/30 p-5">
            <summary className="cursor-pointer font-heading text-sm font-bold">
              Mengapa paket tanpa lokasi tetap muncul di daftar?
            </summary>
            <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-foreground/75">
              Paket tetap bagian dari data pengadaan meski keterangannya belum cukup untuk dipetakan.
              Paket seperti ini ditampilkan sebagai {wilayah.label} (umum), tanpa penempatan pada
              wilayah tertentu.
            </p>
          </details>
          <details className="bg-muted/30 p-5">
            <summary className="cursor-pointer font-heading text-sm font-bold">
              Apakah penyedia yang belum ditemukan berarti bermasalah?
            </summary>
            <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-foreground/75">
              Tidak. Itu berarti nama penyedia belum ditemukan pada rekam LPSE/SPSE dan Data INAPROC
              realisasi yang digunakan. Ketiadaan catatan bukan bukti pelanggaran.
            </p>
          </details>
          <details className="bg-muted/30 p-5">
            <summary className="cursor-pointer font-heading text-sm font-bold">
              Mengapa tanggal sumber bisa berbeda?
            </summary>
            <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-foreground/75">
              Paket, detail RUP, kontrak, dan batas wilayah berasal dari pembaruan yang berbeda.
              Tanggal di samping tiap sumber menunjukkan tanggal data tersebut, sedangkan tanggal
              snapshot menunjukkan kapan paket dirangkum untuk halaman ini.
            </p>
          </details>
        </div>
      </section>

      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <nav aria-label="Jelajahi SAKSI" className="mt-5 flex flex-wrap gap-x-5 gap-y-2 font-sans text-sm font-semibold">
            <Link href={`/peta-pekerjaan?${tautanRegion}`} className="text-primary underline-offset-2 hover:underline">
              Buka peta pekerjaan
            </Link>
            <Link href={`/penyedia?${tautanRegion}`} className="text-primary underline-offset-2 hover:underline">
              Lihat daftar penyedia
            </Link>
            <Link href={`/laporan?${tautanRegion}`} className="text-primary underline-offset-2 hover:underline">
              Laporkan kondisi jalan
            </Link>
          </nav>
        </div>
      </section>
    </main>
  );
}
