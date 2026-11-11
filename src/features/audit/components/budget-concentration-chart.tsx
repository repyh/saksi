"use client";

import { useState } from "react";
import Link from "next/link";
import { FiArrowRight, FiMap } from "react-icons/fi";
import type { BudgetExplorerNode } from "@/contracts/audit/budget-explorer.contract";

const percent = (value: number) => `${(value * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
const currency = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value);
const strokes = ["stroke-primary", "stroke-foreground"];
const fills = ["bg-primary", "bg-foreground"];

export function BudgetConcentrationChart({ data, onSelect }: { data: BudgetExplorerNode[]; onSelect: (path: number[]) => void }) {
  const [preview, setPreview] = useState<[number, number] | null>(null);
  const previewYear = preview ? data[preview[0]] : undefined;
  const previewGroup = preview && previewYear?.children?.[preview[1]];
  const curves = data.map((year) => {
    let count = 0;
    let budget = 0;
    return [{ x: 0, y: 0 }, ...(year.children ?? []).map((group) => {
      count += group.count;
      budget += group.budget;
      return { x: count / Math.max(1, year.count), y: budget / Math.max(1, year.budget) };
    })];
  });
  const maxShare = Math.max(0.01, ...data.flatMap((year) => (year.children ?? []).map((group) => group.budget / Math.max(1, year.budget))));
  const first = data[0];
  const last = data.at(-1);
  const shift = first && last ? ((last.children?.at(-1)?.budget ?? 0) / Math.max(1, last.budget) - (first.children?.at(-1)?.budget ?? 0) / Math.max(1, first.budget)) * 100 : 0;

  return (
    <div className="mt-10 space-y-12">
      {data.length > 1 && first && last && <div className="bg-secondary px-5 py-5 text-foreground sm:px-7 sm:py-6"><p className="max-w-4xl text-base leading-7 sm:text-lg">Porsi pagu pada 10% paket terbesar {shift >= 0 ? "naik" : "turun"} <strong className="font-extrabold">{Math.abs(shift).toLocaleString("id-ID", { maximumFractionDigits: 1 })} poin persentase</strong> dari {first.label} ke {last.label}.</p><p className="mt-1 text-sm">Median pagu paket {first.median === last.median ? `tetap ${currency(last.median ?? 0)}` : `berubah dari ${currency(first.median ?? 0)} menjadi ${currency(last.median ?? 0)}`}.</p></div>}
      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-center">
        <div className="min-w-0">
          <h3 className="mb-3 text-lg font-bold">Kurva distribusi pagu</h3>
          <div className="overflow-x-auto"><svg viewBox="0 0 680 390" role="img" aria-labelledby="concentration-plot-title concentration-plot-desc" className="w-full min-w-[580px]">
            <title id="concentration-plot-title">Kurva konsentrasi pagu per tahun</title>
            <desc id="concentration-plot-desc">Sumbu horizontal: persentase kumulatif paket, dari pagu terkecil. Sumbu vertikal: persentase kumulatif pagu. Kurva yang lebih jauh di bawah garis diagonal menunjukkan pagu lebih terkonsentrasi pada paket besar. Angka tersedia dalam tabel di bawah.</desc>
            {[0, 0.25, 0.5, 0.75, 1].map((tick) => <g key={tick}>
              <line x1="66" x2="640" y1={320 - tick * 280} y2={320 - tick * 280} className="stroke-border" />
              <text x="55" y={325 - tick * 280} textAnchor="end" className="fill-muted-foreground text-[12px]">{percent(tick)}</text>
              <text x={66 + tick * 574} y="345" textAnchor="middle" className="fill-muted-foreground text-[12px]">{percent(tick)}</text>
            </g>)}
            <text x="66" y="22" className="fill-foreground text-[12px] font-semibold">Pagu kumulatif</text>
            <text x="353" y="378" textAnchor="middle" className="fill-foreground text-[12px] font-semibold">Paket kumulatif · pagu terkecil → terbesar</text>
            <line x1="66" y1="320" x2="640" y2="40" strokeDasharray="6 6" className="stroke-muted-foreground" />
            {curves.map((points, index) => <g key={data[index].label}>
              <polyline points={points.map((point) => `${66 + point.x * 574},${320 - point.y * 280}`).join(" ")} fill="none" strokeWidth="3" strokeDasharray={index % 2 ? "8 4" : undefined} className={strokes[index % strokes.length]} />
              {points.slice(1, -1).map((point, pointIndex) => <circle key={pointIndex} cx={66 + point.x * 574} cy={320 - point.y * 280} r="4" className={`${strokes[index % strokes.length]} fill-white`} strokeWidth="2"><title>{`${data[index].label}: ${percent(point.x)} paket membentuk ${percent(point.y)} pagu`}</title></circle>)}
            </g>)}
          </svg></div>
          <div className="mt-2 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs">
            {data.map((year, index) => <span key={year.label} className="flex items-center gap-2"><span aria-hidden="true" className={`h-0.5 w-6 ${fills[index % fills.length]}`} />{year.label}{index % 2 ? " · garis putus-putus" : " · garis utuh"}</span>)}
            <span className="text-muted-foreground">Diagonal: acuan setiap paket berpagu sama</span>
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
          {data.map((year) => {
            const groups = year.children ?? [];
            const bottom = groups.slice(0, 5).reduce((sum, group) => sum + group.budget, 0);
            const top = groups.at(-1)?.budget ?? 0;
            return <div key={year.label}>
              <h4 className="text-base font-bold">{year.label}</h4>
              <p className="mt-2 text-lg font-bold tabular-nums text-primary">{percent(top / Math.max(1, year.budget))} <span className="text-sm font-normal text-foreground">pagu pada 10% paket terbesar</span></p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Separuh paket terkecil membentuk {percent(bottom / Math.max(1, year.budget))} pagu. Median paket: {currency(year.median ?? 0)}.</p>
            </div>;
          })}
        </div>
      </div>
      <div className="mt-12 bg-muted/40 px-4 py-8 sm:px-7 sm:py-10">
        <h3 className="text-lg font-bold">Rincian per kelompok pagu</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Setiap desil berisi sekitar 10% paket, diurutkan dari pagu terkecil (D1) hingga terbesar (D10). Tinggi batang menunjukkan bagian pagu kelompok dari total tahun yang sama. Pilih batang untuk melihat komposisi jenis pekerjaan dan wilayah.</p>
        <div className="mt-6 grid gap-8 sm:grid-cols-2">
          {data.map((year, yearIndex) => <div key={year.label}>
            <p className="mb-4 text-sm font-bold">{year.label} · bagian pagu tiap kelompok</p>
            <div className="grid h-48 grid-cols-10 gap-1 border-b border-border sm:gap-2">
              {year.children?.map((group, index) => {
                const share = group.budget / Math.max(1, year.budget);
                return <button key={group.label} type="button" disabled={!group.count} onMouseEnter={() => setPreview([yearIndex, index])} onFocus={() => setPreview([yearIndex, index])} onClick={() => onSelect([yearIndex, index])} aria-describedby="decile-action-preview" aria-label={`${year.label}, D${index + 1}: ${group.count.toLocaleString("id-ID")} paket, ${percent(share)} pagu. Lihat komposisi.`} title={`${group.count} paket · ${currency(group.minBudget ?? 0)}–${currency(group.maxBudget ?? 0)}`} className={`group flex h-full min-w-0 flex-col justify-end gap-2 rounded-sm transition-colors hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40 ${preview && preview[0] === yearIndex && preview[1] === index ? "bg-primary/10" : ""}`}>
                  <span className="text-center text-[10px] font-semibold tabular-nums sm:text-xs">{percent(share)}</span>
                  <span aria-hidden="true" style={{ height: `${share / maxShare * 130}px` }} className={`block w-full shrink-0 ${fills[yearIndex % fills.length]} group-hover:opacity-75`} />
                  <span className="inline-flex items-center justify-center gap-0.5 pb-2 text-center text-xs font-bold text-primary underline underline-offset-4">D{index + 1}<FiArrowRight aria-hidden="true" className="hidden size-3 sm:block" /></span>
                </button>;
              })}
            </div>
          </div>)}
        </div>
        {preview && previewGroup && previewYear && <div id="decile-action-preview" className="mt-6 flex flex-wrap items-center justify-between gap-5 bg-secondary/20 px-5 py-5">
          <div><p className="font-bold">{previewYear.label} · D{preview[1] + 1} · {previewGroup.count.toLocaleString("id-ID")} paket</p><p className="mt-1 text-sm text-muted-foreground">{currency(previewGroup.minBudget ?? 0)}–{currency(previewGroup.maxBudget ?? 0)} per paket</p><p className="mt-1 text-sm">Peta memuat {previewGroup.locatedCount?.toLocaleString("id-ID")} paket berlokasi. Paket lokasi umum tersedia lewat filter peta.</p></div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => preview && onSelect(preview)} className="inline-flex min-h-11 items-center gap-2 border border-primary px-4 py-2 text-sm font-bold text-primary hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Lihat rincian kelompok<FiArrowRight aria-hidden="true" /></button>
            {previewGroup.mapHref && <Link href={previewGroup.mapHref} className="inline-flex min-h-11 items-center gap-2 bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><FiMap aria-hidden="true" />Buka pilihan ini di Peta Pekerjaan<FiArrowRight aria-hidden="true" /></Link>}
          </div>
        </div>}
      </div>
    </div>
  );
}
