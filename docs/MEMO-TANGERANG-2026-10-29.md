# Memo — Uji data SIRUP Tangerang vs Bandung (29 Oktober 2026, rev. 2)

Pertanyaan: **apakah Kab. Bandung bisa dipertahankan sebagai studi kasus, atau harus pindah ke
Tangerang seperti yang diusulkan dosen pada bimbingan 28 Oktober?**

**Jawaban rev. 2: Tangerang bukan hanya bisa — datanya lebih kaya dari Bandung.** Alasan
mempertahankan Bandung untuk FDS tinggal soal jadwal, bukan soal data.

> **Koreksi rev. 1.** Versi pertama memo ini menyimpulkan "pola koridor `Jl. A - B` hanya 0,4% di
> Tangerang vs 3,8% di Bandung, jadi layer garis tidak punya bahan". **Itu salah, dan salahnya di
> regex saya**, bukan di data: pola yang saya cari mewajibkan awalan literal `Jl.`, padahal Tangerang
> menulis koridor tanpa `Jl.` (`Pemeliharaan Jalan Kresek - Cempaka`) atau dengan kata penghubung
> (`Kp. Cakung Menuju pesantren Griya Tahfiz`). Setelah nama dibersihkan dan kedua sisi koridor
> diuji ke gazetteer, angkanya berbalik (tabel 2).

## Metode

- Endpoint tarikan: `GET /sirup/datatablectr/dataruppenyediakldi?idKldi={D..}&tahun={2025|2026}&iDisplayStart=0&iDisplayLength=4000&sEcho=1`
  tanpa login (header `X-Requested-With` + `Referer`). Skrip: `ingest/sirup_search.py`.
  Catatan: di endpoint pencarian `/sirup/caripaketctr/search`, parameter `kldi` dan `idsLokasi`
  **tidak** menyaring (diam-diam mengembalikan seluruh nasional).
- Snapshot 29 Oktober 2026. Gazetteer desa: Bandung `data/bandung_desa_coords.json` (280 desa/31 kec);
  Kab. Tangerang `data/scratch/tangerang_desa_wilayah.json` (274 desa/29 kec, BPS via
  `ibnux/data-indonesia`). Kota Tangerang 104 desa/13 kec; Tangsel 54 desa/7 kec.
- Pembersihan nama: hapus kode rekening di depan (`1598.25.397.`), decode entity HTML (`&#x27;`,
  `&amp;`), buka pembungkus `Belanja Modal Jalan Desa - …`, rapikan spasi.
- Filter "pekerjaan fisik" dan deteksi koridor **identik untuk semua wilayah**; angka di bawah hasil
  filter seragam ini, bukan angka resmi 5.013 paket di `KONSEP.md` (classifier proyek lebih ketat).

## Tabel 1 — Volume & keterpetaan ke desa

| Wilayah (`idKldi`) | RUP 2025+2026 | Paket fisik | Nama memuat desa/kelurahan | Paket jalan/drainase |
|---|---:|---:|---:|---:|
| Kab. Bandung (`D107`) | 23.386 | 5.363 (22,9%) | 76,2% | 2.487 |
| **Kab. Tangerang (`D50`)** | **51.322** | **6.535 (12,7%)** | **80,4%** | **6.680** |
| Kota Tangerang (`D44`) | 21.177 | 3.718 (17,6%) | 57,7% | — |
| Kota Tangerang Selatan (`D47`) | 28.951 | 2.007 (6,9%) | 56,7% | — |

Validasi metode: untuk Bandung hasilnya 76,2% desa + 5,5% kecamatan + 18,3% tanpa penanda, sejalan
dengan pipeline proyek (78,9% / 7,4% / 13,6%) pada subset yang lebih ketat.

## Tabel 2 — Potensi koridor jalan (nama sudah dibersihkan)

| Ukuran | Kab. Bandung | Kab. Tangerang |
|---|---:|---:|
| Paket jalan/drainase | 2.487 | **6.680** |
| Koridor ketat (penanda koridor + dua sisi resolve ke gazetteer) | 96 (**3,9%**) | **157** (2,4%) |
| Lintas kecamatan (≥2 kecamatan berbeda resolve) | 461 (18,5%) | **1.320 (19,8%)** |
| Kata hubung `menuju / arah / s-d` | 15 (0,6%) | **93 (1,4%)** |
| Pola `Jl. … - …` | 264 (10,6%) | 411 (6,2%) |

Nama koridor Kab. Tangerang yang terverifikasi: `Pemeliharaan Jalan Kresek - Cempaka`,
`Pemeliharaan Jalan Kedung - Sidoko`, `Peningkatan Jalan Klebet - Kemiri`,
`Peningkatan Jalan Bojong - Budimulya Kecamatan Cikupa`,
`Pemeliharaan Jalan Beton Rt. 002/002 Menuju Arah Rt. 001/002 Ds. Kemuning Kec. Legok`.

