# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Vite + React 19 + TypeScript + Tailwind CSS 4, peta Leaflet + tile OSM. Tanpa backend, tanpa login,
tanpa database sampai FDS 1 November 2026. Data disajikan sebagai JSON statis dari `web/public/data/`.

## Users

- **Warga di 251 desa/kelurahan Kab. Tangerang** yang tinggal di ruas paket jalan 2025–2026. Situasi:
  jalan di depan rumah berlubang/retak/genangan, mereka ingin tahu apakah ruas itu baru dibangun,
  dengan uang berapa, dan bagaimana membuat keluhannya punya konsekuensi. Pekerjaan utama: menemukan
  paket yang membangun ruas itu, lalu mengirim laporan berfoto yang menempel pada nomor paket.
- **Dinas Bina Marga & Sumber Daya Air** — menerima daftar paket yang masih dalam masa pemeliharaan
  dan dilaporkan rusak; dasar menagih kontraktor tanpa anggaran baru.
- **Inspektorat / DPRD** — sampel lapangan yang bisa diuji, bukan laporan berjenjang.
- **Juri FDS/MIA 2026 (Web In Action)** — menilai dalam hitungan detik pertama: apakah ini produk
  yang bekerja, apakah angkanya bisa dipercaya, apakah bedanya nyata.

## Product Purpose

SAKSI menautkan **3.602 paket pekerjaan jalan Kab. Tangerang (Rp848,60 Miliar)** dengan **bukti warga
berfoto** di ruas yang sama, sehingga laporan warga berubah dari keluhan menjadi bukti yang punya
nomor paket, tanggal, dan penerima yang jelas. Sukses = warga bisa menyebut nomor RUP saat mengadu,
dan instansi tidak bisa mengatakan laporan itu tidak ada.

## Positioning

Lapisan penaut, bukan kanal aduan baru: satu laporan warga terikat ke satu `kode_rup`, dengan
**badge presisi** yang menyatakan bagaimana titik itu diketahui (desa / koridor / kecamatan), dan
**jendela masa pemeliharaan** yang mengubah laporan menjadi dasar penagihan retensi. Pembanding
internasional: DPWH Filipina menerbitkan koordinat per kontrak; Indonesia tidak — karena itu presisi
diturunkan dari teks nama paket + gazetteer dan dinyatakan terbuka, bukan disembunyikan.

## Operating Context

- **Lomba:** MIA 2026 / Web In Action, subtema *Civic Reporting & Accountability*. FDS 1 November
  2026: repo publik, README, PDF ≤10 halaman, screenshot landing, dan minimal satu halaman fitur hidup.
- **Dua layar yang dinilai:** `#/` (peta audit jalan) dan `#/lapor` (alur lapor 3 langkah). Keduanya
  di-screenshot ke PDF, jadi layar harus utuh dan padat data tanpa perlu interaksi untuk terlihat benar.
- **Perangkat:** desktop 1440×900 untuk screenshot, tetapi harus bekerja di ponsel 360 px — warga
  melapor dari jalan, sering satu tangan, sinyal lambat.
- **Data:** snapshot SIRUP 29 Oktober 2026, dimuat saat runtime dari JSON statis (2,9 MB), difilter di
  klien. Angka akan bergeser bila SIRUP menambah paket; dokumen baru wajib menyebut tanggal snapshot.
- **Tanpa akun:** identitas pelapor tidak diminta; laporan disimpan di `localStorage` perangkat.

## Capabilities and Constraints

**Bekerja sekarang (FDS):** peta 3.331 titik/garis dengan filter tahun, kecamatan, dan jenis
pekerjaan; register paket yang bisa diklik; panel detail dengan badge data resmi; alur lapor 3 langkah
(foto + blur manual + EXIF dibuang, kategorisasi kerusakan, lokasi + 3 kandidat paket dengan
`MatchScore`); penyimpanan lokal dan kode laporan.

**Batasan keras (jangan dilanggar tanpa bertanya):**

