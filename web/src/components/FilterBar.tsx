import type { Filter, JenisPekerjaan } from "../lib/paket";
import { angka } from "../lib/paket";

const TAHUN: Array<{ nilai: Filter["tahun"]; label: string }> = [
  { nilai: "semua", label: "Semua" },
  { nilai: 2025, label: "2025" },
  { nilai: 2026, label: "2026" },
];

const JENIS: Array<{ nilai: JenisPekerjaan; label: string }> = [
  { nilai: "semua", label: "Semua" },
  { nilai: "permukaan", label: "Permukaan" },
  { nilai: "drainase", label: "Drainase" },
  { nilai: "jembatan", label: "Jembatan" },
];

export default function FilterBar({
  filter,
  onUbah,
  kecamatan,
  hasil,
  total,
  onReset,
}: {
  filter: Filter;
  onUbah: (f: Filter) => void;
  kecamatan: string[];
  hasil: number;
  total: number;
  onReset: () => void;
}) {
  const aktif =
    filter.tahun !== "semua" || filter.kecamatan !== "semua" || filter.jenis !== "semua";

  return (
    <div className="sticky top-14 z-30 border-b border-line bg-paper-recess/95">
      <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3">
        <div className="flex items-center gap-2.5">
          <span className="label hidden sm:inline">Tahun</span>
          <div className="seg" role="group" aria-label="Filter tahun anggaran">
            {TAHUN.map((t) => (
              <button
                key={String(t.nilai)}
                type="button"
                aria-pressed={filter.tahun === t.nilai}
                onClick={() => onUbah({ ...filter, tahun: t.nilai })}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-2.5">
          <label className="label hidden sm:inline" htmlFor="filter-kecamatan">
            Kecamatan
          </label>
          <select
            id="filter-kecamatan"
            aria-label="Filter kecamatan"
            className="select min-h-8 w-[168px] py-0 text-xs"
            value={filter.kecamatan}
            onChange={(e) => onUbah({ ...filter, kecamatan: e.target.value })}
          >
            <option value="semua">Semua kecamatan</option>
            {kecamatan.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-0 items-center gap-2.5">
          <label className="label hidden sm:inline" htmlFor="filter-jenis">
            Pekerjaan
          </label>
          <select
            id="filter-jenis"
            aria-label="Filter jenis pekerjaan"
            className="select min-h-8 w-[148px] py-0 text-xs sm:hidden"
            value={filter.jenis}
            onChange={(e) => onUbah({ ...filter, jenis: e.target.value as JenisPekerjaan })}
          >
            {JENIS.map((j) => (
              <option key={j.nilai} value={j.nilai}>
                {j.label}
              </option>
            ))}
          </select>
          <div className="seg hidden sm:inline-flex" role="group" aria-label="Filter jenis pekerjaan">
            {JENIS.map((j) => (
              <button
                key={j.nilai}
                type="button"
                aria-pressed={filter.jenis === j.nilai}
                onClick={() => onUbah({ ...filter, jenis: j.nilai })}
              >
                {j.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <span className="num text-xs text-ink-soft" aria-live="polite">
            <strong className="font-medium">{angka(hasil)}</strong>
            <span className="text-muted"> / {angka(total)} paket</span>
          </span>
          {aktif && (
            <button type="button" className="btn btn--ghost btn--sm" onClick={onReset}>
              Atur ulang
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