Jadi: **rate** koridor sedikit lebih rendah di Tangerang (2,4% vs 3,9%), tetapi **jumlah absolutnya
lebih banyak** (157 vs 96) dan paket lintas kecamatan 2,9× lebih banyak (1.320 vs 461). Layer garis
koridor bisa dibangun di Tangerang.

## Tabel 3 — Perkiraan 5 sektor Kab. Tangerang (kata kunci kasar, bukan classifier proyek)

| Sektor | Paket | Pagu |
|---|---:|---:|
| Jalan, Jembatan & Drainase | 3.651 | Rp859,8 M |
| Fasilitas Publik Lainnya | 838 | Rp491,1 M |
| Fasilitas Pendidikan | 461 | Rp266,7 M |
| Permukiman, Air & Sanitasi | 438 | Rp55,8 M |
| Penerangan & Perhubungan | 8 | Rp1,6 M |
| **Total fisik** | **7.397** | **Rp2.228,7 M** |

Tangerang menghasilkan cerita lebih besar (Rp2,2 T vs Rp0,99 T) dan paket lebih banyak. Angka ini
perkiraan; kalau dipakai, classifier 5 sektor proyek harus dijalankan ulang.

## Catatan kualitas nama (beban kerja kalau pindah)

| Ciri | Bandung | Tangerang |
|---|---:|---:|
| Kode rekening di depan nama | 0,0% | **5,0%** |
| Entity HTML (`&#x27;`, `&amp;`) | 0,7% | 0,9% |
| Nama HURUF BESAR semua | 2,4% | 2,8% |
| Awalan `Belanja…` (operasional) | 54,3% | 56,4% |
| Nama memuat RT/RW | 50,2% | **76,4%** |
| Nama memuat `Kp./Kampung` | 3,6% | **6,7%** |
| Nama memuat `Gang/GG` | 0,5% | **2,2%** |

Tangerang lebih kotor di permukaan (5% kode rekening, lebih banyak pembungkus), tetapi lebih kaya
penanda mikro (RT/RW 76%, kampung 6,7%, gang 2,2%). Pembersihannya murah — semua pola di atas masuk
satu fungsi `clean()`.

## Kesimpulan

1. **Klaim "Tangerang tidak punya lokasi mikro / tidak ada koridor" gugur dua-duanya.** Desa-match
   80,4% (Bandung 76,2%), koridor absolut 157 (Bandung 96), lintas kecamatan 1.320 (Bandung 461).
2. **Keunggulan Bandung tinggal dua, dan keduanya kecil:** kepadatan nama sekolah 2,3× lebih tinggi
   (15,6% vs 6,7%) sehingga fitur "cari sekolah" lebih kaya; rate koridor sedikit lebih tinggi
   (3,9% vs 2,4%).
3. **Alasan jujur mempertahankan Bandung untuk FDS = jadwal.** Pipeline, gazetteer 280 desa, angka
   5.013/Rp993,95 M, dan seluruh dokumen FDS sudah berdiri di atas Bandung.
4. **Jangan lagi memakai argumen data untuk menolak Tangerang** — sudah terbantah oleh pengujian ini.

## Rekomendasi

- **FDS 1 Nov:** tetap Kab. Bandung, dengan alasan jadwal yang disebut terbuka (bukan alasan data).
- **Bimbingan berikutnya:** *"arahan Tangerang sudah diuji. Tangerang bukan hanya bisa, datanya lebih
  besar: 51.322 RUP, 7.397 paket fisik ≈ Rp2,23 T, 80,4% terpetakan ke 274 desa, 157 paket koridor.
  Bandung dipakai untuk FDS karena pipeline dan angkanya sudah jadi; Tangerang jadi bukti replikasi
  di proposal 11 November."*
- **Proposal 11 Nov:** dua pilihan yang sama-sama kuat — (a) Bandung utama + Tangerang replikasi (satu
  slide, membuktikan generalisasi), atau (b) Tangerang jadi studi kasus utama kalau dosen menagih,
  dengan Bandung sebagai pembanding. Biaya pindah realistis **1–2 hari** karena tarikan mentah dan
  gazetteer sudah ada (`data/scratch/tangerang_kab_2025.json`, `…_2026.json`,
  `tangerang_desa_wilayah.json`).

## Catatan tambahan

- Snapshot Bandung TA2026 sekarang **11.867** baris, bukan 11.718 seperti di `KONTEKS-UPDATE`;
  total 23.386 (bukan 23.237). SIRUP menambah paket sepanjang tahun — sebutkan tanggal snapshot di
  dokumen agar tidak dianggap salah hitung.
- Kolom `lokasi` di SIRUP tetap hanya sampai tingkat kabupaten/kota untuk kedua wilayah
  ("Banten, Tangerang (Kab.)", "Jawa Barat, Bandung (Kab.)"), jadi ekstraksi tetap dari teks `nama`
  paket — metode 3-tier tidak berubah.
