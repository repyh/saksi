import { rupiah, vendor } from '../data'
import { daftarLaporan, labelStatus } from '../lib/reports'

export default function Daftar() {
  const laporan = daftarLaporan()
  const bervendor = vendor.paket.filter((p) => p.pemenang)

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <p className="label">Laporan warga</p>
      <h1 className="mt-2 text-[30px] font-semibold md:text-[36px]">
        {laporan.length > 0 ? `${laporan.length} laporan tersimpan di perangkat ini` : 'Belum ada laporan'}
      </h1>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted">
        Pada v1 laporan disimpan di perangkat (tanpa server), supaya bisa didemokan tanpa internet.
        Status awal selalu <em>diduga</em> — belum diverifikasi siapa pun.
      </p>

      {laporan.length === 0 ? (
        <div className="receipt mt-6 px-5 py-8 text-center">
          <p className="text-[15px]">Belum ada laporan. Coba kirim satu lewat halaman lapor.</p>
          <a href="#/lapor" className="mt-4 inline-block rounded-full bg-ink px-5 py-2.5 text-[14px] text-paper">
            Laporkan kerusakan
          </a>
        </div>
      ) : (
        <div className="receipt mt-6 overflow-hidden">
          <table className="w-full text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-line">
                <th className="label px-4 py-3 font-normal">Foto</th>
                <th className="label px-3 py-3 font-normal">Kerusakan</th>
                <th className="label px-3 py-3 text-right font-normal">Luas</th>
                <th className="label px-3 py-3 font-normal">Lokasi</th>
                <th className="label px-4 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {laporan.map((l) => (
                <tr key={l.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2">
                    <img src={l.foto} alt={`Laporan ${l.id}`} className="h-12 w-16 rounded object-cover" />
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium">
                      {l.jenis} · {l.tingkat}
                    </p>
                    <p className="text-[12px] text-muted">{l.deskripsi.slice(0, 60)}</p>
                  </td>
                  <td className="num px-3 py-2 text-right">
                    {l.luas_cm2} cm²
                    <br />
                    <span className="text-[11.5px] text-muted">
                      {l.panjang_cm}×{l.lebar_cm} cm
                    </span>
                  </td>
                  <td className="num px-3 py-2 text-[12px] text-muted">
                    {l.lat ? `${l.lat}, ${l.lng}` : '—'}
                  </td>
                  <td className="px-4 py-2 text-[12px]">{labelStatus[l.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section className="mt-12">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label">Pilot vendor · LPSE DKI Jakarta</p>
            <h2 className="mt-2 text-[22px] font-semibold md:text-[26px]">
              {bervendor.length} paket jalan/trotoar dan pemenangnya
            </h2>
          </div>
          <p className="text-[12px] text-muted">diambil {vendor.diambil} · data pilot, bukan sensus</p>
        </div>
        <div className="receipt mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-line">
                <th className="label px-4 py-3 font-normal">Pemenang</th>
                <th className="label px-3 py-3 font-normal">Paket</th>
                <th className="label px-3 py-3 font-normal">Metode</th>
                <th className="label px-4 py-3 text-right font-normal">Pagu</th>
              </tr>
            </thead>
            <tbody>
              {bervendor.map((p) => (
                <tr key={p.id} className="border-b border-line/60 last:border-0">
                  <td className="px-4 py-2 font-medium">{p.pemenang}</td>
                  <td className="px-3 py-2 text-muted">{(p.nama_paket ?? '').slice(0, 74)}</td>
                  <td className="px-3 py-2 text-[12px]">{p.metode ?? '—'}</td>
                  <td className="num px-4 py-2 text-right">{rupiah(p.pagu)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 max-w-3xl text-[12px] leading-relaxed text-muted">
          Nama penyedia diambil dari halaman paket SPSE yang terbuka untuk publik. Tujuannya transparansi
          pengadaan, bukan menilai kinerja perusahaan. Nilai pagu pada beberapa paket masih perlu
          diverifikasi ulang sebelum dipakai sebagai angka resmi.
        </p>
      </section>
    </div>
  )
}
