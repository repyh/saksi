# Sisa paket tanpa penyedia — sebab dan rencana menutupnya

Snapshot 2 November 2026. Setelah LPSE (731 paket) dan Data INAPROC realisasi (686 paket),
**1.417 dari 1.557** paket jalan punya nama penyedia. Sisa **140 paket · Rp98,6 M** (15,2% pagu).

> Riwayat angka: sebelum Opsi A dijalankan sisanya **176 paket · Rp111,8 M**; penarikan empat
> satker lain menutup **36 paket** (Dishub 31, DLH 2, Kecamatan Pinang 2, Dispora 1 — 34 di
> antaranya e-purchasing, 2 pengadaan langsung).

Dokumen ini mencatat **kenapa** sisanya kosong dan **apa** langkah berikutnya — supaya angka ini
tidak ditebak ulang di sesi lain.

## Sebab, dengan bukti

| Sebab | Paket | Bukti |
|---|---:|---|
| **Dinas PUPR, tidak ada transaksi tercatat** | **118** | 59 TA2025 + 59 TA2026; **nol baris** realisasi untuk kode RUP-nya |
| **Dinas Perhubungan, tidak ada transaksi tercatat** | **22** | dari 53 paket Dishub, 31 tertutup setelah satker ini ditarik |
| **Tender yang tidak ada di daftar lelang SPSE** | 16 | kemiripan nama tertinggi dengan 192 baris lelang hanya **0,38** |
| **Dikecualikan** (di luar prosedur pengadaan) | 19 | tidak muncul di LPSE maupun realisasi |

58 paket "satker belum ditarik" yang tercatat di versi pertama dokumen ini **sudah tertutup**:
Dishub 31, DLH 2, Kecamatan Pinang 2, Dispora 1 (total 36; selisih 22 Dishub kini masuk kategori
"tidak ada transaksi").

Bukan karena data penyedia kosong: dari 13.240 baris realisasi, **semua punya `kode_rup`**
(0 tanpa), dan sebagian kecil berpenyedia `-` — **tidak satu pun** milik paket kita.

Rincian menurut satker:

```
 59  2025  Dinas Pekerjaan Umum Dan Penataan Ruang
 59  2026  Dinas Pekerjaan Umum Dan Penataan Ruang
 12  2025  Dinas Perhubungan
 10  2026  Dinas Perhubungan
```

Pola jadwal 118 paket PUPR: 24 Maret 2026 · 15 Januari 2026 · 12 Agustus 2026 (belum/sedang
berjalan), dan 22 Februari 2025 · 19 Maret 2025 · 13 Oktober 2025 (kemungkinan dibatalkan atau
dieksekusi dengan kode RUP lain — belum bisa diuji tanpa data semua satker).

## Langkah yang sudah dijalankan: Opsi A (lima satker `D44`)

`scripts/realisasi.mjs` sekarang menerima **daftar satker dipisah koma** dan **menggabung** hasil
ke berkas sebelumnya, jadi aman dijalankan bertahap per satker.

| Satker | Kode | 2025 | 2026 | Request (20 baris/hal) |
|---|---|---:|---:|---:|
| Dinas PUPR | `1.03.2.10.0.00.01.0000` | 9.210 | 1.143 | 519 |
| Dinas Perhubungan | `2.15.0.00.0.00.16.0000` | 390 | 118 | 26 |
| Dinas Lingkungan Hidup | `2.10.2.11.0.00.27.0000` | 634 | 357 | 50 |
| Kecamatan Pinang | `7.01.2.13.1.05.40.0000` | 376 | 139 | 26 |
| Dinas Kepemudaan & Olahraga | `2.19.2.10.0.00.23.0000` | 904 | 199 | 56 |

Perintah yang dipakai (4 satker tambahan; PUPR sudah ada di berkas):

```bash
node scripts/realisasi.mjs --tahun 2025,2026 \
  --satker 2.15.0.00.0.00.16.0000,2.10.2.11.0.00.27.0000,7.01.2.13.1.05.40.0000,2.19.2.10.0.00.23.0000
```

Hasil: **3.117 baris baru ≈ 158 request ≈ 4 menit**, berkas gabungan **13.240 transaksi · 5.074 RUP**.
Angka produk: `?kontrak=ADA` **1.381 → 1.417**, `?kontrak=TANPA` **176 → 140**, penyedia unik 518.

### Opsi B — semua 190 satker D44 (belum dijalankan)

50.978 baris (37.799 + 13.179) ÷ 20 = **2.549 request ≈ 38–40 menit**. Baru dipakai kalau sisa 140
masih memuat paket yang seharusnya ada, atau untuk memastikan tidak ada RUP yang dieksekusi satker
lain di luar lima satker di atas.

### Sisa pekerjaan

1. Uji **RUP switch** untuk 118 paket PUPR: cocokkan nama + pagu ke seluruh baris realisasi D44;
   kalau ada pasangan dengan pagu sama dan nama mirip tetapi `kode_rup` berbeda, paket dieksekusi
   dengan RUP lain.
2. Untuk 22 paket Dishub dan paket berjadwal Oktober–November 2026: kemungkinan besar memang belum
   bertransaksi — biarkan kosong dan biarkan UI menyebut "belum ada rekam publik".
3. Jangan menaikkan angka di dokumen/proposal sebelum dihitung ulang dari berkas data.
