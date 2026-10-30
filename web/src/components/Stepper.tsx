import { Centang } from "./Ikon";

export type Langkah = 1 | 2 | 3;

const JUDUL: Record<Langkah, { judul: string; petunjuk: string }> = {
  1: { judul: "Foto", petunjuk: "Bukti & privasi" },
  2: { judul: "Kerusakan", petunjuk: "Jenis, penyebab, ukuran" },
  3: { judul: "Lokasi", petunjuk: "Desa & paket terkait" },
};

export default function Stepper({
  aktif,
  selesai,
  onPilih,
}: {
  aktif: Langkah;
  selesai: Langkah[];
  onPilih: (l: Langkah) => void;
}) {
  const langkah: Langkah[] = [1, 2, 3];

  return (
    <nav className="stepper" aria-label="Langkah laporan">
      {langkah.map((l) => {
        const sudah = l < aktif && selesai.includes(l);
        return (
          <button
            key={l}
            type="button"
            className="step"
            aria-current={aktif === l ? "step" : undefined}
            data-selesai={sudah ? "true" : undefined}
            data-nonaktif={!sudah && aktif !== l ? "true" : undefined}
            onClick={() => onPilih(l)}
          >
            <span
              className="num grid h-5 w-5 flex-none place-items-center border text-2xs"
              style={{
                borderColor: aktif === l ? "var(--color-ink)" : "var(--color-line-strong)",
                background: aktif === l ? "var(--color-ink)" : "transparent",
                color: aktif === l ? "var(--color-paper)" : "inherit",
              }}
            >
              {sudah ? <Centang size={12} /> : `0${l}`}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight">{JUDUL[l].judul}</span>
              <span className="mt-0.5 block truncate text-2xs text-muted">
                {JUDUL[l].petunjuk}
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
