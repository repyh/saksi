# Uji matching paket → ruas (Kota Tangerang)

Uji kelayakan 31 Okt 2026, menjawab pertanyaan: *kalau ada layer ruas resmi, seberapa jauh paket
SIRUP bisa ditempelkan ke ruas jalan yang benar?*

## Bahan

| | |
|---|---|
| RUP | `idKldi=D44` (Kota Tangerang), TA 2025 + 2026 — **21.402 baris** (11.604 + 9.798), ditarik langsung dari `sirup.inaproc.id` 31 Okt 2026 |
| Ruas | `Dinas_PU_TR/Jaringan_Jalan_Kota_Tangerang_2024` — **6.373 segmen**, **5.751 nama unik** (`namobj`), 13 kecamatan |
| Metode | normalisasi nama (buang `Jl./Jalan/Gg.`, tanda baca, huruf kecil), cocokkan nama ruas sebagai frasa utuh di nama paket; fuzzy `difflib` cutoff 0,86 untuk sisanya |

## Hasil

1. **Kandidat paket fisik** (kata kerja konstruksi + objek jalan/jembatan/drainase/trotoar, tanpa
   gedung/puskesmas/sekolah): **1.557 paket**.
2. Dari kandidat itu, yang **menyebut nama jalan spesifik**: hanya **232 paket (15%)**. Sisanya
   generik: "Jalan Lingkungan", "Jalan Utama RW", atau "Jalan Baja" (itu nama Puskesmas, bukan jalan).
3. Dari 242 nama jalan yang disebut, **94 cocok persis (38,8%)** dan **17 lagi cocok lewat fuzzy**
   (mis. `Sambi Doyong` → `Jl. Sambi Doyong`, `Irigasi Syphon` → `Jl. Irigasi Sipon`) → **≈46%**.
4. Artinya: **±7% dari seluruh paket fisik** bisa dipasangkan ke satu ruas bernama. Paket yang
   berhasil: **91 paket, pagu Rp108,05 M** (sebelum fuzzy).
5. Rinciannya ada di `docs/uji-matching-kota-232.csv` (232 baris, kolom ruas + kecamatan).

## Temuan yang lebih penting: anchor sebenarnya adalah RW

Urutan prioritas anchor lokasi di nama paket (hierarkis, RW menang atas kelurahan):

| Anchor yang disebut nama paket | Paket | % dari 1.557 |
|---|---:|---:|
| **RW** (`RW. 04`, `RW 12`) | **853** | **54,8%** |
| Kelurahan (`Kel. Poris Jaya`, nama kelurahan) | 320 | 20,6% |
| Kecamatan | 19 | 1,2% |
| Tanpa anchor apa pun | 365 | 23,4% |

Kota Tangerang punya **1.020 poligon RW** dan **5.167 poligon RT** di server ArcGIS-nya. Jadi jalur
yang benar bukan memaksa paket ke ruas (7% berhasil), tetapi **paket → poligon RW** (55% punya
anchor), lalu ruas hanya sebagai pemurnian ketika namanya ada.

## Batasan

- Nama ruas tidak unik: 436 nama dipakai >1 segmen (`Jl. Melati` 10×). Tanpa kecamatan, "Jl. Melati"
  tidak bisa dipastikan. Uji ini memakai kecamatan bila tersedia di data ruas, bukan di nama paket.
- Beberapa ruas di layer bernama sama dengan kelurahan/kecamatan (`Jl. Kelurahan`, `Jl. Kecamatan
  Periuk`) — itu sengaja dikecualikan karena menghasilkan pencocokan palsu.
- Fuzzy bisa salah: `Perintis Kemerdekaan Kec` → `Jl. Perintis Kemerdekaan 3` benar, tetapi pola
  seperti ini perlu ditinjau manual sebelum dipakai untuk klaim.
- Angka ini **tidak** mengubah produk FDS: studi kasus tetap Kabupaten Tangerang, yang tidak punya
  layer ruas sama sekali.

## Kalau dilanjutkan (setelah FDS)

1. Tarik RUP `D44` penuh, bangun tabel `paket ↔ RW` dengan 1.020 poligon RW.
2. Untuk 7% yang menyebut ruas, simpan `kode_ruas` + geometri `LineString` → peta bisa menggambar
   ruas, bukan titik.
3. Untuk 23% tanpa anchor, biarkan di tabel — jangan dipaksa.
