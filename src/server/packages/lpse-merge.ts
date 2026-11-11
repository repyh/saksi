import type { RoadPackageContract } from "@/contracts/packages/road-package.contract";
import { kunciPenyedia, normalizeVendorNames } from "@/contracts/packages/vendor-name";

export { kunciPenyedia };

/** Baris kontrak LPSE/SPSE yang sudah ternormalisasi (snapshot atau database). */
export interface BarisLpse {
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

/** Baris realisasi Data INAPROC yang sudah ternormalisasi. */
export interface BarisRealisasi {
  kode_rup: string | null;
  kode_paket: string;
  tahun: number;
  metode: string | null;
  sumber_transaksi: string | null;
  penyedia: string | null;
  nilai: number | null;
}

/** Agregasi realisasi per RUP: satu paket bisa punya beberapa transaksi/penyedia. */
export interface AgregatRealisasi {
  penyedia: Map<string, number>;
  total: number;
  transaksi: number;
  metode: string | null;
  tahun: number;
  sumberTransaksi: string | null;
  paket: Map<string, { nilai: number; sumber: string | null; penyedia: Map<string, number> }>;
}

export interface HasilGabungKontrak {
  kontrakPerRup: Map<string, RoadPackageContract>;
  realisasiPerRup: Map<string, AgregatRealisasi>;
  rupPerPenyedia: Map<string, Set<string>>;
  /** Jumlah RUP yang kontraknya hanya bisa diisi dari Data INAPROC (tanpa rekam LPSE). */
  diisiRealisasi: number;
}

/** Halaman detail paket di Data INAPROC — membuka RUP yang sama, bukan halaman daftar. */
export function urlRupInaproc(kodeRup: string) {
  return `https://data.inaproc.id/rup?kode=${encodeURIComponent(kodeRup)}`;
}

/**
 * Halaman realisasi memakai **kode paket** milik transaksi (kode tender / kode e-katalog),
 * bukan kode RUP. Halaman ini berisi detail hanya untuk paket yang punya rekam tender di SPSE;
 * paket e-katalog biasanya menjawab "tidak memiliki Data Detail" meski halamannya tetap terbuka.
 */
export function urlRealisasiPaket(kodePaket: string) {
  return `https://data.inaproc.id/realisasi?kode=${encodeURIComponent(kodePaket)}`;
}

/** Sumber transaksi yang biasanya punya halaman detail realisasi (tender SPSE lebih dulu). */
const PRIORITAS_SUMBER = ["Tender", "Non Tender", "Pencatatan Non Tender", "Pencatatan Swakelola"];

/** Swakelola & instansi bukan penyedia jasa — jangan pernah tampil sebagai "pemenang". */
const BUKAN_PENYEDIA = /^\s*(dinas|pegawai|opd|pemerintah|badan|kantor|uptd|kecamatan|kelurahan|unsur)\b/i;

/** Nilai penyedia pada peta, dicocokkan case-insensitive. */
export function nilaiPenyedia(map: Map<string, number>, nama: string): number {
  const kunci = kunciPenyedia(nama);
  for (const [ada, nilai] of map) {
    if (kunciPenyedia(ada) === kunci) return nilai;
  }
  return 0;
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

function urutPenyedia(agg: AgregatRealisasi): Array<[string, number]> {
  return [...agg.penyedia.entries()].sort((a, b) => b[1] - a[1]);
}

/** Rincian paket realisasi untuk satu RUP, diurutkan dari nilai terbesar. */
function rincianPaket(
  agg: AgregatRealisasi,
  namaUtama: string,
): NonNullable<RoadPackageContract["paketRealisasi"]> {
  return [...agg.paket.entries()]
    .map(([kodePaket, isi]) => {
      const urutPaket = [...isi.penyedia.entries()].sort((a, b) => b[1] - a[1]);
      const namaPaket = urutPaket.length ? urutPaket.map(([nama]) => nama) : [namaUtama];
      return {
        kodePaket,
        nilai: Math.round(isi.nilai),
        sumber: isi.sumber,
        penyedia: namaPaket[0],
        penyediaSemua: namaPaket,
      };
    })
    .sort((a, b) => b.nilai - a.nilai);
}

function peringkatSumber(sumber: string | null) {
  const i = PRIORITAS_SUMBER.indexOf(String(sumber ?? ""));
  return i === -1 ? PRIORITAS_SUMBER.length : i;
}

/**
 * Gabungkan rekam LPSE dan realisasi Data INAPROC menjadi satu indeks kontrak per RUP.
 *
 * LPSE tetap menjadi identitas kontrak (pemenang, HPS, nilai kontrak, tautan SPSE) karena
 * halaman SPSE adalah bukti pengadaannya. Baris realisasi Data INAPROC **tetap ditempelkan**
 * sebagai rincian transaksi (`paketRealisasi`, jumlah transaksi, sumber transaksi), bukan
 * dibuang ketika rekam LPSE sudah ada. Tanpa langkah itu, paket yang punya rekam LPSE
 * kehilangan rincian realisasinya dan UI menyimpulkan datanya tidak tersedia.
 */
export function gabungKontrakRealisasi(
  lpse: readonly BarisLpse[],
  realisasi: readonly BarisRealisasi[],
): HasilGabungKontrak {
  const realisasiPerRup = new Map<string, AgregatRealisasi>();
  for (const baris of realisasi) {
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

  const kontrakPerRup = new Map<string, RoadPackageContract>();

  // 1. Rekam LPSE: identitas pemenang dan nilai kontrak dari halaman SPSE.
  for (const baris of lpse) {
    const nama = baris.pemenang?.trim();
    if (!nama) continue;

    const rup = String(baris.kode_rup);
    const agg = realisasiPerRup.get(rup);
    const urut = agg ? urutPenyedia(agg) : [];
    const namaUtama = urut[0]?.[0] ?? nama;
    const paketBukti = agg
      ? [...agg.paket.entries()].sort(
          (a, b) => peringkatSumber(a[1].sumber) - peringkatSumber(b[1].sumber) || b[1].nilai - a[1].nilai,
        )[0]
      : undefined;
    const penyediaLain = urut
      .map(([namaRealisasi]) => namaRealisasi)
      .filter((namaRealisasi) => kunciPenyedia(namaRealisasi) !== kunciPenyedia(nama));

    kontrakPerRup.set(rup, {
      jenis: baris.jenis_lpse === "lelang" ? "tender" : "nontender",
      sumber: "LPSE",
      metode: baris.metode,
      penyedia: nama,
      npwp: baris.npwp,
      hps: baris.hps,
      nilai_kontrak: baris.nilai_kontrak,
      tahun: baris.tahun,
      url: baris.url,
      ...(agg
        ? {
            kodePaket: paketBukti?.[0] ?? null,
            jumlahPaket: agg.paket.size,
            paketRealisasi: rincianPaket(agg, namaUtama),
            transaksi: agg.transaksi,
            penyediaLain: penyediaLain.length ? penyediaLain : undefined,
            sumberTransaksi: agg.sumberTransaksi,
          }
        : {}),
    });
  }

  // 2. Celah tanpa rekam LPSE diisi Data INAPROC (mis. e-purchasing).
  let diisiRealisasi = 0;
  for (const [rup, agg] of realisasiPerRup) {
    if (kontrakPerRup.has(rup)) continue;
    const urut = urutPenyedia(agg);
    if (!urut.length) continue;

    const paketBukti = [...agg.paket.entries()].sort(
      (a, b) => peringkatSumber(a[1].sumber) - peringkatSumber(b[1].sumber) || b[1].nilai - a[1].nilai,
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
      paketRealisasi: rincianPaket(agg, urut[0][0]),
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
      const kunci = kunciPenyedia(nama);
      const daftar = rupPerPenyedia.get(kunci);
      if (daftar) daftar.add(rup);
      else rupPerPenyedia.set(kunci, new Set([rup]));
    }
  }

  return { kontrakPerRup, realisasiPerRup, rupPerPenyedia, diisiRealisasi };
}