1. Produk = **jalan** saja. Tidak ada filter 5 sektor di UI.
2. Tanpa NLP/LLM di ekstraksi lokasi; tanpa computer vision; **tanpa input luas cm²**.
3. **Jangan memaksa titik.** 271 paket (7,5%) tanpa penanda lokasi tidak dipetakan; tampil di tabel
   dengan label `Lokasi: Kab. Tangerang (Umum)`.
4. Bahasa indikator selalu **"Diduga Tidak Sesuai"** — tidak pernah korupsi, fiktif, atau tuduhan.
5. Penyedia disebut nama asli tetapi berimbang: tanpa skor gabungan, selalu dengan penyebut.
6. Privasi: blur wajah & plat + hapus EXIF **di browser sebelum** data disimpan.
7. Format angka Indonesia: `3.602`, `92,5%`, `Rp848,60 Miliar`.
8. Teks badge persis: `DATA RESMI (SIRUP / BINA MARGA)`, `SIMULASI PROTOTIPE`, `Titik Desa`,
   `Garis Koridor`, `Kecamatan`.
9. Tanpa backend, tanpa login, tanpa Next.js, tanpa UI kit, tanpa state manager. Dependency peta hanya
   Leaflet.

**Terbuka:** rekam jejak penyedia (FR-07) belum punya data tarikan LPSE per penyedia; koridor belum
punya geometri mengikuti jalan (hanya dua titik ujung); backend FastAPI + Postgres menyusul setelah 1
November.

## Brand Commitments

- Nama **SAKSI** — *Sistem Akuntabilitas & Komparasi Spasial Infrastruktur*. Nada: tenang, presisi,
  tidak menuduh; bahasa Indonesia dengan istilah teknis Inggris yang lazim (dashboard, layer, koridor).
- Kejujuran angka adalah identitas merek: setiap titik menyatakan presisinya, setiap klaim membawa
  penyebut, setiap simulasi membawa badge amber.
- Tidak ada gamifikasi, tidak ada hype, tidak ada citra drone dramatis.

## Evidence on Hand

- `data/saksi_tangerang_2025_2026.json` — 5.487 paket fisik, 3.602 di antaranya jalan (Rp848,60 M).
- `data/tangerang_desa_coords.json` — 274 desa/kelurahan BPS `3603`, 29 kecamatan, koordinat OSM.
- `data/manifest.json` — sumber, endpoint, tanggal snapshot, peringatan.
- `docs/` — transkrip bimbingan dosen, memo uji Tangerang, uji NLP lokasi (bukti keputusan).
- **Tidak ada:** foto kerusakan asli, data penyedia per paket, backend, akun pengguna. Foto contoh
  tidak boleh dipalsukan sebagai foto nyata; laporan contoh wajib berlabel `SIMULASI PROTOTIPE`.

## Product Principles

1. **Presisi dinyatakan, bukan diasumsikan.** Setiap titik membawa cara ia diketahui.
2. **Angka lebih dulu, retorika belakangan.** Tampilkan pagu, tahun, satker, jarak, skor — apa adanya.
3. **Tidak menuduh.** Kata terkuat adalah "diduga"; yang disajikan adalah selisih yang bisa diperiksa.
4. **Satu laporan, satu paket.** Bila tidak ada dasar penautan, katakan "Tidak Dapat Ditautkan" dan
   tetap simpan laporan.
5. **Warga memegang kendali privasi.** Blur dan pembersihan EXIF terjadi di perangkat, sebelum simpan.

## Accessibility & Inclusion

Target WCAG 2.2 AA: kontras teks ≥4,5:1, fokus keyboard terlihat, kontrol asli (bukan div yang
menyamar jadi tombol), target sentuh ≥44 px pada alur lapor, `prefers-reduced-motion` dihormati, dan
seluruh alur lapor selesai tanpa mouse. Peta bukan satu-satunya jalan masuk data: register tabel
memuat semua paket, termasuk yang tidak dipetakan.
