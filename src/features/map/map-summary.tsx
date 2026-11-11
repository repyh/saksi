"use client";

import { useMemo, useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import type { RoadAreaAggregate, RoadPackageTotals } from "@/contracts/packages/road-package.contract";
import { ROAD_WORK_LABELS, ROAD_WORK_TYPES } from "@/contracts/packages/road-work";
import { formatRupiahCompact, formatRupiahFull } from "./road-types";
import { WORK_COLORS, WORK_MIXED_COLOR, dominantWork, type WorkCounts } from "./work-encoding";

interface MapSummaryProps {
  /** Ringkasan kohort filter aktif; tidak berubah saat peta digeser. */
  totals: RoadPackageTotals;
  /** Seluruh paket region ini, sebelum filter, untuk penyebut kecil di kartu Paket. */
  totalCount: number;
  loading: boolean;
  /** Agregat kecamatan lengkap, dipakai tabel ringkasan. */
  kecamatan: Record<string, RoadAreaAggregate>;
  onSelectDistrict: (district: string) => void;
}

function persen(bagian: number, total: number) {
  if (!total) return "0%";
  return `${((bagian / total) * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

function Ringkasan({ label, nilai, catatan, judul, catatanKelas }: { label: string; nilai: string; catatan?: string; judul?: string; catatanKelas?: string }) {
  return (
    <div className="min-w-0 basis-1/2 border-l border-border px-3 py-1.5 first:border-l-0 sm:basis-1/4 lg:basis-0 lg:flex-1" title={judul}>
      <p className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className="mt-0.5 flex items-baseline gap-1.5">
        <span className="font-heading text-base font-extrabold tabular-nums leading-tight tracking-tight text-foreground">{nilai}</span>
        {catatan ? <span className={`truncate font-sans text-[10px] text-muted-foreground ${catatanKelas ?? ""}`}>{catatan}</span> : null}
      </p>
    </div>
  );
}

/** Label jenis versi pendek untuk baris ringkas: "Permukaan", "Drainase", "Jembatan". */
function labelRingkas(category: keyof typeof WORK_COLORS) {
  return ROAD_WORK_LABELS[category].split(" & ")[0];
}

/**
 * Angka kohort filter di atas peta. Sebelumnya angka hanya muncul per baris register
 * dan sekilas di tooltip, sehingga peta audit tidak menyatakan isinya sendiri.
 */
export function MapSummary({ totals, totalCount, loading, kecamatan, onSelectDistrict }: MapSummaryProps) {
  const [tableOpen, setTableOpen] = useState(false);
  const workCounts = totals.workCounts as WorkCounts;
  const komposisi = ROAD_WORK_TYPES.filter((category) => workCounts[category] > 0);
  const presisiKota = Math.max(0, totals.count - totals.located);
  const barisKecamatan = useMemo(
    () =>
      Object.values(kecamatan)
        .filter((area) => area.count > 0)
        .sort((a, b) => b.budget - a.budget),
    [kecamatan],
  );

  return (
    <section aria-label="Ringkasan paket pada filter aktif" aria-busy={loading} className="border-b border-border bg-white">
      {/* Satu baris: empat angka, komposisi jenis, dan pintasan tabel di ujung kanan. */}
      <div className="flex flex-wrap items-stretch">
        <Ringkasan
          label="Paket"
          nilai={totals.count.toLocaleString("id-ID")}
          catatan={`dari ${totalCount.toLocaleString("id-ID")}`}
        />
        <Ringkasan
          label="Pagu"
          nilai={formatRupiahCompact(totals.budget)}
          judul={`${formatRupiahFull(totals.budget)} · jumlah pagu seluruh paket pada filter aktif`}
        />
        <Ringkasan
          label="Rata-rata / paket"
          nilai={formatRupiahCompact(totals.count ? totals.budget / totals.count : 0)}
          judul="Pagu dibagi jumlah paket pada filter aktif"
        />
        <Ringkasan
          label="Rekam penyedia"
          nilai={`${totals.withContract.toLocaleString("id-ID")} · ${persen(totals.withContract, totals.count)}`}
          catatan={totals.vendors ? `${totals.vendors.toLocaleString("id-ID")} penyedia unik` : "belum ada rekam"}
          catatanKelas="hidden xl:inline"
          judul="Paket yang punya rekam LPSE atau Data INAPROC, beserta jumlah penyedia unik. Bukan penilaian kinerja."
        />

        <div className="min-w-0 flex-1 basis-[10rem] border-l border-border px-3 py-1.5 sm:basis-[14rem] lg:flex-[1.6]">
          <p className="font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Jenis pekerjaan</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex h-1.5 w-10 shrink-0 overflow-hidden bg-muted" aria-hidden="true">
              {komposisi.map((category) => (
                <span
                  key={category}
                  style={{ width: `${(workCounts[category] / Math.max(1, totals.count)) * 100}%`, backgroundColor: WORK_COLORS[category] }}
                />
              ))}
            </div>
            <ul className="flex min-w-0 flex-wrap items-baseline gap-x-2 font-sans text-[10px] leading-3 text-muted-foreground">
              {komposisi.map((category) => (
                <li key={category} className="whitespace-nowrap">
                  {labelRingkas(category)} <span className="tabular-nums text-foreground/80">{workCounts[category].toLocaleString("id-ID")}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-3 border-l border-border px-3 py-1.5">
          {presisiKota > 0 ? (
            <span className="font-sans text-[10px] text-muted-foreground">{presisiKota.toLocaleString("id-ID")} paket presisi kota</span>
          ) : null}
          <button
            type="button"
            onClick={() => setTableOpen((open) => !open)}
            aria-expanded={tableOpen}
            className="flex min-h-7 items-center gap-1 whitespace-nowrap font-sans text-[11px] font-bold text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Tabel per kecamatan
            {tableOpen ? <FiChevronUp className="size-3" aria-hidden="true" /> : <FiChevronDown className="size-3" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {tableOpen ? (
        <div className="max-h-72 overflow-auto border-t border-border">
          <table className="w-full min-w-[34rem] max-w-4xl table-fixed border-collapse font-sans text-[11px]">
            <caption className="sr-only">Ringkasan paket jalan per kecamatan pada filter aktif</caption>
            <colgroup>
              <col style={{ width: "32%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "26%" }} />
            </colgroup>
            <thead className="sticky top-0 bg-muted/40 text-left">
              <tr className="font-sans text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                <th scope="col" className="px-3 py-1.5 font-bold">Kecamatan</th>
                <th scope="col" className="px-3 py-1.5 text-right font-bold">Paket</th>
                <th scope="col" className="px-3 py-1.5 text-right font-bold">Pagu</th>
                <th scope="col" className="px-3 py-1.5 text-right font-bold">Ber-rekam</th>
                <th scope="col" className="px-3 py-1.5 font-bold">Jenis dominan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {barisKecamatan.map((area) => {
                const dominant = dominantWork(area.workCounts as WorkCounts, area.count);
                return (
                  <tr key={area.label} className="tabular-nums">
                    <th scope="row" className="px-3 py-1.5 text-left font-semibold">
                      <button
                        type="button"
                        onClick={() => onSelectDistrict(area.label)}
                        title={`Saring register ke Kecamatan ${area.label}`}
                        className="text-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        {area.label}
                      </button>
                    </th>
                    <td className="px-3 py-1.5 text-right">{area.count.toLocaleString("id-ID")}</td>
                    <td className="px-3 py-1.5 text-right">{formatRupiahCompact(area.budget)}</td>
                    <td className="px-3 py-1.5 text-right">{persen(area.withContract, area.count)}</td>
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="size-2 shrink-0"
                          style={{ backgroundColor: dominant ? WORK_COLORS[dominant] : WORK_MIXED_COLOR }}
                          aria-hidden="true"
                        />
                        {dominant ? ROAD_WORK_LABELS[dominant] : "Campuran"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
