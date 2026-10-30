import { useEffect, useState, type ComponentType } from 'react'
import Landing from './pages/Landing'
import Lapor from './pages/Lapor'
import Daftar from './pages/Daftar'
import { jalan, vendor } from './data'

const RUTE: Record<string, ComponentType> = {
  '#/': Landing,
  '#/lapor': Lapor,
  '#/laporan': Daftar,
}

const NAV: [string, string][] = [
  ['#/', 'Beranda'],
  ['#/lapor', 'Lapor'],
  ['#/laporan', 'Laporan & vendor'],
]

export default function App() {
  const [hash, setHash] = useState(() => window.location.hash || '#/')

  useEffect(() => {
    const on = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  const Halaman = RUTE[hash] ?? Landing

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <a href="#/" className="flex items-baseline gap-3">
            <span className="num text-[17px] font-bold tracking-[0.2em]">RUAS</span>
            <span className="hidden text-[12px] text-muted sm:inline">ukur laporan, bukan sekadar aduan</span>
          </a>
          <nav className="flex items-center gap-1">
            {NAV.map(([href, label]) => (
              <a
                key={href}
                href={href}
                className={`rounded-full px-3 py-1.5 text-[13px] transition ${
                  hash === href ? 'bg-ink text-paper' : 'text-ink/80 hover:bg-line/40'
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <Halaman />
      </main>

      <footer className="mt-10 border-t border-line">
        <div className="mx-auto max-w-6xl px-5 py-8 text-[12px] leading-relaxed text-muted">
          <p>
            Data pembanding: Bina Marga GIS (IRI 1/2026 — {jalan.nasional.titik.toLocaleString('id-ID')} titik ukur) ·
            LPSE DKI Jakarta (pilot vendor, {vendor.jumlah.terbaca} paket) · diakses Oktober 2026.
          </p>
          <p className="mt-2">
            RUAS bukan kanal resmi pemerintah dan tidak menyimpulkan pelanggaran. Status laporan selalu
            dimulai dari “diduga”. Foto diproses di perangkat; EXIF dibuang sebelum disimpan.
          </p>
        </div>
      </footer>
    </div>
  )
}
