import type { RoadPackageContract } from "@/contracts/packages/road-package.contract";

export interface PenyediaPanelBaris {
  nama: string;
  nilai: number;
  /** true bila penyedia ikut dalam transaksi yang dicatat untuk beberapa penyedia. */
  nilaiBersama: boolean;
}

export interface PenyediaPanel {
  baris: PenyediaPanelBaris[];
  /** Jumlah nilai seluruh baris; tetap sama dengan total transaksi kontrak. */
  total: number;
  /** true bila ada transaksi yang dicatat untuk beberapa penyedia sekaligus. */
  adaPenyediaBersama: boolean;
}

/** Jumlah nama yang tampil sebelum tombol "+N penyedia lainnya". */
export const PENYEDIA_TAMPIL_AWAL = 2;

function kunci(nama: string) {
  return nama.trim().toLocaleUpperCase("id-ID");
}

/**
 * Bangun daftar penyedia untuk panel detail paket dari **semua** nama pada tiap
 * paket realisasi. Nilai transaksi bersama hanya tercatat pada penyedia utama
 * (pemegang nilai), sehingga jumlah nilai tidak berubah dan tidak ada nilai
 * yang diciptakan atau dibagi rata. Penyedia bersama tetap tampil dengan nilai 0.
 */
export function buildPenyediaPanel(
  kontrak: RoadPackageContract | null | undefined,
): PenyediaPanel {
  if (!kontrak) return { baris: [], total: 0, adaPenyediaBersama: false };

  const perPaket = kontrak.paketRealisasi ?? [];
  if (!perPaket.length) {
    const baris: PenyediaPanelBaris[] = [
      { nama: kontrak.penyedia, nilai: kontrak.nilai_kontrak ?? 0, nilaiBersama: false },
      ...(kontrak.penyediaLain ?? []).map((nama) => ({ nama, nilai: 0, nilaiBersama: true })),
    ];
    return {
      baris,
      total: baris.reduce((jumlah, item) => jumlah + item.nilai, 0),
      adaPenyediaBersama: (kontrak.penyediaLain?.length ?? 0) > 0,
    };
  }

  const agregat = new Map<string, PenyediaPanelBaris>();
  let adaPenyediaBersama = false;

  for (const paket of perPaket) {
    const namaSemua = paket.penyediaSemua?.length
      ? [...paket.penyediaSemua]
      : [paket.penyedia];
    if (!namaSemua.some((nama) => kunci(nama) === kunci(paket.penyedia))) {
      namaSemua.unshift(paket.penyedia);
    }
    if (namaSemua.length > 1) adaPenyediaBersama = true;

    const kunciUtama = kunci(paket.penyedia);
    for (const nama of namaSemua) {
      const k = kunci(nama);
      const entri = agregat.get(k) ?? { nama, nilai: 0, nilaiBersama: false };
      if (k === kunciUtama) entri.nilai += paket.nilai;
      else entri.nilaiBersama = true;
      agregat.set(k, entri);
    }
  }

  const baris = [...agregat.values()].sort((a, b) => b.nilai - a.nilai);
  return {
    baris,
    total: baris.reduce((jumlah, item) => jumlah + item.nilai, 0),
    adaPenyediaBersama,
  };
}

/** Label tombol daftar penyedia; `null` bila semua nama sudah tampil. */
export function labelPenyediaLain(
  jumlah: number,
  tampil: number = PENYEDIA_TAMPIL_AWAL,
): string | null {
  const sisa = jumlah - tampil;
  return sisa > 0 ? `+${sisa} penyedia lainnya` : null;
}
