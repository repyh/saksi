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

/**
 * Prefiks badan usaha yang menempel pada nama tanpa pemisah, mis. `CVKARYA`.
 * Hanya dipakai kunci pembanding; `PDAM` dikecualikan agar tidak menjadi `PD AM`.
 */
const PREFIKS_MENEMPEL = new RegExp(
  `^(?:(?:koperasi|yayasan|persero|perum|firma|cv|pt|ud)(?=[A-Z0-9])|pd(?!AM)(?=[A-Z0-9]))`,
  "iu",
);

/**
 * Kunci pembanding nama penyedia. Huruf disamakan besar, lalu tanda baca dan spasi
 * dirapatkan: `CV. JABARU`, `CV  JABARU`, `CVKARYA` dan `CV. KARYA` bertemu pada
 * kunci yang sama. Nama yang hurufnya berbeda (mis. `PRIAMA` vs `PRIMA`) tetap dua
 * penyedia — tidak ada pencocokan samar.
 */
export function kunciPenyedia(nama: string) {
  const rapi = nama
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("id-ID")
    .replace(/[-'’]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!rapi) return "";
  return rapi.replace(PREFIKS_MENEMPEL, "$& ");
}

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
