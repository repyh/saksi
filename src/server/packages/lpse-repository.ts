import "server-only";
import lpse from "../../../data/lpse_kota_tangerang_2025_2026.json";
import type {
  RoadPackageContract,
  VendorSummary,
} from "@/contracts/packages/road-package.contract";
import { slugPenyedia } from "@/contracts/packages/vendor-slug";

export { slugPenyedia };

interface LpseRow {
  kode_rup: string;
  jenis_lpse: "lelang" | "nontender";
  metode: string | null;
  pemenang: string | null;
  npwp: string | null;
  hps: number | null;
  nilai_kontrak: number | null;
  tahun: number;
  url: string | null;
}

interface LpseSnapshot {
  snapshot: string;
  sumber: string;
  paket_rup: number;
  paket_tercocok: number;
  persen_tercocok: number;
  pagu_rup_total: number;
  pagu_tercocok: number;
  pagu_belum_tercocok: number;
  metode_belum_tercocok: Record<string, number>;
  dengan_pemenang: number;
  nilai_kontrak_total: number;
  rasio_kontrak_pagu_median: number | null;
  item: LpseRow[];
}

const data = lpse as unknown as LpseSnapshot;

/** Indeks kode RUP → kontrak. Hanya baris yang punya nama pemenang. */
const kontrakPerRup = new Map<string, RoadPackageContract>();
/** Nama penyedia (huruf besar) → daftar kode RUP. */
const rupPerPenyedia = new Map<string, string[]>();

for (const baris of data.item) {
  if (!baris.pemenang) continue;
  const nama = baris.pemenang.trim();
  if (!nama) continue;

  kontrakPerRup.set(String(baris.kode_rup), {
    jenis: baris.jenis_lpse === "lelang" ? "tender" : "nontender",
    metode: baris.metode,
    pemenang: nama,
    npwp: baris.npwp,
    hps: baris.hps,
    nilai_kontrak: baris.nilai_kontrak,
    tahun: baris.tahun,
    url: baris.url,
  });

  const kunci = nama.toLocaleUpperCase("id-ID");
  const daftar = rupPerPenyedia.get(kunci);
  if (daftar) daftar.push(String(baris.kode_rup));
  else rupPerPenyedia.set(kunci, [String(baris.kode_rup)]);
}

export const lpseMeta = {
  snapshot: data.snapshot,
  sumber: data.sumber,
  paketTercocok: data.paket_tercocok,
  persenTercocok: data.persen_tercocok,
  denganPemenang: data.dengan_pemenang,
  nilaiKontrakTotal: data.nilai_kontrak_total,
  paguTercocok: data.pagu_tercocok,
  paguBelumTercocok: data.pagu_belum_tercocok,
  metodeBelumTercocok: data.metode_belum_tercocok,
  rasioMedian: data.rasio_kontrak_pagu_median,
} as const;

export function kontrakUntukRup(kodeRup: string): RoadPackageContract | null {
  return kontrakPerRup.get(String(kodeRup)) ?? null;
}

export function daftarPenyedia(): VendorSummary[] {
  const hasil: VendorSummary[] = [];
  for (const [kunci, daftarRup] of rupPerPenyedia) {
    let nilai = 0;
    const tahun = new Set<number>();
    let nama = kunci;
    for (const rup of daftarRup) {
      const kontrak = kontrakPerRup.get(rup);
      if (!kontrak) continue;
      nama = kontrak.pemenang;
      nilai += kontrak.nilai_kontrak ?? 0;
      tahun.add(kontrak.tahun);
    }
    hasil.push({
      slug: slugPenyedia(nama),
      nama,
      paket: daftarRup.length,
      nilai,
      tahun: [...tahun].sort(),
      kategori: [],
    });
  }
  return hasil.sort((a, b) => b.nilai - a.nilai || a.nama.localeCompare(b.nama, "id"));
}

export function rupMilikPenyedia(slug: string): string[] {
  for (const [kunci, daftarRup] of rupPerPenyedia) {
    if (slugPenyedia(kunci) === slug) return daftarRup;
  }
  return [];
}
