import "server-only";
import lpse from "../../../data/lpse_kota_tangerang_2025_2026.json";
import realisasi from "../../../data/realisasi_kota_tangerang.json";
import type {
  RoadPackageContract,
  VendorSummary,
} from "@/contracts/packages/road-package.contract";
import { slugPenyedia } from "@/contracts/packages/vendor-slug";

export { slugPenyedia };

/** Halaman detail paket di Data INAPROC — membuka RUP yang sama, bukan halaman daftar. */
function urlRupInaproc(kodeRup: string) {
  return `https://data.inaproc.id/rup?kode=${encodeURIComponent(kodeRup)}`;
}

/**
 * Halaman realisasi memakai **kode paket** milik transaksi (kode tender / kode e-katalog),
 * bukan kode RUP. Halaman ini berisi detail hanya untuk paket yang punya rekam tender di SPSE;
 * paket e-katalog biasanya menjawab "tidak memiliki Data Detail" meski halamannya tetap terbuka.
 */
function urlRealisasiPaket(kodePaket: string) {
  return `https://data.inaproc.id/realisasi?kode=${encodeURIComponent(kodePaket)}`;
}

/** Sumber transaksi yang biasanya punya halaman detail realisasi (tender SPSE lebih dulu). */
const PRIORITAS_SUMBER = ["Tender", "Non Tender", "Pencatatan Non Tender", "Pencatatan Swakelola"];

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

interface RealisasiRow {
  kode_rup: string | null;
  kode_paket: string;
  tahun: number;
  metode: string | null;
  sumber_transaksi: string | null;
  penyedia: string | null;
  nilai: number | null;
}

interface RealisasiSnapshot {
  snapshot: string;
  sumber: string;
  jumlah_baris: number;
  jumlah_rup: number;
  per_metode: Record<string, number>;
  item: RealisasiRow[];
}

const data = lpse as unknown as LpseSnapshot;
const real = realisasi as unknown as RealisasiSnapshot;

/** Indeks kode RUP → kontrak. LPSE lebih dulu; celahnya diisi Data INAPROC. */
const kontrakPerRup = new Map<string, RoadPackageContract>();

for (const baris of data.item) {
  const nama = baris.pemenang?.trim();
  if (!nama) continue;

  kontrakPerRup.set(String(baris.kode_rup), {
    jenis: baris.jenis_lpse === "lelang" ? "tender" : "nontender",
    sumber: "LPSE",
    metode: baris.metode,
    penyedia: nama,
    npwp: baris.npwp,
    hps: baris.hps,
    nilai_kontrak: baris.nilai_kontrak,
    tahun: baris.tahun,
    url: baris.url,
  });
}

/** Agregasi realisasi per RUP: satu paket bisa punya beberapa transaksi/penyedia. */
interface AgregatRealisasi {
  penyedia: Map<string, number>;
  total: number;
  transaksi: number;
  metode: string | null;
  tahun: number;
  sumberTransaksi: string | null;
  paket: Map<string, { nilai: number; sumber: string | null }>;
}

/** Swakelola & instansi bukan penyedia jasa — jangan pernah tampil sebagai "pemenang". */
const BUKAN_PENYEDIA = /^\s*(dinas|pegawai|opd|pemerintah|badan|kantor|uptd|kecamatan|kelurahan|unsur)\b/i;

const realisasiPerRup = new Map<string, AgregatRealisasi>();
for (const baris of real.item) {
  if (!baris.kode_rup || !baris.penyedia) continue;
  if (String(baris.metode ?? "").toLowerCase() === "swakelola") continue;
  if (BUKAN_PENYEDIA.test(String(baris.penyedia))) continue;
  const rup = String(baris.kode_rup);
  const agg = realisasiPerRup.get(rup) ?? {
    penyedia: new Map<string, number>(),
    total: 0,
    transaksi: 0,
    metode: baris.metode,
    tahun: baris.tahun,
    sumberTransaksi: baris.sumber_transaksi,
    paket: new Map(),
  };
  const nilai = Number(baris.nilai ?? 0);
  agg.transaksi += 1;
  agg.total += nilai;
  agg.penyedia.set(baris.penyedia, (agg.penyedia.get(baris.penyedia) ?? 0) + nilai);
  if (baris.kode_paket) {
    const paket = agg.paket.get(baris.kode_paket) ?? { nilai: 0, sumber: baris.sumber_transaksi ?? null };
    paket.nilai += nilai;
    agg.paket.set(baris.kode_paket, paket);
  }
  realisasiPerRup.set(rup, agg);
}

