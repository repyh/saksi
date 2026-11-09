import "server-only";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { formatRupiahFull } from "@/features/map/road-types";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_REGION_ID,
  getRegion,
  regionSummary,
  type RegionConfig,
} from "@/server/regions/region-registry";
import { isDatabaseEnabled } from "./data-source";
import { getLpseMeta } from "./lpse-repository";
import { snapshotMeta } from "./snapshot-repository";
import { createRoadPackageRepository } from "./source";

/**
 * Angka metodologi diturunkan dari manifest region, snapshot aktif, dan meta LPSE/realisasi.
 * Tidak ada angka dataset yang ditanam di JSX: halaman /metode hanya merender hasil fungsi ini.
 */

interface ManifestBerkas {
  berkas: string;
  byte: number;
  sha256: string;
}

interface ManifestMetrik {
  paket: number;
  pagu: number;
  per_tahun: Record<string, number>;
  presisi: Record<string, number>;
  berlokus: number;
  kelurahan_tersentuh: number;
  unit_lingkungan_tersentuh: number;
  kecamatan_tersentuh: number;
  penyedia: {
    lpse: number;
    realisasi: number;
    tanpa_rekam: number;
    tanpa_rekam_pagu: number;
    unik: number;
  };
  sumber: {
    rup: number;
    detail: number;
    realisasi: number;
    lpse: number;
    batas_kecamatan: number;
    batas_kelurahan: number;
    batas_rw: number;
  };
}

interface RegionManifest {
  region: string;
  label: string;
  instansi: string;
  tahun: number[];
  dibuat: string;
  berkas: Record<string, ManifestBerkas>;
  metrik?: ManifestMetrik;
  masalah?: string[];
}

export interface MetodologiSumberBerkas {
  path: string;
  sha256: string | null;
}

export interface MetodologiSumber {
  id: string;
  nama: string;
  keterangan: string;
  tanggal: string | null;
  berkas: MetodologiSumberBerkas[];
}

export interface MetodologiTahap {
  nama: string;
  keterangan: string;
  jumlah: string | null;
}

export interface MetodologiAngka {
  paket: number;
  pagu: number;
  paguTampil: string;
  perTahun: Array<{ tahun: string; jumlah: number }>;
  presisi: Array<{ label: string; jumlah: number; persen: string }>;
  berlokus: number;
  berlokusPersen: string;
  tanpaLokus: number;
  tanpaLokusPersen: string;
  cakupan: Array<{ label: string; tercakup: number; total: number; persen: string }>;
}

export interface MetodologiPenyedia {
  paket: number;
  punyaRekam: number;
  punyaRekamPersen: string;
  lpse: number;
  realisasi: number;
  tanpaRekam: number;
  tanpaRekamPagu: number;
  tanpaRekamPaguTampil: string;
  tanpaRekamPaguPersen: string;
  unik: number;
  /** Nama unik setelah normalisasi nama gabungan; dipakai register penyedia. */
  unikKontrak: number;
}

export interface MetodologiUjiAnchor {
  tanggal: string;
  ruasPersen: string;
  rwPersen: string;
  kelurahanPersen: string;
  sumber: string;
}

export interface MetodologiData {
  lengkap: boolean;
  catatan: string[];
  region: {
    id: string;
    label: string;
    instansi: string;
    tahun: number[];
    environmentLabel: string;
  };
  snapshot: {
    tanggal: string | null;
    sumber: string | null;
    dibuat: string | null;
    masalah: string[];
  };
  sumber: MetodologiSumber[];
  pipeline: MetodologiTahap[];
  angka: MetodologiAngka | null;
  penyedia: MetodologiPenyedia | null;
  ujiAnchor: MetodologiUjiAnchor;
}

