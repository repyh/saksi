import type { Metadata } from "next";
import Link from "next/link";
import { buildMetodologi } from "@/server/packages/methodology";
import { resolveRegionId } from "@/server/regions/region-registry";

export const metadata: Metadata = {
  title: "Metode & Sumber Data — SAKSI",
  description:
    "Sumber, pipeline, dan batas interpretasi angka paket jalan SAKSI: RUP, Data INAPROC, LPSE/SPSE, serta batas wilayah ArcGIS Kota Tangerang.",
};

interface MetodePageProps {
  searchParams: Promise<{ region?: string | string[] }>;
}

function shaPendek(sha: string | null) {
  return sha ? `${sha.slice(0, 12)}…` : "—";
}

export default async function MetodePage({ searchParams }: MetodePageProps) {
  const { region } = await searchParams;
  const regionId = resolveRegionId(region);
  const data = await buildMetodologi(regionId);
  const { angka, penyedia, ujiAnchor, snapshot, region: wilayah } = data;
  const tautanRegion = `region=${encodeURIComponent(regionId)}`;

  return (
    <main className="min-h-screen bg-white text-foreground">
      <section className="border-b border-border bg-muted/20">
        <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
            Metodologi data
          </p>
          <h1 className="mt-2 font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            Bagaimana angka SAKSI disusun
          </h1>
          <p className="mt-3 max-w-3xl font-sans text-sm leading-relaxed text-foreground/80">
            Semua angka di SAKSI berasal dari data resmi: ekspor RUP{" "}
            <a
              href="https://data.inaproc.id/rup"
              className="font-semibold text-primary underline-offset-2 hover:underline"
            >
              data.inaproc.id/rup
            </a>
            , detail RUP, Data INAPROC realisasi, LPSE/SPSE, dan batas wilayah ArcGIS{" "}
            {wilayah.label}. Tidak ada NLP, LLM, computer vision, atau sumber sosial di pipeline.
            Halaman ini menjelaskan asal setiap angka, cara pembaruannya, dan hal yang sengaja tidak
            diklaim.
          </p>

          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-5 sm:grid-cols-4">
            <div>
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Wilayah
              </dt>
              <dd className="mt-0.5 font-heading text-lg font-bold">{wilayah.label}</dd>
            </div>
            <div>
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Instansi
              </dt>
              <dd className="mt-0.5 font-heading text-lg font-bold tabular-nums">{wilayah.instansi}</dd>
            </div>
            <div>
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Tahun anggaran
              </dt>
              <dd className="mt-0.5 font-heading text-lg font-bold tabular-nums">
                {wilayah.tahun.join("–")}
              </dd>
            </div>
            <div>
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Snapshot paket
              </dt>
              <dd className="mt-0.5 font-heading text-lg font-bold">{snapshot.tanggal ?? "—"}</dd>
            </div>
          </dl>
        </div>
      </section>

      {!data.lengkap || !angka || !penyedia ? (
        <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="border border-destructive/40 bg-destructive/5 p-5">
            <p className="font-heading text-lg font-bold text-destructive">Manifest belum lengkap</p>
            <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-foreground/80">
              Angka turunan belum bisa ditampilkan karena manifest region ini belum memuat metrik
              snapshot. Sumber dan tanggal di bawah tetap ditampilkan apa adanya; jangan mengutip
              angka dari halaman ini sampai manifest selesai dirakit.
            </p>
            <ul className="mt-3 space-y-1 font-sans text-sm text-foreground/80">
              {data.catatan.map((catatan) => (
                <li key={catatan} className="border-l-2 border-destructive/50 pl-3">
                  {catatan}
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {angka && penyedia ? (
        <section className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 lg:px-8">
          <h2 className="font-heading text-xl font-bold tracking-tight">Ringkasan snapshot</h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 border border-border sm:grid-cols-4">
            <div className="p-4">
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Paket jalan
              </dt>
              <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-primary">
                {angka.paket.toLocaleString("id-ID")}
              </dd>
            </div>
            <div className="p-4">
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Pagu
              </dt>
              <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-primary">
                {angka.paguTampil}
              </dd>
            </div>
            <div className="p-4">
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Punya lokus turunan
              </dt>
              <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-primary">
                {angka.berlokusPersen}
              </dd>
            </div>
            <div className="p-4">
              <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                Punya rekam penyedia
              </dt>
              <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-primary">
                {penyedia.punyaRekamPersen}
              </dd>
            </div>
          </dl>
          <p className="mt-3 font-sans text-[11px] text-muted-foreground">
            {angka.perTahun
              .map((item) => `TA${item.tahun} ${item.jumlah.toLocaleString("id-ID")} paket`)
              .join(" · ")}
            {snapshot.dibuat ? ` · manifest dirakit ${snapshot.dibuat}` : ""}
          </p>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="font-heading text-xl font-bold tracking-tight">Sumber data dan tanggalnya</h2>
        <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-foreground/80">
          Setiap berkas sumber dicatat di manifest region bersama SHA-256-nya, sehingga angka bisa
          dilacak kembali ke artefak yang persis. Tanggal di bawah dibaca dari snapshot dan manifest,
          bukan ditulis manual di halaman.
        </p>
        <div className="mt-4 overflow-x-auto border border-border">
          <table className="w-full min-w-[640px] border-collapse font-sans text-sm">
            <caption className="sr-only">Sumber data, tanggal pengambilan, dan checksum berkas</caption>
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left">
                <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Sumber
                </th>
                <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Isi
                </th>
                <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Tanggal
                </th>
                <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Berkas · SHA-256
                </th>
              </tr>
            </thead>
            <tbody>
              {data.sumber.map((item) => (
                <tr key={item.id} className="border-b border-border/60 align-top last:border-0">
                  <th scope="row" className="px-3 py-3 text-left font-semibold">
                    {item.nama}
                  </th>
                  <td className="px-3 py-3 text-foreground/80">{item.keterangan}</td>
                  <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                    {item.tanggal ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    {item.berkas.length ? (
                      <ul className="space-y-1">
                        {item.berkas.map((berkas) => (
                          <li key={berkas.path} className="font-mono text-[11px] leading-relaxed">
                            <span className="text-foreground/80">{berkas.path}</span>
                            <span
                              className="ml-2 text-muted-foreground"
                              title={berkas.sha256 ?? "checksum belum tercatat"}
                            >
                              {shaPendek(berkas.sha256)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {snapshot.sumber ? (
          <p className="mt-2 font-sans text-[11px] text-muted-foreground">
            Snapshot paket: {snapshot.sumber} · {snapshot.tanggal ?? "tanggal tidak tercatat"}
          </p>
        ) : null}
      </section>

      <section className="border-y border-border bg-muted/10">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <h2 className="font-heading text-xl font-bold tracking-tight">Pipeline dan gerbang kualitas</h2>
          <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-foreground/80">
            Urutan yang sama dijalankan oleh skrip data maupun worker{" "}
            <code className="font-mono text-[12px]">workers/ingest.mjs</code>: RUP → detail →
            realisasi → LPSE → normalisasi → validasi → upsert DB → rebuild snapshot →{" "}
            <code className="font-mono text-[12px]">region:check</code>. Snapshot sementara digate
            sebelum transaksi domain, jadi kegagalan validasi tidak mengubah data aktif.
          </p>

          {data.pipeline.length ? (
            <ol className="mt-5 border-t border-border">
              {data.pipeline.map((tahap, urutan) => (
                <li
                  key={tahap.nama}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-border/60 py-3 last:border-0"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="font-heading text-sm font-extrabold tabular-nums text-primary">
                      {String(urutan + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="font-heading text-sm font-bold">{tahap.nama}</p>
                      <p className="mt-0.5 font-sans text-[12px] leading-relaxed text-foreground/70">
                        {tahap.keterangan}
                      </p>
                    </div>
                  </div>
                  {tahap.jumlah ? (
                    <span className="font-sans text-[11px] font-bold tabular-nums text-muted-foreground">
                      {tahap.jumlah}
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="border border-border bg-white p-4">
              <p className="font-heading text-sm font-bold">Operasional worker</p>
              <p className="mt-1.5 font-sans text-[12px] leading-relaxed text-foreground/75">
                Worker memakai lock per region dengan TTL dan heartbeat, retry terbatas dengan
                backoff, log JSON-lines, serta riwayat run dan langkahnya. Run kedua yang bertabrakan
                dilewati dengan status <code className="font-mono text-[11px]">SKIPPED</code>, bukan
                ditulis sebagian.
              </p>
            </div>
            <div className="border border-border bg-white p-4">
              <p className="font-heading text-sm font-bold">Penjadwalan</p>
              <p className="mt-1.5 font-sans text-[12px] leading-relaxed text-foreground/75">
                Worker dijalankan terjadwal lewat systemd timer atau cron GitHub Actions. Setiap run
                menghasilkan snapshot bertanggal dan manifest provenance baru; tidak ada penulisan
                manual ke berkas snapshot.
              </p>
            </div>
          </div>
        </div>
      </section>

      {angka ? (
        <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <h2 className="font-heading text-xl font-bold tracking-tight">
            Mengapa lokasi memakai anchor {wilayah.environmentLabel}
          </h2>
          <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="font-sans text-sm leading-relaxed text-foreground/80">
              <p>
                Nama ruas jalan tidak cukup untuk memetakan paket: uji {ujiAnchor.tanggal} menunjukkan
                hanya <strong>{ujiAnchor.ruasPersen}</strong> paket menyebut nama ruas yang bisa
                dicocokkan ke batas wilayah, sementara <strong>{ujiAnchor.rwPersen}</strong> menyebut
                nomor {wilayah.environmentLabel} dan <strong>{ujiAnchor.kelurahanPersen}</strong>{" "}
                kelurahan. Karena itu lokasi paket diturunkan ke {wilayah.environmentLabel} atau
                kelurahan dari nama paket, bukan ditebak dari nama jalan.
              </p>
              <p className="mt-3">
                Peta SAKSI mewarnai <strong>batas wilayah</strong> (koroplet), bukan menaruh titik
                pekerjaan. Tidak ada koordinat titik, tidak ada pin, dan tidak ada jitter. Paket tanpa
                anchor hanya muncul di tabel dengan label “{wilayah.label} (umum)”.
              </p>
              <p className="mt-3">
                {angka.berlokus.toLocaleString("id-ID")} dari {angka.paket.toLocaleString("id-ID")}{" "}
                paket ({angka.berlokusPersen}) punya lokus turunan; {angka.tanpaLokus.toLocaleString("id-ID")}{" "}
                paket ({angka.tanpaLokusPersen}) tidak punya anchor dan tidak dipetakan.
              </p>
            </div>
            <div className="overflow-x-auto border border-border">
              <table className="w-full border-collapse font-sans text-sm">
                <caption className="sr-only">Rincian presisi lokasi dan jangkauan wilayah</caption>
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left">
                    <th scope="col" className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      Presisi
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      Paket
                    </th>
                    <th scope="col" className="px-3 py-2 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      Porsi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {angka.presisi.map((baris) => (
                    <tr key={baris.label} className="border-b border-border/60 last:border-0">
                      <th scope="row" className="px-3 py-2 text-left font-medium">
                        {baris.label}
                      </th>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {baris.jumlah.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                        {baris.persen}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {angka.cakupan.map((baris) => (
              <div key={baris.label} className="border border-border p-4">
                <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  {baris.label}
                </dt>
                <dd className="mt-1 font-heading text-xl font-extrabold tabular-nums text-primary">
                  {baris.tercakup.toLocaleString("id-ID")}
                  <span className="text-sm font-bold text-muted-foreground">
                    {" "}
                    / {baris.total.toLocaleString("id-ID")}
                  </span>
                </dd>
                <dd className="font-sans text-[11px] text-muted-foreground">{baris.persen} wilayah</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {penyedia ? (
        <section className="border-y border-border bg-muted/10">
          <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            <h2 className="font-heading text-xl font-bold tracking-tight">
              Dua lapis rekam penyedia
            </h2>
            <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-foreground/80">
              Nama penyedia tidak diambil dari satu sumber. LPSE/SPSE mencatat tender dan pengadaan
              langsung, sedangkan Data INAPROC realisasi mencatat transaksi e-purchasing/e-katalog.
              Keduanya dicocokkan ke paket lewat <strong>Kode RUP</strong>, bukan kemiripan nama.
              Penyedia disebut dengan nama asli beserta penyebutnya; tidak ada skor gabungan atau
              penilaian kinerja.
            </p>

            <dl className="mt-4 grid grid-cols-2 gap-4 border border-border bg-white sm:grid-cols-4">
              <div className="p-4">
                <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Rekam LPSE/SPSE
                </dt>
                <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-primary">
                  {penyedia.lpse.toLocaleString("id-ID")}
                </dd>
              </div>
              <div className="p-4">
                <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Rekam Data INAPROC
                </dt>
                <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-primary">
                  {penyedia.realisasi.toLocaleString("id-ID")}
                </dd>
              </div>
              <div className="p-4">
                <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Penyedia unik
                </dt>
                <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-primary">
                  {penyedia.unik.toLocaleString("id-ID")}
                </dd>
              </div>
              <div className="p-4">
                <dt className="font-sans text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                  Tanpa rekam publik
                </dt>
                <dd className="mt-1 font-heading text-2xl font-extrabold tabular-nums text-primary">
                  {penyedia.tanpaRekam.toLocaleString("id-ID")}
                </dd>
              </div>
            </dl>

            <p className="mt-3 max-w-3xl font-sans text-sm leading-relaxed text-foreground/80">
              {penyedia.punyaRekam.toLocaleString("id-ID")} dari{" "}
              {penyedia.paket.toLocaleString("id-ID")} paket ({penyedia.punyaRekamPersen}) punya nama
              penyedia. Sisa {penyedia.tanpaRekam.toLocaleString("id-ID")} paket tidak punya rekam
              publik di kedua sumber, dengan pagu {penyedia.tanpaRekamPaguTampil} (
              {penyedia.tanpaRekamPaguPersen} dari total pagu). Ketiadaan rekam bukan bukti
              pelanggaran; itu batas cakupan data yang ditampilkan terbuka.
            </p>
          </div>
        </section>
      ) : null}

      <section className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="font-heading text-xl font-bold tracking-tight">Yang tidak diklaim</h2>
        <ul className="mt-3 grid gap-x-8 gap-y-2 font-sans text-sm leading-relaxed text-foreground/80 sm:grid-cols-2">
          <li className="border-l-2 border-border pl-3">
            <strong>Bukan bukti korupsi.</strong> Indikator “Diduga Tidak Sesuai” adalah sinyal untuk
            ditinjau, bukan tuduhan atau vonis.
          </li>
          <li className="border-l-2 border-border pl-3">
            <strong>Bukan penilaian kinerja.</strong> Angka penyedia dan kontrak adalah fakta
            administratif, tanpa skor atau peringkat gabungan.
          </li>
          <li className="border-l-2 border-border pl-3">
            <strong>Bukan kepastian lokasi.</strong> Presisi tertinggi adalah {wilayah.environmentLabel}{" "}
            atau kelurahan; tidak ada klaim koordinat titik pekerjaan.
          </li>
          <li className="border-l-2 border-border pl-3">
            <strong>Bukan hubungan kausal.</strong> Data tidak membuktikan sebab-akibat antara
            anggaran, kontrak, dan kondisi jalan.
          </li>
          <li className="border-l-2 border-border pl-3">
            <strong>Laporan warga adalah sinyal.</strong> Laporan menandai ruas untuk ditinjau, bukan
            kesimpulan atas paket atau penyedia.
          </li>
        </ul>
      </section>

      <section className="border-t border-border bg-muted/10">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <h2 className="font-heading text-xl font-bold tracking-tight">Cara halaman ini diperbarui</h2>
          <p className="mt-2 max-w-3xl font-sans text-sm leading-relaxed text-foreground/80">
            Halaman ini tidak menyimpan angka salinan. Setiap permintaan membaca manifest region,
            snapshot aktif, dan meta LPSE/realisasi, lalu menghitung ulang angka, porsi, dan tanggal.
            Ketika worker terjadwal menghasilkan manifest dan snapshot baru, angka di sini ikut
            berubah tanpa suntingan manual. Manifest juga mencatat SHA-256 setiap berkas sumber,
            sehingga versi data yang dipakai selalu bisa ditelusuri.
          </p>
          {data.catatan.length ? (
            <ul className="mt-4 space-y-1 border border-border bg-white p-4 font-sans text-[12px] leading-relaxed text-foreground/75">
              {data.catatan.map((catatan) => (
                <li key={catatan}>{catatan}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 border border-border bg-white p-4 font-sans text-[12px] text-foreground/75">
              Silang periksa manifest dengan snapshot aktif dan meta kontrak: tidak ada selisih yang
              tercatat.
            </p>
          )}

          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 font-sans text-sm font-semibold">
            <Link
              href={`/project?${tautanRegion}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              Lihat peta pekerjaan
            </Link>
            <Link
              href={`/penyedia?${tautanRegion}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              Lihat daftar penyedia
            </Link>
            <Link
              href={`/laporan?${tautanRegion}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              Laporkan kondisi jalan
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
