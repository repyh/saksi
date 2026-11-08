import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  RoadPackageContract,
  VendorSummary,
} from "@/contracts/packages/road-package.contract";
import { normalizeVendorNames } from "@/contracts/packages/vendor-name";
import { slugPenyedia } from "@/contracts/packages/vendor-slug";
import {
  DEFAULT_REGION_ID,
  getRegion,
  type RegionConfig,
} from "@/server/regions/region-registry";

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

/** Agregasi realisasi per RUP: satu paket bisa punya beberapa transaksi/penyedia. */
interface AgregatRealisasi {
  penyedia: Map<string, number>;
  total: number;
  transaksi: number;
  metode: string | null;
  tahun: number;
  sumberTransaksi: string | null;
  paket: Map<string, { nilai: number; sumber: string | null; penyedia: Map<string, number> }>;
}

type DataLpse = Omit<LpseSnapshot, "item"> & { item?: LpseRow[] };
type DataRealisasi = Omit<RealisasiSnapshot, "item"> & { item?: RealisasiRow[] };

const KOSONG_LPSE: LpseSnapshot = {
  snapshot: "-",
  sumber: "-",
  paket_rup: 0,
  paket_tercocok: 0,
  persen_tercocok: 0,
  pagu_rup_total: 0,
  pagu_tercocok: 0,
  pagu_belum_tercocok: 0,
  metode_belum_tercocok: {},
  dengan_pemenang: 0,
  nilai_kontrak_total: 0,
  rasio_kontrak_pagu_median: null,
  item: [],
};

const KOSONG_REALISASI: RealisasiSnapshot = {
  snapshot: "-",
  sumber: "-",
  jumlah_baris: 0,
  jumlah_rup: 0,
  per_metode: {},
  item: [],
};

const AKAR = process.cwd();

function bacaJson<T>(berkas: string): T {
  return JSON.parse(readFileSync(path.resolve(AKAR, berkas), "utf8")) as T;
}

/** Swakelola & instansi bukan penyedia jasa — jangan pernah tampil sebagai "pemenang". */
const BUKAN_PENYEDIA = /^\s*(dinas|pegawai|opd|pemerintah|badan|kantor|uptd|kecamatan|kelurahan|unsur)\b/i;

/** Kunci pembanding nama penyedia (case-insensitive). */
function kunciPenyedia(nama: string) {
  return nama.trim().toLocaleUpperCase("id-ID");
}

/**
 * Tambah nilai ke peta penyedia tanpa membuat entri ganda karena beda kapitalisasi.
 * Ejaan pertama dipertahankan.
 */
function tambahNilai(map: Map<string, number>, nama: string, nilai: number) {
  const kunci = kunciPenyedia(nama);
  let pakai = nama;
  for (const ada of map.keys()) {
    if (kunciPenyedia(ada) === kunci) {
      pakai = ada;
      break;
    }
  }
  map.set(pakai, (map.get(pakai) ?? 0) + nilai);
}

/** Nilai penyedia pada peta, dicocokkan case-insensitive. */
function nilaiPenyedia(map: Map<string, number>, nama: string): number {
  const kunci = kunciPenyedia(nama);
  for (const [ada, nilai] of map) {
    if (kunciPenyedia(ada) === kunci) return nilai;
  }
  return 0;
}

export interface IndeksKontrak {
  kontrakPerRup: Map<string, RoadPackageContract>;
  realisasiPerRup: Map<string, AgregatRealisasi>;
  rupPerPenyedia: Map<string, Set<string>>;
  meta: {
    snapshot: string;
    sumber: string;
    paketTercocok: number;
    persenTercocok: number;
    denganPemenang: number;
    nilaiKontrakTotal: number;
    paguTercocok: number;
    paguBelumTercocok: number;
    metodeBelumTercocok: Record<string, number>;
    rasioMedian: number | null;
    realisasi: {
      snapshot: string;
      baris: number;
      rup: number;
      perMetode: Record<string, number>;
      paketDiisiRealisasi: number;
    };
    kontrakTotal: number;
    penyediaTotal: number;
  };
}

