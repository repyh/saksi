/**
 * Hitungan jadwal harian pada zona waktu IANA tanpa dependensi.
 *
 * Dipakai penjadwal ingestion di dalam server Next (src/instrumentation.ts). Semua fungsi
 * murni: tidak membaca berkas, tidak menyentuh jam global kecuali lewat parameter `sekarang`.
 */

export interface BagianLokal {
  tahun: number;
  bulan: number;
  hari: number;
  jam: number;
  menit: number;
  detik: number;
}

const pemformat = new Map<string, Intl.DateTimeFormat>();

function formatUntuk(zona: string): Intl.DateTimeFormat {
  const tersimpan = pemformat.get(zona);
  if (tersimpan) return tersimpan;
  const format = new Intl.DateTimeFormat("en-GB", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  pemformat.set(zona, format);
  return format;
}

/** Tanggal dan jam dinding pada `zona` untuk satu instan. Melempar RangeError bila zona tidak dikenal. */
export function bagianLokal(instan: Date, zona: string): BagianLokal {
  const hasil: Record<string, string> = {};
  for (const bagian of formatUntuk(zona).formatToParts(instan)) {
    hasil[bagian.type] = bagian.value;
  }
  return {
    tahun: Number(hasil.year),
    bulan: Number(hasil.month),
    hari: Number(hasil.day),
    jam: Number(hasil.hour),
    menit: Number(hasil.minute),
    detik: Number(hasil.second),
  };
}

/** Selisih zona (milidetik) pada instan tertentu; Jakarta = +7 jam. */
function selisihZona(instan: Date, zona: string): number {
  const bagian = bagianLokal(instan, zona);
  const sebagaiUtc = Date.UTC(
    bagian.tahun,
    bagian.bulan - 1,
    bagian.hari,
    bagian.jam,
    bagian.menit,
    bagian.detik,
  );
  return sebagaiUtc - Math.floor(instan.getTime() / 1000) * 1000;
}

/**
 * Instan UTC untuk jam dinding tertentu pada `zona`. Iterasi menangani pergeseran DST:
 * tebakan pertama memakai offset pada tebakan itu, lalu offset dihitung ulang di hasilnya.
 */
export function instanLokal(
  tahun: number,
  bulan: number,
  hari: number,
  jam: number,
  menit: number,
  zona: string,
): Date {
  const target = Date.UTC(tahun, bulan - 1, hari, jam, menit, 0, 0);
  let calon = target;
  for (let putaran = 0; putaran < 3; putaran += 1) {
    const berikut = target - selisihZona(new Date(calon), zona);
    if (berikut === calon) break;
    calon = berikut;
  }
  return new Date(calon);
}

/** Kejadian terjadwal terakhir yang sudah lewat (atau tepat sekarang) pada `zona`. */
export function jadwalTerakhir(
  jam: number,
  menit: number,
  zona: string,
  sekarang: Date = new Date(),
): Date {
  const bagian = bagianLokal(sekarang, zona);
  const hariIni = instanLokal(bagian.tahun, bagian.bulan, bagian.hari, jam, menit, zona);
  if (hariIni.getTime() <= sekarang.getTime()) return hariIni;
  const kemarin = bagianLokal(new Date(hariIni.getTime() - 86_400_000), zona);
  return instanLokal(kemarin.tahun, kemarin.bulan, kemarin.hari, jam, menit, zona);
}

/** Kejadian terjadwal berikutnya setelah `sekarang`. */
export function jadwalBerikut(
  jam: number,
  menit: number,
  zona: string,
  sekarang: Date = new Date(),
): Date {
  const terakhir = jadwalTerakhir(jam, menit, zona, sekarang);
  if (terakhir.getTime() > sekarang.getTime()) return terakhir;
  const besok = bagianLokal(new Date(terakhir.getTime() + 86_400_000), zona);
  return instanLokal(besok.tahun, besok.bulan, besok.hari, jam, menit, zona);
}

/** Kunci tanggal setempat, untuk memastikan satu pekerjaan hanya berjalan sekali per hari. */
export function kunciHari(sekarang: Date, zona: string): string {
  const bagian = bagianLokal(sekarang, zona);
  return `${bagian.tahun}-${String(bagian.bulan).padStart(2, "0")}-${String(bagian.hari).padStart(2, "0")}`;
}
