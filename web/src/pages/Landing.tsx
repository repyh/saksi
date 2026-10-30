import { jalan, kelasRusak, nomor, persen, provinsiTerburuk, vendor } from '../data'
import { daftarLaporan } from '../lib/reports'

function Stat({ label, nilai, catatan }: { label: string; nilai: string; catatan: string }) {
  return (
    <div className="receipt px-5 py-4">
      <p className="label">{label}</p>
      <p className="num mt-1 text-2xl font-semibold">{nilai}</p>
      <p className="mt-1 text-[12.5px] leading-snug text-muted">{catatan}</p>
    </div>
  )
}

export default function Landing() {
  const n = jalan.nasional
  const laporan = daftarLaporan()
  const rusak = n.persen.rusak_ringan + n.persen.rusak_berat

  return (
    <div>
      <section className="mx-auto max-w-6xl px-5 pt-12 pb-6 md:pt-16">
        <p className="label">Pelaporan warga · Computer vision · Data resmi Bina Marga</p>
        <h1 className="mt-3 max-w-4xl text-[34px] leading-[1.08] font-bold tracking-tight md:text-[54px]">
          Jalan di depan rumahmu rusak?
          <br />
          <span className="text-accent">Ukur, lalu laporkan.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink/85">
          Satu foto dengan KTP sebagai acuan ukuran menghasilkan luas kerusakan dalam cm² — bukan
          perkiraan. Laporan itu lalu diletakkan di sebelah pengukuran resmi pemerintah, supaya
          selisihnya kelihatan.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a href="#/lapor" className="rounded-full bg-ink px-5 py-2.5 text-[14px] font-medium text-paper">
            Laporkan kerusakan
          </a>
          <a href="#/laporan" className="rounded-full border border-line px-5 py-2.5 text-[14px]">
            Lihat laporan {laporan.length > 0 && `(${laporan.length})`}
          </a>
        </div>
        <p className="mt-4 text-[12px] text-muted">
          Tanpa login · tanpa identitas · foto tidak dikirim ke server mana pun
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-4 sm:grid-cols-3">
        <Stat
          label="Jalan terukur (resmi)"
          nilai={`${nomor(n.km)} km`}
          catatan={`${nomor(n.titik)} titik ukur IRI, semester ${jalan.semester} — sumber Bina Marga.`}
        />
        <Stat
          label="Masuk kelas rusak"
          nilai={persen(rusak)}
          catatan={`Rusak ringan ${persen(n.persen.rusak_ringan)} + rusak berat ${persen(n.persen.rusak_berat)}.`}
        />
        <Stat
          label="Paket vendor (pilot)"
          nilai={`${vendor.jumlah.terbaca}`}
          catatan={`Paket LPSE DKI Jakarta yang terbaca; ${vendor.paket.filter((p) => p.pemenang).length} sudah ada pemenang.`}
        />
      </section>

      <section className="mx-auto max-w-6xl px-5 py-12">
        <p className="label">Cara kerja</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            ['1', 'Foto + benda acuan', 'Letakkan KTP di samping kerusakan. Lebarnya 8,56 cm — itu acuan kami.'],
            ['2', 'Kalibrasi & ukur', 'Tandai dua sudut KTP, lalu tarik kotak pada kerusakan. Luas keluar dalam cm².'],
            ['3', 'Dibandingkan data resmi', 'Laporan diletakkan di samping kelas kondisi jalan dari pengukuran Bina Marga.'],
          ].map(([no, judul, isi]) => (
            <div key={no} className="receipt px-5 py-5">
              <p className="num text-[13px] text-accent">{no}</p>
              <p className="mt-1 text-[16px] font-semibold">{judul}</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{isi}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label">Data resmi · konteks</p>
            <h2 className="mt-2 text-[24px] font-semibold md:text-[30px]">Provinsi dengan porsi jalan rusak terbesar</h2>
          </div>
          <p className="text-[12px] text-muted">IRI per titik ukur, semester {jalan.semester}</p>
        </div>
        <div className="receipt mt-5 overflow-hidden">
          <table className="w-full text-left text-[14px]">
            <thead>
              <tr className="border-b border-line">
                <th className="label px-5 py-3 font-normal">Provinsi</th>
                <th className="label px-3 py-3 text-right font-normal">Km terukur</th>
                <th className="label px-3 py-3 text-right font-normal">Rata IRI</th>
                <th className="label px-5 py-3 text-right font-normal">Rusak</th>
              </tr>
            </thead>
            <tbody>
              {provinsiTerburuk().map((p) => (
                <tr key={p.provinsi} className="border-b border-line/60 last:border-0">
                  <td className="px-5 py-2.5">{p.provinsi.trim()}</td>
                  <td className="num px-3 py-2.5 text-right text-muted">{nomor(p.km)}</td>
                  <td className="num px-3 py-2.5 text-right">{p.rata_iri.toFixed(2).replace(".", ",")}</td>
                  <td className="num px-5 py-2.5 text-right font-semibold text-accent">{persen(kelasRusak(p))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          IRI mengukur kerataan permukaan (m/km), bukan jumlah lubang. Angka ini bukan penilaian atas kinerja instansi.
        </p>
      </section>
    </div>
  )
}