let diisiRealisasi = 0;
for (const [rup, agg] of realisasiPerRup) {
  if (kontrakPerRup.has(rup)) continue;
  const urut = [...agg.penyedia.entries()].sort((a, b) => b[1] - a[1]);
  if (!urut.length) continue;

  const peringkat = (sumber: string | null) => {
    const i = PRIORITAS_SUMBER.indexOf(String(sumber ?? ""));
    return i === -1 ? PRIORITAS_SUMBER.length : i;
  };
  const paketBukti = [...agg.paket.entries()].sort(
    (a, b) => peringkat(a[1].sumber) - peringkat(b[1].sumber) || b[1].nilai - a[1].nilai,
  )[0];

  kontrakPerRup.set(rup, {
    jenis: agg.metode === "E-Purchasing" ? "e-purchasing" : "lainnya",
    sumber: "Data INAPROC",
    metode: agg.metode,
    penyedia: urut[0][0],
    npwp: null,
    hps: null,
    nilai_kontrak: agg.total ? Math.round(agg.total) : null,
    tahun: agg.tahun,
    url: paketBukti ? urlRealisasiPaket(paketBukti[0]) : urlRupInaproc(rup),
    kodePaket: paketBukti?.[0] ?? null,
    jumlahPaket: agg.paket.size,
    transaksi: agg.transaksi,
    penyediaLain: urut.slice(1).map(([nama]) => nama),
    sumberTransaksi: agg.sumberTransaksi,
  });
  diisiRealisasi += 1;
}

/** Indeks penyedia → kode RUP, dibangun dari kontrak gabungan. */
const rupPerPenyedia = new Map<string, Set<string>>();
for (const [rup, kontrak] of kontrakPerRup) {
  for (const nama of [kontrak.penyedia, ...(kontrak.penyediaLain ?? [])]) {
    const kunci = nama.trim().toLocaleUpperCase("id-ID");
    const daftar = rupPerPenyedia.get(kunci);
    if (daftar) daftar.add(rup);
    else rupPerPenyedia.set(kunci, new Set([rup]));
  }
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
  realisasi: {
    snapshot: real.snapshot,
    baris: real.jumlah_baris,
    rup: real.jumlah_rup,
    perMetode: real.per_metode,
    paketDiisiRealisasi: diisiRealisasi,
  },
  kontrakTotal: kontrakPerRup.size,
  penyediaTotal: rupPerPenyedia.size,
} as const;

export function kontrakUntukRup(kodeRup: string): RoadPackageContract | null {
  return kontrakPerRup.get(String(kodeRup)) ?? null;
}

export function daftarPenyedia(): VendorSummary[] {
  return ringkasanPenyedia(null);
}

/**
 * Ringkasan penyedia, dibatasi ke kode RUP yang diberikan (mis. hanya paket jalan).
 * `null` = semua RUP yang punya rekam kontrak.
 */
export function ringkasanPenyedia(rupDiizinkan: Set<string> | null): VendorSummary[] {
  const hasil = new Map<string, VendorSummary>();

  for (const [rup, kontrak] of kontrakPerRup) {
    if (rupDiizinkan && !rupDiizinkan.has(rup)) continue;

    const perPenyedia = realisasiPerRup.get(rup)?.penyedia;
    const daftar = [kontrak.penyedia, ...(kontrak.penyediaLain ?? [])];

    for (const nama of daftar) {
      const kunci = nama.trim().toLocaleUpperCase("id-ID");
      const entri = hasil.get(kunci) ?? {
        slug: slugPenyedia(nama),
        nama,
        paket: 0,
        nilai: 0,
        tahun: [],
        kategori: [],
      };
      entri.paket += 1;
      entri.nilai += Math.round(
        perPenyedia
          ? Number(perPenyedia.get(nama) ?? 0)
          : kunci === kontrak.penyedia.trim().toLocaleUpperCase("id-ID")
            ? Number(kontrak.nilai_kontrak ?? 0)
            : 0,
      );
      if (!entri.tahun.includes(kontrak.tahun)) entri.tahun.push(kontrak.tahun);
      hasil.set(kunci, entri);
    }
  }

  return [...hasil.values()].sort(
    (a, b) => b.nilai - a.nilai || a.nama.localeCompare(b.nama, "id"),
  );
}

export function rupMilikPenyedia(slug: string): string[] {
  for (const [kunci, daftarRup] of rupPerPenyedia) {
    if (slugPenyedia(kunci) === slug) return [...daftarRup];
  }
  return [];
}
