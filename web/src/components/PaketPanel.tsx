import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Paket } from "../lib/paket";
import {
  angka,
  bulanIndo,
  dalamJendela,
  koordinat,
  labelPresisi,
  lokasiPaket,
  rupiahPenuh,
  rupiahRingkas,
} from "../lib/paket";
import { BadgePresisi, Glyph, StempelResmi } from "./Badge";
import { PanahKanan, PanahKiri, Seru } from "./Ikon";

const AWAL = 60;
const LANGKAH = 60;

function Baris({ nilai, label }: { nilai: ReactNode; label: string }) {
  return (
    <div className="grid grid-cols-[108px_1fr] items-baseline gap-3 border-b border-line py-2 last:border-b-0">
      <dt className="label leading-4">{label}</dt>
      <dd className="min-w-0 text-sm leading-5 text-ink-soft">{nilai}</dd>
    </div>
  );
}

export default function PaketPanel({
  paket,
  terpilih,
  onPilih,
  onTutup,
}: {
  paket: Paket[];
  terpilih: Paket | null;
  onPilih: (p: Paket) => void;
  onTutup: () => void;
}) {
  const [batas, setBatas] = useState(AWAL);
  const gulir = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setBatas(AWAL);
  }, [paket]);

  useEffect(() => {
    if (terpilih) gulir.current?.scrollTo({ top: 0 });
  }, [terpilih]);

  const urut = useMemo(
    () => [...paket].sort((a, b) => b.tahun - a.tahun || b.pagu - a.pagu),
    [paket],
  );

  const tanpaLokus = useMemo(
    () => paket.reduce((n, p) => (p.lat == null ? n + 1 : n), 0),
    [paket],
  );

  /* ── Detail ─────────────────────────────────────────────── */
  if (terpilih) {
    const p = terpilih;
    const jendela = dalamJendela(p.bulan);
    return (
      <div className="flex h-full min-h-0 flex-col bg-card">
        <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
          <button type="button" className="btn btn--ghost btn--sm" onClick={onTutup}>
            <PanahKiri size={14} /> Kembali ke daftar
          </button>
          <span className="label">Detail paket</span>
        </div>

        <div ref={gulir} className="min-h-0 flex-1 overflow-auto px-4 pb-6 pt-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <BadgePresisi paket={p} />
            <StempelResmi />
          </div>

          <h2 className="mt-3 text-lg font-semibold leading-snug text-ink">{p.nama}</h2>
          <p className="num mt-1 text-xs text-muted">RUP {p.kode_rup}</p>

          <dl className="mt-4 border-t border-line">
            <Baris
              nilai={
                <span className="num text-base text-ink">
                  {rupiahPenuh(p.pagu)}{" "}
                  <span className="text-xs text-muted">({rupiahRingkas(p.pagu)})</span>
                </span>
              }
              label="Pagu"
            />
            <Baris nilai={<span className="num">{p.tahun}</span>} label="Tahun" />
            <Baris nilai={p.satker} label="Satker" />
            <Baris nilai={p.metode} label="Metode" />
            <Baris nilai={p.sumber.replace(/,\s*$/, "")} label="Sumber" />
            <Baris nilai={bulanIndo(p.bulan)} label="Pelaksanaan" />
            <Baris nilai={lokasiPaket(p)} label="Lokasi" />
            {p.kecamatan_resmi && <Baris nilai={p.kecamatan_resmi} label="Kecamatan" />}
            <Baris nilai={labelPresisi(p)} label="Presisi" />
            {p.lat != null && p.lon != null && (
              <Baris nilai={<span className="num">{koordinat(p.lat, p.lon)}</span>} label="Koordinat" />
            )}
            <Baris nilai={p.lokasi_mikro ?? "—"} label="Lokasi mikro" />
          </dl>

          {jendela ? (
            <div className="callout callout--saksi mt-4">
              <Seru size={18} className="mt-0.5 flex-none" />
              <div>
                <strong className="block text-xs font-semibold text-ink">
                  Dalam jendela pemeliharaan
                </strong>
                <span className="text-2xs leading-relaxed text-ink-soft">
                  Pelaksanaan {bulanIndo(p.bulan)} — ≤12 bulan. Laporan kerusakan pada rentang ini
                  menjadi dasar menagih perbaikan sebelum retensi dicairkan.
                </span>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-2xs leading-relaxed text-muted">
              Pelaksanaan {bulanIndo(p.bulan)} — di luar jendela pemeliharaan 12 bulan.
            </p>
          )}

          <p className="mt-4 border-t border-line pt-3 text-2xs leading-relaxed text-muted">
            Sumber: SIRUP Inaproc, snapshot 29 Oktober 2026.
          </p>
        </div>

        <div className="flex-none border-t border-line bg-card p-3">
          <a className="btn btn--saksi w-full" href={`#/lapor?paket=${p.kode_rup}`}>
            Laporkan kerusakan <PanahKanan size={15} />
          </a>
          <p className="mt-1.5 text-2xs leading-relaxed text-muted">
            Laporan membawa nomor RUP ini. Titik peta diturunkan dari nama paket, bukan koordinat
            resmi.
          </p>
        </div>
      </div>
    );
  }

  /* ── Daftar ─────────────────────────────────────────────── */
  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <div className="flex-none border-b border-line px-4 py-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="label label-strong">Register paket</h2>
          <span className="num text-xs text-muted">
            {angka(paket.length)}
            {tanpaLokus > 0 && <span className="text-2xs"> · {angka(tanpaLokus)} tanpa lokasi</span>}
          </span>
        </div>
        <p className="mt-1 text-2xs text-muted">
          Tahun terbaru lebih dulu · klik baris untuk melihat lokasi
        </p>
      </div>

      <div ref={gulir} className="min-h-0 flex-1 overflow-auto">
        {paket.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-ink-soft">Tidak ada paket pada kombinasi filter ini.</p>
            <p className="mt-1 text-2xs text-muted">
              Coba tahun lain atau pilih “Semua kecamatan”.
            </p>
          </div>
        ) : (
          <table className="register table-fixed">
            <thead>
              <tr>
                <th scope="col">Paket</th>
                <th scope="col" className="w-[86px] text-right">
                  Pagu
                </th>
                <th scope="col" className="hidden w-[116px] xl:table-cell">
                  Presisi
                </th>
              </tr>
            </thead>
            <tbody>
              {urut.slice(0, batas).map((p) => (
                <tr
                  key={p.kode_rup}
                  tabIndex={0}
                  onClick={() => onPilih(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onPilih(p);
                    }
                  }}
                  title={p.lat == null ? "Tanpa penanda lokasi — tidak dipetakan" : p.nama}
                >
                  <td>
                    <div className="flex items-start gap-2">
                      <Glyph presisi={p.presisi_peta} size={9} className="mt-[5px]" />
                      <div className="min-w-0">
                        <div className="line-clamp-2 leading-snug text-ink">{p.nama}</div>
                        <div className="mt-1 line-clamp-2 text-2xs leading-snug text-muted">
                          {lokasiPaket(p)}
                          {p.kecamatan_resmi && ` · ${p.kecamatan_resmi}`}
                          {" · "}
                          <span className="num">{p.tahun}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="num whitespace-nowrap text-right text-xs text-ink">
                    {rupiahRingkas(p.pagu)}
                  </td>
                  <td className="hidden whitespace-nowrap xl:table-cell">
                    <BadgePresisi paket={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {batas < paket.length && (
          <div className="flex flex-col items-center gap-2 px-4 py-5">
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => setBatas((n) => n + LANGKAH)}
            >
              Muat {Math.min(LANGKAH, paket.length - batas)} paket lagi
            </button>
            <span className="num text-2xs text-muted">
              {angka(batas)} dari {angka(paket.length)} ditampilkan
            </span>
          </div>
        )}

        <p className="border-t border-line px-4 py-3 text-2xs leading-relaxed text-muted">
          Paket bertanda garis putus tidak punya penanda lokasi dan hanya tampil di tabel —
          <span className="text-ink-soft"> tidak dipetakan</span>.
        </p>
      </div>
    </div>
  );
}
