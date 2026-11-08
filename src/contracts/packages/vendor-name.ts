/**
 * Normalisasi nama penyedia gabungan yang berasal dari satu baris transaksi.
 *
 * Satu baris realisasi kadang memuat beberapa badan usaha sekaligus, mis.
 * `CV. BUMI SALAKA, CV. ZARMINA FAIQA`. Nama seperti itu boleh dipecah **hanya**
 * bila setiap segmen benar-benar diawali prefiks badan usaha yang valid dan
 * masih punya nama setelah prefiks. Tanpa syarat itu, nama dikembalikan apa
 * adanya supaya nama resmi seperti `PT. Telekomunikasi Indonesia, Tbk.` atau
 * nama instansi yang memakai koma tidak ikut terpotong.
 */

/** Prefiks badan usaha yang diakui. Urutan panjang dulu agar tidak salah cocok. */
const PREFIKS_BADAN_USAHA = [
  "koperasi",
  "yayasan",
  "persero",
  "perum",
  "firma",
  "cv",
  "pt",
  "ud",
  "pd",
] as const;

/**
 * Segmen valid = prefiks + (titik dan/atau spasi) + nama tidak kosong.
 * `PDAM` tidak cocok karena setelah `pd` tidak ada titik/spasi.
 */
const POLA_NAMA_BERBADAN = new RegExp(
  `^(?:${PREFIKS_BADAN_USAHA.join("|")})(?:\\.\\s*|\\s+)(.+)$`,
  "iu",
);

/** Batas aman: nama dengan lebih dari 6 segmen tidak dipecah. */
const MAKS_SEGMEN = 6;

function namaSetelahPrefiks(segmen: string): string | null {
  const cocok = segmen.match(POLA_NAMA_BERBADAN);
  const nama = cocok?.[1]?.trim();
  return nama ? nama : null;
}

/**
 * Pecah nama penyedia gabungan menjadi daftar nama bila semua segmen valid.
 * Deduplikasi case-insensitive dengan mempertahankan ejaan pertama.
 * Tidak memakai fuzzy matching.
 */
export function normalizeVendorNames(nama: string | null | undefined): string[] {
  const mentah = nama?.trim();
  if (!mentah) return [];

  const segmen = mentah.split(",").map((bagian) => bagian.trim());
  if (segmen.length < 2 || segmen.length > MAKS_SEGMEN) return [mentah];

  const namaValid: string[] = [];
  for (const bagian of segmen) {
    const namaBersih = namaSetelahPrefiks(bagian);
    if (!namaBersih) return [mentah];
    namaValid.push(bagian);
  }

  const unik: string[] = [];
  const terlihat = new Set<string>();
  for (const bagian of namaValid) {
    const kunci = bagian.toLocaleLowerCase("id-ID");
    if (terlihat.has(kunci)) continue;
    terlihat.add(kunci);
    unik.push(bagian);
  }

  return unik.length ? unik : [mentah];
}
