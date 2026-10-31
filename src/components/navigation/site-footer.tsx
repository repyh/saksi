import Link from "next/link";
import { FiExternalLink } from "react-icons/fi";

export function SiteFooter() {
  return (
    <footer className="border-t-4 border-secondary bg-foreground text-white">
      <div className="w-full px-4 pt-8 pb-5 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-[minmax(0,1fr)_minmax(180px,auto)] sm:gap-10 lg:gap-16">
          <div className="max-w-xl">
            <Link
              href="/"
              className="font-heading text-xl font-black uppercase tracking-[0.24em] text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              SAKSI
            </Link>
            <div className="mt-4">
              <div className="border-l border-secondary pl-3">
                <p className="text-sm leading-5 text-white/65">Universitas Pelita Harapan</p>
                <p className="mt-1 text-base leading-6 font-semibold text-white">
                  <span className="font-normal text-white/75">Kelompok </span>
                  minim literasi
                </p>
              </div>
              <ul className="mt-4 space-y-1 text-sm leading-6 text-white/80">
                <li>Christian Jonathan Hiroshi Oroh</li>
                <li>Christopher Marchel Mark Gijoh</li>
                <li>Valdosi Hilkia Masehito Djarang</li>
              </ul>
              <div className="mt-6">
                <p className="text-[11px] leading-4 font-bold uppercase tracking-[0.14em] text-secondary">Dosen pembimbing</p>
                <p className="mt-1.5 text-base leading-6 font-semibold text-white">Dr. David Habsara Hareva, S.Si., MHS</p>
              </div>
            </div>
          </div>

          <nav aria-label="Sumber data">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-white">Sumber data</h2>
            <ul className="mt-2 space-y-1 text-sm leading-5 text-white/75">
              <li>
                <a href="https://sirup.inaproc.id/" target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center font-medium underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  SIRUP LKPP <FiExternalLink aria-hidden="true" className="ml-2 size-3.5" />
                </a>
              </li>
              <li>
                <a href="https://gisportal.binamarga.pu.go.id/" target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center font-medium underline decoration-white/25 underline-offset-4 hover:text-white hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
                  GIS Bina Marga <FiExternalLink aria-hidden="true" className="ml-2 size-3.5" />
                </a>
              </li>
            </ul>
          </nav>
        </div>

        <div className="mt-7 flex flex-col gap-2 border-t border-white/15 pt-3 text-xs leading-5 text-white/60 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-3xl">
            Website ini dibuat untuk lomba Multimedia in Action kategori Web in Action 2026.
          </p>
          <p className="shrink-0 sm:text-right">© 2026 SAKSI</p>
        </div>
      </div>
    </footer>
  );
}
