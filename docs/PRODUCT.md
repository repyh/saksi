# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4, shadcn/base-ui, peta MapLibre GL JS
6.16 dengan vector style **OpenFreeMap Positron**. Peta dasar dari satu variabel
`NEXT_PUBLIC_BASEMAP_URL` (berisi URL style JSON; default
`https://tiles.openfreemap.org/styles/positron`; atribusi OpenStreetMap/OpenFreeMap) — tidak ada
pemilih basemap di produk. Prisma + Better Auth opsional:
build lolos tanpa `DATABASE_URL`. Bukti foto laporan disimpan di Supabase Storage.

## Users

- **Warga di 85 dari 104 kelurahan Kota Tangerang** yang tinggal di wilayah paket jalan 2025–2026.
  Situasi: jalan di depan rumah berlubang/retak/genangan, mereka ingin tahu apakah ruas itu baru
  dibangun, dengan uang berapa, dan bagaimana membuat keluhannya punya konsekuensi. Pekerjaan utama:
  menemukan paket yang membangun wilayah itu, lalu mengirim laporan berfoto yang menempel pada nomor
  paket.
- **Dinas teknis pengelola jalan** — menerima daftar paket yang masih dalam masa pemeliharaan
  dan dilaporkan rusak; dasar menagih kontraktor tanpa anggaran baru.
- **Inspektorat / DPRD** — sampel lapangan yang bisa diuji, bukan laporan berjenjang.
- **Juri FDS/MIA 2026 (Web In Action)** — menilai dalam hitungan detik pertama: apakah ini produk
  yang bekerja, apakah angkanya bisa dipercaya, apakah bedanya nyata.

## Product Purpose

SAKSI menautkan **1.634 paket pekerjaan jalan Kota Tangerang (Rp683,34 Miliar)** dengan **bukti warga
berfoto** di wilayah yang sama, sehingga laporan warga berubah dari keluhan menjadi bukti yang punya
nomor paket, tanggal, dan penerima yang jelas. Sukses = warga bisa menyebut nomor RUP saat mengadu,
dan instansi tidak bisa mengatakan laporan itu tidak ada.

## Positioning

Lapisan penaut, bukan kanal aduan baru: satu laporan warga terikat ke satu `kode_rup`, dengan
**tingkat anchor lokasi** yang menyatakan seberapa dalam lokasi itu diketahui (RW / kelurahan /
kecamatan), dan **jendela masa pemeliharaan** yang mengubah laporan menjadi dasar penagihan retensi.
Tidak ada pin per paket karena tidak ada koordinat pekerjaan di sumber resmi. Pembanding
internasional: DPWH Filipina menerbitkan koordinat per kontrak; Indonesia tidak — karena itu peta
memakai poligon wilayah resmi dan batasannya dinyatakan terbuka, bukan disembunyikan.

## Operating Context

- **Lomba:** MIA 2026 / Web In Action, subtema *Civic Reporting & Accountability*. FDS 1 November 2026
  sudah lewat (repo publik, README, PDF ≤10 halaman, screenshot landing, halaman fitur hidup); jadwal
  berikutnya penyisihan 11 November 2026 dan final 28 November 2026.
- **Dua layar yang dinilai:** `/` (peta audit jalan) dan `/laporan` (alur lapor 3 langkah). Keduanya
  di-screenshot ke PDF, jadi layar harus utuh dan padat data tanpa perlu interaksi untuk terlihat benar.
- **Perangkat:** desktop 1440×900 untuk screenshot, tetapi harus bekerja di ponsel 360 px — warga
  melapor dari jalan, sering satu tangan, sinyal lambat.
- **Data:** ekspor RUP `data.inaproc.id` (28.699 baris D44) + detail RUP + realisasi, snapshot 5 November 2026. Filter dijalankan di
  server lewat route `/api/packages` (tahun anggaran, kecamatan, kelurahan, jenis pekerjaan, status
  rekam kontrak, pencarian teks); default "Hanya paket berlokasi" menampilkan 1.286 dari 1.634 paket.
  Angka akan bergeser bila SIRUP menambah paket; dokumen baru wajib menyebut tanggal snapshot.
- **Tanpa akun:** identitas pelapor tidak diminta; draf disimpan di perangkat (IndexedDB), laporan
  terkirim disimpan di server dengan foto di Supabase Storage, dan akun hanya perlu untuk melihat
  riwayat laporan sendiri.

