# Sisa paket tanpa penyedia — sebab dan sisa pekerjaan

> **Catatan 8 November 2026:** kondisi aktif = **2.552 paket** dan **218 paket (Rp132,34 M, 16,3%
> pagu) tanpa rekam penyedia publik**. Angka 176/140/133 di bagian riwayat adalah tahap penarikan
> data, bukan kondisi terkini.

Snapshot RUP **5 November 2026**; realisasi **6 November 2026**. Setelah LPSE (731 paket) dan **ekspor
Data INAPROC realisasi untuk seluruh satker `D44`** (1.603 paket tambahan), **2.334 dari 2.552** paket
jalan punya nama penyedia. Sisa **218 paket · Rp132,34 M** (16,3% pagu).

> Riwayat angka: 176 paket (LPSE + PUPR saja) → 140 (lima satker) → **133** (ekspor CSV seluruh
> satker) → **208** setelah populasi RUP naik ke 1.634 paket → **218** setelah rebuild prefiks `Jl.`
> menaikkan populasi ke 2.552 paket.

Dokumen ini mencatat **kenapa** sisanya kosong dan **apa** langkah berikutnya — supaya angka ini
tidak ditebak ulang di sesi lain.

## Rincian sisa 218 paket (data 6 November 2026)

| Metode di ekspor RUP | Paket |
|---|---:|
| E-Purchasing | 71 |
| Pengadaan Langsung | 42 |
| Tanpa metode di ekspor | 76 |
| Tender | 16 |
| Dikecualikan | 13 |
| **Total** | **218** |

Menurut tahun: **2025 = 120 · 2026 = 98**. Menurut satker terbesar: PUPR 146, Dishub 27, enam
kecamatan 43, Disperindagkop 1, DLH 1.

Bukan karena kolom penyedia kosong: ekspor 6 November 2026 memuat **50.836 baris** dan **tidak ada**
baris berpenyedia `-`. Ada 265 baris tanpa `kode_rup`; baris itu tidak dipakai sebagai rekam paket.

## Riwayat analisis sebab (kondisi 133 paket, 4 November 2026)

> Bagian di bawah adalah riwayat proses penarikan data. Angka 111/22/15 dan totalnya **tidak lagi
> menjumlah ke 218**; rincian aktif ada di tabel metode di atas.

| Sebab | Paket | Bukti |
|---|---:|---|
| **Tidak ada transaksi tercatat** — PUPR | **111** | kode RUP-nya **nol baris** di ekspor lengkap |
| **Tidak ada transaksi tercatat** — Dishub | **22** | idem; 31 paket Dishub lain tertutup setelah satker ditarik |
| **Tender yang tidak ada di daftar lelang SPSE** | 16 | kemiripan nama tertinggi dengan 192 baris lelang hanya **0,38** |
| **Dikecualikan** (di luar prosedur pengadaan) | 15 | tidak muncul di LPSE maupun realisasi |

Menurut metode saat itu: **e-purchasing 70 · pengadaan langsung 32 · tender 16 · dikecualikan 15**.
Menurut tahun saat itu: **2025 = 77 · 2026 = 56**.

## Kenapa paket ini bisa tidak punya transaksi

1. **Belum berjalan.** Paket TA2026 berjadwal Agustus–November 2026 belum tentu sudah bertransaksi;
   data INAPROC tersinkron 6 Nov 2026.
2. **RUP tidak dieksekusi / diganti.** Paket TA2025 yang tidak pernah bertransaksi biasanya
   dibatalkan, digeser ke tahun berikutnya, atau dieksekusi dengan kode RUP lain ("RUP switch").
3. **Di luar SPSE dan INAPROC sekaligus.** 13 paket `Dikecualikan` memang tidak lewat prosedur
   pengadaan, jadi tidak akan pernah muncul di kedua sumber.
4. **Tender tidak terdaftar** di LPSE Kota Tangerang — 16 paket, kemungkinan ditenderkan lewat
   mekanisme/instansi lain atau dibatalkan.

## Sisa pekerjaan

1. **Uji RUP switch** untuk 146 paket PUPR: cocokkan nama + pagu ke seluruh 50.836 baris; kalau ada
   pasangan dengan pagu sama dan nama mirip tetapi `kode_rup` berbeda, paket itu dieksekusi dengan
   RUP lain. Ini satu-satunya cara menaikkan angka tanpa data baru.
2. **Biarkan kosong** paket berjadwal Agustus–November 2026 dan paket `Dikecualikan`; UI sudah
   menyebutkan "belum ada rekam publik".
3. **Jangan kejar SIKaP/e-katalog** untuk sisa ini: `sikap.inaproc.id` (`Disallow: /`) dan
   `katalog.inaproc.id` (`Disallow: /api/`) bukan target pengambilan data.

## Cara menarik ulang

```bash
node scripts/realisasi.mjs --mode csv                     # 4 request/tahun, ±12 detik, seluruh satker D44
node scripts/realisasi.mjs --mode table --satker <kode>   # cadangan per satker, 20 baris/halaman
npm run build                                             # lalu cek /api/packages?kontrak=ADA
```

Angka acuan setelah penarikan: `?kontrak=ADA` **2.334** · `?kontrak=TANPA` **218** · penyedia unik
**633**.
