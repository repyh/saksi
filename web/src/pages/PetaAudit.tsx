import { useCallback, useEffect, useMemo, useState } from "react";
import FilterBar from "../components/FilterBar";
import Peta from "../components/Peta";
import PaketPanel from "../components/PaketPanel";
import { StempelResmi } from "../components/Badge";
import { Seru } from "../components/Ikon";
import {
  angka,
  daftarKecamatan,
  muatData,
  persen,
  rupiahRingkas,
  statistik,
  terapkanFilter,
  type Dataset,
  type Filter,
  type Paket,
} from "../lib/paket";

const FILTER_AWAL: Filter = { tahun: "semua", kecamatan: "semua", jenis: "semua" };

function Sel({
  label,
  nilai,
  catatan,
  tone,
}: {
  label: string;
  nilai: string;
  catatan: string;
  tone?: "saksi" | "redup";
}) {
  return (
    <div className="px-3 py-3">
      <dt className="label">{label}</dt>
      <dd
        className="num mt-1 whitespace-nowrap text-xl leading-none xl:text-2xl"
        style={{ color: tone === "redup" ? "var(--color-muted)" : "var(--color-ink)" }}
      >
        {nilai}
      </dd>
      <dd
        className="num mt-1.5 text-2xs leading-tight"
        style={{ color: tone === "saksi" ? "var(--color-accent-deep)" : "var(--color-muted)" }}
      >
        {catatan}
      </dd>
    </div>
  );
}

export default function PetaAudit({ paketAwal }: { paketAwal?: string | null }) {
  const [data, setData] = useState<Dataset | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>(FILTER_AWAL);
  const [terpilih, setTerpilih] = useState<Paket | null>(null);

  const muat = useCallback(async (signal?: AbortSignal) => {
    setGalat(null);
    try {
      const d = await muatData(signal);
      setData(d);
    } catch (e: unknown) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setGalat(e instanceof Error ? e.message : "Data paket gagal dimuat.");
    }
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void muat(ac.signal);
    return () => ac.abort();
  }, [muat]);

  const stats = useMemo(() => (data ? statistik(data.paket, data.desa) : null), [data]);
  const kecamatan = useMemo(() => (data ? daftarKecamatan(data.paket) : []), [data]);
  const hasil = useMemo(
    () => (data ? terapkanFilter(data.paket, filter) : []),
    [data, filter],
  );

  useEffect(() => {
    if (!terpilih) return;
    if (!hasil.some((p) => p.kode_rup === terpilih.kode_rup)) setTerpilih(null);
  }, [hasil, terpilih]);

  /* Dibuka dari tautan `#/?paket=<kode>` (mis. dari konfirmasi laporan). */
  useEffect(() => {
    if (!data || !paketAwal || terpilih) return;
    const p = data.paket.find((x) => x.kode_rup === paketAwal);
    if (p) setTerpilih(p);
  }, [data, paketAwal, terpilih]);

  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto max-w-[1560px] px-5">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 py-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-ink">
                Peta audit jalan Kab. Tangerang
              </h1>
              <p className="mt-1 max-w-[74ch] text-sm leading-relaxed text-muted">
                {stats ? (
                  <>
                    <span className="num text-ink-soft">{angka(stats.paket)}</span> paket jalan,
                    jembatan, dan drainase TA 2025–2026. Setiap titik menyatakan cara ia diketahui;
                    paket tanpa penanda tempat tidak dipetakan.
                  </>
                ) : (
                  "Paket jalan, jembatan, dan drainase TA 2025–2026 dengan presisi lokasi yang dinyatakan terbuka."
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <StempelResmi />
              <span className="label">SIRUP · 29 Okt 2026</span>
            </div>
          </div>

          <dl className="metrik border-t border-line">
            <Sel
              label="Paket jalan"
              nilai={stats ? angka(stats.paket) : "—"}
              catatan={
                stats
                  ? Object.entries(stats.perTahun)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([t, n]) => `${t}: ${angka(n)}`)
                      .join(" · ")
                  : "memuat data…"
              }
            />
            <Sel
              label="Pagu"
              nilai={stats ? rupiahRingkas(stats.pagu) : "—"}
              catatan={stats ? `median ${rupiahRingkas(stats.medianPagu)}` : "memuat data…"}
            />
            <Sel
              label="Desa tersentuh"
              nilai={stats ? angka(stats.desa) : "—"}
              catatan={stats ? `dari ${angka(stats.desaTotal)} desa · ${stats.kecamatan} kecamatan` : "—"}
            />
            <Sel
              label="Bertitik"
              nilai={stats ? persen(stats.persenTitik) : "—"}
              catatan={stats ? `${angka(stats.bertitik)} dari ${angka(stats.paket)} paket` : "—"}
            />
            <Sel
              label="Koridor ruas"
              nilai={stats ? angka(stats.koridor) : "—"}
              catatan="garis antar dua desa"
            />
            <Sel
              label="Tanpa lokasi"
              nilai={stats ? angka(stats.tanpaLokus) : "—"}
              catatan="tidak dipetakan · hanya di tabel"
              tone="redup"
            />
          </dl>
        </div>
      </section>

      <FilterBar
        filter={filter}
        onUbah={(f) => setFilter(f)}
        kecamatan={kecamatan}
        hasil={hasil.length}
        total={data?.paket.length ?? 0}
        onReset={() => setFilter(FILTER_AWAL)}
      />

      {galat ? (
        <div className="mx-auto max-w-[1560px] px-5 py-16">
          <div className="callout callout--saksi max-w-[60ch]">
            <Seru size={18} className="mt-0.5 flex-none" />
            <div>
              <strong className="block font-semibold text-ink">Data paket gagal dimuat.</strong>
              <span className="text-ink-soft">{galat}</span>
              <div className="mt-3">
                <button type="button" className="btn btn--sm" onClick={() => muat()}>
                  Coba lagi
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mx-auto max-w-[1560px]">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_470px]">
            <div className="h-[60vh] min-h-[420px] border-b border-line lg:h-[max(62vh,calc(100vh-20rem))] lg:min-h-[520px] lg:border-b-0">
              {data ? (
                <Peta
                  paket={hasil}
                  desa={data.desa}
                  terpilih={terpilih}
                  onPilih={(p) => setTerpilih(p)}
                />
              ) : (
                <div className="grid h-full place-items-center bg-paper-recess">
                  <div className="text-center">
                    <p className="label">Memuat register paket…</p>
                    <p className="num mt-2 text-2xs text-muted">
                      public/data/paket.json · 3.331 titik
                    </p>
                  </div>
                </div>
              )}
            </div>

            <aside className="h-[72vh] min-h-[420px] border-line lg:h-[max(62vh,calc(100vh-20rem))] lg:border-l">
              <PaketPanel
                paket={hasil}
                terpilih={terpilih}
                onPilih={(p) => setTerpilih(p)}
                onTutup={() => setTerpilih(null)}
              />
            </aside>
          </div>
        </div>
      )}
    </>
  );
}
