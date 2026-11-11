// Aturan uji "RUP switch": paket register yang tidak punya rekam penyedia dicocokkan ke RUP lain
// yang namanya menunjuk pekerjaan yang sama. Aturan di sini sengaja ketat.
//
// Dua kesalahan yang harus dicegah:
//  1. Menyebut paket "dibatalkan" atau "tidak dikerjakan" hanya karena tidak ada baris realisasi.
//     Ketiadaan rekam bukan bukti apa pun tentang pelaksanaan.
//  2. Menyebut paket "dieksekusi lewat RUP lain" hanya karena namanya mirip. Nama jalan, kelurahan,
//     dan RW berulang setiap tahun, dan pagu dibulatkan (Rp200.000.000, Rp1.000.000.000), sehingga
//     kemiripan nama + pagu yang sama mudah terjadi pada dua pekerjaan yang berbeda.
//
// Karena itu pencocokan memakai **nama identik** (setelah normalisasi) atau **sidik** yang sama,
// bukan skor kemiripan; skor kemiripan hanya dipakai untuk menyusun daftar tinjauan manusia.

/**
 * Kata yang tidak membedakan identitas paket: pembungkus birokrasi ("Kegiatan Pembangunan Sarana
 * dan Prasarana di Kelurahan …"), verba kegiatan, dan label wilayah. "Lanjutan" **tidak** dibuang
 * karena paket lanjutan adalah paket yang berbeda.
 */
export const GENERIK = new Set(
  `paket kegiatan pekerjaan belanja modal pembangunan peningkatan rekonstruksi pemeliharaan
   rehabilitasi penataan pengaspalan pengerasan pembetonan pemasangan perbaikan pelebaran
   normalisasi satuan tahun anggaran ta kota tangerang sarana prasarana bangunan air irigasi
   lainnya dan di yang dsk kel kelurahan dau abt apbd apbdp dana alokasi umum`
    .split(/\s+/)
    .filter(Boolean),
);

/** Bentuk baku nama untuk perbandingan: huruf kecil, tanpa tanda baca, spasi tunggal. */
export function kunciNama(nama) {
  return String(nama ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Kata pembeda paket, urut abjad: nomor RW/RT, nama ruas, kelurahan, dan objek pekerjaan. */
export function sidikNama(nama) {
  const kata = new Set(
    kunciNama(nama)
      .split(" ")
      .filter((k) => k && !GENERIK.has(k)),
  );
  return [...kata].sort().join(" ");
}

/**
 * Indeks nama → daftar baris. `kunci` menentukan tingkat kelonggaran:
 * `kunciNama` menuntut nama identik, `sidikNama` masih menerima urutan kata dan pembungkus berbeda.
 */
export function indeksNama(daftar, ambilNama, kunci = kunciNama) {
  const peta = new Map();
  for (const baris of daftar) {
    const nama = kunci(ambilNama(baris));
    if (!nama) continue;
    const isi = peta.get(nama);
    if (isi) isi.push(baris);
    else peta.set(nama, [baris]);
  }
  return peta;
}

/**
 * Berapa paket yang berbagi pagu persis dengan paket lain di tahun dan satker yang sama, padahal
 * namanya berbeda. Angka ini menunjukkan mengapa pagu tidak boleh dipakai sendirian sebagai bukti.
 */
export function hitungDerauPagu(daftar, { tahun, satker, pagu, kunciRup }) {
  const peta = new Map();
  for (const baris of daftar) {
    const k = `${tahun(baris)}|${satker(baris)}|${pagu(baris)}`;
    const isi = peta.get(k);
    if (isi) isi.push(baris);
    else peta.set(k, [baris]);
  }
  let berbagi = 0;
  for (const baris of daftar) {
    const k = `${tahun(baris)}|${satker(baris)}|${pagu(baris)}`;
    const lain = (peta.get(k) ?? []).filter((x) => kunciRup(x) !== kunciRup(baris));
    if (lain.length) berbagi += 1;
  }
  return berbagi;
}

const BULAN = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
};

/**
 * Jadwal RUP ditulis "Juli 2026" — ubah menjadi "2026-07" supaya bisa dibandingkan dengan tanggal
 * snapshot. Jadwal yang belum lewat berarti paket masih dalam masa pelaksanaan: kosongnya rekam
 * bukan temuan.
 */
export function kunciBulan(teks) {
  const cocok = String(teks ?? "")
    .toLowerCase()
    .match(/([a-z]+)\s+(\d{4})/);
  const bulan = cocok ? BULAN[cocok[1]] : undefined;
  if (!bulan) return null;
  return `${cocok[2]}-${String(bulan).padStart(2, "0")}`;
}