## Capabilities and Constraints

**Bekerja sekarang:** peta koroplet batas wilayah resmi dengan segmented control kecamatan (13
poligon) / kelurahan (104) / RW (1.020); filter tahun anggaran, kecamatan, kelurahan (checkbox), jenis
pekerjaan, status rekam kontrak (ADA/TANPA LPSE), dan pencarian teks; register paket yang bisa diklik;
panel detail dengan penyedia, nilai kontrak, dan tautan sumber; halaman rekam penyedia; alur lapor
(foto + blur manual + EXIF dibuang, kategorisasi kerusakan, lokasi + kandidat paket dengan
`MatchScore`); penyimpanan laporan dan kode laporan.

**Batasan keras (jangan dilanggar tanpa bertanya):**

1. Produk = **jalan** saja. Tidak ada filter 5 sektor di UI.
2. Tanpa NLP/LLM di ekstraksi lokasi; tanpa computer vision; **tanpa input luas cm²**.
3. **Jangan memaksa titik.** Tidak ada pin/jitter per paket: peta hanya koroplet poligon wilayah.
   348 paket (21,3%) tanpa lokus hanya tampil di tabel dengan label `Lokasi umum · Kota Tangerang`.
4. Bahasa indikator selalu **"Diduga Tidak Sesuai"** — tidak pernah korupsi, fiktif, atau tuduhan.
5. Penyedia disebut nama asli tetapi berimbang: tanpa skor gabungan, selalu dengan penyebut; 208 paket
   tanpa rekam publik ditandai apa adanya, bukan ditebak.
6. Privasi: blur wajah & plat + hapus EXIF **di browser sebelum** data disimpan.
7. Format angka Indonesia: `1.634`, `78,7%`, `Rp683,34 Miliar`.
8. Label sumber data persis: `Data resmi (LPSE)` dan `Data resmi (INAPROC)`; tidak ada badge yang
   mengklaim presisi titik.
9. Stack terkunci: Next.js App Router + React 19 + Tailwind v4 + shadcn/base-ui; peta hanya MapLibre
   GL JS 6.16 dengan OpenFreeMap Positron; tanpa state manager, tanpa pemilih basemap.

**Terbuka:** 208 paket (Rp130,67 M) belum punya rekam penyedia publik; tidak ada koordinat pekerjaan
sehingga peta tetap koroplet; geometri ruas jalan (bukan poligon wilayah) belum ada.

## Brand Commitments

- Nama **SAKSI** — *Sistem Akuntabilitas & Komparasi Spasial Infrastruktur*. Nada: tenang, presisi,
  tidak menuduh; bahasa Indonesia dengan istilah teknis Inggris yang lazim (dashboard, layer, kuantil).
- Kejujuran angka adalah identitas merek: setiap poligon menyatakan tingkat anchor-nya, setiap klaim
  membawa penyebut, setiap simulasi membawa badge amber.
- Tidak ada gamifikasi, tidak ada hype, tidak ada citra drone dramatis.

## Evidence on Hand

- `data/saksi_kota_tangerang_2025_2026.json` — 1.634 paket jalan Kota Tangerang (Rp683,34 M).
- `data/rup_kota_tangerang_2025_2026.json` — 21.402 baris RUP D44 TA 2025–2026 (snapshot).
- `data/rup_detail_kota_tangerang.json` — enrich detail RUP 3 November 2026.
- `data/lpse_kota_tangerang_2025_2026.json` + `data/realisasi_kota_tangerang.json` — rekam penyedia
  (LPSE/SPSE dan ekspor CSV satker D44 di Data INAPROC).
- Batas wilayah resmi RW/kelurahan/kecamatan — ArcGIS Kota Tangerang (13 / 104 / 1.020 poligon).
- `docs/` — transkrip bimbingan dosen, memo uji Tangerang, uji NLP lokasi (bukti keputusan).
- **Tidak ada:** koordinat pekerjaan per paket, foto kerusakan asli, data penyedia untuk 208 paket.
  Foto contoh tidak boleh dipalsukan sebagai foto nyata; laporan contoh wajib berlabel
  `SIMULASI PROTOTIPE`.

## Product Principles

1. **Presisi dinyatakan, bukan diasumsikan.** Setiap poligon membawa tingkat anchor yang dipakai.
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
