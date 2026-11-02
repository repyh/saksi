# Sisa 176 paket tanpa penyedia — sebab dan rencana menutupnya

Snapshot 2 November 2026. Setelah LPSE (731 paket) dan Data INAPROC realisasi (650 paket),
**1.381 dari 1.557** paket jalan punya nama penyedia. Sisa **176 paket · Rp111,8 M** (17,2% pagu).

Dokumen ini mencatat **kenapa** sisanya kosong dan **apa** langkah berikutnya — supaya angka ini
tidak ditebak ulang di sesi lain.

## Sebab, dengan bukti

| Sebab | Paket | Bukti |
|---|---:|---|
| **Satker belum ditarik** — realisasi baru diambil untuk Dinas PUPR | **58** | Dishub 53 · DLH 3 · Kecamatan Pinang 2 · Dispora 1 |
| **Dinas PUPR, tidak ada transaksi tercatat** | **118** | 59 TA2025 + 59 TA2026; **nol baris** realisasi untuk kode RUP-nya |
| **Tender yang tidak ada di daftar lelang SPSE** | 16 | kemiripan nama tertinggi dengan 192 baris lelang hanya **0,38** |
| **Dikecualikan** (di luar prosedur pengadaan) | 19 | tidak muncul di LPSE maupun realisasi |

Bukan karena data penyedia kosong: dari 10.131 baris realisasi, **semua punya `kode_rup`**
(0 tanpa), dan 157 baris berpenyedia `-` — **tidak satu pun** milik paket kita.

Rincian menurut satker:

```
 59  2025  Dinas Pekerjaan Umum Dan Penataan Ruang
 59  2026  Dinas Pekerjaan Umum Dan Penataan Ruang
 35  2025  Dinas Perhubungan
 18  2026  Dinas Perhubungan
  2  2025  Kecamatan Pinang
  1  2025  Dinas Lingkungan Hidup
  1  2026  Dinas Lingkungan Hidup
  1  2025  Dinas Kepemudaan Dan Olahraga
```

Pola jadwal 118 paket PUPR: 24 Maret 2026 · 15 Januari 2026 · 12 Agustus 2026 (belum/sedang
berjalan), dan 22 Februari 2025 · 19 Maret 2025 · 13 Oktober 2025 (kemungkinan dibatalkan atau
dieksekusi dengan kode RUP lain — belum bisa diuji tanpa data semua satker).

## Langkah: tarik semua satker `D44`

`scripts/realisasi.mjs` sekarang hanya memakai `--satker <kode>` tunggal (default PUPR). Dua opsi:

### Opsi A — lima satker yang muncul di snapshot (disarankan)

| Satker | Kode | 2025 | 2026 | Request (20 baris/hal) |
|---|---|---:|---:|---:|
| Dinas PUPR | `1.03.2.10.0.00.01.0000` | 9.210 | 1.143 | 519 (sudah) |
| Dinas Perhubungan | `2.15.0.00.0.00.16.0000` | 390 | 118 | 26 |
| Dinas Lingkungan Hidup | `2.10.2.11.0.00.27.0000` | 634 | 357 | 50 |
| Kecamatan Pinang | `7.01.2.13.1.05.40.0000` | 376 | 139 | 26 |
| Dinas Kepemudaan & Olahraga | `2.19.2.10.0.00.23.0000` | 904 | 199 | 56 |

Tambahan di luar yang sudah ada: **3.117 baris ≈ 158 request ≈ 3–4 menit** (jeda 250 ms + latensi).

### Opsi B — semua 190 satker D44

50.978 baris (37.799 + 13.179) ÷ 20 = **2.549 request ≈ 38–40 menit**. Baru dipakai kalau Opsi A
masih menyisakan paket yang seharusnya ada, atau kalau mau memastikan tidak ada RUP yang dieksekusi
satker lain.

### Perubahan skrip yang diperlukan

1. `--satker` menerima **daftar dipisah koma**, atau tambahkan `--semua-satker` yang mengambil
   daftar dari `/dashboard-api/filter/satker?instansi=D44` (190 entri) lalu menelusuri semuanya.
2. Kunci dedupe tetap `tahun:kode_paket:penyedia:nilai`; tambahkan `satker` ke ringkasan `per_rup`
   supaya transaksi lintas satker untuk satu RUP tidak tertukar.
3. Nama keluaran: `data/realisasi_kota_tangerang.json` (digabung) — jangan bikin berkas per satker
   supaya `lpse-repository.ts` tidak perlu berubah.
4. Jeda 250 ms dipertahankan; kalau muncul HTTP 429/503, naikkan ke 600 ms dan ulangi halaman itu
   (pola retry sudah ada di `scripts/realisasi.mjs`).

### Verifikasi setelah penarikan

```bash
node scripts/realisasi.mjs --satker 1.03.2.10.0.00.01.0000,2.15.0.00.0.00.16.0000,2.10.2.11.0.00.27.0000,7.01.2.13.1.05.40.0000,2.19.2.10.0.00.23.0000
npm run build
```

Harapan: `?kontrak=ADA` naik dari **1.381** ke sekitar **1.430** (58 paket satker lain), sisa turun
ke ~118. Setelah itu uji dua hipotesis untuk 118 paket PUPR:

- **RUP switch** — cocokkan nama + pagu 118 paket ke seluruh baris realisasi D44; kalau ada pasangan
  dengan pagu sama dan nama mirip tetapi `kode_rup` berbeda, paket dieksekusi dengan RUP lain.
- **Belum berjalan** — paket dengan jadwal Oktober–November 2026 memang belum bertransaksi; biarkan
  kosong dan biarkan UI menyebut "belum ada rekam publik".

Jangan menaikkan angka di dokumen/proposal sebelum penarikan benar-benar dijalankan dan dihitung
ulang dari data.
