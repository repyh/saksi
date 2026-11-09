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
import { prisma } from "@/lib/prisma";
import { CATALOG_REVALIDATE_SECONDS } from "./catalog-cache-config";
import { isDatabaseEnabled } from "./data-source";

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

  return susunIndeks(data, realisasi);
}

/** Bangun indeks dari baris yang sudah ternormalisasi, baik dari berkas maupun database. */
function susunIndeks(data: LpseSnapshot, realisasi: RealisasiSnapshot): IndeksKontrak {
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

interface BarisLpseDb {
  kodeRup: string;
  jenisLpse: string;
  metode: string | null;
  pemenangName: string | null;
  npwpMasked: string | null;
  hps: string | number | null;
  nilaiKontrak: string | number | null;
  tahun: number;
  url: string | null;
}

interface BarisRealisasiDb {
  kodeRup: string;
  kodePaket: string;
  tahun: number;
  metode: string | null;
  sumberTransaksi: string | null;
  penyediaRaw: string | null;
  nilai: string | number | null;
}

interface MetaDb {
  lpseSnapshot: Date | string | null;
  realisasiSnapshot: Date | string | null;
  totalPaket: number;
  totalPagu: string | number;
  paketTercocok: number;
  denganPemenang: number;
  nilaiKontrakTotal: string | number;
  paguTercocok: string | number;
}

function tanggalSnapshot(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const tanggal = value instanceof Date ? value : new Date(value);
  return Number.isNaN(tanggal.getTime()) ? String(value) : tanggal.toISOString().slice(0, 10);
}

function angka(value: string | number | null | undefined): number {
  return Number(value ?? 0);
}

async function muatBarisKontrakDatabase(regionId: string): Promise<{
  lpseRows: LpseRow[];
  realisasiRows: RealisasiRow[];
  meta: MetaDb | undefined;
}> {
  const [lpseDb, realisasiDb, metaDb] = await Promise.all([
    prisma.$queryRaw<BarisLpseDb[]>`
      SELECT kode_rup AS "kodeRup", jenis_lpse AS "jenisLpse", method AS "metode",
        pemenang_name AS "pemenangName", npwp_masked AS "npwpMasked", hps,
        nilai_kontrak AS "nilaiKontrak", tahun, url
      FROM lpse_contracts
      WHERE region_id = ${regionId} AND pemenang_name IS NOT NULL
    `,
    prisma.$queryRaw<BarisRealisasiDb[]>`
      SELECT t.kode_rup AS "kodeRup", t.kode_paket AS "kodePaket", t.tahun,
        t.metode, t.sumber_transaksi AS "sumberTransaksi",
        t.penyedia_raw AS "penyediaRaw", t.nilai
      FROM realization_transactions t
      JOIN road_packages rp ON rp.rup = t.kode_rup AND rp.region_id = t.region_id
      WHERE t.region_id = ${regionId}
        AND t.kode_rup IS NOT NULL
        AND lower(coalesce(t.metode, '')) <> 'swakelola'
        AND t.penyedia_raw !~* '^\\s*(dinas|pegawai|opd|pemerintah|badan|kantor|uptd|kecamatan|kelurahan|unsur)\\b'
    `,
    prisma.$queryRaw<MetaDb[]>`
      SELECT
        (SELECT max(source_retrieved_at) FROM lpse_contracts WHERE region_id = ${regionId}) AS "lpseSnapshot",
        (SELECT max(last_seen_at) FROM realization_packages WHERE region_id = ${regionId}) AS "realisasiSnapshot",
        (SELECT count(*)::int FROM road_packages WHERE region_id = ${regionId}) AS "totalPaket",
        (SELECT COALESCE(sum(budget), 0)::text FROM road_packages WHERE region_id = ${regionId}) AS "totalPagu",
        (SELECT count(DISTINCT road_package_id)::int FROM lpse_contracts WHERE region_id = ${regionId}) AS "paketTercocok",
        (SELECT count(DISTINCT road_package_id)::int FROM lpse_contracts
          WHERE region_id = ${regionId} AND pemenang_name IS NOT NULL) AS "denganPemenang",
        (SELECT COALESCE(sum(nilai_kontrak), 0)::text FROM lpse_contracts
          WHERE region_id = ${regionId} AND pemenang_name IS NOT NULL) AS "nilaiKontrakTotal",
        (SELECT COALESCE(sum(rp.budget), 0)::text FROM road_packages rp
          WHERE rp.region_id = ${regionId}
            AND EXISTS (SELECT 1 FROM lpse_contracts lc
              WHERE lc.road_package_id = rp.id)) AS "paguTercocok"
    `,
  ]);

  const lpseRows: LpseRow[] = lpseDb.map((baris) => ({
    kode_rup: baris.kodeRup,
    jenis_lpse: baris.jenisLpse === "lelang" ? "lelang" : "nontender",
    metode: baris.metode,
    pemenang: baris.pemenangName,
    npwp: baris.npwpMasked,
    hps: baris.hps == null ? null : angka(baris.hps),
    nilai_kontrak: baris.nilaiKontrak == null ? null : angka(baris.nilaiKontrak),
    tahun: baris.tahun,
    url: baris.url,
  }));

  const realisasiRows: RealisasiRow[] = realisasiDb.map((baris) => ({
    kode_rup: baris.kodeRup,
    kode_paket: baris.kodePaket,
    tahun: baris.tahun,
    metode: baris.metode,
    sumber_transaksi: baris.sumberTransaksi,
    penyedia: baris.penyediaRaw,
    nilai: angka(baris.nilai),
  }));

  return { lpseRows, realisasiRows, meta: metaDb[0] };
}

async function buatIndeksDatabase(regionId: string): Promise<IndeksKontrak> {
  const region = getRegion(regionId);
  const { lpseRows, realisasiRows, meta } = await muatBarisKontrakDatabase(regionId);

  const totalPagu = angka(meta?.totalPagu);
  const paguTercocok = angka(meta?.paguTercocok);
  const totalPaket = meta?.totalPaket ?? 0;
  const paketTercocok = meta?.paketTercocok ?? 0;

  const perMetode: Record<string, number> = {};
  for (const baris of realisasiRows) {
    const kunci = baris.metode ?? "Tidak dicantumkan";
    perMetode[kunci] = (perMetode[kunci] ?? 0) + 1;
  }

  const data: LpseSnapshot = {
    ...KOSONG_LPSE,
    snapshot: tanggalSnapshot(meta?.lpseSnapshot),
    sumber: `${region.lpse?.base ?? "SPSE"} (SPSE)`,
    paket_rup: totalPaket,
    paket_tercocok: paketTercocok,
    persen_tercocok: totalPaket ? Math.round((paketTercocok / totalPaket) * 1000) / 10 : 0,
    pagu_rup_total: totalPagu,
    pagu_tercocok: paguTercocok,
    pagu_belum_tercocok: Math.max(0, totalPagu - paguTercocok),
    dengan_pemenang: meta?.denganPemenang ?? 0,
    nilai_kontrak_total: angka(meta?.nilaiKontrakTotal),
    item: lpseRows,
  };

  const realisasi: RealisasiSnapshot = {
    ...KOSONG_REALISASI,
    snapshot: tanggalSnapshot(meta?.realisasiSnapshot),
    sumber: "https://data.inaproc.id/realisasi — Data INAPROC",
    jumlah_baris: realisasiRows.length,
    jumlah_rup: new Set(realisasiRows.map((baris) => baris.kode_rup)).size,
    per_metode: perMetode,
    item: realisasiRows,
  };

  return susunIndeks(data, realisasi);
}

interface IndeksTersimpan {
  at: number;
  promise: Promise<IndeksKontrak>;
}

const cache = new Map<string, IndeksTersimpan>();

/**
 * Indeks kontrak per region. Map disimpan per proses untuk kerja CPU, tetapi
 * kedaluwarsa mengikuti `revalidate` Data Cache katalog (5 menit) supaya proses
 * panjang tidak menyajikan kontrak basi selamanya.
 */
export function getIndeksKontrak(regionId: string = DEFAULT_REGION_ID): Promise<IndeksKontrak> {
  const sekarang = Date.now();
  const tersimpan = cache.get(regionId);
  if (tersimpan && sekarang - tersimpan.at < CATALOG_REVALIDATE_SECONDS * 1000) {
    return tersimpan.promise;
  }
  const indeks = isDatabaseEnabled()
    ? buatIndeksDatabase(regionId)
    : Promise.resolve(buatIndeks(getRegion(regionId)));
  cache.set(regionId, { at: sekarang, promise: indeks });
  indeks.catch(() => cache.delete(regionId));
  return indeks;
}

export function getLpseMeta(regionId: string = DEFAULT_REGION_ID) {
  return getIndeksKontrak(regionId).then((indeks) => indeks.meta);
}

export function kontrakUntukRup(
  regionId: string,
  kodeRup: string,
): Promise<RoadPackageContract | null> {
  return getIndeksKontrak(regionId).then(
    (indeks) => indeks.kontrakPerRup.get(String(kodeRup)) ?? null,
  );
}

export function daftarPenyedia(regionId: string = DEFAULT_REGION_ID): Promise<VendorSummary[]> {
  return ringkasanPenyedia(regionId, null);
}

/**
 * Ringkasan penyedia, dibatasi ke kode RUP yang diberikan (mis. hanya paket jalan).
 * `null` = semua RUP yang punya rekam kontrak.
 */
export async function ringkasanPenyedia(
  regionId: string,
  rupDiizinkan: Set<string> | null,
): Promise<VendorSummary[]> {
  const { kontrakPerRup, realisasiPerRup } = await getIndeksKontrak(regionId);
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

export async function rupMilikPenyedia(
  regionId: string,
  slug: string,
): Promise<string[]> {
  for (const [kunci, daftarRup] of (await getIndeksKontrak(regionId)).rupPerPenyedia) {
    if (slugPenyedia(kunci) === slug) return [...daftarRup];
  }
  return [];
}
