import { Component, useEffect, useState, type ReactNode } from "react";
import PetaAudit from "./pages/PetaAudit";
import Lapor from "./pages/Lapor";
import { Seru } from "./components/Ikon";

type Rute = { path: string; params: URLSearchParams };

function bacaRute(): Rute {
  const hash = window.location.hash.replace(/^#/, "");
  const [path, qs] = hash.split("?");
  return {
    path: path && path !== "" ? path : "/",
    params: new URLSearchParams(qs ?? ""),
  };
}

const NAV: Array<{ href: string; label: string; path: string }> = [
  { href: "#/", label: "Peta audit", path: "/" },
  { href: "#/lapor", label: "Lapor", path: "/lapor" },
];

/** Halaman tetap hidup bila satu layar gagal — demo tidak boleh jadi halaman kosong. */
class BatasGalat extends Component<{ children: ReactNode }, { galat: Error | null }> {
  state = { galat: null as Error | null };

  static getDerivedStateFromError(galat: Error) {
    return { galat };
  }

  render() {
    if (this.state.galat) {
      return (
        <div className="mx-auto max-w-[760px] px-5 py-16">
          <div className="callout callout--saksi">
            <Seru size={18} className="mt-0.5 flex-none" />
            <div>
              <strong className="block font-semibold text-ink">Layar ini gagal ditampilkan.</strong>
              <span className="text-ink-soft">
                Data tetap utuh di perangkat Anda. Muat ulang halaman, atau kembali ke peta audit.
              </span>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  onClick={() => window.location.reload()}
                >
                  Muat ulang
                </button>
                <a className="btn btn--sm" href="#/">
                  Peta audit
                </a>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [rute, setRute] = useState<Rute>(() => bacaRute());

  useEffect(() => {
    const on = () => {
      setRute(bacaRute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const halaman =
    rute.path === "/lapor" ? (
      <Lapor
        contoh={rute.params.get("contoh") === "1"}
        paketAwal={rute.params.get("paket")}
      />
    ) : (
      <PetaAudit paketAwal={rute.params.get("paket")} />
    );

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <a
        href="#isi"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:border focus:border-ink focus:bg-card focus:px-3 focus:py-2 focus:text-sm"
      >
        Lompat ke isi
      </a>

      <header className="sticky top-0 z-40 bg-paper">
        <div className="witness-rule" />
        <div className="border-b border-line">
          <div className="mx-auto flex h-14 max-w-[1560px] items-center gap-5 px-5">
            <a href="#/" className="flex min-w-0 items-center gap-3 no-underline">
              <span className="num text-[15px] font-semibold tracking-[0.28em] text-ink">
                SAKSI
              </span>
              <span className="hidden max-w-[40ch] border-l border-line pl-3 text-2xs leading-tight text-muted xl:block xl:whitespace-nowrap">
                Sistem Akuntabilitas &amp; Komparasi Spasial Infrastruktur
              </span>
            </a>

            <nav className="ml-auto flex items-center gap-5" aria-label="Navigasi utama">
              {NAV.map((n) => {
                const aktif = rute.path === n.path;
                return (
                  <a
                    key={n.href}
                    href={n.href}
                    aria-current={aktif ? "page" : undefined}
                    className="relative flex h-14 items-center font-mono text-2xs uppercase tracking-[0.14em] no-underline transition-colors"
                    style={{ color: aktif ? "var(--color-ink)" : "var(--color-muted)" }}
                  >
                    {n.label}
                    <span
                      className={`absolute bottom-0 left-0 right-0 h-[2px] ${
                        aktif ? "bg-accent" : "bg-transparent"
                      }`}
                    />
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      <main id="isi" className="flex-1">
        <BatasGalat>{halaman}</BatasGalat>
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="mx-auto grid max-w-[1560px] gap-3 px-5 py-6 text-2xs leading-relaxed text-muted md:grid-cols-[1fr_auto] md:items-start">
          <p className="max-w-[80ch]">
            <span className="num font-medium text-ink-soft">SAKSI</span> — prototipe untuk MIA 2026 /
            Web In Action. Data paket: SIRUP Inaproc (snapshot 29 Oktober 2026) dan gazetteer desa BPS
            <span className="num"> 3603</span>. Titik peta diturunkan dari teks nama paket, bukan
            koordinat resmi.
          </p>
          <p className="text-ink-soft">
            Bukan kanal resmi pemerintah. Tidak menyimpulkan pelanggaran.
          </p>
        </div>
      </footer>
    </div>
  );
}