function buatIndeks(region: RegionConfig): IndeksKontrak {
  const lpse: DataLpse = region.lpse?.keluaran
    ? bacaJson<DataLpse>(region.lpse.keluaran)
    : KOSONG_LPSE;
  const real: DataRealisasi = region.sumber.realisasi
    ? bacaJson<DataRealisasi>(region.sumber.realisasi)
    : KOSONG_REALISASI;
  const data: LpseSnapshot = { ...KOSONG_LPSE, ...lpse, item: lpse.item ?? [] };
  const realisasi: RealisasiSnapshot = {
    ...KOSONG_REALISASI,
    ...real,
    item: real.item ?? [],
  };

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

  const realisasiPerRup = new Map<string, AgregatRealisasi>();
  for (const baris of realisasi.item) {
    if (!baris.kode_rup || !baris.penyedia) continue;
    if (String(baris.metode ?? "").toLowerCase() === "swakelola") continue;
    if (BUKAN_PENYEDIA.test(String(baris.penyedia))) continue;
    const daftarNama = normalizeVendorNames(baris.penyedia);
    if (!daftarNama.length) continue;
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
    // Nilai adalah nilai transaksi bersama: diberikan penuh ke penyedia pertama
    // dan 0 ke penyedia gabungan lain. Nilai bersama tidak dibagi agar total
    // RUP/paket tetap sama dan rekonsiliasi terjaga.
    for (const [urutan, nama] of daftarNama.entries()) {
      tambahNilai(agg.penyedia, nama, urutan === 0 ? nilai : 0);
    }
    if (baris.kode_paket) {
      const paket = agg.paket.get(baris.kode_paket) ?? {
        nilai: 0,
        sumber: baris.sumber_transaksi ?? null,
        penyedia: new Map<string, number>(),
      };
      paket.nilai += nilai;
      for (const [urutan, nama] of daftarNama.entries()) {
        tambahNilai(paket.penyedia, nama, urutan === 0 ? nilai : 0);
      }
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
      paketRealisasi: [...agg.paket.entries()]
        .map(([kodePaket, isi]) => {
          const urutPaket = [...isi.penyedia.entries()].sort((a, b) => b[1] - a[1]);
          const namaPaket = urutPaket.length ? urutPaket.map(([nama]) => nama) : [urut[0][0]];
          return {
            kodePaket,
            nilai: Math.round(isi.nilai),
            sumber: isi.sumber,
            penyedia: namaPaket[0],
            penyediaSemua: namaPaket,
          };
        })
        .sort((a, b) => b.nilai - a.nilai),
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

  return {
    kontrakPerRup,
    realisasiPerRup,
    rupPerPenyedia,
    meta: {
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
        snapshot: realisasi.snapshot,
        baris: realisasi.jumlah_baris,
        rup: realisasi.jumlah_rup,
        perMetode: realisasi.per_metode,
        paketDiisiRealisasi: diisiRealisasi,
      },
      kontrakTotal: kontrakPerRup.size,
      penyediaTotal: rupPerPenyedia.size,
    },
  };
}

const cache = new Map<string, IndeksKontrak>();

export function getIndeksKontrak(regionId: string = DEFAULT_REGION_ID): IndeksKontrak {
  const tersimpan = cache.get(regionId);
  if (tersimpan) return tersimpan;
  const indeks = buatIndeks(getRegion(regionId));
  cache.set(regionId, indeks);
  return indeks;
}

export function getLpseMeta(regionId: string = DEFAULT_REGION_ID) {
  return getIndeksKontrak(regionId).meta;
}

export function kontrakUntukRup(
  regionId: string,
  kodeRup: string,
): RoadPackageContract | null {
  return getIndeksKontrak(regionId).kontrakPerRup.get(String(kodeRup)) ?? null;
}

export function daftarPenyedia(regionId: string = DEFAULT_REGION_ID): VendorSummary[] {
  return ringkasanPenyedia(regionId, null);
}

/**
 * Ringkasan penyedia, dibatasi ke kode RUP yang diberikan (mis. hanya paket jalan).
 * `null` = semua RUP yang punya rekam kontrak.
 */
export function ringkasanPenyedia(
  regionId: string,
  rupDiizinkan: Set<string> | null,
): VendorSummary[] {
  const { kontrakPerRup, realisasiPerRup } = getIndeksKontrak(regionId);
  const hasil = new Map<string, VendorSummary>();

  for (const [rup, kontrak] of kontrakPerRup) {
    if (rupDiizinkan && !rupDiizinkan.has(rup)) continue;

    const perPenyedia = realisasiPerRup.get(rup)?.penyedia;
    const daftar = [kontrak.penyedia, ...(kontrak.penyediaLain ?? [])];

    for (const nama of daftar) {
      const kunci = kunciPenyedia(nama);
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
          ? nilaiPenyedia(perPenyedia, nama)
          : kunci === kunciPenyedia(kontrak.penyedia)
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

export function rupMilikPenyedia(
  regionId: string,
  slug: string,
): string[] {
  for (const [kunci, daftarRup] of getIndeksKontrak(regionId).rupPerPenyedia) {
    if (slugPenyedia(kunci) === slug) return [...daftarRup];
  }
  return [];
}