const idInt = new Intl.NumberFormat("id-ID");
const idSatuDesimal = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const idDuaDesimal = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const BULAN: Record<string, string> = {
  jan: "Januari",
  feb: "Februari",
  mar: "Maret",
  apr: "April",
  mei: "Mei",
  may: "Mei",
  jun: "Juni",
  jul: "Juli",
  agu: "Agustus",
  aug: "Agustus",
  sep: "September",
  okt: "Oktober",
  oct: "Oktober",
  nov: "November",
  des: "Desember",
  dec: "Desember",
};

/** Menerima "5 Nov 2026", "2 Nov 2026", "2026-11-06", atau ISO lengkap. */
function tanggalIndonesia(value: string | null | undefined): string | null {
  if (!value) return null;
  const teks = value.trim();

  const pendek = /^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/.exec(teks);
  if (pendek) {
    const [, hari, bulan, tahun] = pendek;
    const nama = BULAN[bulan.slice(0, 3).toLocaleLowerCase("en-US")];
    return nama ? `${Number(hari)} ${nama} ${tahun}` : teks;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(teks);
  if (iso) {
    const tanggal = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00+07:00`);
    if (Number.isNaN(tanggal.getTime())) return teks;
    return tanggal.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Jakarta",
    });
  }

  return teks;
}

function persen(bagian: number, total: number): string {
  if (!total) return "0%";
  return `${idSatuDesimal.format((bagian / total) * 100)}%`;
}

function rupiahMiliar(nilai: number): string {
  return `Rp${idDuaDesimal.format(nilai / 1_000_000_000)} Miliar`;
}

/** Nama artefak ingestion untuk setiap berkas yang checksum-nya ditampilkan. */
const ARTEFAK_BERKAS: Array<(region: RegionConfig) => [string | undefined, string]> = [
  (region) => [region.sumber.rup, "rup"],
  (region) => [region.sumber.detail, "detail"],
  (region) => [region.sumber.realisasi, "realisasi"],
  (region) => [region.lpse?.keluaran, "lpse-cocok"],
  (region) => [region.batas.kelurahan.berkas, "batas-kelurahan"],
  (region) => [region.batas.lingkungan?.berkas, "batas-rw"],
  (region) => [region.batas.kecamatan?.berkas, "batas-kecamatan"],
];

async function bacaManifest(regionId: string): Promise<RegionManifest | null> {
  if (isDatabaseEnabled()) {
    const baris = await prisma.regionManifest.findFirst({
      where: { regionId },
      orderBy: { generatedAt: "desc" },
      select: { generatedAt: true, metrics: true, checksums: true },
    });
    if (!baris) return null;

    const region = getRegion(regionId);
    const checksums = (baris.checksums ?? {}) as Record<string, string>;
    const berkas: Record<string, ManifestBerkas> = {};
    for (const pasangan of ARTEFAK_BERKAS) {
      const [jalur, kunci] = pasangan(region);
      const sha256 = checksums[kunci];
      if (jalur && sha256) berkas[jalur] = { berkas: jalur, byte: 0, sha256 };
    }

    return {
      region: region.id,
      label: region.label,
      instansi: region.instansi,
      tahun: region.tahun,
      dibuat: baris.generatedAt.toISOString(),
      berkas,
      metrik: (baris.metrics ?? undefined) as ManifestMetrik | undefined,
      masalah: [],
    };
  }

  const berkas = path.resolve(process.cwd(), "data", "regions", regionId, "manifest.json");
  if (!existsSync(berkas)) return null;
  try {
    return JSON.parse(readFileSync(berkas, "utf8")) as RegionManifest;
  } catch {
    return null;
  }
}

function shaUntuk(manifest: RegionManifest | null, berkas: string): string | null {
  return manifest?.berkas?.[berkas]?.sha256 ?? null;
}

/**
 * Uji lapangan 31 Oktober 2026 (dicatat di docs/STATE.md) yang menjadi alasan anchor RW.
 * Ini temuan uji coba, bukan metrik snapshot, sehingga tidak bisa diturunkan dari manifest.
 */
const UJI_ANCHOR: MetodologiUjiAnchor = {
  tanggal: "31 Oktober 2026",
  ruasPersen: "7%",
  rwPersen: "54,8%",
  kelurahanPersen: "20,6%",
  sumber: "docs/STATE.md",
};

export async function buildMetodologi(
  regionId: string = DEFAULT_REGION_ID,
): Promise<MetodologiData> {
  const region = getRegion(regionId);
  const ringkas = regionSummary(region);
  const manifest = await bacaManifest(regionId);
  const metrik = manifest?.metrik ?? null;
  const meta = await snapshotMeta(regionId);
  const lpse = await getLpseMeta(regionId);
  const catatan: string[] = [];

  if (!manifest) {
    catatan.push(
      `Manifest region ${regionId} belum tersedia; angka turunan belum bisa ditampilkan.`,
    );
  } else if (!metrik) {
    catatan.push("Manifest region belum memuat blok metrik; angka turunan belum bisa ditampilkan.");
  }

  const berkasBatas = [
    region.batas.kelurahan.berkas,
    region.batas.lingkungan?.berkas,
    region.batas.kecamatan?.berkas,
  ].filter((berkas): berkas is string => Boolean(berkas));

  const sumber: MetodologiSumber[] = [
    {
      id: "rup",
      nama: "Ekspor RUP",
      keterangan:
        "Daftar paket RUP seluruh satker daerah dari data.inaproc.id/rup, difilter ke sektor jalan, jembatan, dan drainase.",
      tanggal: tanggalIndonesia(meta.snapshot),
      berkas: region.sumber.rup
        ? [{ path: region.sumber.rup, sha256: shaUntuk(manifest, region.sumber.rup) }]
        : [],
    },
    {
      id: "detail",
      nama: "Detail RUP",
      keterangan:
        "Detail per paket (lokasi, bulan, metode) dari halaman detail RUP; sumber anchor RW/kelurahan/kecamatan.",
      tanggal: tanggalIndonesia(meta.snapshot),
      berkas: region.sumber.detail
        ? [{ path: region.sumber.detail, sha256: shaUntuk(manifest, region.sumber.detail) }]
        : [],
    },
    {
      id: "realisasi",
      nama: "Data INAPROC realisasi",
      keterangan:
        "Ekspor CSV realisasi transaksi (termasuk e-purchasing/e-katalog) untuk seluruh satker daerah.",
      tanggal: tanggalIndonesia(lpse.realisasi.snapshot),
      berkas: region.sumber.realisasi
        ? [{ path: region.sumber.realisasi, sha256: shaUntuk(manifest, region.sumber.realisasi) }]
        : [],
    },
    {
      id: "lpse",
      nama: "LPSE/SPSE",
      keterangan:
        "Rekam tender dan pengadaan langsung dari SPSE: pemenang, HPS, nilai kontrak, dan tautan bukti.",
      tanggal: tanggalIndonesia(lpse.snapshot),
      berkas: region.lpse?.keluaran
        ? [{ path: region.lpse.keluaran, sha256: shaUntuk(manifest, region.lpse.keluaran) }]
        : [],
    },
    {
      id: "batas",
      nama: "Batas wilayah ArcGIS Kota Tangerang",
      keterangan: `Batas kecamatan, kelurahan, dan ${ringkas.environmentLabel} dari layanan ArcGIS kota, diambil saat perakitan snapshot; dipakai untuk koroplet, bukan titik pekerjaan.`,
      tanggal: tanggalIndonesia(manifest?.dibuat),
      berkas: berkasBatas.map((berkas) => ({
        path: berkas,
        sha256: shaUntuk(manifest, berkas),
      })),
    },
  ];

  const pipeline: MetodologiTahap[] = metrik
    ? [
        {
          nama: "Ekspor RUP",
          keterangan: "Seluruh paket RUP daerah diambil, lalu disaring ke sektor jalan.",
          jumlah: `${idInt.format(metrik.sumber.rup)} baris`,
        },
        {
          nama: "Detail RUP",
          keterangan: "Detail per paket diambil untuk membaca lokasi dan metode.",
          jumlah: `${idInt.format(metrik.sumber.detail)} baris`,
        },
        {
          nama: "Realisasi",
          keterangan: "Transaksi realisasi dari Data INAPROC dibaca per kode RUP/paket.",
          jumlah: `${idInt.format(metrik.sumber.realisasi)} baris`,
        },
        {
          nama: "LPSE/SPSE",
          keterangan: "Kontrak tender dan pengadaan langsung dicocokkan lewat Kode RUP.",
          jumlah: `${idInt.format(metrik.sumber.lpse)} kontrak tercocok`,
        },
        {
          nama: "Normalisasi & validasi",
          keterangan:
            "Nama wilayah dinormalisasi dengan alias tervalidasi, anchor RW/kelurahan/kecamatan diperiksa, tanpa NLP/LLM.",
          jumlah: null,
        },
        {
          nama: "Snapshot publik",
          keterangan: "Snapshot bertanggal dirakit dari paket, kontrak, dan batas wilayah.",
          jumlah: `${idInt.format(metrik.paket)} paket`,
        },
        {
          nama: "Gerbang kualitas",
          keterangan: "region:check memeriksa kecocokan snapshot, manifest, dan batas wilayah.",
          jumlah: `${idInt.format(manifest?.masalah?.length ?? 0)} masalah`,
        },
      ]
    : [];

  let angka: MetodologiAngka | null = null;
  let penyedia: MetodologiPenyedia | null = null;

  if (metrik) {
    const presisi = metrik.presisi ?? {};
    const tanpaLokus = presisi.Kabupaten ?? Math.max(0, metrik.paket - metrik.berlokus);
    const urutanPresisi = ["RW", "Kelurahan", "Kecamatan", "Kabupaten"];
    const labelPresisi: Record<string, string> = {
      RW: `Nomor ${ringkas.environmentLabel}`,
      Kelurahan: "Kelurahan",
      Kecamatan: "Kecamatan",
      Kabupaten: "Tanpa lokus (umum kota)",
    };

    angka = {
      paket: metrik.paket,
      pagu: metrik.pagu,
      paguTampil: rupiahMiliar(metrik.pagu),
      perTahun: Object.entries(metrik.per_tahun ?? {})
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([tahun, jumlah]) => ({ tahun, jumlah })),
      presisi: urutanPresisi
        .filter((kunci) => typeof presisi[kunci] === "number")
        .map((kunci) => ({
          label: labelPresisi[kunci] ?? kunci,
          jumlah: presisi[kunci],
          persen: persen(presisi[kunci], metrik.paket),
        })),
      berlokus: metrik.berlokus,
      berlokusPersen: persen(metrik.berlokus, metrik.paket),
      tanpaLokus,
      tanpaLokusPersen: persen(tanpaLokus, metrik.paket),
      cakupan: [
        {
          label: "Kelurahan tersentuh",
          tercakup: metrik.kelurahan_tersentuh,
          total: metrik.sumber.batas_kelurahan,
          persen: persen(metrik.kelurahan_tersentuh, metrik.sumber.batas_kelurahan),
        },
        {
          label: `${ringkas.environmentLabel} tersentuh`,
          tercakup: metrik.unit_lingkungan_tersentuh,
          total: metrik.sumber.batas_rw,
          persen: persen(metrik.unit_lingkungan_tersentuh, metrik.sumber.batas_rw),
        },
        {
          label: "Kecamatan tersentuh",
          tercakup: metrik.kecamatan_tersentuh,
          total: metrik.sumber.batas_kecamatan,
          persen: persen(metrik.kecamatan_tersentuh, metrik.sumber.batas_kecamatan),
        },
      ],
    };

    const punyaRekam = metrik.paket - metrik.penyedia.tanpa_rekam;
    penyedia = {
      paket: metrik.paket,
      punyaRekam,
      punyaRekamPersen: persen(punyaRekam, metrik.paket),
      lpse: metrik.penyedia.lpse,
      realisasi: metrik.penyedia.realisasi,
      tanpaRekam: metrik.penyedia.tanpa_rekam,
      tanpaRekamPagu: metrik.penyedia.tanpa_rekam_pagu,
      tanpaRekamPaguTampil: formatRupiahFull(metrik.penyedia.tanpa_rekam_pagu),
      tanpaRekamPaguPersen: persen(metrik.penyedia.tanpa_rekam_pagu, metrik.pagu),
      unik: metrik.penyedia.unik,
      unikKontrak: metrik.penyedia.unik,
    };

    if (lpse.kontrakTotal && lpse.kontrakTotal !== punyaRekam) {
      catatan.push(
        `Meta LPSE/realisasi mencatat ${idInt.format(lpse.kontrakTotal)} paket berpenyedia, sedangkan manifest mencatat ${idInt.format(punyaRekam)}; selisih ini perlu ditinjau sebelum angka dipublikasikan.`,
      );
    }

    // Silang periksa manifest dengan snapshot aktif agar manifest basi tidak lolos diam-diam.
    try {
      const paketSnapshot = await createRoadPackageRepository(regionId).listRoadPackages();
      if (paketSnapshot.length !== metrik.paket) {
        catatan.push(
          `Snapshot aktif memuat ${idInt.format(paketSnapshot.length)} paket, manifest memuat ${idInt.format(metrik.paket)}; jalankan ulang region:check dan data:snapshot.`,
        );
      }
      const hitungPresisi = new Map<string, number>();
      for (const item of paketSnapshot) {
        hitungPresisi.set(item.presisi_peta, (hitungPresisi.get(item.presisi_peta) ?? 0) + 1);
      }
      const bedaPresisi = urutanPresisi.filter(
        (kunci) => (hitungPresisi.get(kunci) ?? 0) !== (presisi[kunci] ?? 0),
      );
      if (bedaPresisi.length) {
        catatan.push(
          `Rincian presisi snapshot dan manifest berbeda pada: ${bedaPresisi.join(", ")}.`,
        );
      }

      const namaPenyedia = new Set<string>();
      for (const item of paketSnapshot) {
        if (!item.kontrak) continue;
        for (const nama of [item.kontrak.penyedia, ...(item.kontrak.penyediaLain ?? [])]) {
          const bersih = nama.trim();
          if (bersih) namaPenyedia.add(bersih.toLocaleUpperCase("id-ID"));
        }
      }
      if (penyedia) {
        penyedia = { ...penyedia, unikKontrak: namaPenyedia.size };
        if (namaPenyedia.size !== penyedia.unik) {
          catatan.push(
            `Manifest mencatat ${idInt.format(penyedia.unik)} entri penyedia; setelah normalisasi nama gabungan, register menampilkan ${idInt.format(namaPenyedia.size)} nama unik.`,
          );
        }
      }
    } catch {
      catatan.push("Snapshot paket tidak dapat dibaca untuk silang periksa manifest.");
    }
  }

  if (manifest?.masalah?.length) {
    catatan.push(`Manifest mencatat ${manifest.masalah.length} masalah kualitas data.`);
  }

  return {
    lengkap: Boolean(metrik),
    catatan,
    region: {
      id: region.id,
      label: region.label,
      instansi: region.instansi,
      tahun: region.tahun,
      environmentLabel: ringkas.environmentLabel,
    },
    snapshot: {
      tanggal: tanggalIndonesia(meta.snapshot),
      sumber: meta.sumber,
      dibuat: tanggalIndonesia(manifest?.dibuat),
      masalah: manifest?.masalah ?? [],
    },
    sumber,
    pipeline,
    angka,
    penyedia,
    ujiAnchor: UJI_ANCHOR,
  };
}
