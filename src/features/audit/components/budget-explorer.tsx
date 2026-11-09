"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { FiArrowLeft, FiArrowRight, FiLink, FiMap } from "react-icons/fi";
import { BudgetConcentrationChart } from "./budget-concentration-chart";
import type { BudgetExplorerNode } from "@/contracts/audit/budget-explorer.contract";

const number = new Intl.NumberFormat("id-ID");
const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function BudgetExplorer({ data, snapshot, source, region }: { data: BudgetExplorerNode[]; snapshot: string; source: string; region: string }) {
  const chartHeading = useRef<HTMLHeadingElement>(null);
  const [path, setPath] = useState<number[]>([]);
  const [metric, setMetric] = useState<"budget" | "count">("budget");
  const [visible, setVisible] = useState(10);
  let nodes = data;
  const ancestors: BudgetExplorerNode[] = [];
  for (const index of path) {
    const node = nodes[index];
    ancestors.push(node);
    nodes = node.children ?? [];
  }
  const current = ancestors.at(-1);
  const records = current?.records;
  const total = nodes.reduce((sum, node) => sum + node[metric], 0);
  const maximum = Math.max(1, ...nodes.map((node) => node[metric]));
  const format = (value: number) => metric === "budget" ? money.format(value) : `${number.format(value)} paket`;
  const navigate = (next: number[]) => {
    setPath(next);
    setVisible(10);
    requestAnimationFrame(() => {
      chartHeading.current?.focus({ preventScroll: true });
      chartHeading.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
  };
  const mapHref = current?.mapHref ?? `/peta-pekerjaan?region=${encodeURIComponent(region)}`;
  const nextAction = path.length <= 1 ? "Lihat jenis pekerjaan" : path.length === 2 ? "Lihat kecamatan" : "Lihat paket";
  const titles = ["Distribusi pagu di balik paket tipikal", "Pilih kelompok peringkat pagu", "Jenis pekerjaan dalam kelompok ini", "Sebaran kecamatan dalam pilihan ini", "Paket pembentuk pilihan Anda"];

  return (
    <section aria-labelledby="budget-explorer-title" className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-primary">Analisis makro · Paket jalan 2025–2026</p>
            <h2 id="budget-explorer-title" className="max-w-3xl font-heading text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">Bagaimana pagu tersebar di antara paket?</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Bandingkan porsi kumulatif pagu dengan porsi paket, dari pagu terkecil sampai terbesar. Pilih kelompok untuk menelusuri rinciannya.</p>
          </div>
          {path.length === 0 && <Link href={mapHref} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><FiMap aria-hidden="true" className="size-5" />Buka Peta Pekerjaan<FiArrowRight aria-hidden="true" /></Link>}
        </div>


        {path.length > 0 && <nav aria-label="Jalur analisis" className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-3 text-sm">
          <button type="button" onClick={() => navigate([])} className="min-h-8 font-bold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary">Semua pekerjaan</button>
          {ancestors.map((node, index) => <span key={index} className="flex items-center gap-2"><span aria-hidden="true" className="text-muted-foreground">/</span><button type="button" aria-current={index === ancestors.length - 1 ? "step" : undefined} onClick={() => navigate(path.slice(0, index + 1))} className="min-h-8 text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary">{node.label}</button></span>)}
        </nav>}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
          <h3 ref={chartHeading} tabIndex={-1} className="scroll-mt-24 text-lg font-bold outline-none sm:text-xl" aria-live="polite">{titles[path.length]}</h3>
          {path.length > 0 && <div className="flex flex-wrap items-center gap-4"><Link href={mapHref} className="inline-flex min-h-12 items-center justify-center gap-2 bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"><FiMap aria-hidden="true" />Lihat pilihan ini di Peta Pekerjaan<FiArrowRight aria-hidden="true" /></Link><button type="button" onClick={() => navigate(path.slice(0, -1))} className="flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"><FiArrowLeft aria-hidden="true" />Kembali</button></div>}
        </div>

        {!records && path.length > 0 && <div className="mt-6 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{number.format(current?.count ?? 0)} paket dalam pilihan ini. Pilihan diteruskan ke peta. {current?.mapHref?.includes("umum=1") ? "Paket lokasi umum tersedia di daftar." : `Peta dimulai dengan ${number.format(current?.locatedCount ?? 0)} paket berlokasi; paket lokasi umum tersedia lewat filter.`}</p><div role="group" aria-label="Ukuran grafik" className="flex border border-border">
            {(["budget", "count"] as const).map((value) => <button key={value} type="button" aria-pressed={metric === value} onClick={() => setMetric(value)} className={`min-h-11 px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${metric === value ? "bg-primary text-white" : "hover:bg-muted"}`}>{value === "budget" ? "Pagu" : "Jumlah paket"}</button>)}
          </div></div>}

        {path.length === 0 ? <BudgetConcentrationChart data={data} onSelect={navigate} /> : records ? <div className="mt-6">
          <p className="mb-3 text-sm text-muted-foreground">{number.format(records.length)} paket · diurutkan menurut pagu terbesar</p>
          <ul className="divide-y divide-border">{records.slice(0, visible).map((record) => <li key={record.rup}><Link href={record.href} aria-label={`Buka ${record.name} di Peta Pekerjaan`} title="Buka di Peta Pekerjaan" className="group flex flex-col items-start justify-between gap-3 py-5 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-2 focus-visible:outline-primary sm:flex-row sm:items-center sm:gap-5"><div className="min-w-0"><p className="inline-flex items-center gap-2 text-sm font-bold leading-6 group-hover:text-primary"><span>{record.name}</span><FiLink aria-hidden="true" className="size-4 shrink-0 text-primary" /></p><p className="mt-1 text-xs text-muted-foreground">RUP {record.rup} · {record.precision}</p></div><span className="shrink-0 text-sm font-bold tabular-nums">{money.format(record.budget)}</span></Link></li>)}</ul>
          {visible < records.length && <button type="button" onClick={() => setVisible(visible + 10)} className="mt-5 min-h-11 border border-primary px-5 text-sm font-bold text-primary hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary">Tampilkan 10 paket berikutnya</button>}
        </div> : <div className="mt-7 space-y-2">
          <p className="mb-4 text-xs text-muted-foreground">Panjang batang dibandingkan nilai terbesar dalam pilihan ini. Persentase memakai total pilihan sebagai penyebut.</p>
          {nodes.map((node, index) => <button key={node.label} type="button" disabled={!node.count} aria-label={`${node.label}. ${nextAction}.`} onClick={() => navigate([...path, index])} className="group grid min-h-16 w-full gap-2 rounded-sm px-3 py-3 text-left transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-default disabled:opacity-50 sm:grid-cols-[14rem_1fr] sm:gap-6">
            <span className="flex flex-col justify-center gap-1 text-sm font-semibold">{node.label}<span className="inline-flex items-center gap-2 text-xs font-bold text-primary underline decoration-primary/40 underline-offset-4">{nextAction}<FiArrowRight aria-hidden="true" /></span></span>
            <span className="min-w-0"><span className="mb-2 flex justify-between gap-3 text-xs tabular-nums"><span>{format(node[metric])}</span><span>{total ? (node[metric] / total * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 }) : "0"}%</span></span><span className="block h-3 bg-muted"><span className="block h-full bg-primary group-hover:bg-primary/80" style={{ width: `${node[metric] / maximum * 100}%` }} /></span></span>
          </button>)}
          {nodes.length === 0 && <p className="py-8 text-sm text-muted-foreground">Tidak ada paket pada pilihan ini.</p>}
        </div>}

        {!records && <details className="mt-8 text-sm"><summary className="cursor-pointer font-semibold text-primary">Lihat angka dalam tabel</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left"><caption className="sr-only">Angka grafik {current?.label ?? "per tahun"}</caption><thead><tr className="border-b border-border"><th scope="col" className="py-3">Pilihan</th><th scope="col" className="py-3 text-right">Paket</th><th scope="col" className="py-3 text-right">Pagu</th></tr></thead><tbody>{(path.length ? nodes : data.flatMap((year) => (year.children ?? []).map((work) => ({ ...work, label: `${year.label} · ${work.label}` })))).map((node, index) => <tr key={node.label} className="even:bg-muted/40"><th scope="row" className="pr-4 font-normal"><button type="button" disabled={!node.count} onClick={() => navigate(path.length ? [...path, index] : [Math.floor(index / (data[0]?.children?.length || 1)), index % (data[0]?.children?.length || 1)])} className="min-h-11 py-3 text-left text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary disabled:text-muted-foreground">{node.label}</button></th><td className="text-right tabular-nums">{number.format(node.count)}</td><td className="text-right tabular-nums">{money.format(node.budget)}</td></tr>)}</tbody></table></div></details>}
        <div className="mt-10 space-y-2 text-xs leading-5 text-muted-foreground">
          <p className="font-bold text-primary">DATA RESMI (SIRUP / BINA MARGA)</p><p>Snapshot {snapshot} · {source} · Pagu merupakan rencana anggaran, bukan nilai pekerjaan selesai.</p>
          <p>Desil dihitung ulang per tahun dengan jumlah paket hampir sama; D1 berpagu terkecil, D10 terbesar. Pagu yang sama diurutkan menurut kode RUP sehingga dapat melintasi batas kelompok. Konsentrasi menunjukkan struktur portofolio, bukan ukuran pemerataan, kebutuhan, atau kinerja.</p><p>Jenis pekerjaan dikelompokkan dari nama paket; kategori permukaan jalan juga mencakup paket jalan yang tidak menyebut drainase, penahan, atau jembatan. Sebaran wilayah belum dibandingkan dengan panjang, kondisi jalan, atau jumlah penduduk.</p>
        </div>
      </div>
    </section>
  );
}
